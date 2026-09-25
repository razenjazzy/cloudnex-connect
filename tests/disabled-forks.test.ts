import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { maybeWriteMongoUser } from '../src/services/mongo-users';
import { isGraphqlLineIngestEnabled } from '../src/http/optional-flags';
import { graphqlSchema } from '../src/graphql/schema';

describe('disabled forks', () => {
  it('gates /webhook-alt behind LINE_SECOND_WEBHOOK and reuses handleWebhook', () => {
    const src = readFileSync('src/http/webhook-routes.ts', 'utf8');
    expect(src).toContain('isLineSecondWebhookEnabled');
    expect(src).toContain('...handleWebhook');
    expect(src).toContain("app.post('/webhook-legacy'");
  });

  it('GraphQL ingest runs processLineMessageJob when the flag is on', () => {
    const src = readFileSync('src/graphql/schema.ts', 'utf8');
    expect(src).toContain('processLineMessageJob');
    expect(src).toContain('isGraphqlLineIngestEnabled');
  });

  it('skips Mongo user writes when MONGO_USERS is off', async () => {
    const prev = process.env.MONGO_USERS;
    delete process.env.MONGO_USERS;
    expect(await maybeWriteMongoUser('U1', { role: 'user' })).toEqual({ skipped: true });
    process.env.MONGO_USERS = prev;
  });

  it('rejects GraphQL ingest without ops and returns disabled when the flag is off', async () => {
    delete process.env.GRAPHQL_LINE_INGEST;
    const resolve = graphqlSchema.getMutationType()?.getFields().ingestLineEvents.resolve;
    await expect(resolve?.({}, { payload: { events: [] } }, { opsOk: false, adminOk: false }, {} as never)).rejects.toThrow(/Unauthorized/);
    const off = await resolve?.({}, { payload: { events: [] } }, { opsOk: true, adminOk: false }, {} as never);
    expect(off).toMatchObject({ ok: false, disabled: true });
    expect(isGraphqlLineIngestEnabled()).toBe(false);
    const src = readFileSync('src/graphql/schema.ts', 'utf8');
    expect(src).not.toMatch(/X-Line-Signature/);
  });

  it('does not expose GraphQL sendCampaign (HTTP super-admin send only)', () => {
    expect(graphqlSchema.getMutationType()?.getFields().sendCampaign).toBeUndefined();
    expect(graphqlSchema.getMutationType()?.getFields().previewCampaign).toBeTruthy();
  });

  it('Admin Advanced controls are disabled', () => {
    const spa = readFileSync('admin/src/App.tsx', 'utf8');
    expect(spa).toContain("page === 'advanced'");
    expect(spa).toContain('disabled');
    expect(spa).toContain('disabled={campClass === \'customers_promo\'}');
    expect(spa).toContain('disabled={!actor || settings?.queueReady === false}');
    expect(spa).toContain('CopyField');
    expect(spa).toContain("href: '/admin/language'");
    expect(spa).toContain("href: '/admin/commands'");
    expect(spa).toContain("label: 'Settings'");
  });
});
