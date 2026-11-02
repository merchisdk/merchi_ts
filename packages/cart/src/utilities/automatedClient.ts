/** A startup optimization only; explicit cart operations remain available. */
export function isAutomatedClient(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean {
  return /HeadlessChrome|bot|crawler|spider|slurp|SEBot-WA/i.test(userAgent);
}
