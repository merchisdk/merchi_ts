import type { FrontendErrorOperationContext, FrontendErrorStripeCode } from "./operation.js";

export const FRONTEND_ERROR_SCHEMA_VERSION = 1 as const;

export type FrontendErrorSource =
  | "manual"
  | "window_error"
  | "unhandled_rejection"
  | "react_error_boundary";

export interface FrontendErrorStackFrame {
  file: string;
  function: string;
  line?: number;
  column?: number;
}

export interface FrontendErrorEvent {
  schemaVersion: typeof FRONTEND_ERROR_SCHEMA_VERSION;
  eventId: string;
  occurredAt: string;
  application: string;
  releaseSha?: string;
  source: FrontendErrorSource;
  errorType: string;
  message: string;
  route?: string;
  digest?: string;
  stackTrace?: string;
  stackFrames: FrontendErrorStackFrame[];
  componentStack?: string;
  operation?: FrontendErrorOperationContext;
  apiStatusCode?: number;
  apiErrorCode?: number;
  stripeErrorCode?: FrontendErrorStripeCode;
  replayRequested?: boolean;
}

export interface FrontendErrorReceipt {
  accepted?: boolean;
  reportId?: string;
  disposition?: string;
  replay?: { id: string; uploadToken: string };
}

/** Optional integrations run only after filtering, deduplication and quotas. */
export interface FrontendErrorIntegration {
  prepare(event: FrontendErrorEvent): void;
  accepted(event: FrontendErrorEvent, receipt: FrontendErrorReceipt): void;
}

export interface CaptureContext {
  source?: FrontendErrorSource;
  route?: string;
  digest?: string;
  componentStack?: string;
  operation?: FrontendErrorOperationContext;
}

export type FrontendErrorShouldReport = (
  error: unknown,
  context: CaptureContext,
) => boolean;

export type FrontendErrorTransport = (
  endpoint: string,
  event: FrontendErrorEvent,
) => void | Promise<void | FrontendErrorReceipt>;

export interface FrontendErrorReporterConfig {
  endpoint: string;
  application: string;
  releaseSha?: string;
  enabled?: boolean;
  dedupeWindowMs?: number;
  /** Separate bounded allowances for critical operations and other errors. */
  maxEventsPerPage?: number;
  transport?: FrontendErrorTransport;
  /**
   * Replaces the default unexpected-error filter. When omitted,
   * automatic extension-only events are skipped by both capture methods,
   * along with explicitly handled validation, intentional cancellation and
   * recovered noncritical operations. Unknown/unhandled failures are retained.
   */
  shouldReport?: FrontendErrorShouldReport;
}
