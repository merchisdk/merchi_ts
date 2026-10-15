import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createFrontendErrorReporter, type CaptureContext, type FrontendErrorEvent } from "../src/index.js";

const fixtures = JSON.parse(readFileSync("tests/fixtures/operation-errors.json", "utf8")) as Array<{
  name: string; errorType: string; source: CaptureContext["source"];
  operation?: CaptureContext["operation"]; apiStatusCode?: number; apiErrorCode?: number;
  stripeErrorCode?: string; suppression: string | null;
}>;

describe("operation-aware safe filters", () => {
  it.each(fixtures)("$name", (fixture) => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({ endpoint: "https://collector.example", application: "store", enabled: true, transport });
    const error = fixture.errorType === "AbortError"
      ? new DOMException("operation cancelled", "AbortError")
      : Object.assign(new Error("operation failed"), { name: fixture.errorType });
    Object.assign(error, {
      statusCode: fixture.apiStatusCode, errorCode: fixture.apiErrorCode,
      ...(fixture.stripeErrorCode ? { type: "card_error", code: fixture.stripeErrorCode } : {}),
    });
    const context: CaptureContext = {};
    if (fixture.source) context.source = fixture.source;
    if (fixture.operation) context.operation = fixture.operation;
    expect(reporter.captureUnexpected(error, context)).toBe(!fixture.suppression);
    expect(transport).toHaveBeenCalledTimes(fixture.suppression ? 0 : 1);
  });

  it("protects critical failures even when their stack is entirely an extension", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({ endpoint: "https://collector.example", application: "store", enabled: true, transport });
    const error = new Error("payment failed");
    error.stack = "Error: payment failed\n    at connect (chrome-extension://id/inpage.js:1:2)";
    expect(reporter.captureUnexpected(error, { source: "unhandled_rejection", operation: { name: "payment.confirm" } })).toBe(true);
  });

  it("does not let recovered or cancelled noise consume the real cart error allowance", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({ endpoint: "https://collector.example", application: "store", enabled: true, maxEventsPerPage: 1, transport });
    expect(reporter.captureUnexpected(new DOMException("cancel", "AbortError"), {
      operation: { name: "search.load", outcome: "cancelled", reason: "superseded" },
    })).toBe(false);
    expect(reporter.captureUnexpected(new TypeError("Failed to fetch"), {
      operation: { name: "cart.load", outcome: "failed" },
    })).toBe(true);
  });

  it("keeps different business operations distinct during deduplication", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({ endpoint: "https://collector.example", application: "store", enabled: true, transport });
    const error = new Error("Failed to fetch");
    expect(reporter.captureUnexpected(error, { operation: { name: "cart.load" } })).toBe(true);
    expect(reporter.captureUnexpected(error, { operation: { name: "payment.confirm" } })).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("reserves a separate bounded allowance for business failures after unknown error noise", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({ endpoint: "https://collector.example", application: "store", enabled: true, maxEventsPerPage: 1, transport });
    expect(reporter.captureUnexpected(new Error("unknown widget failed"))).toBe(true);
    expect(reporter.captureUnexpected(new Error("another widget failed"))).toBe(false);
    expect(reporter.captureUnexpected(new Error("cart unavailable"), { operation: { name: "cart.load" } })).toBe(true);
    expect(reporter.captureUnexpected(new Error("cart failed again"), { operation: { name: "cart.load" } })).toBe(false);
  });

  it("copies only allowlisted enums and numeric diagnostics from caller/provider objects", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({ endpoint: "https://collector.example", application: "store", enabled: true, transport: (_, event) => { events.push(event); } });
    const error = Object.assign(new Error("payment failed"), { statusCode: 503, errorCode: 1, type: "card_error", code: "secret-provider-value", original: { token: "customer-secret" } });
    const context = { operation: { name: "payment.confirm", outcome: "invalid", reason: "customer-secret", customerEmail: "person@example.com" } } as unknown as CaptureContext;
    expect(reporter.captureUnexpected(error, context)).toBe(true);
    expect(events[0]).toMatchObject({ operation: { name: "payment.confirm", outcome: "failed" }, apiStatusCode: 503, apiErrorCode: 1 });
    expect(JSON.stringify(events[0])).not.toMatch(/customer-secret|secret-provider-value|person@example/);
  });

  it("keeps malformed HTTP diagnostics instead of treating them as proof of validation or a card decline", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({ endpoint: "https://collector.example", application: "store", enabled: true, transport });
    const context: CaptureContext = { operation: { name: "payment.confirm", outcome: "handled", reason: "validation" } };
    expect(reporter.captureUnexpected(Object.assign(new Error("server failed"), {
      statusCode: "500", errorCode: 6, type: "card_error", code: "card_declined",
    }), context)).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
  });
});
