import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTransport,
  FRONTEND_ERROR_SCHEMA_VERSION,
  type FrontendErrorEvent,
} from "../src/index.js";

describe("fetchTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts JSON without cookies, credentials, cache, or referrer data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const event: FrontendErrorEvent = {
      schemaVersion: FRONTEND_ERROR_SCHEMA_VERSION,
      eventId: "event-12345678",
      occurredAt: "2026-08-14T00:00:00.000Z",
      application: "merchi-dashboard",
      source: "manual",
      errorType: "Error",
      message: "test",
      stackFrames: [],
    };

    await fetchTransport("https://api.merchi.co/v6/frontend-errors", event);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.merchi.co/v6/frontend-errors",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(event),
        credentials: "omit",
        cache: "no-store",
        keepalive: true,
        referrerPolicy: "no-referrer",
      }),
    );
  });
});
