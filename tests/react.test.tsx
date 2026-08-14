import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFrontendErrorReporter,
  type FrontendErrorEvent,
} from "../src/index.js";
import { MerchiErrorBoundary } from "../src/react.js";

function BrokenComponent(): never {
  throw new Error("component failed for person@example.com");
}

describe("MerchiErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the failure and renders a resettable fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({
      endpoint: "https://api.merchi.co/v6/frontend-errors",
      application: "merchi-dashboard",
      enabled: true,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });
    let shouldThrow = true;
    const Recoverable = (): React.ReactNode => {
      if (shouldThrow) return <BrokenComponent />;
      return <p>Recovered</p>;
    };

    render(
      <MerchiErrorBoundary
        reporter={reporter}
        fallback={({ reset }) => (
          <button
            type="button"
            onClick={() => {
              shouldThrow = false;
              reset();
            }}
          >
            Try again
          </button>
        )}
      >
        <Recoverable />
      </MerchiErrorBoundary>,
    );

    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: "react_error_boundary",
      message: "component failed for [redacted-email]",
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered")).toBeTruthy();
  });
});
