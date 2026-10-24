// @vitest-environment node
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";

import { errorDetails } from "../src/normalize.js";
import { createFrontendErrorReporter } from "../src/reporter.js";
import type { FrontendErrorEvent } from "../src/types.js";

type ErrorWithBrandCheck = ErrorConstructor & { isError?: (value: unknown) => boolean };
const errorConstructor = Error as ErrorWithBrandCheck;
const nativeCheckAvailable = typeof errorConstructor.isError === "function";
const generic = { errorType: "NonErrorException", message: "Non-Error exception", stackFrames: [] };

function foreignError(): Error {
  return runInNewContext(`new TypeError("request failed for person@example.com token=secret")`) as Error;
}

describe.skipIf(!nativeCheckAvailable)("cross-realm native diagnostics", () => {
  it("preserves a genuine foreign Error's bounded, redacted diagnostics", () => {
    const error = foreignError();
    expect(error instanceof Error).toBe(false);
    error.stack = "TypeError: person@example.com\n    at load (https://store.example/app.js?private=hidden:12:3)";
    Object.assign(error, { digest: "token=secret", customer: { email: "private@example.com" } });
    expect(errorDetails(error)).toEqual({
      errorType: "TypeError",
      message: "request failed for [redacted-email] token=[redacted]",
      stackTrace: "TypeError: [redacted-email]\n    at load (https://store.example/app.js)",
      stackFrames: [{ file: "https://store.example/app.js", function: "load", line: 12, column: 3 }],
      digest: "token=[redacted]",
    });
  });

  it("retains automatic reports and only the existing allowlisted fields", () => {
    const events: FrontendErrorEvent[] = [];
    const reporter = createFrontendErrorReporter({ enabled: true, endpoint: "https://example.invalid/errors",
      application: "test", transport: (_endpoint, event) => { events.push(event); } });
    const error = foreignError();
    Object.assign(error, { cause: { password: "hidden" }, errors: ["hidden"], customerEmail: "hidden" });
    expect(reporter.captureUnexpected(error, { source: "unhandled_rejection" })).toBe(true);
    expect(events[0]).toMatchObject({ source: "unhandled_rejection", errorType: "TypeError" });
    expect(JSON.stringify(events)).not.toContain("hidden");
  });

  it("handles foreign Error subclasses and AggregateError without copying contents", () => {
    for (const expression of ["new (class CustomError extends Error {})('failed')",
      "new AggregateError([{ password: 'hidden' }], 'failed')"]) {
      const result = errorDetails(runInNewContext(expression));
      expect(result.message).toBe("failed");
      expect(result.errorType).not.toBe("NonErrorException");
      expect(JSON.stringify(result)).not.toContain("hidden");
    }
  });

  it("preserves existing local Error and DOMException behavior", () => {
    expect(errorDetails(new TypeError("local"))).toMatchObject({ errorType: "TypeError", message: "local" });
    expect(errorDetails(new DOMException("cancelled", "AbortError"))).toMatchObject({ errorType: "AbortError", message: "cancelled" });
  });

  it("preserves native identity when its prototype or toStringTag changes", () => {
    const error = foreignError();
    Object.setPrototypeOf(error, null);
    Object.defineProperty(error, Symbol.toStringTag, { value: "CustomerRecord" });
    expect(errorDetails(error)).toMatchObject({ errorType: "Error", message: expect.stringContaining("request failed") });
  });

  it.each(["name", "message", "stack", "digest"])("reads %s once and contains a throwing accessor", (field) => {
    const error = foreignError();
    // V8's lazy stack formatter can itself read name/message. Use a data stack
    // to measure only the normalizer's direct property reads here.
    error.stack = "TypeError: failed";
    let calls = 0;
    Object.defineProperty(error, field, { configurable: true, get() { calls += 1; throw new Error("secret"); } });
    expect(() => errorDetails(error)).not.toThrow();
    expect(calls).toBe(1);
  });

  it("never coerces non-string diagnostic fields", () => {
    const error = foreignError();
    const toString = vi.fn(() => "private customer data");
    for (const field of ["name", "message", "stack", "digest"]) {
      Object.defineProperty(error, field, { value: { toString }, configurable: true });
    }
    expect(errorDetails(error)).toEqual({ errorType: "Error", message: "Unhandled application error", stackFrames: [] });
    expect(toString).not.toHaveBeenCalled();
  });

  it("retains message, stack, digest and frame limits", () => {
    const error = foreignError();
    error.message = "m".repeat(4000);
    error.stack = Array.from({ length: 1000 }, (_, i) => `at f (https://store.example/${i}.js:1:2)`).join("\n");
    Object.assign(error, { digest: "d".repeat(400) });
    const result = errorDetails(error);
    expect(result.message).toHaveLength(2000);
    expect(result.stackTrace).toHaveLength(32000);
    expect(result.stackFrames).toHaveLength(20);
    expect(result.digest).toHaveLength(200);
  });

  it("rejects fake tags, foreign/local Error prototypes, and proxies", () => {
    const tagged = { [Symbol.toStringTag]: "Error", message: "private@example.com" };
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    const values = [tagged, Object.create(Error.prototype), runInNewContext("Object.create(Error.prototype)"),
      new Proxy(tagged, { has: () => false, getOwnPropertyDescriptor: () => undefined }),
      new Proxy(foreignError(), {}), revocable.proxy];
    for (const value of values) expect(errorDetails(value)).toEqual(generic);
  });

  it("does not read properties of an arbitrary rejected object", () => {
    const get = vi.fn(() => { throw new Error("must not read"); });
    const object = new Proxy({}, { get });
    expect(errorDetails(object)).toEqual(generic);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("compatibility fallback", () => {
  const bundled = buildSync({ entryPoints: ["src/normalize.ts"], bundle: true, platform: "node",
    format: "cjs", write: false }).outputFiles[0]!.text;
  it.each(["undefined", "() => true", "value => Object.prototype.toString.call(value) === '[object Error]'"])(
    "does not use missing or nonconforming brand check %s", (check) => {
      // Isolate feature detection from the test runner's own Error.isError use.
      const result = runInNewContext(`
        Error.isError = ${check};
        ${bundled}
        ({ foreign: module.exports.errorDetails(foreign),
           tagged: module.exports.errorDetails({ [Symbol.toStringTag]: 'Error', message: 'private' }),
           local: module.exports.errorDetails(new TypeError('local')),
           dom: module.exports.errorDetails(new DOMException('cancelled', 'AbortError')) })
      `, { module: { exports: {} }, foreign: foreignError(), DOMException });
      expect(result.foreign).toEqual(generic);
      expect(result.tagged).toEqual(generic);
      expect(result.local).toMatchObject({ errorType: "TypeError", message: "local" });
      expect(result.dom).toMatchObject({ errorType: "AbortError", message: "cancelled" });
    },
  );

  it.each([null, undefined, {}, [], Symbol("private"), 12n])("keeps arbitrary value %s generic", (value) => {
    expect(errorDetails(value)).toEqual(generic);
  });
});
