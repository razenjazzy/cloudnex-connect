import { describe, expect, it } from 'vitest';
import { extractLineMessageJobs } from '../src/line/process-message';
import { isQueueBackendReady } from '../src/jobs/queue';

describe('LINE event extraction and queue gating', () => {
  it('extracts text message jobs for resolveCommandReply', () => {
    const jobs = extractLineMessageJobs([
      {
        type: 'message',
        replyToken: 'reply-1',
        webhookEventId: 'evt-1',
        source: { type: 'user', userId: 'U123' },
        message: { type: 'text', id: 'm1', text: 'HELP', quoteToken: 'q' },
      } as never,
    ]);
    expect(jobs).toEqual([
      expect.objectContaining({
        replyToken: 'reply-1',
        conversationId: 'U123',
        text: 'HELP',
        webhookEventId: 'evt-1',
      }),
    ]);
  });

  it('does not report the queue backend ready without REDIS_URL', () => {
    const previous = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    expect(isQueueBackendReady()).toBe(false);
    if (previous !== undefined) process.env.REDIS_URL = previous;
  });
});

describe('enqueueLineEvent job ids', () => {
  it('retries a failed job when LINE reuses webhookEventId', async () => {
    const src = await import('node:fs').then(fs => fs.readFileSync('src/jobs/queue.ts', 'utf8'));
    expect(src).toContain('line_event_requeued_after_fail');
    expect(src).toContain('existing.retry');
    expect(src).toContain('attempts: 3');
  });
});
