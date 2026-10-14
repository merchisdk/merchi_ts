export { isExpectedClientError } from "./expectedClientError.js";
export { resolveReleaseSha, type ReleaseShaEnv } from "./releaseSha.js";
export { isReportingEnabled } from "./reporting.js";
export {
  captureException,
  captureUnexpected,
  configureFrontendErrors,
  createFrontendErrorReporter,
  FrontendErrorReporter,
  getDefaultFrontendErrorReporter,
} from "./reporter.js";
export {
  errorDetails,
  normalizeFrameFile,
  normalizeIdentifier,
  normalizeRoute,
  parseStackFrames,
} from "./normalize.js";
export { redactText } from "./redact.js";
export { fetchTransport } from "./transport.js";
export {
  FRONTEND_ERROR_SCHEMA_VERSION,
  type CaptureContext,
  type FrontendErrorEvent,
  type FrontendErrorReporterConfig,
  type FrontendErrorShouldReport,
  type FrontendErrorSource,
  type FrontendErrorStackFrame,
  type FrontendErrorTransport,
} from "./types.js";
