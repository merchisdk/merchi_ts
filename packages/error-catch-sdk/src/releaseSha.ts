/**
 * Resolve a storefront release identifier from environment variables.
 *
 * This module has no imports so Next.js can load it from `next.config`
 * without pulling in the browser reporter.
 *
 * Order: explicit release SHA, Vercel commit, GitHub commit, then generic CI
 * commit variables. Blank values are skipped.
 */
const EXPLICIT_RELEASE_KEYS = ["NEXT_PUBLIC_RELEASE_SHA", "RELEASE_SHA"] as const;
const VERCEL_COMMIT_KEYS = [
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
] as const;
const GITHUB_COMMIT_KEYS = ["GITHUB_SHA"] as const;
const GENERIC_COMMIT_KEYS = [
  "COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "GIT_COMMIT",
  "CI_COMMIT_SHA",
  "SOURCE_VERSION",
] as const;

const RELEASE_SHA_KEYS = [
  ...EXPLICIT_RELEASE_KEYS,
  ...VERCEL_COMMIT_KEYS,
  ...GITHUB_COMMIT_KEYS,
  ...GENERIC_COMMIT_KEYS,
];

export type ReleaseShaEnv = {
  readonly [key: string]: string | undefined;
};

export function resolveReleaseSha(env: ReleaseShaEnv): string | undefined {
  for (const key of RELEASE_SHA_KEYS) {
    const value = env[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
