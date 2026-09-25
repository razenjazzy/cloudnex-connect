import { createHmac, createSign, timingSafeEqual } from 'node:crypto';
import { appLogger } from '../services/logger';

export const DEFAULT_LINE_MEDIA_MAX_BYTES = 10_485_760;
const MEDIA_TTL_SEC = 15 * 60;

const BLOCKED_EXT = /\.(exe|svg|html|htm|js|bat|cmd|sh|msi)$/i;

export const lineMediaMaxBytes = (): number => {
  const raw = Number(process.env.LINE_MEDIA_MAX_BYTES || DEFAULT_LINE_MEDIA_MAX_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LINE_MEDIA_MAX_BYTES;
};

export const isAvScanRequired = (): boolean => /^(1|true|yes|on)$/i.test(process.env.AV_SCAN_REQUIRED || '');

export const gcsMediaBucket = (): string => (process.env.GCS_MEDIA_BUCKET || '').trim();

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

const mediaHmacSecret = (): string =>
  process.env.SECRETS_ENCRYPTION_KEY?.trim()
  || process.env.OPS_API_TOKEN?.trim()
  || '';

const b64url = (value: string): string => Buffer.from(value).toString('base64url');

const signJwtRs256 = (payload: Record<string, unknown>, privateKey: string): string => {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${body}`);
  return `${header}.${body}.${sign.sign(privateKey, 'base64url')}`;
};

const gcsAccessToken = async (): Promise<string | null> => {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (raw) {
    try {
      const creds = JSON.parse(raw) as { client_email?: string; private_key?: string };
      if (!creds.client_email || !creds.private_key) return null;
      const now = Math.floor(Date.now() / 1000);
      const jwt = signJwtRs256({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/devstorage.read_write',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }, creds.private_key);
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });
      if (!res.ok) return null;
      const body = await res.json() as { access_token?: string };
      return body.access_token || null;
    } catch (error) {
      appLogger.warn('gcs_jwt_failed', { error: String(error) });
      return null;
    }
  }
  try {
    const res = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' },
    });
    if (!res.ok) return null;
    const body = await res.json() as { access_token?: string };
    return body.access_token || null;
  } catch {
    return null;
  }
};

export const encodeMediaToken = (objectName: string, exp = Math.floor(Date.now() / 1000) + MEDIA_TTL_SEC): string | null => {
  const secret = mediaHmacSecret();
  if (!secret) return null;
  const payload = `${exp}.${objectName}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${exp}.${b64url(objectName)}.${sig}`;
};

export const decodeMediaToken = (token: string): { objectName: string } | null => {
  const secret = mediaHmacSecret();
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [expRaw, objectB64, sig] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  let objectName = '';
  try {
    objectName = Buffer.from(objectB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!objectName.startsWith('line-inbound/')) return null;
  const expected = createHmac('sha256', secret).update(`${exp}.${objectName}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { objectName };
};

export const fetchGcsObject = async (objectName: string): Promise<{ buffer: Buffer; contentType: string } | null> => {
  const bucket = gcsMediaBucket();
  const token = await gcsAccessToken();
  if (!bucket || !token) return null;
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
};

export type StoreInboundMediaInput = {
  buffer: Buffer;
  fileName?: string;
  kind: 'image' | 'video' | 'file';
  conversationId: string;
  channelId: string;
  mediaId: string;
};

/** Uploads to GCS and returns a short HTTPS URL. Null unless upload actually succeeded. */
export const storeInboundMedia = async (input: StoreInboundMediaInput): Promise<string | null> => {
  const bucket = gcsMediaBucket();
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!bucket || !base.startsWith('https://')) return null;
  const tokenAuth = await gcsAccessToken();
  if (!tokenAuth) return null;
  const safeName = (input.fileName || input.kind).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  const objectName = `line-inbound/${input.channelId}/${input.conversationId}/${input.mediaId}-${safeName}`;
  const contentType = input.kind === 'image' ? 'image/jpeg' : input.kind === 'video' ? 'video/mp4' : 'application/octet-stream';
  const upload = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tokenAuth}`,
        'content-type': contentType,
      },
      body: new Uint8Array(input.buffer),
    },
  );
  if (!upload.ok) {
    appLogger.warn('gcs_media_upload_failed', { status: upload.status, bucket });
    return null;
  }
  const token = encodeMediaToken(objectName);
  if (!token) return null;
  return `${base}/media/${token}`;
};

/** Sync helper for tests: bucket env alone is not a stored file. */
export const signedMediaUrlOrNull = (): string | null => null;
