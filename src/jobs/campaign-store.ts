import { randomUUID } from 'node:crypto';
import { getPlatformConfig, setPlatformConfig } from '../services/firestore';
import type { CampaignAudienceType } from '../line/campaigns';

export type CampaignStatus = 'queued' | 'sending' | 'sent' | 'partial' | 'failed';

export type CampaignRecord = {
  id: string;
  audienceType: CampaignAudienceType;
  channelId: string;
  text: string;
  status: CampaignStatus;
  count: number;
  sentCount: number;
  actorUserId: string;
  idempotencyKey?: string;
  delivery: 'multicast' | 'broadcast';
  language?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

const KEY = 'campaignsV1';
const MAX = 50;

type Store = { items: CampaignRecord[] };

const load = async (): Promise<CampaignRecord[]> => {
  const stored = await getPlatformConfig<Store>(KEY);
  return Array.isArray(stored?.items) ? stored.items : [];
};

const save = async (items: CampaignRecord[]): Promise<void> => {
  await setPlatformConfig(KEY, { items: items.slice(0, MAX) } as unknown as Record<string, unknown>);
};

export const listCampaigns = async (limit = 50): Promise<CampaignRecord[]> => {
  const items = await load();
  return items.slice(0, Math.min(50, Math.max(1, limit)));
};

export const getCampaign = async (id: string): Promise<CampaignRecord | null> => {
  return (await load()).find(item => item.id === id) || null;
};

export const findCampaignByIdempotencyKey = async (key: string): Promise<CampaignRecord | null> => {
  if (!key.trim()) return null;
  return (await load()).find(item => item.idempotencyKey === key) || null;
};

export const createQueuedCampaign = async (input: Omit<CampaignRecord, 'id' | 'status' | 'sentCount' | 'createdAt' | 'updatedAt' | 'error'>): Promise<CampaignRecord> => {
  const now = new Date().toISOString();
  const record: CampaignRecord = {
    ...input,
    id: randomUUID(),
    status: 'queued',
    sentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const items = [record, ...(await load())].slice(0, MAX);
  await save(items);
  return record;
};

export const updateCampaign = async (id: string, patch: Partial<CampaignRecord>): Promise<CampaignRecord | null> => {
  const items = await load();
  const index = items.findIndex(item => item.id === id);
  if (index < 0) return null;
  const next = { ...items[index], ...patch, id, updatedAt: new Date().toISOString() };
  items[index] = next;
  await save(items);
  return next;
};
