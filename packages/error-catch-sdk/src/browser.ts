import { getDefaultFrontendErrorReporter, type FrontendErrorReporter } from "./reporter.js";

interface InstalledHandlers {
  references: number;
  remove: () => void;
}

const installedHandlers = new WeakMap<FrontendErrorReporter, InstalledHandlers>();

export function installGlobalErrorHandlers(
  suppliedReporter?: FrontendErrorReporter,
): () => void {
  const reporter = suppliedReporter ?? getDefaultFrontendErrorReporter();
  if (typeof window === "undefined" || !reporter) return () => undefined;

  const existing = installedHandlers.get(reporter);
  if (existing) {
    existing.references += 1;
    return () => releaseHandlers(reporter);
  }

  const onError = (event: ErrorEvent): void => {
    if (!(event.error instanceof Error)) return;
    reporter.captureException(event.error, { source: "window_error" });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    if (!(event.reason instanceof Error)) return;
    reporter.captureException(event.reason, { source: "unhandled_rejection" });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  installedHandlers.set(reporter, {
    references: 1,
    remove: () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    },
  });
  return () => releaseHandlers(reporter);
}

function releaseHandlers(reporter: FrontendErrorReporter): void {
  const installed = installedHandlers.get(reporter);
  if (!installed) return;
  installed.references -= 1;
  if (installed.references > 0) return;
  installed.remove();
  installedHandlers.delete(reporter);
}
