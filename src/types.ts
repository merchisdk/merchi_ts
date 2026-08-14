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
}

export interface CaptureContext {
  source?: FrontendErrorSource;
  route?: string;
  digest?: string;
  componentStack?: string;
}

export type FrontendErrorTransport = (
  endpoint: string,
  event: FrontendErrorEvent,
) => void | Promise<void>;

export interface FrontendErrorReporterConfig {
  endpoint: string;
  application: string;
  releaseSha?: string;
  enabled?: boolean;
  dedupeWindowMs?: number;
  maxEventsPerPage?: number;
  transport?: FrontendErrorTransport;
}
