import { redactText } from "./redact.js";
import type { FrontendErrorStackFrame } from "./types.js";

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const LONG_IDENTIFIER_SEGMENT = /^[a-z0-9_-]{32,}$/i;
const CHROME_FRAME = /^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
const FIREFOX_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

export const MAX_MESSAGE_LENGTH = 2_000;
export const MAX_STACK_TRACE_LENGTH = 32_000;
export const MAX_COMPONENT_STACK_LENGTH = 16_000;
export const MAX_STACK_FRAMES = 20;

function normalizedPathSegment(segment: string): string {
  if (UUID_SEGMENT.test(segment)) return "{uuid}";
  if (NUMERIC_SEGMENT.test(segment)) return "{id}";
  if (LONG_IDENTIFIER_SEGMENT.test(segment)) return "{id}";
  return redactText(segment, 200);
}

export function normalizeRoute(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = value.trim();
  let pathname: string;
  try {
    pathname = new URL(raw, "https://merchi.invalid").pathname;
  } catch {
    pathname = raw.split(/[?#]/, 1)[0] ?? "";
  }
  if (!pathname) return undefined;
  const normalized = pathname
    .split("/")
    .map(normalizedPathSegment)
    .join("/");
  return normalized.startsWith("/") ? normalized.slice(0, 1_000) : `/${normalized}`.slice(0, 1_000);
}

export function normalizeFrameFile(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return redactText(`${url.protocol}//${url.host}${url.pathname}`, 1_000);
  } catch {
    return redactText(raw.split(/[?#]/, 1)[0] ?? "", 1_000);
  }
}

function positiveInteger(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseStackFrames(stack: unknown): FrontendErrorStackFrame[] {
  if (typeof stack !== "string") return [];
  const frames: FrontendErrorStackFrame[] = [];
  for (const line of stack.split("\n")) {
    const match = CHROME_FRAME.exec(line) ?? FIREFOX_FRAME.exec(line);
    if (!match) continue;
    const file = normalizeFrameFile(match[2]);
    if (!file) continue;
    const frame: FrontendErrorStackFrame = {
      file,
      function: redactText(match[1]?.trim() || "<anonymous>", 300),
    };
    const lineNumber = positiveInteger(match[3] ?? "");
    const columnNumber = positiveInteger(match[4] ?? "");
    if (lineNumber !== undefined) frame.line = lineNumber;
    if (columnNumber !== undefined) frame.column = columnNumber;
    frames.push(frame);
    if (frames.length >= MAX_STACK_FRAMES) break;
  }
  return frames;
}

export function normalizeIdentifier(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.slice(0, 100) || fallback;
}

export function errorDetails(error: unknown): {
  errorType: string;
  message: string;
  stackTrace?: string;
  stackFrames: FrontendErrorStackFrame[];
  digest?: string;
} {
  if (!(error instanceof Error)) {
    const primitive =
      typeof error === "string" || typeof error === "number" || typeof error === "boolean"
        ? String(error)
        : "Non-Error exception";
    return {
      errorType: "NonErrorException",
      message: redactText(primitive, MAX_MESSAGE_LENGTH) || "Non-Error exception",
      stackFrames: [],
    };
  }

  const stackTrace = error.stack
    ? redactText(error.stack, MAX_STACK_TRACE_LENGTH)
    : undefined;
  const digestValue = (error as Error & { digest?: unknown }).digest;
  const details: {
    errorType: string;
    message: string;
    stackTrace?: string;
    stackFrames: FrontendErrorStackFrame[];
    digest?: string;
  } = {
    errorType: normalizeIdentifier(error.name, "Error"),
    message: redactText(error.message || "Unhandled application error", MAX_MESSAGE_LENGTH),
    stackFrames: parseStackFrames(error.stack),
  };
  if (stackTrace) details.stackTrace = stackTrace;
  if (typeof digestValue === "string" && digestValue.trim()) {
    details.digest = redactText(digestValue.trim(), 200);
  }
  return details;
}
