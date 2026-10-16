import { isBrowserExtensionError } from "./browserExtension.js";
import { apiFailureContext, isCriticalOperation, normalizeOperation, safeOperationSuppression } from "./operation.js";
import {
  errorDetails,
  MAX_COMPONENT_STACK_LENGTH,
  normalizeIdentifier,
  normalizeRoute,
} from "./normalize.js";
import { collectClientFingerprint } from "./clientFingerprint.js";
import { redactText } from "./redact.js";
import { fetchTransport } from "./transport.js";
import {
  FRONTEND_ERROR_SCHEMA_VERSION,
  type CaptureContext,
  type FrontendErrorEvent,
  type FrontendErrorReporterConfig,
  type FrontendErrorShouldReport,
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
  return [event.errorType, event.message, event.route ?? "", event.digest ?? "", frames,
    event.operation?.name ?? "", event.operation?.outcome ?? "", event.operation?.reason ?? "",
    event.apiStatusCode ?? "", event.apiErrorCode ?? "", event.stripeErrorCode ?? ""].join("\n");
}

export class FrontendErrorReporter {
  readonly #endpoint: string;
  readonly #application: string;
  readonly #releaseSha?: string;
  readonly #enabled: boolean;
  readonly #dedupeWindowMs: number;
  readonly #maxEventsPerPage: number;
  readonly #transport: FrontendErrorTransport;
  readonly #shouldReport: FrontendErrorShouldReport | undefined;
  readonly #seenAt = new Map<string, number>();
  #eventCount = 0;
  #criticalEventCount = 0;

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
    this.#shouldReport = config.shouldReport;
  }

  captureException(error: unknown, context: CaptureContext = {}): boolean {
    try {
      if (this.#shouldReport && !this.#shouldReport(error, context)) return false;
      if (!this.#enabled || !this.#endpoint) {
        return false;
      }
      const event = this.#buildEvent(error, context);
      if (!this.#shouldReport && (safeOperationSuppression(event) || isBrowserExtensionError(event))) return false;
      const critical = isCriticalOperation(event.operation);
      if ((critical ? this.#criticalEventCount : this.#eventCount) >= this.#maxEventsPerPage) return false;
      const key = dedupeKey(event);
      const now = Date.now();
      this.#removeExpiredDedupeEntries(now);
      const previous = this.#seenAt.get(key);
      if (previous !== undefined && now - previous < this.#dedupeWindowMs) return false;
      this.#seenAt.set(key, now);
      if (critical) this.#criticalEventCount += 1;
      else this.#eventCount += 1;
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

  /**
   * Report an unexpected failure. Non-Error rejections are normalised by the
   * same path as `captureException`, including operation-aware safe filters.
   * A status code or error name alone never establishes that a failure was handled.
   */
  captureUnexpected(error: unknown, context: CaptureContext = {}): boolean {
    return this.captureException(error, context);
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
      ...apiFailureContext(error),
    };
    if (this.#releaseSha) event.releaseSha = this.#releaseSha;
    if (route) event.route = route;
    if (digest) event.digest = digest;
    if (details.stackTrace) event.stackTrace = details.stackTrace;
    if (componentStack) event.componentStack = componentStack;
    const operation = normalizeOperation(context.operation);
    if (operation) event.operation = operation;
    const client = collectClientFingerprint();
    if (client) event.client = client;
    return event;
  }

  #removeExpiredDedupeEntries(now: number): void {
    for (const [key, seenAt] of this.#seenAt) {
      if (now - seenAt >= this.#dedupeWindowMs) this.#seenAt.delete(key);
    }
  }
}

interface NormalizedReporterConfig {
  endpoint: string;
  application: string;
  releaseSha: string;
  enabled: boolean;
  dedupeWindowMs: number;
  maxEventsPerPage: number;
  transport: FrontendErrorTransport;
  shouldReport?: FrontendErrorShouldReport;
}

function normalizedReporterConfig(config: FrontendErrorReporterConfig): NormalizedReporterConfig {
  const normalized: NormalizedReporterConfig = {
    endpoint: typeof config.endpoint === "string" ? config.endpoint.trim() : "",
    application: normalizeIdentifier(config.application, "unknown-frontend"),
    releaseSha: normalizeIdentifier(config.releaseSha, ""),
    enabled: config.enabled === true,
    dedupeWindowMs: Math.max(0, config.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS),
    maxEventsPerPage: Math.max(
      0,
      Math.floor(config.maxEventsPerPage ?? DEFAULT_MAX_EVENTS_PER_PAGE),
    ),
    transport: config.transport ?? fetchTransport,
  };
  if (config.shouldReport) normalized.shouldReport = config.shouldReport;
  return normalized;
}

function sameReporterConfig(
  left: NormalizedReporterConfig,
  right: NormalizedReporterConfig,
): boolean {
  return (
    left.endpoint === right.endpoint &&
    left.application === right.application &&
    left.releaseSha === right.releaseSha &&
    left.enabled === right.enabled &&
    left.dedupeWindowMs === right.dedupeWindowMs &&
    left.maxEventsPerPage === right.maxEventsPerPage &&
    left.transport === right.transport &&
    left.shouldReport === right.shouldReport
  );
}

let defaultReporter: FrontendErrorReporter | undefined;
let defaultReporterConfig: NormalizedReporterConfig | undefined;

export function createFrontendErrorReporter(
  config: FrontendErrorReporterConfig,
): FrontendErrorReporter {
  return new FrontendErrorReporter(config);
}

export function configureFrontendErrors(
  config: FrontendErrorReporterConfig,
): FrontendErrorReporter {
  const normalized = normalizedReporterConfig(config);
  if (
    defaultReporter &&
    defaultReporterConfig &&
    sameReporterConfig(defaultReporterConfig, normalized)
  ) {
    return defaultReporter;
  }
  defaultReporter = createFrontendErrorReporter(config);
  defaultReporterConfig = normalized;
  return defaultReporter;
}

export function getDefaultFrontendErrorReporter(): FrontendErrorReporter | undefined {
  return defaultReporter;
}

export function captureException(error: unknown, context?: CaptureContext): boolean {
  return defaultReporter?.captureException(error, context) ?? false;
}

export function captureUnexpected(error: unknown, context?: CaptureContext): boolean {
  return defaultReporter?.captureUnexpected(error, context) ?? false;
}
