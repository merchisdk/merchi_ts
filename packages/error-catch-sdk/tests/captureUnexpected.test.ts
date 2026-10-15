import { describe, expect, it, vi } from "vitest";

import {
  captureUnexpected,
  configureFrontendErrors,
  createFrontendErrorReporter,
  type FrontendErrorEvent,
} from "../src/index.js";

function apiError(statusCode: number, errorCode: number, message: string): Error {
  const error = new Error(message);
  error.name = "ApiError";
  return Object.assign(error, { statusCode, errorCode, errorMessage: message });
}

describe("captureUnexpected", () => {
  it("skips expected client errors and still reports programming failures", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-1",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });

    expect(reporter.captureUnexpected(apiError(409, 3, "email exists"), {
      operation: { name: "checkout.submit", outcome: "handled", reason: "validation" },
    })).toBe(false);
    expect(reporter.captureException(apiError(409, 3, "email exists"))).toBe(true);
    expect(reporter.captureUnexpected(new TypeError("render failed"))).toBe(true);
    expect(events.map((event) => event.errorType)).toEqual(["ApiError", "TypeError"]);
  });

  it("normalises non-Error rejections instead of dropping them", () => {
    const events: FrontendErrorEvent[] = [];
    configureFrontendErrors({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-1",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });

    expect(captureUnexpected("failed for person@example.com")).toBe(true);
    expect(captureUnexpected({ customerEmail: "person@example.com" })).toBe(true);
    expect(events[0]).toMatchObject({
      errorType: "NonErrorException",
      message: "failed for [redacted-email]",
    });
    expect(events[1]?.message).toBe("Non-Error exception");
    expect(JSON.stringify(events[1])).not.toContain("person@example.com");
  });

  it("lets shouldReport replace the default client-error filter", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-1",
      enabled: true,
      shouldReport: () => true,
      transport,
    });
    expect(reporter.captureUnexpected(apiError(400, 2, "invalid"))).toBe(true);
    expect(transport).toHaveBeenCalledOnce();

    const blockedTransport = vi.fn();
    const blocked = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-1",
      enabled: true,
      shouldReport: () => false,
      transport: blockedTransport,
    });
    expect(blocked.captureException(new Error("hidden"))).toBe(false);
    expect(blocked.captureUnexpected(new TypeError("also hidden"))).toBe(false);
    expect(blockedTransport).not.toHaveBeenCalled();
  });

  it("reports authorization failures, missing cart resources and validation errors that crash a React route", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-5", enabled: true, transport,
    });
    expect(reporter.captureUnexpected(apiError(401, 7, "cart unauthorized"))).toBe(true);
    expect(reporter.captureUnexpected(apiError(403, 2, "cart forbidden"))).toBe(true);
    expect(reporter.captureUnexpected(apiError(404, 8, "cart missing"))).toBe(true);
    expect(reporter.captureUnexpected(apiError(429, 2, "checkout rate limited"))).toBe(true);
    expect(reporter.captureUnexpected(apiError(422, 6, "invalid phone"), {
      source: "react_error_boundary",
    })).toBe(true);
    expect(transport).toHaveBeenCalledTimes(5);
  });

  it("returns the existing reporter when configureFrontendErrors is called with the same config", () => {
    const transport = vi.fn();
    const config = {
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true as const,
      transport,
    };
    const first = configureFrontendErrors(config);
    const second = configureFrontendErrors({
      ...config,
      application: " merchi-dashboard ",
      dedupeWindowMs: 60_000,
      maxEventsPerPage: 20,
    });
    expect(second).toBe(first);
    expect(createFrontendErrorReporter(config)).not.toBe(first);

    const changed = configureFrontendErrors({ ...config, application: "other-frontend" });
    expect(changed).not.toBe(first);
  });
});
