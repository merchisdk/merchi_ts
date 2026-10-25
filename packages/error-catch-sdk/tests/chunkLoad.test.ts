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

describe("stale chunk loads", () => {
  it.each(fixtures)("$name", (fixture) => {
    expect(isChunkLoadError({
      source: fixture.source,
      errorType: fixture.errorType,
      message: fixture.message,
      ...(fixture.operation ? { operation: fixture.operation } : {}),
    })).toBe(fixture.expected);
  });

  it("drops a React boundary chunk load before transport", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-7",
      enabled: true,
      maxEventsPerPage: 1,
      transport,
    });
    const chunk = new Error(
      "Failed to load chunk /_next/static/chunks/0d2ijvs3tsjg..js?dpl=dpl_test from module 64893",
    );
    chunk.name = "ChunkLoadError";
    expect(reporter.captureException(chunk, {
      source: "react_error_boundary",
      componentStack: "at RootLayout",
    })).toBe(false);
    expect(transport).not.toHaveBeenCalled();
    expect(reporter.captureException(new TypeError("Cart failed"), {
      source: "react_error_boundary",
    })).toBe(true);
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
