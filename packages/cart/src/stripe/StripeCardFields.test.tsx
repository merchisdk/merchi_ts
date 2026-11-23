import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { loadStripe } from '@stripe/stripe-js';
import { configureFrontendErrors } from '@merchi/error-catch';
import StripeCardFields from './StripeCardFields';

jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn() }));
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: React.PropsWithChildren) => children,
  CardElement: () => <div>Card details</div>,
  useStripe: () => ({}),
  useElements: () => ({}),
}));
jest.mock('@merchi/invoice', () => jest.requireActual('../../../invoice/src/stripe/useStripeLoader'));
jest.mock('../assets/stripe-payment-secure.png', () => ({ src: 'stripe-payment-secure.png' }));

it('lets shoppers retry loading Stripe on legacy checkout without submitting a payment', async () => {
  const load = jest.mocked(loadStripe);
  const transport = jest.fn();
  configureFrontendErrors({
    endpoint: 'https://collector.example',
    application: 'store',
    enabled: true,
    transport,
  });
  const failed = Promise.reject(new Error('Failed to load Stripe.js'));
  // Keep the fixture safe to run against a checkout that ignores the rejection.
  void failed.catch(() => undefined);
  load.mockReturnValueOnce(failed).mockResolvedValueOnce({} as NonNullable<Awaited<ReturnType<typeof loadStripe>>>);
  const doStripePayment = jest.fn();
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      root.render(<StripeCardFields cart={{}} error={{}} doStripePayment={doStripePayment}
        loadingStripePayment={false} loadingStripePaymentButtons={false}
        setLoadingStripePayment={jest.fn()} PaymentButton={() => <button type="submit">Pay</button>}
        stripePubKey="pk_test_fixture" />);
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not load the payment form');
    expect(container.textContent).not.toContain('Card details');
    expect(transport.mock.calls[0]?.[1]).toMatchObject({
      message: 'Failed to load Stripe.js',
      operation: { name: 'payment.initialize', outcome: 'failed' },
    });

    await act(async () => { container.querySelector('button')!.click(); });
    expect(load.mock.calls).toEqual([['pk_test_fixture'], ['pk_test_fixture']]);
    expect(container.textContent).toContain('Card details');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(doStripePayment).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
