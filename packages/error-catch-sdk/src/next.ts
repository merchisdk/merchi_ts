"use client";

import { useEffect } from "react";

import { installGlobalErrorHandlers } from "./browser.js";
import {
  captureUnexpected,
  configureFrontendErrors,
  type FrontendErrorReporter,
} from "./reporter.js";
import type { CaptureContext, FrontendErrorReporterConfig } from "./types.js";

export interface MerchiStorefrontErrorsOptions {
  apiUrl: string;
  domainId: string | number;
  releaseSha?: string;
  enabled?: boolean;
}

/**
 * Configure the shared reporter for a Merchi storefront and install global
 * handlers. The same options return the existing reporter, so handlers are
 * installed once.
 *
 * `endpoint` is `${apiUrl}frontend-errors`. Storefront API URLs already end
 * with `/`. The application name is `merchi-storefront-<domainId>`.
 */
export function initMerchiStorefrontErrors(
  options: MerchiStorefrontErrorsOptions,
): FrontendErrorReporter {
  const config: FrontendErrorReporterConfig = {
    endpoint: `${options.apiUrl}frontend-errors`,
    application: `merchi-storefront-${options.domainId}`,
    enabled: options.enabled === true,
  };
  if (options.releaseSha !== undefined) config.releaseSha = options.releaseSha;
  const reporter = configureFrontendErrors(config);
  installGlobalErrorHandlers(reporter);
  return reporter;
}

/** Report a Next.js `error.tsx` / `global-error.tsx` error, including `digest`. */
export function useReportRouteError(error: Error & { digest?: string }): void {
  useEffect(() => {
    const context: CaptureContext = { source: "react_error_boundary" };
    if (typeof error.digest === "string" && error.digest) context.digest = error.digest;
    captureUnexpected(error, context);
  }, [error]);
}
