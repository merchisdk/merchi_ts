import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configureFrontendErrors,
  type FrontendErrorEvent,
} from "../src/index.js";
import {
  initMerchiStorefrontErrors,
  useReportRouteError,
} from "../src/next.js";

function RouteError({ error }: { error: Error & { digest?: string } }) {
  useReportRouteError(error);
  return <p>Something went wrong</p>;
}

describe("Next.js storefront helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("configures one storefront reporter and installs global handlers once", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const options = {
      apiUrl: "https://api.merchi.co/v6/",
      domainId: 42,
      releaseSha: "0123456789abcdef",
      enabled: true,
    };
    const first = initMerchiStorefrontErrors(options);
    const second = initMerchiStorefrontErrors(options);
    expect(second).toBe(first);

    const clientError = new Error("invalid phone");
    clientError.name = "ApiError";
    Object.assign(clientError, {
      statusCode: 422,
      errorCode: 6,
      errorMessage: "invalid phone",
    });
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", { value: clientError });
    window.dispatchEvent(rejection);
    window.dispatchEvent(new ErrorEvent("error", { error: new TypeError("render failed") }));
    const stringRejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(stringRejection, "reason", { value: "failed for person@example.com" });
    window.dispatchEvent(stringRejection);

    window.dispatchEvent(new ErrorEvent("error", {
      error: Object.assign(new Error("Loading chunk checkout failed."), { name: "ChunkLoadError" }),
    }));
    const chunkRejection = new Event("unhandledrejection");
    Object.defineProperty(chunkRejection, "reason", {
      value: new TypeError("Failed to fetch dynamically imported module: https://shop.example/app.js"),
    });
    window.dispatchEvent(chunkRejection);

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as FrontendErrorEvent);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.merchi.co/v6/frontend-errors");
    expect(bodies.map((event) => event.errorType)).toEqual(["ApiError", "TypeError", "NonErrorException", "ChunkLoadError", "TypeError"]);
    expect(bodies[1]).toMatchObject({
      application: "merchi-storefront-42",
      releaseSha: "0123456789abcdef",
      source: "window_error",
    });
    expect(bodies[2]?.message).toBe("failed for [redacted-email]");
  });

  it("reports route crashes including missing-resource API failures with their digest", () => {
    const events: FrontendErrorEvent[] = [];
    configureFrontendErrors({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-storefront-42",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });

    const error = new Error("route crashed") as Error & { digest?: string };
    error.digest = "digest-123";
    const { rerender } = render(<RouteError error={error} />);
    rerender(<RouteError error={error} />);

    const expected = new Error("missing") as Error & { digest?: string };
    expected.name = "ApiError";
    expected.digest = "digest-expected";
    Object.assign(expected, { statusCode: 404, errorCode: 8, errorMessage: "missing" });
    rerender(<RouteError error={expected} />);

    const chunk = Object.assign(new Error("Loading chunk checkout failed."), { name: "ChunkLoadError" });
    rerender(<RouteError error={chunk} />);
    expect(events).toHaveLength(3);
    expect(events[2]).toMatchObject({
      source: "react_error_boundary", errorType: "ChunkLoadError",
      message: "Loading chunk checkout failed.",
    });
    expect(events[0]).toMatchObject({
      source: "react_error_boundary",
      message: "route crashed",
      digest: "digest-123",
    });
    expect(events[1]).toMatchObject({
      source: "react_error_boundary", errorType: "ApiError",
      message: "missing", digest: "digest-expected",
    });
  });
});

