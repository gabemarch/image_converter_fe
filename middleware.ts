import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const ANON_COOKIE_NAME = 'fc_anon_id';
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function generateAnonId(): string {
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export default clerkMiddleware(async (auth, req) => {
  const res = NextResponse.next();
  const { userId } = await auth();
  if (userId) return res;
  const existing = req.cookies.get(ANON_COOKIE_NAME)?.value;
  if (existing) return res;
  const id = generateAnonId();
  res.cookies.set(ANON_COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ANON_COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
});
