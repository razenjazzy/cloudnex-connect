import { appLogger } from '../services/logger';

export const DEFAULT_LINE_MEDIA_MAX_BYTES = 10_485_760;

const BLOCKED_EXT = /\.(exe|svg|html|htm|js|bat|cmd|sh|msi)$/i;

export const lineMediaMaxBytes = (): number => {
  const raw = Number(process.env.LINE_MEDIA_MAX_BYTES || DEFAULT_LINE_MEDIA_MAX_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LINE_MEDIA_MAX_BYTES;
};

export const isAvScanRequired = (): boolean => /^(1|true|yes|on)$/i.test(process.env.AV_SCAN_REQUIRED || '');

export const assertInboundMediaAllowed = (input: {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}): { ok: true } | { ok: false; error: string } => {
  const name = (input.fileName || '').trim();
  if (name && BLOCKED_EXT.test(name)) return { ok: false, error: 'File type is not allowed.' };
  const mime = (input.mimeType || '').toLowerCase();
  if (mime.includes('svg') || mime.includes('javascript') || mime === 'application/x-msdownload') {
    return { ok: false, error: 'File type is not allowed.' };
  }
  const size = input.sizeBytes || 0;
  if (size > lineMediaMaxBytes()) return { ok: false, error: 'File is too large.' };
  return { ok: true };
};

export const scanBufferIfRequired = async (buffer: Buffer): Promise<{ ok: true } | { ok: false; error: string }> => {
  const url = (process.env.CLAMAV_URL || '').trim();
  if (!url) {
    if (isAvScanRequired()) return { ok: false, error: 'AV scanner is required but not configured.' };
    return { ok: true };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      if (isAvScanRequired()) return { ok: false, error: 'AV scanner unavailable.' };
      appLogger.warn('av_scan_skipped_upstream', { status: res.status });
      return { ok: true };
    }
    const body = await res.text();
    if (/infect|found|virus/i.test(body)) return { ok: false, error: 'File failed virus scan.' };
    return { ok: true };
  } catch (error) {
    if (isAvScanRequired()) return { ok: false, error: 'AV scanner unavailable.' };
    appLogger.warn('av_scan_failed', { error: String(error) });
    return { ok: true };
  }
};

/** No upload implementation yet. Setting GCS_MEDIA_BUCKET must not look like success. */
export const signedMediaUrlOrNull = (): string | null => null;
