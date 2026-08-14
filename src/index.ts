export {
  captureException,
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
  type FrontendErrorSource,
  type FrontendErrorStackFrame,
  type FrontendErrorTransport,
} from "./types.js";
