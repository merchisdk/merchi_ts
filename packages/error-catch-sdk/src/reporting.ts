const ENABLED_FLAGS = new Set(["1", "true", "yes", "on"]);
const DISABLED_FLAGS = new Set(["0", "false", "no", "off"]);

/**
 * Parse a storefront reporting flag.
 *
 * Explicit opt-in: `1`, `true`, `yes`, `on`.
 * Explicit opt-out: `0`, `false`, `no`, `off`.
 * Otherwise reporting is enabled only when `nodeEnv` is `production`.
 */
export function isReportingEnabled(
  nodeEnv: string | undefined,
  flag: string | undefined,
): boolean {
  if (typeof flag === "string") {
    const normalized = flag.trim().toLowerCase();
    if (ENABLED_FLAGS.has(normalized)) return true;
    if (DISABLED_FLAGS.has(normalized)) return false;
  }
  return typeof nodeEnv === "string" && nodeEnv.trim().toLowerCase() === "production";
}
