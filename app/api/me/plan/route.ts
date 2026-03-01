import { NextResponse } from 'next/server';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getRequestIdentity, getIdentityId } from '@/app/lib/identity';
import { getUserPlan, getSubscription, setSubscription, setStripeCustomerMapping } from '@/app/lib/subscription';
import { getEntitlements, priceIdToPlan, type Plan } from '@/app/lib/plans';
import { getDailyUsage, getMonthlyUsage } from '@/app/lib/usage';
import type { SubscriptionStatus } from '@/app/lib/subscription';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export type SyncResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: 'no_subscription' }
  | { ok: false; reason: 'price_not_configured'; priceId?: string };

/** Sync subscription from Stripe into Redis and optionally Clerk metadata. */
async function syncStripeSubscriptionToRedis(
  clerkUserId: string,
  customerId: string,
  stripe: Stripe
): Promise<SyncResult> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });
  const stripeSub = subscriptions.data.find(
    (s) => s.status === 'active' || s.status === 'trialing'
  );
  if (!stripeSub) return { ok: false, reason: 'no_subscription' };

  const item = stripeSub.items.data[0];
  const priceId = item?.price?.id;
  const plan = priceId ? (priceIdToPlan(priceId) as Plan | null) : null;
  if (!plan || plan === 'free')
    return { ok: false, reason: 'price_not_configured', priceId: priceId ?? undefined };

  const currentPeriodEnd = item?.current_period_end ?? 0;
  await setStripeCustomerMapping(customerId, clerkUserId);
  await setSubscription(clerkUserId, {
    plan,
    status: stripeSub.status as SubscriptionStatus,
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSub.id,
    currentPeriodEnd,
    priceId,
  });
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { stripeCustomerId: customerId },
    });
  } catch {
    // Non-fatal: Redis is source of truth for plan
  }
  return { ok: true, plan };
}

/**
 * If signed-in user has no subscription in Redis, try to find one in Stripe:
 * 1. By Clerk user's publicMetadata.stripeCustomerId (if set, e.g. from checkout or previous sync)
 * 2. By Clerk primary email (Stripe customer with same email)
 * Syncs to Redis and stores stripeCustomerId in Clerk metadata when found.
 */
async function trySyncSubscriptionFromStripe(clerkUserId: string): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  const stripe = getStripe();
  if (!stripe) return;

  const metadataCustomerId = user.publicMetadata?.stripeCustomerId;
  if (typeof metadataCustomerId === 'string' && metadataCustomerId.startsWith('cus_')) {
    const result = await syncStripeSubscriptionToRedis(clerkUserId, metadataCustomerId, stripe);
    if (result.ok) return;
  }

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return;

  const customers = await stripe.customers.list({ email, limit: 1 });
  const customer = customers.data[0];
  if (!customer) return;

  await syncStripeSubscriptionToRedis(clerkUserId, customer.id, stripe);
}

/** POST: one-time link of Stripe customer to current user (by customer ID). Verifies Stripe customer email matches Clerk. */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
    }

    let body: { stripeCustomerId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    const customerId = typeof body?.stripeCustomerId === 'string' ? body.stripeCustomerId.trim() : '';
    if (!customerId.startsWith('cus_')) {
      return NextResponse.json(
        { error: 'stripe_customer_id_required', message: 'Send { "stripeCustomerId": "cus_xxx" }' },
        { status: 400 }
      );
    }

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
    }
    const stripeEmail = (customer as Stripe.Customer).email?.trim().toLowerCase();
    const clerkEmail = user.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
    if (stripeEmail && clerkEmail && stripeEmail !== clerkEmail) {
      return NextResponse.json(
        { error: 'email_mismatch', message: 'Stripe customer email does not match your account email.' },
        { status: 403 }
      );
    }

    const result = await syncStripeSubscriptionToRedis(user.id, customerId, stripe);
    if (result.ok) {
      return NextResponse.json({ ok: true, plan: result.plan });
    }
    if (result.reason === 'no_subscription') {
      return NextResponse.json(
        { error: 'no_active_subscription', message: 'No active subscription found for this Stripe customer.' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        error: 'price_not_configured',
        message: 'Your subscription exists but its price ID is not configured in this app. Set STRIPE_PRICE_PRO_YEARLY (and similar) in env.',
        priceId: result.priceId,
      },
      { status: 400 }
    );
  } catch (e) {
    console.error('POST /api/me/plan (sync) error:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const identity = await getRequestIdentity();
    const identityId = getIdentityId(identity);

    let plan = await getUserPlan(identityId);
    if (identity.kind === 'user' && plan === 'free') {
      const existing = await getSubscription(identity.id);
      if (!existing) {
        await trySyncSubscriptionFromStripe(identity.id);
        plan = await getUserPlan(identityId);
      }
    }

    const entitlements = getEntitlements(plan);

    const dailyUsed = await getDailyUsage(identityId);
    const monthlyUsed = await getMonthlyUsage(identityId);
    const dailyLimit = entitlements.conversionsPerDay ?? null;
    const monthlyLimit = entitlements.conversionsPerMonth ?? null;

    const sub = identity.kind === 'user' ? await getSubscription(identity.id) : null;

    return NextResponse.json({
      plan,
      entitlements: {
        ...entitlements,
        maxFileSizeMB: Math.round(entitlements.maxFileSizeBytes / (1024 * 1024)),
      },
      usage: {
        dailyUsed,
        dailyLimit,
        monthlyUsed,
        monthlyLimit,
      },
      subscription: sub
        ? {
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
          }
        : null,
    });
  } catch (e) {
    console.error('GET /api/me/plan error:', e);
    return NextResponse.json(
      {
        plan: 'free',
        entitlements: getEntitlements('free'),
        usage: {
          dailyUsed: 0,
          dailyLimit: 5,
          monthlyUsed: 0,
          monthlyLimit: null,
        },
        subscription: null,
      },
      { status: 200 }
    );
  }
}
