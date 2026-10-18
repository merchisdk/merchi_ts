/** Only a confirmed missing/expired cart permits replacing the saved cart. */
export function canReplaceMissingCart(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { statusCode?: unknown }).statusCode;
  return status === 404 || status === 410;
}
