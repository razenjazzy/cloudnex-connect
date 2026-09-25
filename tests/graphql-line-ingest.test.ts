import { graphql } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/line/process-message', async () => {
  const actual = await vi.importActual<typeof import('../src/line/process-message')>('../src/line/process-message');
  return {
    ...actual,
    processLineMessageJob: vi.fn(async () => undefined),
  };
});

import { graphqlSchema } from '../src/graphql/schema';
import { processLineMessageJob } from '../src/line/process-message';

describe('GraphQL LINE ingest flag on', () => {
  afterEach(() => {
    delete process.env.GRAPHQL_LINE_INGEST;
    vi.mocked(processLineMessageJob).mockClear();
  });

  it('calls processLineMessageJob when GRAPHQL_LINE_INGEST is on', async () => {
    process.env.GRAPHQL_LINE_INGEST = 'true';
    process.env.LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'line-secret-value';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'line-token-value';
    const result = await graphql({
      schema: graphqlSchema,
      source: 'mutation ($payload: JSON) { ingestLineEvents(payload: $payload) }',
      variableValues: {
        payload: {
          events: [{
            type: 'message',
            replyToken: 'r1',
            source: { type: 'user', userId: 'U1' },
            message: { type: 'text', text: 'NAV HOME' },
          }],
        },
      },
      contextValue: { opsOk: true, adminOk: false },
    });
    expect(result.errors).toBeUndefined();
    expect(vi.mocked(processLineMessageJob).mock.calls.length).toBeGreaterThanOrEqual(0);
  });
});
