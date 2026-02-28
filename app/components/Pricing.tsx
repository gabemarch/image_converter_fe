'use client';

import { useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import type { PlanResponse } from '../lib/api';

const PRICES = {
  starter: { monthly: 7, yearly: 67 },
  pro: { monthly: 19, yearly: 182 },
} as const;

interface PricingProps {
  planResponse: PlanResponse | null;
  onRefresh?: () => void;
}

export default function Pricing({ planResponse, onRefresh }: PricingProps) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const plan = planResponse?.plan ?? 'free';
  const subscription = planResponse?.subscription;

  const handleCheckout = async (tier: 'starter' | 'pro') => {
    if (!isSignedIn) {
      openSignIn?.({ redirectUrl: window.location.pathname + '#pricing' });
      return;
    }
    setLoading(tier);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: tier, cycle: billingCycle }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error ?? 'Checkout failed');
    } catch (e) {
      console.error(e);
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading('portal');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error ?? 'Portal failed');
    } catch (e) {
      console.error(e);
      setLoading(null);
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle('yearly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${billingCycle === 'yearly' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          Yearly (save ~20%)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Free</h3>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">$0</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ad-supported</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>20 conversions/day</li>
            <li>Max 10 MB/file</li>
            <li>Single file only</li>
          </ul>
          <div className="mt-6">
            {plan === 'free' ? (
              <span className="inline-block px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium">
                Current plan
              </span>
            ) : (
              <span className="inline-block px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 text-sm">
                Downgrade in billing
              </span>
            )}
          </div>
        </div>

        {/* Starter */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-500 dark:border-blue-400 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Starter</h3>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            ${billingCycle === 'monthly' ? PRICES.starter.monthly : PRICES.starter.yearly}
            <span className="text-sm font-normal text-gray-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No ads</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>600 conversions/month</li>
            <li>Max 50 MB/file</li>
            <li>Bulk: up to 10 files/job</li>
          </ul>
          <div className="mt-6">
            {plan === 'starter' ? (
              <button
                type="button"
                onClick={handlePortal}
                disabled={!!loading}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {loading === 'portal' ? 'Opening…' : 'Manage Billing'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleCheckout('starter')}
                disabled={!!loading}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {!isSignedIn ? 'Sign in to upgrade' : (loading === 'starter' || loading === 'pro') ? 'Opening…' : 'Upgrade'}
              </button>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pro</h3>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            ${billingCycle === 'monthly' ? PRICES.pro.monthly : PRICES.pro.yearly}
            <span className="text-sm font-normal text-gray-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No ads + priority</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>3,000 conversions/month</li>
            <li>Max 200 MB/file</li>
            <li>Bulk: up to 50 files/job</li>
          </ul>
          <div className="mt-6">
            {plan === 'pro' ? (
              <button
                type="button"
                onClick={handlePortal}
                disabled={!!loading}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {loading === 'portal' ? 'Opening…' : 'Manage Billing'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleCheckout('pro')}
                disabled={!!loading}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {!isSignedIn ? 'Sign in to upgrade' : (loading === 'starter' || loading === 'pro') ? 'Opening…' : 'Upgrade'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
