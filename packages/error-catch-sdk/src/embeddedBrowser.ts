import type { FrontendErrorEvent } from "./types.js";
import { isCriticalOperation } from "./operation.js";

/** CefSharp JavascriptObjectRepository rejection. Do not generalize this. */
const CEFSHARP_OBJECT_NOT_FOUND =
  /^Object Not Found Matching Id:\d+(?:, MethodName:\w+, ParamCount:\d+)?$/;

/** Only the known embedded-Chromium bridge rejection is safe to discard. */
export function isEmbeddedBrowserBridgeError(
  event: Pick<
    FrontendErrorEvent,
    "source" | "message" | "componentStack" | "digest" | "operation"
  >,
): boolean {
  if (
    !["window_error", "unhandled_rejection"].includes(event.source) ||
    event.componentStack ||
    event.digest ||
    isCriticalOperation(event.operation)
  ) return false;
  return CEFSHARP_OBJECT_NOT_FOUND.test(event.message.trim());
}
