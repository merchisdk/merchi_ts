import { redactText } from "./redact.js";

// These paths carry credentials, unlike job/invoice/product identifiers.
const CREDENTIAL_PATHS = [
  /(\/(?:sessions|store-session|sl|tokens?|access-token|auth-token)\/)[^/]+/gi,
  /^(\/invite\/)(?!domain\/)[^/]+/gi,
  /(\/public\/google-product-reviews-feed\/[^/]+\/)[^/]+/gi,
  /(\/(?:invite\/domain|domain_invite|company-invite)\/[^/]+\/)[^/]+/gi,
  /(\/password\/reset\/change\/public\/)[^/]+/gi,
  /^(\/(?:magic(?:-link)?|reset(?:-password)?|verify(?:-email)?)\/)[^/]+/gi,
];
const RECORD_QUERY = /^(?:(?:job|invoice|product|domain|draft)(?:_?id)?|page|limit|offset)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decoded(value: string): string {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(value);
      if (next === value) break;
      value = next;
    } catch { break; }
  }
  return value;
}

/** Sanitized navigation evidence. Dynamic IDs are preserved, never generalized. */
export function sanitizeEvidenceUrl(value: unknown, pathOnly = false): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/")) return undefined;
  try {
    const url = new URL(raw, "https://merchi.invalid");
    if (!/^https?:$/.test(url.protocol)) return undefined;
    let path = url.pathname.split("/").map((segment) => {
      const text = decoded(segment).replace(/[\x00-\x1f\x7f]/g, "");
      // Numeric record IDs are not phone numbers. Keep encoded path separators
      // encoded so redaction cannot change which segment identifies a resource.
      const safe = /^\d+$/.test(text) || UUID.test(text) ? text : redactText(text, 1_000);
      return encodeURIComponent(safe).replace(/%7B/gi, "{").replace(/%7D/gi, "}");
    }).join("/");
    for (const pattern of CREDENTIAL_PATHS) path = path.replace(pattern, "$1[redacted]");
    if (pathOnly) return path.slice(0, 1_000);
    const query = new URLSearchParams();
    for (const [rawKey, rawValue] of url.searchParams) {
      const key = decoded(rawKey);
      const candidate = decoded(rawValue);
      // Only resource IDs and pagination are known to be non-secret. Keep other
      // parameter names for diagnosis, but never collect arbitrary query values.
      const safe = RECORD_QUERY.test(key) && (/^\d+$/.test(candidate) || UUID.test(candidate));
      query.append(/^[a-zA-Z0-9_.-]{1,80}$/.test(key) ? key : "redacted", safe ? candidate : "[redacted]");
    }
    const host = /^https?:\/\//i.test(raw) ? `${url.protocol}//${url.host}` : "";
    const search = query.toString();
    // Fragments may carry OAuth credentials. Userinfo is intentionally absent.
    return `${host}${path}${search ? `?${search}` : ""}`.slice(0, 2_000);
  } catch { return undefined; }
}
