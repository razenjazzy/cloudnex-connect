import { describe, expect, it } from 'vitest';
import { extractLineMessageJobs } from '../src/line/process-message';
import { assertInboundMediaAllowed, DEFAULT_LINE_MEDIA_MAX_BYTES, signedMediaUrlOrNull } from '../src/line/media';
import { scanBufferIfRequired } from '../src/line/media';

describe('quoted and media extract', () => {
  it('keeps quotedMessage text and id', () => {
    const jobs = extractLineMessageJobs([
      {
        type: 'message',
        replyToken: 'r1',
        webhookEventId: 'e1',
        source: { type: 'user', userId: 'U1' },
        message: {
          type: 'text',
          id: 'm1',
          text: 'follow up',
          quotedMessageId: 'qm1',
          quotedMessage: { type: 'text', text: 'original card' },
        },
      } as never,
    ]);
    expect(jobs[0]).toEqual(expect.objectContaining({
      text: 'follow up',
      quotedMessageId: 'qm1',
      quotedText: 'original card',
    }));
  });

  it('extracts image and file ids', () => {
    const jobs = extractLineMessageJobs([
      {
        type: 'message',
        replyToken: 'r2',
        source: { type: 'user', userId: 'U1' },
        message: { type: 'image', id: 'img1' },
      } as never,
      {
        type: 'message',
        replyToken: 'r3',
        source: { type: 'user', userId: 'U1' },
        message: { type: 'file', id: 'f1', fileName: 'quote.pdf' },
      } as never,
    ]);
    expect(jobs.map(j => ({ imageMessageId: j.imageMessageId, fileMessageId: j.fileMessageId, fileName: j.fileName }))).toEqual([
      { imageMessageId: 'img1', fileMessageId: undefined, fileName: undefined },
      { imageMessageId: undefined, fileMessageId: 'f1', fileName: 'quote.pdf' },
    ]);
  });

  it('skips group files when LINE_GROUP_ROOMS is off', () => {
    const prev = process.env.LINE_GROUP_ROOMS;
    delete process.env.LINE_GROUP_ROOMS;
    const jobs = extractLineMessageJobs([
      {
        type: 'message',
        replyToken: 'r4',
        source: { type: 'group', groupId: 'G1' },
        message: { type: 'image', id: 'img2' },
      } as never,
    ]);
    expect(jobs).toEqual([]);
    process.env.LINE_GROUP_ROOMS = prev;
  });
});

describe('media allowlist', () => {
  it('rejects exe, svg, and oversize', () => {
    expect(assertInboundMediaAllowed({ fileName: 'a.exe' }).ok).toBe(false);
    expect(assertInboundMediaAllowed({ fileName: 'x.svg' }).ok).toBe(false);
    expect(assertInboundMediaAllowed({ sizeBytes: DEFAULT_LINE_MEDIA_MAX_BYTES + 1 }).ok).toBe(false);
    expect(assertInboundMediaAllowed({ fileName: 'a.pdf', sizeBytes: 100 }).ok).toBe(true);
  });

  it('does not treat GCS_MEDIA_BUCKET as a stored file', () => {
    const prev = process.env.GCS_MEDIA_BUCKET;
    process.env.GCS_MEDIA_BUCKET = 'some-bucket';
    expect(signedMediaUrlOrNull()).toBeNull();
    process.env.GCS_MEDIA_BUCKET = prev;
  });

  it('rejects infected mock when AV required', async () => {
    const prevUrl = process.env.CLAMAV_URL;
    const prevReq = process.env.AV_SCAN_REQUIRED;
    process.env.CLAMAV_URL = 'http://127.0.0.1:9/scan';
    process.env.AV_SCAN_REQUIRED = 'true';
    const result = await scanBufferIfRequired(Buffer.from('x'));
    expect(result.ok).toBe(false);
    process.env.CLAMAV_URL = prevUrl;
    process.env.AV_SCAN_REQUIRED = prevReq;
  });
});
