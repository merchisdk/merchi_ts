import { captureUnexpected } from '@merchi/error-catch';

/** Only bounded diagnostic fields are taken from a parsed API response. */
export function reportCheckoutFailure(error: unknown, statusCode?: number): void {
  const input = error && typeof error === 'object' ? error as Record<string, unknown> : undefined;
  const failure = statusCode === undefined ? error : Object.assign(
    new Error(typeof input?.message === 'string' ? input.message : 'Checkout failed.'),
    { statusCode, errorCode: input?.errorCode },
  );
  captureUnexpected(failure, {
    source: 'manual',
    operation: statusCode === undefined
      ? { name: 'checkout.submit', outcome: 'failed' }
      : { name: 'checkout.submit', outcome: 'handled', reason: 'validation' },
  });
}
