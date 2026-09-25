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

  it('GraphQL ingest is off by default and schema has no signature ingest', () => {
    delete process.env.GRAPHQL_LINE_INGEST;
    expect(isGraphqlLineIngestEnabled()).toBe(false);
    expect(graphqlSchema.getMutationType()?.getFields().ingestLineEvents).toBeTruthy();
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
    expect(spa).toContain('disabled={settings?.queueReady === false}');
    expect(spa).toContain('/admin/api/session/me');
  });
});
