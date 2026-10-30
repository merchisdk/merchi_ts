import { describe, expect, it } from "vitest";
import { createFrontendErrorReporter, sanitizeEvidenceUrl, type FrontendErrorEvent } from "../src/index.js";
import cases from "./evidence-urls.json" with { type: "json" };

describe("navigation evidence", () => {
  it.each(cases)("sanitizes %s", (input, expected) => {
    expect(sanitizeEvidenceUrl(input)).toBe(expected);
    expect(sanitizeEvidenceUrl(expected)).toBe(expected);
    expect(sanitizeEvidenceUrl(input, true)).toBe(expected!.replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
  });

  it.each(["javascript:alert(1)", "not a URL", "https://host:bad/jobs/123"])("rejects %s", (input) => {
    expect(sanitizeEvidenceUrl(input)).toBeUndefined();
  });

  it("sends usable evidence while keeping duplicate grouping independent of record IDs", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({ enabled: true, endpoint: "/errors", application: "merchi-dashboard", transport: (_endpoint, event) => { events.push(event); } });
    const error = new Error("load failed");
    window.history.replaceState({}, "", "/jobs/123?invoice_id=456&token=RAW_SECRET");
    expect(reporter.captureException(error)).toBe(true);
    expect(events[0]?.route).toBe("/jobs/123");
    expect(events[0]?.pageUrl).toContain("/jobs/123?invoice_id=456&token=%5Bredacted%5D");
    window.history.replaceState({}, "", "/jobs/789");
    expect(reporter.captureException(error)).toBe(false);
    expect(JSON.stringify(events)).not.toContain("RAW_SECRET");
    expect(reporter.captureException(new Error("another failure"), { route: "/invoices/456?token=RAW_SECRET" })).toBe(true);
    expect(events[1]?.route).toBe("/invoices/456");
    expect(events[1]?.pageUrl).toContain(`${window.location.origin}/invoices/456?token=%5Bredacted%5D`);
  });
});
