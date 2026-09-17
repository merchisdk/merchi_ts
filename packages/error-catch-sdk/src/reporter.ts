import {
  errorDetails,
  MAX_COMPONENT_STACK_LENGTH,
  normalizeIdentifier,
  normalizeRoute,
} from "./normalize.js";
import { redactText } from "./redact.js";
import { fetchTransport } from "./transport.js";
import {
  FRONTEND_ERROR_SCHEMA_VERSION,
  type CaptureContext,
  type FrontendErrorEvent,
  type FrontendErrorReporterConfig,
  type FrontendErrorSource,
  type FrontendErrorTransport,
} from "./types.js";

const DEFAULT_DEDUPE_WINDOW_MS = 60_000;
const DEFAULT_MAX_EVENTS_PER_PAGE = 20;
const VALID_SOURCES = new Set<FrontendErrorSource>([
  "manual",
  "window_error",
  "unhandled_rejection",
  "react_error_boundary",
]);

function normalizeSource(value: unknown): FrontendErrorSource {
  return typeof value === "string" && VALID_SOURCES.has(value as FrontendErrorSource)
    ? (value as FrontendErrorSource)
    : "manual";
}

function currentRoute(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return normalizeRoute(window.location.pathname);
}

function eventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function dedupeKey(event: FrontendErrorEvent): string {
  const frames = event.stackFrames
    .slice(0, 5)
    .map((frame) => `${frame.file}:${frame.function}:${frame.line ?? ""}:${frame.column ?? ""}`)
    .join("|");
  return [event.errorType, event.message, event.route ?? "", event.digest ?? "", frames].join("\n");
}

export class FrontendErrorReporter {
  readonly #endpoint: string;
  readonly #application: string;
  readonly #releaseSha?: string;
  readonly #enabled: boolean;
  readonly #dedupeWindowMs: number;
  readonly #maxEventsPerPage: number;
  readonly #transport: FrontendErrorTransport;
  readonly #seenAt = new Map<string, number>();
  #eventCount = 0;

  constructor(config: FrontendErrorReporterConfig) {
    this.#endpoint = typeof config.endpoint === "string" ? config.endpoint.trim() : "";
    this.#application = normalizeIdentifier(config.application, "unknown-frontend");
    const releaseSha = normalizeIdentifier(config.releaseSha, "");
    if (releaseSha) this.#releaseSha = releaseSha;
    this.#enabled = config.enabled === true;
    this.#dedupeWindowMs = Math.max(0, config.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS);
    this.#maxEventsPerPage = Math.max(
      0,
      Math.floor(config.maxEventsPerPage ?? DEFAULT_MAX_EVENTS_PER_PAGE),
    );
    this.#transport = config.transport ?? fetchTransport;
  }

  captureException(error: unknown, context: CaptureContext = {}): boolean {
    try {
      if (!this.#enabled || !this.#endpoint || this.#eventCount >= this.#maxEventsPerPage) {
        return false;
      }
      const event = this.#buildEvent(error, context);
      const key = dedupeKey(event);
      const now = Date.now();
      this.#removeExpiredDedupeEntries(now);
      const previous = this.#seenAt.get(key);
      if (previous !== undefined && now - previous < this.#dedupeWindowMs) return false;
      this.#seenAt.set(key, now);
      this.#eventCount += 1;
      try {
        void Promise.resolve(this.#transport(this.#endpoint, event)).catch(() => undefined);
      } catch {
        // Error reporting must never interfere with the host application.
      }
      return true;
    } catch {
      return false;
    }
  }

  #buildEvent(error: unknown, context: CaptureContext): FrontendErrorEvent {
    const details = errorDetails(error);
    const route = normalizeRoute(context.route) ?? currentRoute();
    const digest = context.digest
      ? redactText(context.digest, 200)
      : details.digest;
    const componentStack = context.componentStack
      ? redactText(context.componentStack, MAX_COMPONENT_STACK_LENGTH)
      : undefined;
    const event: FrontendErrorEvent = {
      schemaVersion: FRONTEND_ERROR_SCHEMA_VERSION,
      eventId: eventId(),
      occurredAt: new Date().toISOString(),
      application: this.#application,
      source: normalizeSource(context.source),
      errorType: details.errorType,
      message: details.message,
      stackFrames: details.stackFrames,
    };
    if (this.#releaseSha) event.releaseSha = this.#releaseSha;
    if (route) event.route = route;
    if (digest) event.digest = digest;
    if (details.stackTrace) event.stackTrace = details.stackTrace;
    if (componentStack) event.componentStack = componentStack;
    return event;
  }

  #removeExpiredDedupeEntries(now: number): void {
    for (const [key, seenAt] of this.#seenAt) {
      if (now - seenAt >= this.#dedupeWindowMs) this.#seenAt.delete(key);
    }
  }
}

let defaultReporter: FrontendErrorReporter | undefined;

export function createFrontendErrorReporter(
  config: FrontendErrorReporterConfig,
): FrontendErrorReporter {
  return new FrontendErrorReporter(config);
}

export function configureFrontendErrors(
  config: FrontendErrorReporterConfig,
): FrontendErrorReporter {
  defaultReporter = createFrontendErrorReporter(config);
  return defaultReporter;
}

export function getDefaultFrontendErrorReporter(): FrontendErrorReporter | undefined {
  return defaultReporter;
}

export function captureException(error: unknown, context?: CaptureContext): boolean {
  return defaultReporter?.captureException(error, context) ?? false;
}
