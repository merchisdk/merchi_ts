import { captureUnexpected } from '@merchi/error-catch';

/**
 * Call-site tags recorded on the error-catch event.
 *
 * `CaptureContext.source` only accepts the error-catch enum (`manual`,
 * `window_error`, `unhandled_rejection`, `react_error_boundary`). Any other
 * string is coerced to `manual` and dropped, so the call site is sent as
 * `digest`, which the collector already stores.
 */
export const CART_FAILURE_SOURCES = {
  addItem: 'cart.addItem',
  invoicePdf: 'cart.invoicePdf',
} as const;

export type CartFailureSource =
  (typeof CART_FAILURE_SOURCES)[keyof typeof CART_FAILURE_SOURCES];

/**
 * Report an unexpected cart failure.
 *
 * `captureUnexpected` normalises non-Error rejections and skips expected
 * Merchi client errors (4xx / client error codes). The call is a no-op until
 * the host configures `@merchi/error-catch`, and a failure inside reporting
 * never replaces the original error.
 */
export function reportCartFailure(error: unknown, source: CartFailureSource): void {
  try {
    captureUnexpected(error, {
      source: 'manual',
      digest: source,
    });
  } catch {
    // Reporting must not replace the original failure.
  }
}

/** Report an add-to-cart failure, then invoke the existing callback. */
export function reportAddCartItemFailure(
  error: unknown,
  onError: (error: any) => void,
): void {
  reportCartFailure(error, CART_FAILURE_SOURCES.addItem);
  onError(error);
}
