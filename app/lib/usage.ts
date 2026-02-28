/**
 * Usage counters and limit enforcement (daily for free, monthly for paid).
 */

import { Redis } from '@upstash/redis';
import type { Plan } from './plans';
import { getEntitlements } from './plans';

const DAY_PREFIX = 'usage:day:';
const MONTH_PREFIX = 'usage:month:';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function todayKey(identityId: string): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${DAY_PREFIX}${identityId}:${yyyy}-${mm}-${dd}`;
}

function monthKey(identityId: string): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${MONTH_PREFIX}${identityId}:${yyyy}-${mm}`;
}

export class UsageLimitError extends Error {
  constructor(
    message: string,
    public code: 'DAILY_LIMIT' | 'MONTHLY_LIMIT' | 'FILE_SIZE' | 'BULK_NOT_ALLOWED' | 'FILES_PER_JOB'
  ) {
    super(message);
    this.name = 'UsageLimitError';
  }
}

export async function getDailyUsage(identityId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const n = await redis.get<number>(todayKey(identityId));
  return typeof n === 'number' ? n : 0;
}

export async function getMonthlyUsage(identityId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const n = await redis.get<number>(monthKey(identityId));
  return typeof n === 'number' ? n : 0;
}

export async function incrementUsage(
  identityId: string,
  plan: Plan,
  count: number = 1
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const keyDay = todayKey(identityId);
  const keyMonth = monthKey(identityId);
  await redis.incrby(keyDay, count);
  await redis.expire(keyDay, 60 * 60 * 24 * 2);
  if (plan !== 'free') {
    await redis.incrby(keyMonth, count);
    await redis.expire(keyMonth, 60 * 60 * 24 * 32);
  }
}

export interface AssertLimitsParams {
  identityId: string;
  plan: Plan;
  filesCount: number;
  maxFileSizeBytes: number;
  fileSizes?: number[];
}

export async function assertWithinLimits(params: AssertLimitsParams): Promise<void> {
  const { identityId, plan, filesCount, maxFileSizeBytes, fileSizes } = params;
  const entitlements = getEntitlements(plan);

  if (filesCount > entitlements.maxFilesPerJob) {
    throw new UsageLimitError(
      `Maximum ${entitlements.maxFilesPerJob} files per conversion. Upgrade for more.`,
      'FILES_PER_JOB'
    );
  }

  if (!entitlements.bulkEnabled && filesCount > 1) {
    throw new UsageLimitError(
      'Bulk conversion is a paid feature. Upgrade to Starter or Pro.',
      'BULK_NOT_ALLOWED'
    );
  }

  const sizeToCheck = fileSizes?.every((s) => s <= maxFileSizeBytes)
    ? Math.max(...(fileSizes ?? [0]))
    : maxFileSizeBytes;
  if (sizeToCheck > entitlements.maxFileSizeBytes) {
    const mb = Math.round(entitlements.maxFileSizeBytes / (1024 * 1024));
    throw new UsageLimitError(
      `File size exceeds your plan limit (${mb} MB). Upgrade for larger files.`,
      'FILE_SIZE'
    );
  }

  if (plan === 'free' && entitlements.conversionsPerDay != null) {
    const used = await getDailyUsage(identityId);
    if (used >= entitlements.conversionsPerDay) {
      throw new UsageLimitError(
        `Daily limit reached (${entitlements.conversionsPerDay} conversions). Resets at midnight UTC or upgrade for more.`,
        'DAILY_LIMIT'
      );
    }
  }

  if (plan !== 'free' && entitlements.conversionsPerMonth != null) {
    const used = await getMonthlyUsage(identityId);
    if (used >= entitlements.conversionsPerMonth) {
      throw new UsageLimitError(
        `Monthly limit reached (${entitlements.conversionsPerMonth} conversions). Upgrade or wait for next cycle.`,
        'MONTHLY_LIMIT'
      );
    }
  }
}
