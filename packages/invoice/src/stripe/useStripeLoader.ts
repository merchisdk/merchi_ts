'use client';

import { useEffect, useState } from 'react';
import { captureUnexpected } from '@merchi/error-catch';

export function useStripeLoader<T>(
  publishableKey: string,
  loadStripe: (key: string) => Promise<T | null>,
) {
  const [result, setResult] = useState<{ key: string; stripe: T | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setResult(null);
    if (!publishableKey) return;

    let active = true;
    async function load() {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe) throw new Error('Stripe.js did not initialize');
        if (active) setResult({ key: publishableKey, stripe });
      } catch (error) {
        if (!active) return;
        setResult({ key: publishableKey, stripe: null });
        captureUnexpected(error, {
          source: 'manual', operation: { name: 'payment.initialize', outcome: 'failed' },
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [publishableKey, loadStripe, attempt]);

  const current = result?.key === publishableKey ? result : null;
  return {
    stripe: current?.stripe ?? null,
    failed: current?.stripe === null,
    retry() {
      setResult(null);
      setAttempt(previous => previous + 1);
    },
  };
}
