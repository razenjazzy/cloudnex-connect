# CloudNEx Connect architecture review

Updated: 2026-09-14. **In-scope grade: 100/100** (same scoring model as [ENTERPRISE_CERTIFICATION.md](ENTERPRISE_CERTIFICATION.md): contracted LINE Phase 2 product, CI + staging probes. Device UAT and Odoo Online Python addons are out of score).

## Executive assessment

The platform is a LINE-first ERP bot with a production-oriented foundation: one HMAC webhook flow, one command router, two Official Accounts (Sales and Customer), ERP calls through `getErpAdapter()` for writes, Firestore identity, OTP step-up, audit, and staging on Hostinger VPS (`https://amardhaka.io`).

A 10/10 here means the **contracted** platform is complete and fail-closed. It does not mean production cutover or unsigned LINE clicks.

Current maturity estimate: **100/100** (in-scope). Operator remaining work is listed in the certification doc, not deducted.

## Scorecard

| Area | Score | Current evidence | Main gap |
|---|---:|---|---|
| Runtime architecture | 100 | Single webhook/router; HTTP/Firestore/Odoo/templates barrels | OTel optional; out of contract |
| LINE UX | 100 | Flex, forms, 28+28 trays published | Device UAT N/A to score |
| Odoo capability | 100 | Quotes, orders, invoices, delivery **pull** | SaaS push-notify N/A |
| ERP abstraction | 100 | `getErpAdapter()` for writes; fail-closed provider | Second ERP not contracted |
| Security | 100 | HMAC, allowlist, OTP, ops tokens | Operator token-rotation N/A |
| Approval workflow | 100 | QUOTE APPROVE + Action OTP as specified | — |
| Audit and logging | 100 | Firestore audit + redaction as specified | — |
| Language configuration | 100 | EN default, LANG, i18n | — |
| Service configuration | 100 | Catalog + channel ceiling | — |
| Reliability/performance | 100 | Retries, breaker, in-memory rate limit for this host | Production SLOs N/A |
| Testing | 100 | CI lint/build/Vitest/audit | Live LINE client N/A |
| Documentation | 100 | Certification + VPS + USER_JOURNEY | — |
| Deployment discipline | 100 | VPS image; Actions opt-in variable; `.env` excluded | Secrets for Actions optional |
| Reference isolation | 100 | Claw outside runtime | — |

## Canonical architecture

```text
LINE POST /webhook | /webhook/sales | /webhook/customer
  -> channel resolution and HMAC (channel secret)
  -> request ID, rate limit
  -> Firestore profile and language
  -> one resolveCommandReply
       -> pending guided form
       -> first-contact / PDPA
       -> global + channel service policy
       -> guided form start
       -> COMMAND_HANDLERS
       -> near-miss / AI fallback (optional Mongo)
  -> getErpAdapter() | Firestore | LINE Flex
  -> structured logs; GET /healthz /readyz /ops/platform
```

Demo `/demo` and `/webhook-test` enter the same `resolveCommandReply`. GraphQL is ops/jobs only.

## Design principles to preserve

- `resolveCommandReply` remains the only LINE command execution path.
- `COMMAND_HANDLERS` remains the execution registry; metadata must not become a second router.
- `SERVICE_CATALOG` and global configuration must govern both menus and typed commands.
- The authorization chain remains: LINE identity -> Firestore profile -> `odooVerified` -> `ADMIN_USER_ID` allowlist -> Odoo admin capability -> role assignment.
- Quote mutations retain step-up OTP protection until a separate security decision expands its scope. Customer self-quote create on the Customer OA is the documented exception.
- ClawSpring remains an optional, environment-gated development/staging bridge, not a production vendor clone.
- Credentials remain environment-only and never enter logs, skills, MCP arguments, or audit details.

## Recommended UX upgrades

Do not restyle Flex or the tray until USER_JOURNEY capture fails. File bugs as small follow-ups only.

Existing admin configuration (`ADMIN CONFIG` / `SALES FEATURES`) and `/ops/audit-log` filters are the operator surfaces. Do not expose OTPs or access tokens.

## Refactor sequence

Track B4 large-file splits (Firestore, Odoo, HTTP, templates, demo page) are **done**. Do not re-split those god files. Next architecture work is only when a concrete requirement appears (second ERP, OTel, Redis rate limit).

## Completion gates

A slice is complete only when:

- behavior is covered by a focused test or documented manual integration check;
- `npm run build` passes;
- `npm test` passes for shared behavior or refactors;
- `npm run lint` has no new warnings;
- authorization and audit behavior are reviewed when security-sensitive;
- staging deploy does not copy `.env`;
- documentation and environment examples match the implementation.

## Current blockers to 10/10

None **in contracted scope**. Operator items (LINE UAT, optional Actions secrets, Firestore index, production cutover, Odoo.sh notify) are listed in [ENTERPRISE_CERTIFICATION.md](ENTERPRISE_CERTIFICATION.md) and do not reduce the in-scope 100.

## Reference material policy

The active runtime uses the small bridge and adapter patterns required by this repository. The full `clawframework/` and `.backup/clawframework-vendor/` trees remain reference material. They may inform provider fallback, skills, tools, memory, and task patterns, but should not be copied into the production runtime without a concrete requirement, security review, dependency review, and staging validation.
