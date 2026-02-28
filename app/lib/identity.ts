/**
 * Identity resolution for monetization: Clerk users + anonymous (cookie-based).
 */

import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

const ANON_COOKIE_NAME = 'fc_anon_id';
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type RequestIdentity =
  | { kind: 'user'; id: string }
  | { kind: 'anon'; id: `anon:${string}` };

/**
 * Generate a simple stable id for anonymous users (not cryptographically secure; for usage scoping only).
 */
function generateAnonId(): string {
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Get or create anonymous user id from cookie.
 * Call from Route Handler or Server Action where we can read/set cookies.
 * For first-time anon visitors, middleware should set the cookie so API routes can read it.
 */
export async function getOrCreateAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE_NAME)?.value;
  if (existing) return existing;
  const id = generateAnonId();
  store.set(ANON_COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ANON_COOKIE_MAX_AGE,
    path: '/',
  });
  return id;
}

/**
 * Resolve current request identity: signed-in user (Clerk) or anonymous (cookie).
 * Use in API routes and server code. For anonymous users, ensure middleware has set fc_anon_id.
 */
export async function getRequestIdentity(): Promise<RequestIdentity> {
  const { userId } = await auth();
  if (userId) return { kind: 'user', id: userId };
  const store = await cookies();
  let anonId = store.get(ANON_COOKIE_NAME)?.value;
  if (!anonId) {
    anonId = generateAnonId();
    store.set(ANON_COOKIE_NAME, anonId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ANON_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return { kind: 'anon', id: `anon:${anonId}` };
}

/** Stable id string for usage keys (userId or anon:xxx). */
export function getIdentityId(identity: RequestIdentity): string {
  return identity.id;
}
