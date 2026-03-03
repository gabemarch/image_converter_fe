/**
 * Plan and entitlement definitions for monetization.
 * Single source of truth for free / starter / pro tiers.
 */

export type Plan = 'free' | 'starter' | 'pro';

export type Entitlements = {
  plan: Plan;
  adsEnabled: boolean;
  bulkEnabled: boolean;
  maxFilesPerJob: number;
  maxFileSizeBytes: number;
  conversionsPerDay?: number;
  conversionsPerMonth?: number;
  priority: 'standard' | 'high' | 'highest';
};

const TEN_MB = 10 * 1024 * 1024;
const FIFTY_MB = 50 * 1024 * 1024;
const TWO_HUNDRED_MB = 200 * 1024 * 1024;

export const PLAN_ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: {
    plan: 'free',
    adsEnabled: true,
    bulkEnabled: false,
    maxFilesPerJob: 1,
    maxFileSizeBytes: TEN_MB,
    conversionsPerDay: 5,
    priority: 'standard',
  },
  starter: {
    plan: 'starter',
    adsEnabled: false,
    bulkEnabled: true,
    maxFilesPerJob: 10,
    maxFileSizeBytes: FIFTY_MB,
    conversionsPerMonth: 600,
    priority: 'high',
  },
  pro: {
    plan: 'pro',
    adsEnabled: false,
    bulkEnabled: true,
    maxFilesPerJob: 50,
    maxFileSizeBytes: TWO_HUNDRED_MB,
    // No conversionsPerMonth = unlimited
    priority: 'highest',
  },
};

export function getEntitlements(plan: Plan): Entitlements {
  return { ...PLAN_ENTITLEMENTS[plan] };
}

/** Stripe price IDs (set in env). */
export const STRIPE_PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
  starter_yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? '',
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
} as const;

export function priceIdToPlan(priceId: string): Plan | null {
  if (priceId === STRIPE_PRICE_IDS.starter_monthly || priceId === STRIPE_PRICE_IDS.starter_yearly)
    return 'starter';
  if (priceId === STRIPE_PRICE_IDS.pro_monthly || priceId === STRIPE_PRICE_IDS.pro_yearly)
    return 'pro';
  return null;
}
