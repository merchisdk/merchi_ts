export { isExpectedClientError } from "./expectedClientError.js";
export { isChunkLoadError } from "./chunkLoad.js";
export { isBrowserExtensionError } from "./browserExtension.js";
export { isEmbeddedBrowserBridgeError } from "./embeddedBrowser.js";
export {
  FRONTEND_ERROR_OPERATIONS,
  type FrontendErrorOperation,
  type FrontendErrorOperationContext,
  type FrontendErrorOutcome,
  type FrontendErrorReason,
  type FrontendErrorStripeCode,
} from "./operation.js";
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
export { clientFingerprintFrom, collectClientFingerprint } from "./clientFingerprint.js";
export type { ClientFingerprintInput } from "./clientFingerprint.js";
export { redactText } from "./redact.js";
export { fetchTransport } from "./transport.js";
export {
  FRONTEND_ERROR_SCHEMA_VERSION,
  type CaptureContext,
  type FrontendErrorBrowser,
  type FrontendErrorClient,
  type FrontendErrorColorScheme,
  type FrontendErrorDeviceType,
  type FrontendErrorEvent,
  type FrontendErrorIntegration,
  type FrontendErrorOs,
  type FrontendErrorReceipt,
  type FrontendErrorReporterConfig,
  type FrontendErrorShouldReport,
  type FrontendErrorSource,
  type FrontendErrorStackFrame,
  type FrontendErrorTransport,
} from "./types.js";

export { sanitizeEvidenceUrl } from "./evidenceUrl.js";
