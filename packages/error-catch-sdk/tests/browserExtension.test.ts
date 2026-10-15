import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { isBrowserExtensionError, createFrontendErrorReporter, type FrontendErrorSource } from "../src/index.js";
import { installGlobalErrorHandlers } from "../src/browser.js";
const fixtures = JSON.parse(readFileSync("tests/fixtures/browser-extension-errors.json", "utf8")) as Array<{
  name: string; source: FrontendErrorSource; frames: string[]; trace: string;
  componentStack?: string; digest?: string; expected: boolean;
}>;

describe("extension-only browser errors", () => {
  it.each(fixtures)("$name", (fixture) => {
    expect(isBrowserExtensionError({
      source: fixture.source as FrontendErrorSource,
      stackFrames: fixture.frames.map((file) => ({ file, function: "connect" })),
      stackTrace: fixture.trace,
      ...(fixture.componentStack ? { componentStack: fixture.componentStack } : {}),
      ...(fixture.digest ? { digest: fixture.digest } : {}),
    })).toBe(fixture.expected);
  });

  it("retains stacks truncated at the byte limit", () => {
    expect(isBrowserExtensionError({
      source: "window_error", stackFrames: [], stackTrace: "x".repeat(32000),
    })).toBe(false);
  });

  it("ignores the MetaMask rejection before transport and before consuming the page allowance", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-5", enabled: true, maxEventsPerPage: 1,
      transport,
    });
    const uninstall = installGlobalErrorHandlers(reporter);
    try {
      const extension = new Error("Failed to connect to MetaMask");
      extension.name = "i";
      extension.stack = fixtures[0]!.trace;
      const rejection = new Event("unhandledrejection");
      Object.defineProperty(rejection, "reason", { value: extension });
      window.dispatchEvent(rejection);
      expect(transport).not.toHaveBeenCalled();
      window.dispatchEvent(new ErrorEvent("error", { error: new TypeError("Cart failed") }));
      expect(transport).toHaveBeenCalledOnce();
    } finally {
      uninstall();
    }
  });

  it("keeps explicit captures and lets shouldReport override automatic filtering", () => {
    const transport = vi.fn();
    const config = { endpoint: "https://collector.example", application: "store", enabled: true, transport };
    const extension = new Error("Failed to connect to MetaMask");
    extension.stack = fixtures[0]!.trace;
    expect(createFrontendErrorReporter(config).captureException(extension)).toBe(true);
    expect(createFrontendErrorReporter({ ...config, shouldReport: () => true })
      .captureUnexpected(extension, { source: "unhandled_rejection" })).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
