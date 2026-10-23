import { MAX_STACK_FRAMES, MAX_STACK_TRACE_LENGTH } from "./normalize.js";
import type { FrontendErrorEvent } from "./types.js";
import { isCriticalOperation } from "./operation.js";

const EXTENSION_FILE =
  /^(?:chrome-extension|moz-extension|safari-extension|safari-web-extension|ms-browser-extension):\/\/[^/\s]+\//i;
const CHROME_FRAME = /^at\s+(?:(.*?)\s+\()?(.+?):\d+:\d+\)?$/;
const FIREFOX_FRAME = /^(.*?)@(.+?):\d+:\d+$/;
// Query redaction removes ?...:line:col, leaving a bare URL in parentheses.
const REDACTED_CHROME_FRAME =
  /^at\s+(?:(.*?)\s+\()?((?:https?|chrome-extension|moz-extension|safari-extension|safari-web-extension|ms-browser-extension):\/\/[^)\s]+)\)?$/i;
const REDACTED_FIREFOX_FRAME =
  /^(.*?)@((?:https?|chrome-extension|moz-extension|safari-extension|safari-web-extension|ms-browser-extension):\/\/[^)\s]+)$/i;
const ERROR_HEADING = /^[A-Za-z_$][\w.$-]*:(?:\s|$)/;
// Tag scripts an extension wraps when its own fetch fails. Not payment code.
const TAG_SCRIPT_HOSTS = new Set([
  "www.googletagmanager.com",
  "www.google-analytics.com",
  "ssl.google-analytics.com",
  "www.googleadservices.com",
  "googleads.g.doubleclick.net",
  "stats.g.doubleclick.net",
  "www.googletagservices.com",
]);

function frameOwner(file: string): "extension" | "tag" | undefined {
  if (EXTENSION_FILE.test(file)) return "extension";
  try {
    const url = new URL(file);
    if (url.protocol === "https:" && TAG_SCRIPT_HOSTS.has(url.hostname.toLowerCase())) {
      return "tag";
    }
  } catch {
    // Unknown or relative frames can still be application code.
  }
  return undefined;
}

/**
 * Automatic reports whose frames are only an extension, or an extension plus
 * the tag script it wrapped. A first-party or unknown frame stays reportable.
 */
export function isBrowserExtensionError(
  event: Pick<
    FrontendErrorEvent,
    "source" | "stackFrames" | "stackTrace" | "componentStack" | "digest" | "operation"
  >,
): boolean {
  if (
    !["window_error", "unhandled_rejection"].includes(event.source) ||
    event.componentStack ||
    event.digest || isCriticalOperation(event.operation)
  ) return false;

  const files = event.stackFrames.map((frame) => frame.file);
  const trace = event.stackTrace ?? "";
  // A capped stack may hide application frames beyond the capture boundary.
  if (trace.length >= MAX_STACK_TRACE_LENGTH) return false;
  if (!trace && files.length >= MAX_STACK_FRAMES) return false;
  for (const [index, rawLine] of trace.split("\n").entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const match =
      CHROME_FRAME.exec(line) ??
      FIREFOX_FRAME.exec(line) ??
      REDACTED_CHROME_FRAME.exec(line) ??
      REDACTED_FIREFOX_FRAME.exec(line);
    if (match) files.push(match[2] ?? "");
    // V8 starts with an error heading. Every other non-frame is ambiguous.
    else if (index !== 0 || !ERROR_HEADING.test(line)) return false;
  }
  const owners = files.map(frameOwner);
  return (
    owners.some((owner) => owner === "extension") &&
    owners.every((owner) => owner !== undefined)
  );
}
