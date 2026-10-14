/**
 * Client failures already handled by Merchi UI.
 *
 * `@merchi/sdk` `ApiError` (`packages/sdk/src/request.ts`) carries `statusCode`,
 * `errorCode`, and `errorMessage`. `errorCode` uses `ErrorType`
 * (`packages/sdk/src/constants/errors.ts`): `0` unknown, `1` server, `2`–`22`
 * client/domain failures. `@merchi/cart` does not define its own error class; its
 * catch sites read that same `errorMessage` / `statusCode` / `errorCode` shape.
 *
 * Only those fields are consulted. `status` and `status_code` are not Merchi
 * error fields and do not count.
 */
const CLIENT_ERROR_CODE_MIN = 2;
const CLIENT_ERROR_CODE_MAX = 22;

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
  if (statusCode !== undefined) return statusCode >= 400 && statusCode < 500;
  return (
    errorCode !== undefined &&
    errorCode >= CLIENT_ERROR_CODE_MIN &&
    errorCode <= CLIENT_ERROR_CODE_MAX
  );
}
