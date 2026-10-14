import { describe, expect, it, vi } from "vitest";

import { installGlobalErrorHandlers } from "../src/browser.js";
import {
  createFrontendErrorReporter,
  type FrontendErrorEvent,
} from "../src/index.js";

describe("global browser handlers", () => {
  it("captures Error objects, normalises non-Error rejections, and ignores resource errors", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });
    const uninstall = installGlobalErrorHandlers(reporter);

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("render failed") }));
    window.dispatchEvent(new Event("error"));
    const errorRejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(errorRejection, "reason", { value: new Error("async failed") });
    window.dispatchEvent(errorRejection);
    const objectRejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(objectRejection, "reason", { value: { unsafe: "object" } });
    window.dispatchEvent(objectRejection);

    expect(events.map((event) => event.source)).toEqual([
      "window_error",
      "unhandled_rejection",
      "unhandled_rejection",
    ]);
    expect(events[2]).toMatchObject({
      errorType: "NonErrorException",
      message: "Non-Error exception",
    });
    expect(JSON.stringify(events[2])).not.toContain("unsafe");
    uninstall();
  });

  it("does not report expected Merchi client errors from global handlers", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });
    const uninstall = installGlobalErrorHandlers(reporter);
    const clientError = new Error("already registered");
    clientError.name = "ApiError";
    Object.assign(clientError, {
      statusCode: 409,
      errorCode: 3,
      errorMessage: "already registered",
    });
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", { value: clientError });
    window.dispatchEvent(rejection);
    window.dispatchEvent(new ErrorEvent("error", { error: clientError }));
    expect(events).toEqual([]);
    uninstall();
  });

  it("reference-counts repeated installation", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const captureUnexpected = vi.fn(() => true);
    const reporter = { captureUnexpected } as unknown as ReturnType<
      typeof createFrontendErrorReporter
    >;
    const firstUninstall = installGlobalErrorHandlers(reporter);
    const secondUninstall = installGlobalErrorHandlers(reporter);

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("once") }));
    expect(captureUnexpected).toHaveBeenCalledOnce();
    firstUninstall();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("still installed") }));
    expect(captureUnexpected).toHaveBeenCalledTimes(2);
    secondUninstall();
    expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function),
    );
    removeEventListener.mockRestore();
  });
});
