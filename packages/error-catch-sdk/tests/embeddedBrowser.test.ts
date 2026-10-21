import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  createFrontendErrorReporter,
  isEmbeddedBrowserBridgeError,
  type FrontendErrorSource,
} from "../src/index.js";
import { installGlobalErrorHandlers } from "../src/browser.js";

const fixtures = JSON.parse(
  readFileSync("tests/fixtures/embedded-browser-errors.json", "utf8"),
) as Array<{
  name: string;
  source: FrontendErrorSource;
  errorType: string;
  message: string;
  componentStack?: string;
  digest?: string;
  expected: boolean;
}>;

describe("embedded Chromium bridge errors", () => {
  it.each(fixtures)("$name", (fixture) => {
    expect(isEmbeddedBrowserBridgeError({
      source: fixture.source,
      message: fixture.message,
      ...(fixture.componentStack ? { componentStack: fixture.componentStack } : {}),
      ...(fixture.digest ? { digest: fixture.digest } : {}),
    })).toBe(fixture.expected);
  });

  it("ignores the CefSharp rejection before transport and before consuming the page allowance", () => {
    const transport = vi.fn();
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-7", enabled: true, maxEventsPerPage: 1,
      transport,
    });
    const uninstall = installGlobalErrorHandlers(reporter);
    try {
      const rejection = new Event("unhandledrejection");
      Object.defineProperty(rejection, "reason", {
        value: "Object Not Found Matching Id:2, MethodName:update, ParamCount:4",
      });
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
    const noise = "Object Not Found Matching Id:2, MethodName:update, ParamCount:4";
    expect(createFrontendErrorReporter(config).captureException(noise)).toBe(true);
    expect(createFrontendErrorReporter({ ...config, shouldReport: () => true })
      .captureUnexpected(noise, { source: "unhandled_rejection" })).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("retains the signature on a critical purchase operation", () => {
    expect(isEmbeddedBrowserBridgeError({
      source: "unhandled_rejection",
      message: "Object Not Found Matching Id:2, MethodName:update, ParamCount:4",
      operation: { name: "payment.confirm", outcome: "failed" },
    })).toBe(false);
  });
});
