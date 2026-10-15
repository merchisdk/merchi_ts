import type { FrontendErrorEvent } from "./types.js";

export const FRONTEND_ERROR_OPERATIONS = [
  "cart.load", "cart.create", "cart.add_item", "cart.update", "cart.shipping", "cart.invoice_pdf",
  "checkout.submit", "payment.initialize", "payment.confirm", "payment.status", "payment.cancel",
  "product.load", "search.load", "navigation.load", "analytics.send", "support_chat.load",
] as const;
export type FrontendErrorOperation = typeof FRONTEND_ERROR_OPERATIONS[number];
export type FrontendErrorOutcome = "failed" | "handled" | "cancelled" | "recovered";
export type FrontendErrorReason = "validation" | "user_cancelled" | "navigation" | "superseded" | "retry_succeeded";
export const EXPECTED_STRIPE_CODES = ["card_declined", "expired_card", "incorrect_cvc", "incorrect_number"] as const;
export type FrontendErrorStripeCode = typeof EXPECTED_STRIPE_CODES[number];
export interface FrontendErrorOperationContext {
  name: FrontendErrorOperation;
  /** Missing or invalid outcomes default to failed. */
  outcome?: FrontendErrorOutcome;
  reason?: FrontendErrorReason;
}

const OUTCOMES = new Set(["failed", "handled", "cancelled", "recovered"]);
const REASONS = new Set(["validation", "user_cancelled", "navigation", "superseded", "retry_succeeded"]);

export function normalizeOperation(value: unknown): FrontendErrorOperationContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  if (!FRONTEND_ERROR_OPERATIONS.includes(input.name as FrontendErrorOperation)) return undefined;
  const operation: FrontendErrorOperationContext = {
    name: input.name as FrontendErrorOperation,
    outcome: OUTCOMES.has(input.outcome as string) ? input.outcome as FrontendErrorOutcome : "failed",
  };
  if (REASONS.has(input.reason as string)) operation.reason = input.reason as FrontendErrorReason;
  return operation;
}

export function isCriticalOperation(operation?: FrontendErrorOperationContext): boolean {
  return !!operation && /^(cart|checkout|payment)\./.test(operation.name);
}

/** No messages, URLs, IDs, bodies, or provider objects are copied into context. */
export function apiFailureContext(error: unknown): { apiStatusCode?: number; apiErrorCode?: number; stripeErrorCode?: FrontendErrorStripeCode } {
  const context: { apiStatusCode?: number; apiErrorCode?: number; stripeErrorCode?: FrontendErrorStripeCode } = {};
  if (!error || typeof error !== "object") return context;
  const input = error as Record<string, unknown>;
  if (Number.isInteger(input.statusCode) && Number(input.statusCode) >= 400 && Number(input.statusCode) <= 599) {
    context.apiStatusCode = input.statusCode as number;
  }
  if (Number.isInteger(input.errorCode) && Number(input.errorCode) >= 0 && Number(input.errorCode) <= 999) {
    context.apiErrorCode = input.errorCode as number;
  }
  if (input.type === "card_error" && input.statusCode === undefined && input.errorCode === undefined &&
    EXPECTED_STRIPE_CODES.includes(input.code as FrontendErrorStripeCode)) {
    context.stripeErrorCode = input.code as FrontendErrorStripeCode;
  }
  return context;
}

export function safeOperationSuppression(event: FrontendErrorEvent): string | undefined {
  if (event.source === "react_error_boundary" || event.componentStack || (event.digest && event.source !== "manual")) return undefined;
  const operation = event.operation;
  if (!operation || (operation.outcome ?? "failed") === "failed") return undefined;
  const status = event.apiStatusCode;
  const code = event.apiErrorCode;
  // A cancellation/recovery label cannot hide a server, auth, configuration or rate-limit failure.
  if ((status !== undefined && ![400, 409, 422].includes(status)) || code === 0 || code === 1) return undefined;
  if (operation.outcome === "handled" && operation.reason === "validation" &&
    status !== undefined && [400, 409, 422].includes(status) &&
    code !== undefined && [3, 5, 6, 7].includes(code)) return "handled_validation";
  if (status !== undefined || code !== undefined) return undefined;
  if (operation.name === "payment.confirm" && operation.outcome === "handled" &&
    operation.reason === "validation" && event.stripeErrorCode) return "handled_payment_outcome";
  if (operation.outcome === "cancelled" && event.errorType === "AbortError" &&
    (operation.reason === "user_cancelled" ||
      (!isCriticalOperation(operation) && ["navigation", "superseded"].includes(operation.reason ?? "")))) return "intentional_cancellation";
  if (operation.outcome === "recovered" && operation.reason === "retry_succeeded" &&
    !isCriticalOperation(operation)) return "recovered_noncritical";
  return undefined;
}
