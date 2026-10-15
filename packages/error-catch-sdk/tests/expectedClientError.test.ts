import { describe, expect, it } from "vitest";

import { isExpectedClientError } from "../src/expectedClientError.js";

function apiError(fields: {
  statusCode?: number;
  errorCode?: number;
  message?: string;
}): Error {
  const error = new Error(fields.message ?? "No error message");
  error.name = "ApiError";
  return Object.assign(error, {
    statusCode: fields.statusCode,
    errorCode: fields.errorCode ?? 0,
    errorMessage: fields.message ?? "No error message",
    original: fields,
  });
}

describe("isExpectedClientError", () => {
  it("only suppresses recognized validation and input failures", () => {
    expect(isExpectedClientError(apiError({ statusCode: 404, errorCode: 8, message: "missing" }))).toBe(
      false,
    );
    expect(isExpectedClientError(apiError({ statusCode: 400, errorCode: 2, message: "invalid" }))).toBe(
      true,
    );
    expect(isExpectedClientError(apiError({ statusCode: 403, errorCode: 0, message: "forbidden" }))).toBe(
      false,
    );
    expect(isExpectedClientError(apiError({ statusCode: 499, errorCode: 1 }))).toBe(false);
    expect(isExpectedClientError(apiError({ statusCode: 401, errorCode: 7 }))).toBe(false);
    expect(isExpectedClientError(apiError({ statusCode: 429, errorCode: 2 }))).toBe(false);
    expect(isExpectedClientError(apiError({ statusCode: 422, errorCode: 6 }))).toBe(true);
  });

  it("reports @merchi/sdk server failures and unclassified ApiErrors", () => {
    expect(isExpectedClientError(apiError({ statusCode: 500, errorCode: 1, message: "boom" }))).toBe(
      false,
    );
    expect(isExpectedClientError(apiError({ statusCode: 500, errorCode: 2, message: "boom" }))).toBe(
      false,
    );
    expect(isExpectedClientError(apiError({ message: "empty response" }))).toBe(false);
    expect(isExpectedClientError(apiError({ errorCode: 1, message: "server" }))).toBe(false);
    expect(isExpectedClientError(apiError({ errorCode: 23, message: "future code" }))).toBe(false);
  });

  it("treats known client error codes as expected when statusCode is absent", () => {
    expect(isExpectedClientError(apiError({ errorCode: 3, message: "email exists" }))).toBe(true);
    expect(isExpectedClientError(apiError({ errorCode: 22, message: "unknown domain" }))).toBe(false);
  });

  it("recognises the ApiError shape @merchi/cart already reads", () => {
    expect(
      isExpectedClientError({
        errorMessage: "Unable to attach client to cart.",
        message: "Unable to attach client to cart.",
        statusCode: 422,
        errorCode: 6,
      }),
    ).toBe(true);
    expect(
      isExpectedClientError({
        errorMessage: "Unable to fetch cart.",
        message: "Unable to fetch cart.",
      }),
    ).toBe(false);
  });

  it("does not guess alternate status fields or plain failures", () => {
    expect(isExpectedClientError({ status: 400, errorMessage: "nope" })).toBe(false);
    expect(isExpectedClientError({ status_code: 400, errorMessage: "nope" })).toBe(false);
    expect(
      isExpectedClientError({
        status_code: 500,
        errorCode: 2,
        errorMessage: "client code, no statusCode",
      }),
    ).toBe(false);
    expect(isExpectedClientError({ statusCode: "400", errorMessage: "nope" })).toBe(false);
    expect(
      isExpectedClientError({ statusCode: "400", errorCode: 2, errorMessage: "client code" }),
    ).toBe(false);
    expect(isExpectedClientError(new TypeError("render failed"))).toBe(false);
    expect(isExpectedClientError("no such cookie present")).toBe(false);
    expect(isExpectedClientError(null)).toBe(false);
  });
});
