'use client';

import { useEffect, useRef } from 'react';

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
const ADSENSE_SLOT_INLINE = process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE ?? '';

interface AdUnitProps {
  className?: string;
  slot?: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
}

export default function AdUnit({
  className = '',
  slot = ADSENSE_SLOT_INLINE,
  format = 'auto',
}: AdUnitProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !ADSENSE_CLIENT || !slot) return;
    try {
      (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle =
        (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle || [];
      (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle.push({});
    } catch (e) {
      console.warn('AdSense push error', e);
    }
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return null;

  return (
    <ins
      ref={ref}
      className={`adsbygoogle ${className}`}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
      style={{ display: 'block' }}
    />
  );
}
