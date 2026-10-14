import { describe, expect, it } from "vitest";

import { isReportingEnabled } from "../src/reporting.js";

describe("isReportingEnabled", () => {
  it("enables production when the flag is unset", () => {
    expect(isReportingEnabled("production", undefined)).toBe(true);
    expect(isReportingEnabled(" Production ", "")).toBe(true);
  });

  it("disables non-production when the flag is unset or unrecognised", () => {
    expect(isReportingEnabled("development", undefined)).toBe(false);
    expect(isReportingEnabled("test", undefined)).toBe(false);
    expect(isReportingEnabled(undefined, undefined)).toBe(false);
    expect(isReportingEnabled("development", "maybe")).toBe(false);
    expect(isReportingEnabled("production", "maybe")).toBe(true);
  });

  it("opts in from an explicit truthy flag in any environment", () => {
    for (const flag of ["true", "TRUE", " 1 ", "yes", "on"]) {
      expect(isReportingEnabled("development", flag)).toBe(true);
      expect(isReportingEnabled(undefined, flag)).toBe(true);
    }
  });

  it("opts out from an explicit falsy flag, including in production", () => {
    for (const flag of ["false", "FALSE", "0", "no", "off"]) {
      expect(isReportingEnabled("production", flag)).toBe(false);
      expect(isReportingEnabled("development", flag)).toBe(false);
    }
  });
});
