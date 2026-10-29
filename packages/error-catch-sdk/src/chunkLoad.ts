import type { FrontendErrorEvent } from "./types.js";
import { isCriticalOperation } from "./operation.js";

/**
 * Turbopack, webpack, and the browser's own dynamic-import failure for a
 * missing hashed chunk. Classification alone does not establish recovery and
 * must not suppress reporting. Kept as a compatibility helper for consumers;
 * explicit manual captures and critical operations are excluded.
 */
const CHUNK_LOAD_MESSAGE =
  /^(?:Failed to load chunk \S+ from module \d+|Loading (?:CSS )?chunk \S+ failed\b|Failed to fetch dynamically imported module\b|error loading dynamically imported module\b|Importing a module script failed\b)/i;

export function isChunkLoadError(
  event: Pick<FrontendErrorEvent, "source" | "errorType" | "message" | "operation">,
): boolean {
  if (
    !["window_error", "unhandled_rejection", "react_error_boundary"].includes(event.source) ||
    isCriticalOperation(event.operation)
  ) return false;
  if (event.errorType === "ChunkLoadError") return true;
  return CHUNK_LOAD_MESSAGE.test(event.message.trim());
}

