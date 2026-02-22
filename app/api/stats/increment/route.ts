import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const STATS_KEY = 'conversions_total';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function POST(): Promise<NextResponse> {
  try {
    const redis = getRedis();
    if (!redis) return NextResponse.json({ totalConversions: 0 }, { status: 200 });
    const totalConversions = await redis.incr(STATS_KEY);
    return NextResponse.json({ totalConversions });
  } catch {
    return NextResponse.json({ totalConversions: 0 }, { status: 200 });
  }
}
