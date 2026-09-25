# Audit Trail — Archive & Rotation Policy

## What gets logged

Every privileged/mutating action goes through `recordAuditEvent()`
(`src/services/firestore.ts`) into the `auditLog` Firestore collection:
`role_grant`, `role_revoke`, `user_create/update/delete`,
`service_create/update/delete`, `channel_config_update`, `audit_rotate`,
`secrets_update`, `secret_reveal_*`, `admin_session_bind`, and `bootstrap_complete`.
Each entry records the action, outcome (`success`/`failure`), acting user, LINE
channel, target id, and a free-text **detail that must never contain secret
values**, timestamped in UTC ISO-8601.

`GET /ops/audit-log` and `GET /admin/api/audit-log` (ops) accept bounded filters
for `action`, `outcome`, `actorUserId`, `channelId`, `from`, and `to`, plus a
`limit` capped at 200 and an opaque `cursor`. Those ops views **omit**
`secret_reveal_*` rows. Super admin reads unmask metadata only at
`GET /admin/api/audit-log/reveals` (actor LINE id, key **name**, outcome,
requestId, time — never the secret). GraphQL `auditLog` also strips
`secret_reveal_*`. CLI: `cns audit --actor <LINE userId>`.

Results include the optional `requestId` correlation field and a `nextCursor`
when another page is available. Send `nextCursor` back as `cursor` to continue
in descending event order. The same correlation field is retained in BigQuery
during rotation. Invalid dates, unsupported outcomes, and invalid cursors are
ignored rather than causing an unbounded or failing query.

Background jobs generate an execution ID at startup. Audit rotation stores
that ID as its request correlation, and daily-report/segmentation lifecycle
logs include it for operational tracing.

Logging is fire-and-forget: a Firestore write failure is warned to stdout,
never blocks or fails the command that triggered it. The trail is a
best-effort record, not a transactional ledger.

## Two-tier storage

| Tier | Store | Retention | Purpose |
|---|---|---|---|
| Hot | Firestore `auditLog` | `AUDIT_RETENTION_DAYS` (default **30**) | Fast reads for `/ops/audit-log`, Cloudnex Connect Admin Logs, and `ADMIN AUDIT ROTATE` |
| Cold | BigQuery `ops_archive.audit_log` | Indefinite | Full history, day-partitioned on `createdAt`, queryable with SQL |

Firestore stays small and fast on purpose — it's not meant as a permanent
archive. BigQuery is the permanent record.

Host app logs (pino JSON, secrets redacted) use Docker `json-file` plus
[deploy/hostinger/logrotate-cloudnex-connect.conf](../deploy/hostinger/logrotate-cloudnex-connect.conf)
(hourly + daily gzip, 30-day retain). No in-process Node cron.

## Overlay key rotation

`SECRETS_ENCRYPTION_KEY` encrypts `runtimeSecretsV1`. To rotate: set the new
key in host env, re-enter overlay values via Admin PUT while unlocked (or
decrypt with the old key offline and persist a new blob). Never write plaintext
overlay JSON or the encryption key into audit `detail` or pino.

## Rotation mechanics (`src/services/audit-archive.ts`)

On each run:

1. Compute `cutoff = now - AUDIT_RETENTION_DAYS`.
2. Fetch up to `AUDIT_ROTATE_BATCH_SIZE` (default 500, Firestore's batch-write
   cap) of the oldest events at/before the cutoff.
3. Insert that page into BigQuery (auto-creates the dataset/table on first
   use).
4. Only after the insert succeeds, delete that exact page from Firestore.
5. Repeat, up to `AUDIT_ROTATE_MAX_BATCHES` (default 20) pages per run, so one
   invocation can't run unbounded against a large backlog — a leftover
   backlog is simply picked up by the next run.

**Fail-safe by construction:** nothing is ever deleted from Firestore unless
it was just durably archived. If BigQuery is unreachable, misconfigured, or
`GOOGLE_CLOUD_PROJECT` is unset, the job archives and deletes nothing and
reports why — it never trades data loss for a smaller collection. A
duplicate BigQuery row from a retried page is harmless (the table is
append-only and not deduplicated on read); a lost Firestore row is not, so
every failure mode is biased toward "try again next run" over "delete
anyway."

## Configuration

Set in `.env` (see `.env.example`):

| Var | Default | Meaning |
|---|---|---|
| `AUDIT_RETENTION_DAYS` | `30` | Age at which an event becomes eligible for archive+delete |
| `AUDIT_ARCHIVE_ENABLED` | `true` | Operator kill-switch — `false` pauses rotation entirely without touching infra config |
| `AUDIT_ARCHIVE_DATASET` | `ops_archive` | BigQuery dataset for the cold copy |
| `AUDIT_ARCHIVE_TABLE` | `audit_log` | BigQuery table for the cold copy |
| `AUDIT_ROTATE_BATCH_SIZE` | `500` | Rows per archive+delete page (capped at Firestore's 500-write batch limit) |
| `AUDIT_ROTATE_MAX_BATCHES` | `20` | Pages per single run (10,000 events at the default batch size) |

## Triggering a rotation

Three equivalent entry points, all calling the same
`runAuditRotationJob()`:

- **Scheduled (recommended for production):** an external scheduler hits the
  ops endpoint on a cadence (e.g. daily). With Cloud Scheduler:

  ```
  gcloud scheduler jobs create http audit-log-rotate \
    --schedule="0 3 * * *" \
    --uri="https://<host>/ops/audit-log/rotate" \
    --http-method=POST \
    --headers="Authorization=Bearer <OPS_API_TOKEN>"
  ```

  A plain crontab entry works the same way on any host. Staging example:
  [deploy/hostinger/crontab.example](../deploy/hostinger/crontab.example)
  (`0 * * * *` logrotate, `0 3 * * *` audit rotate).

  `0 3 * * * curl -fsS -X POST -H "Authorization: Bearer $OPS_API_TOKEN" https://<host>/ops/audit-log/rotate`

- **From LINE, by an admin:** `ADMIN AUDIT ROTATE`
- **From an operator terminal:** `cns rotate-audit-log --yes` (needs
  `OPS_API_TOKEN`; see `src/cli/index.ts`)
- **From an MCP-connected agent:** the `rotate_audit_log` tool
  (`src/mcp/server.ts`), same underlying call

There is no in-process scheduler (setInterval/cron) — the app doesn't assume
it's the only running instance, so triggering is left to infrastructure
(Cloud Scheduler, a crontab, CI) that can guarantee "run once daily"
regardless of how many app instances are up.

## Querying the archive

```sql
SELECT *
FROM `<project>.ops_archive.audit_log`
WHERE actorUserId = 'Uxxxxxxxx...'
ORDER BY createdAt DESC
LIMIT 100;
```

## Changing the policy

To keep more (or less) in the hot tier, change `AUDIT_RETENTION_DAYS` and
redeploy — no data migration needed, the next rotation run simply uses the
new cutoff. To pause rotation, set `AUDIT_ARCHIVE_ENABLED=false`. To stop
archiving to BigQuery entirely, don't set `GOOGLE_CLOUD_PROJECT` — rotation
will report `bigquery_unavailable` and leave Firestore untouched
indefinitely (i.e. the safe default is "keep everything" if cold storage
isn't set up).
