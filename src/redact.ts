const BEARER_PATTERN = /(bearer\s+)[a-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(api[_ -]?key|authorization|cookie|password|secret|session[_ -]?(?:id|token)|token)\b(\s*[:=]\s*)(["']?)[^\s,;"'&]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const IPV4_PATTERN =
  /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const PHONE_PATTERN = /(?<!\w)\+?\d[\d ()-]{7,}\d(?!\w)/g;
const URL_QUERY_PATTERN = /(https?:\/\/[^\s?#]+)[?#][^\s)\]}>'"]*/gi;

export function redactText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  const redacted = text
    .replace(BEARER_PATTERN, "$1[redacted]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(
      SENSITIVE_ASSIGNMENT_PATTERN,
      (_match, key: string, separator: string) => `${key}${separator}[redacted]`,
    )
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(IPV4_PATTERN, "[redacted-ip]")
    .replace(PHONE_PATTERN, "[redacted-number]")
    .replace(URL_QUERY_PATTERN, "$1");
  return redacted.slice(0, Math.max(0, maxLength));
}
