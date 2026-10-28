import { captureUnexpected, type FrontendErrorOperation } from '@merchi/error-catch';

/**
 * Call-site tags recorded on the error-catch event.
 *
 * `CaptureContext.source` only accepts the error-catch enum (`manual`,
 * `window_error`, `unhandled_rejection`, `react_error_boundary`). Any other
 * string is coerced to `manual` and dropped, so the call site is sent as
 * the legacy `digest` as well as bounded operation context.
 */
export const CART_FAILURE_SOURCES = {
  load: 'cart.load',
  addItem: 'cart.addItem',
  invoicePdf: 'cart.invoicePdf',
  create: 'cart.create',
  update: 'cart.update',
  shipping: 'cart.shipping',
} as const;
const OPERATIONS: Record<CartFailureSource, FrontendErrorOperation> = {
  'cart.load': 'cart.load',
  'cart.addItem': 'cart.add_item', 'cart.invoicePdf': 'cart.invoice_pdf',
  'cart.create': 'cart.create', 'cart.update': 'cart.update', 'cart.shipping': 'cart.shipping',
};

export type CartFailureSource =
  (typeof CART_FAILURE_SOURCES)[keyof typeof CART_FAILURE_SOURCES];

/**
 * Report an unexpected cart failure.
 *
 * `captureUnexpected` normalises non-Error rejections. Failed operations remain
 * reportable even for client status codes. The call is a no-op until
 * the host configures `@merchi/error-catch`, and a failure inside reporting
 * never replaces the original error.
 */
export function reportCartFailure(error: unknown, source: CartFailureSource, handledValidation = false): void {
  try {
    // A UI callback returning only confirms display, not a validation failure.
    // Keep this predicate aligned with error-catch safeOperationSuppression.
    const failure = error as { statusCode?: unknown; errorCode?: unknown } | null;
    let validation = false;
    try {
      validation = handledValidation && failure !== null && typeof failure === 'object' &&
        [400, 409, 422].includes(failure.statusCode as number) &&
        [3, 5, 6, 7].includes(failure.errorCode as number);
    } catch {
      // Classification must not prevent the reporter from handling this value.
    }
    captureUnexpected(error, {
      source: 'manual',
      digest: source,
      operation: {
        name: OPERATIONS[source],
        outcome: validation ? 'handled' : 'failed',
        ...(validation ? { reason: 'validation' as const } : {}),
      },
    });
  } catch {
    // Reporting must not replace the original failure.
  }
}

/** Invoke the UI callback, then report using its confirmed handling outcome. */
export function reportAddCartItemFailure(
  error: unknown,
  onError: (error: any) => void,
): void {
  let handled = false;
  try {
    onError(error);
    handled = true;
  } finally {
    // A displayed error is only suppressed if the shared policy also verifies
    // a known input code/status. A callback that crashes cannot mark it handled.
    reportCartFailure(error, CART_FAILURE_SOURCES.addItem, handled);
  }
}
