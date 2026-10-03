import { appLogger } from '../services/logger';

export type LineTokenCheck = {
  ok: boolean;
  /** LINE's HTTP status for bot/info (0 when LINE was unreachable). */
  status: number;
  displayName?: string;
  basicId?: string;
  webhookEndpoint?: string;
  webhookActive?: boolean;
  error?: string;
};

const LINE_BOT_API = 'https://api.line.me/v2/bot';
const TIMEOUT_MS = 8000;

/** Read-only: asks LINE which OA this access token belongs to and where its webhook points. The token is never returned. */
export const verifyLineChannelToken = async (accessToken: string): Promise<LineTokenCheck> => {
  const headers = { Authorization: `Bearer ${accessToken}` };
  try {
    const info = await fetch(`${LINE_BOT_API}/info`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!info.ok) {
      const body = await info.json().catch(() => ({})) as { message?: string };
      return { ok: false, status: info.status, error: body.message || `LINE returned ${info.status}` };
    }
    const bot = await info.json() as { displayName?: string; basicId?: string };
    const hook = await fetch(`${LINE_BOT_API}/channel/webhook/endpoint`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const endpoint = hook.ok ? await hook.json() as { endpoint?: string; active?: boolean } : {};
    return {
      ok: true,
      status: info.status,
      displayName: bot.displayName,
      basicId: bot.basicId,
      webhookEndpoint: endpoint.endpoint,
      webhookActive: endpoint.active,
    };
  } catch (error) {
    appLogger.warn('line_token_verify_unreachable', { error: String(error) });
    return { ok: false, status: 0, error: 'Could not reach LINE to verify the token.' };
  }
};

export const normalizeBasicId = (value?: string): string => (value || '').trim().replace(/^@/, '').toLowerCase();
