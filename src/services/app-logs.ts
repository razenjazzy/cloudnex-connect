import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Read-only view of the consolidated VPS log archive (scripts/vps-log-archive.sh) for the Admin Logs page. */
export const APP_LOG_DIR = (): string => process.env.APP_LOG_DIR?.trim() || '/var/log/cloudnex-connect';

export type AppLogLevel = 'error' | 'warn' | 'info' | 'debug';

export type AppLogEntry = {
  time: string;
  level: AppLogLevel;
  scope?: string;
  message: string;
  requestId?: string;
  path?: string;
  statusCode?: number;
  channelId?: string;
  detail?: Record<string, unknown>;
};

export type AppLogQuery = {
  source: string;
  hours: number;
  level?: AppLogLevel;
  q?: string;
  requestId?: string;
  limit: number;
};

const LEVELS: AppLogLevel[] = ['error', 'warn', 'info', 'debug'];
const MAX_BYTES_PER_QUERY = 40 * 1024 * 1024;
const SECRETISH = /(secret|token|password|api[-_]?key|authorization|signature)/i;
const DROP_KEYS = new Set(['level', 'time', 'scope', 'message', 'requestId', 'path', 'statusCode', 'channelId', 'method', 'durationMs']);

const lineLevel = (value: unknown, fallbackText: string): AppLogLevel => {
  if (typeof value === 'string' && LEVELS.includes(value as AppLogLevel)) return value as AppLogLevel;
  if (typeof value === 'number') return value >= 50 ? 'error' : value >= 40 ? 'warn' : value >= 30 ? 'info' : 'debug';
  return /\b(error|exception|failed|fatal)\b/i.test(fallbackText) ? 'error' : /\bwarn(ing)?\b/i.test(fallbackText) ? 'warn' : 'info';
};

/** One archived line: `<docker timestamp> <pino json | plain text>`. Never returns secret-looking fields. */
export const parseLogLine = (raw: string): AppLogEntry | null => {
  const line = raw.trimEnd();
  if (!line) return null;
  const space = line.indexOf(' ');
  const stamp = space > 0 ? line.slice(0, space) : '';
  const body = /^\d{4}-\d{2}-\d{2}T/.test(stamp) ? line.slice(space + 1) : line;
  const time = /^\d{4}-\d{2}-\d{2}T/.test(stamp) ? stamp : '';
  if (body.startsWith('{')) {
    try {
      const json = JSON.parse(body) as Record<string, unknown>;
      const detail: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(json)) {
        if (DROP_KEYS.has(key) || SECRETISH.test(key)) continue;
        detail[key] = typeof value === 'string' ? value.slice(0, 300) : value;
      }
      return {
        time: typeof json.time === 'string' ? json.time : time,
        level: lineLevel(json.level, String(json.message || '')),
        scope: typeof json.scope === 'string' ? json.scope : undefined,
        message: String(json.message ?? json.msg ?? '').slice(0, 300),
        requestId: typeof json.requestId === 'string' ? json.requestId : undefined,
        path: typeof json.path === 'string' ? json.path : undefined,
        statusCode: typeof json.statusCode === 'number' ? json.statusCode : undefined,
        channelId: typeof json.channelId === 'string' ? json.channelId : undefined,
        ...(Object.keys(detail).length ? { detail } : {}),
      };
    } catch {
      // fall through: treat as plain text
    }
  }
  const access = /^([0-9a-fA-F.:]+) "([A-Z]+) (\S+) [^"]*" (\d{3}) (\d+) rt=([\d.]+)/.exec(body);
  if (access) {
    const status = Number(access[4]);
    return {
      time,
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      scope: 'nginx',
      message: 'nginx_access',
      path: access[3],
      statusCode: status,
      detail: { ip: access[1], method: access[2], bytes: Number(access[5]), seconds: Number(access[6]) },
    };
  }
  const nginxError = /\[(emerg|alert|crit|error|warn|notice|info)\]/.exec(body);
  if (nginxError) {
    const sev = nginxError[1];
    return { time, level: ['emerg', 'alert', 'crit', 'error'].includes(sev) ? 'error' : sev === 'warn' ? 'warn' : 'info', scope: 'nginx', message: body.replace(/^.*?\]\s*/, '').slice(0, 300) };
  }
  const redis = /^\d+:[CMSX] \d{2} \w{3} \d{4} [\d:.]+ ([#*.-]) (.*)$/.exec(body);
  if (redis) {
    return { time, level: redis[1] === '#' ? (/warning/i.test(redis[2]) ? 'warn' : 'error') : 'info', scope: 'redis', message: redis[2].slice(0, 300) };
  }
  return { time, level: lineLevel(undefined, body), message: body.slice(0, 300) };
};

const hourFiles = (laneDir: string, hours: number, now: number): string[] => {
  const files: string[] = [];
  const from = now - hours * 3_600_000;
  for (const day of existsSync(laneDir) ? readdirSync(laneDir) : []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const dayDir = join(laneDir, day);
    for (const file of readdirSync(dayDir)) {
      const hit = /^(\d{2})\.log(\.gz)?$/.exec(file);
      if (!hit) continue;
      const hourStart = Date.parse(`${day}T${hit[1]}:00:00Z`);
      if (Number.isFinite(hourStart) && hourStart + 3_600_000 >= from && hourStart <= now) files.push(join(dayDir, file));
    }
  }
  return files.sort();
};

export type AppLogResult = {
  source: string;
  sources: string[];
  windowHours: number;
  scannedFiles: number;
  truncated: boolean;
  summary: {
    total: number;
    byLevel: Record<AppLogLevel, number>;
    topMessages: Array<{ message: string; level: AppLogLevel; count: number }>;
    httpErrors: Array<{ path: string; statusCode: number; count: number }>;
    signatureInvalid: number;
  };
  entries: AppLogEntry[];
};

/** Source folders in the archive: staging-app, staging-redis, production-app, edge-nginx-access, ... */
export const listLogSources = (): string[] => {
  const root = APP_LOG_DIR();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^[a-z][a-z0-9-]{0,47}$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
};

export const queryAppLogs = (query: AppLogQuery, now = Date.now()): AppLogResult => {
  const laneDir = join(APP_LOG_DIR(), query.source);
  const files = hourFiles(laneDir, query.hours, now);
  const byLevel: Record<AppLogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0 };
  const messages = new Map<string, { message: string; level: AppLogLevel; count: number }>();
  const http = new Map<string, { path: string; statusCode: number; count: number }>();
  const entries: AppLogEntry[] = [];
  let bytes = 0;
  let truncated = false;
  let total = 0;
  let signatureInvalid = 0;
  const needle = query.q?.toLowerCase();

  for (const file of files) {
    const size = statSync(file).size;
    if (bytes + size > MAX_BYTES_PER_QUERY) { truncated = true; break; }
    bytes += size;
    const text = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString('utf8') : readFileSync(file, 'utf8');
    for (const raw of text.split('\n')) {
      const entry = parseLogLine(raw);
      if (!entry) continue;
      if (entry.time && Date.parse(entry.time) < now - query.hours * 3_600_000) continue;
      byLevel[entry.level] += 1;
      total += 1;
      if (entry.message === 'webhook_signature_invalid') signatureInvalid += 1;
      if (entry.level !== 'info' || (entry.statusCode && entry.statusCode >= 400)) {
        const key = `${entry.level}|${entry.message}`;
        const slot = messages.get(key) || { message: entry.message, level: entry.level, count: 0 };
        slot.count += 1;
        messages.set(key, slot);
      }
      if (entry.statusCode && entry.statusCode >= 400 && entry.path) {
        const path = entry.path.replace(/[?#].*$/, '').replace(/\/\d+(?=\/|$)/g, '/:id');
        const key = `${entry.statusCode}|${path}`;
        const slot = http.get(key) || { path, statusCode: entry.statusCode, count: 0 };
        slot.count += 1;
        http.set(key, slot);
      }
      if (query.level && entry.level !== query.level) continue;
      if (query.requestId && entry.requestId !== query.requestId) continue;
      if (needle && !JSON.stringify(entry).toLowerCase().includes(needle)) continue;
      entries.push(entry);
    }
  }
  entries.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
  return {
    source: query.source,
    sources: listLogSources(),
    windowHours: query.hours,
    scannedFiles: files.length,
    truncated,
    summary: {
      total,
      byLevel,
      topMessages: [...messages.values()].sort((a, b) => b.count - a.count).slice(0, 15),
      httpErrors: [...http.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      signatureInvalid,
    },
    entries: entries.slice(0, query.limit),
  };
};

export const parseAppLogQuery = (raw: Record<string, unknown>, defaultSource: string): AppLogQuery | { error: string } => {
  const source = typeof raw.source === 'string' && raw.source ? raw.source : defaultSource;
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(source)) return { error: 'source must be a lowercase name such as staging-app or edge-nginx-access.' };
  const hours = Math.min(168, Math.max(1, Math.trunc(Number(raw.hours) || 6)));
  const limit = Math.min(500, Math.max(10, Math.trunc(Number(raw.limit) || 100)));
  const level = typeof raw.level === 'string' && LEVELS.includes(raw.level as AppLogLevel) ? raw.level as AppLogLevel : undefined;
  const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim().slice(0, 100) : undefined;
  const requestId = typeof raw.requestId === 'string' && /^[\w-]{4,64}$/.test(raw.requestId) ? raw.requestId : undefined;
  return { source, hours, limit, level, q, requestId };
};
