import { idleHomeSeconds } from '../line/idle-home';

export type ChannelBucket = 'sales' | 'customer' | 'other';
export type ChannelCounts = { sales: number; customer: number; other: number };

const emptyCounts = (): ChannelCounts => ({ sales: 0, customer: 0, other: 0 });

const HOUR_MS = 3_600_000;
const HOUR_SLOTS = 12;

type HourBucket = ChannelCounts & { t: number };

const active = new Map<string, { channel: ChannelBucket; at: number }>();
let messages = emptyCounts();
let hourly: HourBucket[] = [];

export const bucketChannelId = (channelId: string): ChannelBucket => {
  const name = (channelId || '').toLowerCase();
  if (name === 'sales') return 'sales';
  if (name === 'customer' || name === 'default') return 'customer';
  return 'other';
};

const totalOf = (counts: ChannelCounts): number => counts.sales + counts.customer + counts.other;

const pruneActive = (now: number): void => {
  const windowMs = idleHomeSeconds() * 1000;
  for (const [userId, row] of active.entries()) {
    if (now - row.at >= windowMs) active.delete(userId);
  }
};

const bumpHour = (now: number, channel: ChannelBucket): void => {
  const t = Math.floor(now / HOUR_MS);
  const last = hourly[hourly.length - 1];
  if (!last || last.t !== t) {
    hourly.push({ t, ...emptyCounts() });
    if (hourly.length > HOUR_SLOTS) hourly = hourly.slice(-HOUR_SLOTS);
  }
  hourly[hourly.length - 1][channel] += 1;
};

export const resetChannelTrafficForTests = (): void => {
  active.clear();
  messages = emptyCounts();
  hourly = [];
};

export const recordChannelInbound = (channelId: string, userId: string, now = Date.now()): void => {
  const id = userId.trim();
  if (!id) return;
  const channel = bucketChannelId(channelId);
  pruneActive(now);
  active.set(id, { channel, at: now });
  messages[channel] += 1;
  bumpHour(now, channel);
};

export const snapshotChannelTraffic = (now = Date.now()) => {
  pruneActive(now);
  const activeUsers = emptyCounts();
  for (const row of active.values()) activeUsers[row.channel] += 1;
  const startT = Math.floor(now / HOUR_MS) - (HOUR_SLOTS - 1);
  const byHour = new Map(hourly.map(row => [row.t, row]));
  const hourlySeries = Array.from({ length: HOUR_SLOTS }, (_, i) => {
    const t = startT + i;
    const row = byHour.get(t) || { t, ...emptyCounts() };
    return {
      hour: new Date(t * HOUR_MS).toISOString().slice(11, 16),
      sales: row.sales,
      customer: row.customer,
      other: row.other,
      total: totalOf(row),
    };
  });
  return {
    windowSeconds: idleHomeSeconds(),
    activeUsers: { ...activeUsers, total: totalOf(activeUsers) },
    messages: { ...messages, total: totalOf(messages) },
    hourly: hourlySeries,
  };
};
