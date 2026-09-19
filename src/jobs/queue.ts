import { Queue } from 'bullmq';
import { bullmqPrefix } from '../http/env';
import { appLogger } from '../services/logger';

export type LineEventJob = {
  channelId: string;
  conversationId: string;
  replyToken: string;
  webhookEventId?: string;
  text?: string;
  audioMessageId?: string;
  sourceType?: string;
  receivedAt: number;
  requestId?: string;
  baseUrl: string;
  isGroupContext?: boolean;
};

export type OpsJobName = 'daily-report' | 'segmentation' | 'seed-odoo' | 'audit-rotate';

export type OpsJobPayload = {
  name: OpsJobName;
  actor?: string;
};

type RedisConnection = { url: string; maxRetriesPerRequest: null };

let lineQueue: Queue | null = null;
let opsQueue: Queue | null = null;

const redisUrl = (): string => (process.env.REDIS_URL || '').trim();

export const isQueueBackendReady = (): boolean => Boolean(redisUrl());

export const bullmqConnection = (): RedisConnection => {
  const url = redisUrl();
  if (!url) throw new Error('REDIS_URL is required for BullMQ');
  return { url, maxRetriesPerRequest: null };
};

export const getLineEventQueue = (): Queue => {
  if (!lineQueue) {
    lineQueue = new Queue('line-events', {
      connection: bullmqConnection(),
      prefix: bullmqPrefix,
    });
  }
  return lineQueue;
};

export const getOpsJobQueue = (): Queue => {
  if (!opsQueue) {
    opsQueue = new Queue('ops-jobs', {
      connection: bullmqConnection(),
      prefix: bullmqPrefix,
    });
  }
  return opsQueue;
};

export const enqueueLineEvent = async (job: LineEventJob): Promise<string> => {
  const queue = getLineEventQueue();
  const jobId = job.webhookEventId;
  const opts = {
    jobId,
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
  };
  try {
    const queued = await queue.add('line-event', job, opts);
    return String(queued.id);
  } catch (error) {
    if (!jobId) throw error;
    const existing = await queue.getJob(jobId);
    if (!existing) throw error;
    const state = await existing.getState();
    if (state === 'failed') {
      await existing.updateData(job);
      await existing.retry();
      appLogger.warn('line_event_requeued_after_fail', { jobId });
      return String(existing.id);
    }
    appLogger.info('line_event_duplicate', { jobId, state });
    return String(existing.id);
  }
};

export const enqueueOpsJob = async (name: OpsJobName, actor = 'ops'): Promise<string> => {
  const queued = await getOpsJobQueue().add(name, { name, actor }, {
    removeOnComplete: 50,
    removeOnFail: 100,
  });
  appLogger.info('ops_job_enqueued', { name, jobId: queued.id });
  return String(queued.id);
};

export const closeQueues = async (): Promise<void> => {
  await Promise.all([lineQueue?.close(), opsQueue?.close()]);
  lineQueue = null;
  opsQueue = null;
};
