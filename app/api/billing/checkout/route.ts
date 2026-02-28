import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { STRIPE_PRICE_IDS, priceIdToPlan, type Plan } from '@/app/lib/plans';
import {
  getSubscription,
  setStripeCustomerMapping,
} from '@/app/lib/subscription';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

const VALID_PRICE_IDS = new Set([
  STRIPE_PRICE_IDS.starter_monthly,
  STRIPE_PRICE_IDS.starter_yearly,
  STRIPE_PRICE_IDS.pro_monthly,
  STRIPE_PRICE_IDS.pro_yearly,
].filter(Boolean));

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Sign in to upgrade' },
      { status: 401 }
    );
  }

  let body: { priceId?: string; plan?: string; cycle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let priceId: string | undefined = body.priceId;
  if (!priceId && body.plan && body.cycle) {
    const planKey = body.plan as 'starter' | 'pro';
    const cycleKey = body.cycle as 'monthly' | 'yearly';
    if (planKey === 'starter' && cycleKey === 'monthly') priceId = STRIPE_PRICE_IDS.starter_monthly;
    else if (planKey === 'starter' && cycleKey === 'yearly') priceId = STRIPE_PRICE_IDS.starter_yearly;
    else if (planKey === 'pro' && cycleKey === 'monthly') priceId = STRIPE_PRICE_IDS.pro_monthly;
    else if (planKey === 'pro' && cycleKey === 'yearly') priceId = STRIPE_PRICE_IDS.pro_yearly;
  }
  if (!priceId || !VALID_PRICE_IDS.has(priceId)) {
    return NextResponse.json(
      { error: 'Invalid or missing priceId or plan/cycle' },
      { status: 400 }
    );
  }

  const plan = priceIdToPlan(priceId) as Plan | null;
  if (!plan) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const successUrl = process.env.STRIPE_SUCCESS_URL ?? `${baseUrl}?checkout=success`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL ?? `${baseUrl}?checkout=canceled`;

  try {
    const existing = await getSubscription(userId);
    let customerId: string | undefined = existing?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { clerkUserId: userId },
      });
      customerId = customer.id;
      await setStripeCustomerMapping(customerId, userId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { clerkUserId: userId, plan },
        trial_period_days: undefined,
      },
      metadata: { clerkUserId: userId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Checkout error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
