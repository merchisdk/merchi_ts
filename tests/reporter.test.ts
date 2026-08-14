import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureException,
  configureFrontendErrors,
  createFrontendErrorReporter,
  type FrontendErrorEvent,
} from "../src/index.js";

describe("FrontendErrorReporter", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/products/123?secret=value");
  });

  it("is opt-in and sends an allowlisted, normalized event", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      releaseSha: " release sha ",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });

    const error = new TypeError("Failed for person@example.com");
    error.stack = "TypeError: Failed\n    at render (https://dashboard.merchi.co/app.js?token=x:12:4)";
    expect(reporter.captureException(error, { source: "window_error" })).toBe(true);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      application: "merchi-dashboard",
      releaseSha: "release-sha",
      source: "window_error",
      errorType: "TypeError",
      message: "Failed for [redacted-email]",
      route: "/products/{id}",
    });
    expect(events[0]?.stackFrames[0]?.file).toBe("https://dashboard.merchi.co/app.js");
    expect(events[0]).not.toHaveProperty("environment");
    expect(events[0]).not.toHaveProperty("user");
  });

  it("does nothing unless reporting is explicitly enabled", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      transport,
    });
    expect(reporter.captureException(new Error("disabled"))).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it("falls back to an allowlisted source for untyped JavaScript consumers", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });
    reporter.captureException(new Error("invalid source"), {
      source: "user-controlled-value" as "manual",
    });
    expect(events[0]?.source).toBe("manual");
  });

  it("suppresses duplicates and enforces the per-page cap", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      dedupeWindowMs: 60_000,
      maxEventsPerPage: 2,
      transport,
    });
    const repeated = new Error("same error");
    expect(reporter.captureException(repeated)).toBe(true);
    expect(reporter.captureException(repeated)).toBe(false);
    expect(reporter.captureException(new Error("second error"))).toBe(true);
    expect(reporter.captureException(new Error("over the cap"))).toBe(false);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("swallows synchronous and asynchronous transport failures", async () => {
    const synchronous = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      transport: () => {
        throw new Error("network failed");
      },
    });
    const asynchronous = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      transport: () => Promise.reject(new Error("network failed")),
    });
    expect(() => synchronous.captureException(new Error("app error"))).not.toThrow();
    expect(() => asynchronous.captureException(new Error("app error"))).not.toThrow();
    await Promise.resolve();
  });

  it("provides safe singleton convenience functions", () => {
    const transport = vi.fn();
    configureFrontendErrors({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      transport,
    });
    expect(captureException(new Error("singleton"))).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
  });
});
