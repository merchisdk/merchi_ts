import { MAX_STACK_FRAMES, MAX_STACK_TRACE_LENGTH } from "./normalize.js";
import type { FrontendErrorEvent } from "./types.js";

const EXTENSION_FILE =
  /^(?:chrome-extension|moz-extension|safari-extension|safari-web-extension|ms-browser-extension):\/\/[^/\s]+\//i;
const CHROME_FRAME = /^at\s+(?:(.*?)\s+\()?(.+?):\d+:\d+\)?$/;
const FIREFOX_FRAME = /^(.*?)@(.+?):\d+:\d+$/;
const ERROR_HEADING = /^[A-Za-z_$][\w.$-]*:(?:\s|$)/;

/** Only automatic, entirely extension-owned stacks are safe to discard. */
export function isBrowserExtensionError(
  event: Pick<
    FrontendErrorEvent,
    "source" | "stackFrames" | "stackTrace" | "componentStack" | "digest"
  >,
): boolean {
  if (
    !["window_error", "unhandled_rejection"].includes(event.source) ||
    event.componentStack ||
    event.digest
  ) return false;

  const files = event.stackFrames.map((frame) => frame.file);
  const trace = event.stackTrace ?? "";
  // A capped stack may hide application frames beyond the capture boundary.
  if (trace.length >= MAX_STACK_TRACE_LENGTH) return false;
  if (!trace && files.length >= MAX_STACK_FRAMES) return false;
  for (const [index, rawLine] of trace.split("\n").entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = CHROME_FRAME.exec(line) ?? FIREFOX_FRAME.exec(line);
    if (match) files.push(match[2] ?? "");
    // V8 starts with an error heading. Every other non-frame is ambiguous.
    else if (index !== 0 || !ERROR_HEADING.test(line)) return false;
  }
  return files.length > 0 && files.every((file) => EXTENSION_FILE.test(file));
}
