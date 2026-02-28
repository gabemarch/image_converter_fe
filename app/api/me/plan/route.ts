import { NextResponse } from 'next/server';
import { getRequestIdentity, getIdentityId } from '@/app/lib/identity';
import { getUserPlan, getSubscription } from '@/app/lib/subscription';
import { getEntitlements } from '@/app/lib/plans';
import { getDailyUsage, getMonthlyUsage } from '@/app/lib/usage';

export async function GET() {
  try {
    const identity = await getRequestIdentity();
    const identityId = getIdentityId(identity);

    const plan = await getUserPlan(identityId);
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
