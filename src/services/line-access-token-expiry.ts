const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

/** Unix exp from a JWT access token, or null for opaque/long-lived tokens. Never logs the token. */
export const jwtExpiryUnix = (token: string): number | null => {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
};

export const lineAccessTokenExpiryWarnings = (
  env: NodeJS.ProcessEnv = process.env,
  nowUnix = Math.floor(Date.now() / 1000),
): string[] => {
  const warnings: string[] = [];
  const pairs: Array<[string, string]> = [
    ['LINE_CHANNEL_ACCESS_TOKEN', env.LINE_CHANNEL_ACCESS_TOKEN || ''],
    ['LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN', env.LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN || ''],
  ];
  for (const [name, token] of pairs) {
    if (!token.trim()) continue;
    const exp = jwtExpiryUnix(token);
    if (exp === null) continue;
    const remaining = exp - nowUnix;
    if (remaining <= 0) {
      warnings.push(`${name} JWT is expired; LINE outbound will 401 until re-issued.`);
      continue;
    }
    if (remaining <= SEVEN_DAYS_S) {
      const days = Math.max(1, Math.ceil(remaining / 86400));
      warnings.push(`${name} JWT expires in ${days} day(s); re-issue before outbound LINE calls fail.`);
    }
  }
  return warnings;
};
