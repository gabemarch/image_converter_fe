/**
 * Subscription state from Redis. Resolves user plan for entitlement checks.
 */

import { Redis } from '@upstash/redis';
import type { Plan } from './plans';
import { getEntitlements } from './plans';

const SUB_PREFIX = 'sub:';
const CUSTOMER_PREFIX = 'stripe_customer:';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';

export interface SubscriptionRecord {
  plan: Plan;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: number;
  priceId?: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getSubscription(userId: string): Promise<SubscriptionRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<SubscriptionRecord>(`${SUB_PREFIX}${userId}`);
  return raw ?? null;
}

export async function getUserPlan(userIdOrIdentityId: string): Promise<Plan> {
  if (userIdOrIdentityId.startsWith('anon:')) return 'free';
  const sub = await getSubscription(userIdOrIdentityId);
  if (!sub) return 'free';
  if (sub.status !== 'active' && sub.status !== 'trialing') return 'free';
  return sub.plan;
}

export async function getUserEntitlements(userIdOrIdentityId: string) {
  const plan = await getUserPlan(userIdOrIdentityId);
  return getEntitlements(plan);
}

export async function setSubscription(
  userId: string,
  record: SubscriptionRecord
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(`${SUB_PREFIX}${userId}`, record);
}

export async function deleteSubscription(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(`${SUB_PREFIX}${userId}`);
}

export async function setStripeCustomerMapping(
  stripeCustomerId: string,
  userId: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(`${CUSTOMER_PREFIX}${stripeCustomerId}`, { userId });
}

export async function getUserIdByStripeCustomerId(
  stripeCustomerId: string
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<{ userId: string }>(`${CUSTOMER_PREFIX}${stripeCustomerId}`);
  return raw?.userId ?? null;
}
