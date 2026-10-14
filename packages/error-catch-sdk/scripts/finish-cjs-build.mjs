import { createRequire } from "node:module";

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
