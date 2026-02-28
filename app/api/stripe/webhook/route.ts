import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { priceIdToPlan, type Plan } from '@/app/lib/plans';
import {
  getUserIdByStripeCustomerId,
  setSubscription,
  deleteSubscription,
  setStripeCustomerMapping,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from '@/app/lib/subscription';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

function planFromPriceId(priceId: string): Plan | null {
  return priceIdToPlan(priceId);
}

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e) {
    console.error('Webhook signature verification failed:', e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subId = session.subscription as string;
        const clerkUserId = (session.metadata?.clerkUserId) ?? await getUserIdByStripeCustomerId(customerId);
        if (!clerkUserId) {
          console.error('checkout.session.completed: no clerkUserId');
          break;
        }
        if (!customerId) break;
        await setStripeCustomerMapping(customerId, clerkUserId);
        const sub = await stripe.subscriptions.retrieve(subId);
        const item = sub.items.data[0];
        const priceId = item?.price?.id ?? '';
        const plan = planFromPriceId(priceId) ?? 'starter';
        const record: SubscriptionRecord = {
          plan,
          status: 'active',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
          currentPeriodEnd: item?.current_period_end ?? 0,
          priceId,
        };
        await setSubscription(clerkUserId, record);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const clerkUserId = await getUserIdByStripeCustomerId(customerId);
        if (!clerkUserId) break;
        const item = sub.items.data[0];
        const priceId = item?.price?.id ?? '';
        const plan = planFromPriceId(priceId) ?? 'starter';
        const status = sub.status as SubscriptionStatus;
        const record: SubscriptionRecord = {
          plan: status === 'active' ? plan : 'free',
          status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: item?.current_period_end ?? 0,
          priceId,
        };
        await setSubscription(clerkUserId, record);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const clerkUserId = await getUserIdByStripeCustomerId(customerId);
        if (!clerkUserId) break;
        await deleteSubscription(clerkUserId);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
