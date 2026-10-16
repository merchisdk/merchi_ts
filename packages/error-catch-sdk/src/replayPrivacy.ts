/** These boundaries cannot be overridden by storefront configuration. */
export const PAYMENT_REPLAY_SELECTOR = [
  "[data-replay-payment]", ".merchi-checkout", ".merchi-checkout-modal", ".merchi-checkout-page",
  'iframe[src*="elements-inner"]', 'iframe[src*="checkout.stripe.com"]',
].join(",");

export function isPaymentRelatedReplayPath(value: string): boolean {
  try {
    let path = new URL(value, "https://replay.invalid").pathname;
    for (let pass = 0; pass < 2; pass += 1) path = decodeURIComponent(path);
    return /(?:^|\/)(?:checkout|payments?|pay|billing|invoices?)(?:\/|$)/i.test(path) ||
      /(?:^|\/)quote\/success(?:\/|$)/i.test(path);
  } catch {
    // An ambiguous URL must not enable capture.
    return true;
  }
}

/** Inspect raw snapshots/mutations before masking, including transient mounts. */
export function containsPaymentReplayContent(value: unknown, depth = 0): boolean {
  if (depth > 60) return true;
  if (Array.isArray(value)) return value.some((item) => containsPaymentReplayContent(item, depth + 1));
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (input.type === 4 && input.data && typeof input.data === "object") {
    const href = (input.data as Record<string, unknown>).href;
    if (typeof href === "string" && isPaymentRelatedReplayPath(href)) return true;
  }
  const attrs = input.attributes;
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    const attributes = attrs as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(attributes, "data-replay-payment") && attributes["data-replay-payment"] !== null) return true;
    if (typeof attributes.class === "string" && /(?:^|\s)merchi-checkout(?:-modal|-page)?(?:\s|$)/.test(attributes.class)) return true;
    if (typeof attributes.src === "string" && /elements-inner|checkout\.stripe\.com/i.test(attributes.src)) return true;
  }
  return Object.values(input).some((item) => item && typeof item === "object" && containsPaymentReplayContent(item, depth + 1));
}
