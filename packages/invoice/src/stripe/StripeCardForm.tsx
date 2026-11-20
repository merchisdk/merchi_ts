import * as React from 'react';
import { StripePaymentForm } from './StripePaymentForm';
import { StripePaymentGate } from './StripePaymentGate';
import { useEffect, useState } from 'react';
import { TEST_CARD_NUMBER } from '../testCheckout';
import LegacyStripeCardForm from './LegacyStripeCardForm';

function TestInvoiceCardForm(props: React.ComponentProps<typeof LegacyStripeCardForm>) {
  const { urlApi } = props;
  const [result, setResult] = useState<{ url: string; key?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${urlApi.replace(/\/$/, '')}/stripe/test_publishable_key/`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const { key } = await response.json();
        if (typeof key !== 'string' || !key.startsWith('pk_test_')) throw new Error();
        if (!controller.signal.aborted) setResult({ url: urlApi, key });
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ url: urlApi }); });
    return () => controller.abort();
  }, [urlApi]);
  if (result?.url !== urlApi) return <p role="status">Loading Stripe test checkout…</p>;
  if (!result.key) return <p role="alert">Stripe test checkout is unavailable.</p>;
  return <>
    <p>Test checkout · Use {TEST_CARD_NUMBER} with any future expiry and any CVC.</p>
    <LegacyStripeCardForm {...props} testKey={result.key} />
  </>;
}

export default function StripeCardForm(props: any) {
  const { invoice, urlApi, alertErrorShow, callbackStripePaymentSuccess } = props;
  if (invoice.isTest) return <TestInvoiceCardForm {...props} />;
  return <StripePaymentGate engine={invoice.stripePaymentEngine} apiUrl={urlApi} resource="invoice" resourceId={invoice.id}
    resourceToken={invoice.invoiceToken} legacy={<LegacyStripeCardForm {...props} />}>
    <StripePaymentForm apiUrl={urlApi} resource="invoice" resourceId={invoice.id}
    resourceToken={invoice.invoiceToken} onError={alertErrorShow}
    onSuccess={updated => callbackStripePaymentSuccess({ invoice: updated })} />
  </StripePaymentGate>;
}
