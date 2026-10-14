import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveReleaseSha } from "../src/releaseSha.js";

describe("resolveReleaseSha", () => {
  it("prefers an explicit release SHA over platform commit variables", () => {
    expect(
      resolveReleaseSha({
        NEXT_PUBLIC_RELEASE_SHA: " explicit-sha ",
        RELEASE_SHA: "release-sha",
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
        GITHUB_SHA: "github-sha",
        COMMIT_SHA: "commit-sha",
      }),
    ).toBe("explicit-sha");
  });

  it("uses RELEASE_SHA when the public override is blank", () => {
    expect(
      resolveReleaseSha({
        NEXT_PUBLIC_RELEASE_SHA: "  ",
        RELEASE_SHA: "release-sha",
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
      }),
    ).toBe("release-sha");
  });

  it("falls through Vercel, then GitHub, then generic commit variables", () => {
    expect(
      resolveReleaseSha({
        NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "",
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
        GITHUB_SHA: "github-sha",
        COMMIT_SHA: "commit-sha",
      }),
    ).toBe("vercel-sha");

    expect(
      resolveReleaseSha({
        GITHUB_SHA: " github-sha ",
        GIT_COMMIT_SHA: "git-commit-sha",
        SOURCE_VERSION: "source-version",
      }),
    ).toBe("github-sha");

    expect(
      resolveReleaseSha({
        NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "public-vercel",
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
      }),
    ).toBe("public-vercel");
    expect(resolveReleaseSha({ GIT_COMMIT_SHA: "git-commit-sha", GIT_COMMIT: "git-commit" })).toBe(
      "git-commit-sha",
    );
    expect(resolveReleaseSha({ CI_COMMIT_SHA: " ci-sha " })).toBe("ci-sha");
    expect(resolveReleaseSha({ GIT_COMMIT: "git-commit" })).toBe("git-commit");
    expect(resolveReleaseSha({ SOURCE_VERSION: "source-version" })).toBe("source-version");
    expect(resolveReleaseSha({ COMMIT_SHA: "commit-sha", GIT_COMMIT: "other" })).toBe("commit-sha");
  });

  it("returns undefined when no release variable is set", () => {
    expect(resolveReleaseSha({})).toBeUndefined();
    expect(
      resolveReleaseSha({
        NEXT_PUBLIC_RELEASE_SHA: "",
        VERCEL_GIT_COMMIT_SHA: "   ",
        GITHUB_SHA: undefined,
      }),
    ).toBeUndefined();
  });

  it("stays import-free so next.config can load it without the browser package", () => {
    const source = readFileSync(join(process.cwd(), "src/releaseSha.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
  });
});
