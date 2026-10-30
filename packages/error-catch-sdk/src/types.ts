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

export type FrontendErrorBrowser =
  | "Chrome"
  | "Edge"
  | "Firefox"
  | "Safari"
  | "Opera"
  | "Samsung Internet";

export type FrontendErrorOs =
  | "Windows"
  | "macOS"
  | "iOS"
  | "Android"
  | "Chrome OS"
  | "Linux";

export type FrontendErrorDeviceType = "mobile" | "tablet" | "desktop";

export type FrontendErrorColorScheme = "light" | "dark";

/**
 * Bounded browser environment stored with an error report.
 * The public IP is intentionally absent: the collector records it from the
 * trusted connection address when it persists the report.
 */
export interface FrontendErrorClient {
  userAgent?: string;
  browser?: FrontendErrorBrowser;
  browserVersion?: string;
  os?: FrontendErrorOs;
  osVersion?: string;
  platform?: FrontendErrorOs;
  mobile?: boolean;
  deviceType?: FrontendErrorDeviceType;
  language?: string;
  languages?: string[];
  timezone?: string;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  online?: boolean;
  colorScheme?: FrontendErrorColorScheme;
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
  /** Actual sanitized path, including record IDs. */
  route?: string;
  /** Sanitized host/path and resource query IDs; credentials are redacted. */
  pageUrl?: string;
  digest?: string;
  stackTrace?: string;
  stackFrames: FrontendErrorStackFrame[];
  componentStack?: string;
  operation?: FrontendErrorOperationContext;
  apiStatusCode?: number;
  apiErrorCode?: number;
  stripeErrorCode?: FrontendErrorStripeCode;
  client?: FrontendErrorClient;
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
