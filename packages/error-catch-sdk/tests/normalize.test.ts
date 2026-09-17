import { describe, expect, it } from "vitest";

import {
  errorDetails,
  normalizeFrameFile,
  normalizeRoute,
  parseStackFrames,
  redactText,
} from "../src/index.js";

describe("privacy normalization", () => {
  it("removes URL queries and normalizes dynamic route identifiers", () => {
    expect(normalizeRoute("https://dashboard.merchi.co/products/123?token=secret#tab")).toBe(
      "/products/{id}",
    );
    expect(normalizeRoute("/jobs/550e8400-e29b-41d4-a716-446655440000")).toBe(
      "/jobs/{uuid}",
    );
  });

  it("redacts common secrets and personal identifiers", () => {
    const value = redactText(
      "Authorization: Bearer abc.def.ghi email=person@example.com ip=192.168.1.2 password=hunter2",
      2_000,
    );
    expect(value).not.toContain("abc.def.ghi");
    expect(value).not.toContain("person@example.com");
    expect(value).not.toContain("192.168.1.2");
    expect(value).not.toContain("hunter2");
    expect(value).toContain("[redacted]");
  });

  it("strips query strings from stack frame URLs", () => {
    expect(normalizeFrameFile("https://example.com/app.js?token=secret#fragment")).toBe(
      "https://example.com/app.js",
    );
  });
});

describe("stack parsing", () => {
  it("parses Chrome and Firefox stack frames", () => {
    const frames = parseStackFrames(
      [
        "TypeError: broken",
        "    at renderProduct (https://dashboard.merchi.co/app.js?token=x:42:7)",
        "loadProduct@https://dashboard.merchi.co/data.js:8:3",
      ].join("\n"),
    );
    expect(frames).toEqual([
      {
        file: "https://dashboard.merchi.co/app.js",
        function: "renderProduct",
        line: 42,
        column: 7,
      },
      {
        file: "https://dashboard.merchi.co/data.js",
        function: "loadProduct",
        line: 8,
        column: 3,
      },
    ]);
  });

  it("does not serialize arbitrary rejected objects", () => {
    const details = errorDetails({ customerEmail: "person@example.com" });
    expect(details.errorType).toBe("NonErrorException");
    expect(details.message).toBe("Non-Error exception");
    expect(details.message).not.toContain("person@example.com");
  });
});
