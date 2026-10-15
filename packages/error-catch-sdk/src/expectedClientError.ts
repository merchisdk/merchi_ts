/**
 * Client failures already handled by Merchi UI.
 *
 * `@merchi/sdk` `ApiError` (`packages/sdk/src/request.ts`) carries `statusCode`,
 * `errorCode`, and `errorMessage`. `errorCode` uses `ErrorType`
 * (`packages/sdk/src/constants/errors.ts`): `0` unknown, `1` server, `2`–`22`
 * client/domain failures. Only validation and known customer input failures
 * should be ignored; auth, configuration and missing resources can break a
 * purchase. `@merchi/cart` does not define its own error class; its
 * catch sites read that same `errorMessage` / `statusCode` / `errorCode` shape.
 *
 * Only those fields are consulted. `status` and `status_code` are not Merchi
 * error fields and do not count.
 */
// EMAIL_ALREADY_EXISTS, EMAIL_NOT_FOUND, INVALID_PHONE_NUMBER, INVALID_PASSWORD.
const EXPECTED_INPUT_CODES = new Set([3, 5, 6, 7]);
const VALIDATION_STATUSES = new Set([400, 409, 422]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function integerField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

export function isExpectedClientError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const statusCode = integerField(error, "statusCode");
  const errorCode = integerField(error, "errorCode");
  const namedApiError = error.name === "ApiError";
  const cartApiShape =
    typeof error.errorMessage === "string" &&
    (statusCode !== undefined || errorCode !== undefined);
  if (!namedApiError && !cartApiShape) return false;
  if (statusCode !== undefined && !VALIDATION_STATUSES.has(statusCode)) return false;
  if (errorCode !== undefined && EXPECTED_INPUT_CODES.has(errorCode)) return true;
  // Generic CLIENT_ERROR is expected only with an explicit validation status.
  return errorCode === 2 && (statusCode === 400 || statusCode === 422);
}
