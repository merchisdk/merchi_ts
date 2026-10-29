import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  createFrontendErrorReporter,
  isChunkLoadError,
  type FrontendErrorOperationContext,
  type FrontendErrorSource,
} from "../src/index.js";

const fixtures = JSON.parse(
  readFileSync("tests/fixtures/chunk-load-errors.json", "utf8"),
) as Array<{
  name: string;
  source: FrontendErrorSource;
  errorType: string;
  message: string;
  componentStack?: string;
  digest?: string;
  operation?: FrontendErrorOperationContext;
  expected: boolean;
}>;

describe("chunk classification is not proof of recovery", () => {
  it.each(fixtures)("$name", (fixture) => {
    expect(isChunkLoadError({
      source: fixture.source,
      errorType: fixture.errorType,
      message: fixture.message,
      ...(fixture.operation ? { operation: fixture.operation } : {}),
    })).toBe(fixture.expected);
  });

  it("reports an unresolved React boundary chunk load", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-7",
      enabled: true,
      maxEventsPerPage: 2,
      transport,
    });
    const chunk = new Error(
      "Failed to load chunk /_next/static/chunks/0d2ijvs3tsjg..js?dpl=dpl_test from module 64893",
    );
    chunk.name = "ChunkLoadError";
    expect(reporter.captureException(chunk, {
      source: "react_error_boundary",
      componentStack: "at RootLayout",
    })).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
    expect(reporter.captureException(new TypeError("Cart failed"), {
      source: "react_error_boundary",
    })).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each(fixtures)("retains unresolved report: $name", (fixture) => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://collector.example", application: "store", enabled: true, transport,
    });
    const error = Object.assign(new Error(fixture.message), { name: fixture.errorType });
    expect(reporter.captureUnexpected(error, {
      source: fixture.source,
      ...(fixture.componentStack ? { componentStack: fixture.componentStack } : {}),
      ...(fixture.digest ? { digest: fixture.digest } : {}),
      ...(fixture.operation ? { operation: fixture.operation } : {}),
    })).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
  });

  for (const source of ["manual", "window_error", "unhandled_rejection", "react_error_boundary"] as const) {
    for (const name of ["navigation.load", "cart.load", "checkout.submit", "payment.confirm"] as const) {
      for (const outcome of ["failed", "recovered"] as const) {
        it(`${source} ${name} ${outcome} follows explicit recovery policy`, () => {
          const transport = vi.fn();
          const reporter = createFrontendErrorReporter({
            endpoint: "https://collector.example", application: "store", enabled: true, transport,
          });
          const error = Object.assign(new Error("Loading chunk 12 failed."), { name: "ChunkLoadError" });
          const suppressed = name === "navigation.load" && outcome === "recovered" && source !== "react_error_boundary";
          expect(reporter.captureUnexpected(error, {
            source, operation: { name, outcome, ...(outcome === "recovered" ? { reason: "retry_succeeded" as const } : {}) },
          })).toBe(!suppressed);
          expect(transport).toHaveBeenCalledTimes(suppressed ? 0 : 1);
        });
      }
    }
  }

  it.each([
    { operation: { name: "navigation.load", outcome: "recovered" } },
    { operation: { name: "navigation.load", outcome: "handled", reason: "retry_succeeded" } },
    { operation: { name: "navigation.load", outcome: "recovered", reason: "retry_succeeded" }, componentStack: "at Page" },
    { source: "window_error", operation: { name: "navigation.load", outcome: "recovered", reason: "retry_succeeded" }, digest: "route-crash" },
  ] as const)("retains unproven recovery or render failure %#", (context) => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://collector.example", application: "store", enabled: true, transport,
    });
    expect(reporter.captureUnexpected(new TypeError("Failed to fetch dynamically imported module"), context)).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
  });

  it("keeps explicit captures and lets shouldReport override automatic filtering", () => {
    const transport = vi.fn();
    const config = {
      endpoint: "https://collector.example",
      application: "store",
      enabled: true,
      transport,
    };
    const chunk = new Error("Failed to load chunk /_next/static/chunks/app.js from module 12");
    chunk.name = "ChunkLoadError";
    expect(createFrontendErrorReporter(config).captureException(chunk)).toBe(true);
    expect(createFrontendErrorReporter({ ...config, shouldReport: () => true })
      .captureException(chunk, { source: "react_error_boundary" })).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
  });
});

