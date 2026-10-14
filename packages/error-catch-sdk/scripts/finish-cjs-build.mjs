import { createRequire } from "node:module";
import { build } from "esbuild";

// Next.js transpiles next.config.ts to CommonJS on Node 20. Keep this
// dependency-free entry point available to both config loaders.
await build({
  entryPoints: [new URL("../src/releaseSha.ts", import.meta.url).pathname],
  outfile: new URL("../dist/releaseSha.cjs", import.meta.url).pathname,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2020",
});

const require = createRequire(import.meta.url);
const loaded = require("../dist/index.cjs");

if (typeof loaded.captureUnexpected !== "function") {
  throw new Error("CJS build did not export captureUnexpected");
}
if (typeof loaded.captureException !== "function") {
  throw new Error("CJS build did not export captureException");
}

if (loaded.captureUnexpected(new Error("unconfigured")) !== false) {
  throw new Error("CJS captureUnexpected must be a no-op until configured");
}

const { resolveReleaseSha } = require("@merchi/error-catch/release");
if (resolveReleaseSha({ RELEASE_SHA: " config-release " }) !== "config-release") {
  throw new Error("CJS release entry point did not resolve the config release");
}
