import { describe, expect, it, vi } from "vitest";

import { installGlobalErrorHandlers } from "../src/browser.js";
import {
  createFrontendErrorReporter,
  type FrontendErrorEvent,
} from "../src/index.js";

describe("global browser handlers", () => {
  it("captures Error objects and ignores resource or non-Error failures", () => {
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
    ]);
    uninstall();
  });

  it("reference-counts repeated installation", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const captureException = vi.fn(() => true);
    const reporter = { captureException } as unknown as ReturnType<
      typeof createFrontendErrorReporter
    >;
    const firstUninstall = installGlobalErrorHandlers(reporter);
    const secondUninstall = installGlobalErrorHandlers(reporter);

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("once") }));
    expect(captureException).toHaveBeenCalledOnce();
    firstUninstall();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("still installed") }));
    expect(captureException).toHaveBeenCalledTimes(2);
    secondUninstall();
    expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function),
    );
    removeEventListener.mockRestore();
  });
});
