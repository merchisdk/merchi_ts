/** Skip eager cart API work for common crawlers/preview bots (storefront telemetry noise). */
export function isAutomatedClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /bot|crawler|spider|bingbot|googlebot|slurp|duckduckbot|baiduspider|yandex|semrush|ahref|SEBot-WA/i.test(ua);
}
