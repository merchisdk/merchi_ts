# @merchi/error-catch

Small, dependency-light browser error capture for Merchi frontends.

The package captures unexpected browser and React errors, removes common
sensitive values, suppresses duplicate reports, and sends a bounded JSON event
to a Merchi-owned collector. It does not connect directly to Merchi System
Agent and never contains an ingestion secret.

## Status

The package is intentionally limited to error capture; collection, storage,
source-map processing, alerting, and remediation belong to Merchi services.

## Install

```bash
npm install @merchi/error-catch
```

## Configure

Configure one reporter near application startup. Reporting is opt-in and does
nothing unless `enabled` is explicitly `true`.

```ts
import { configureFrontendErrors } from "@merchi/error-catch";
import { installGlobalErrorHandlers } from "@merchi/error-catch/browser";

const reporter = configureFrontendErrors({
  endpoint: "https://api.merchi.co/v6/frontend-errors",
  application: "merchi-dashboard",
  releaseSha: process.env.NEXT_PUBLIC_RELEASE_SHA,
  enabled: process.env.NEXT_PUBLIC_FRONTEND_ERROR_REPORTING_ENABLED === "true",
});

installGlobalErrorHandlers(reporter);
```

For Next.js App Router, put this setup in `src/instrumentation-client.ts` so it
runs before hydration.

Calling `configureFrontendErrors` again with the same effective options returns
the existing reporter. Pair that with `installGlobalErrorHandlers`, which
already reference-counts listeners, and startup code can run more than once
without installing a second set of handlers.

## Next.js storefront

Storefronts can replace local `src/lib` error-reporting glue with a few calls.
`apiUrl` is concatenated as `${apiUrl}frontend-errors` (Merchi API URLs already
end with `/`). The application name is `merchi-storefront-<domainId>`.

```ts
// next.config.ts — import the release helper, not the browser reporter
import { resolveReleaseSha } from "@merchi/error-catch/release";

const releaseSha = resolveReleaseSha(process.env);
```

`resolveReleaseSha` checks, in order, `NEXT_PUBLIC_RELEASE_SHA`, `RELEASE_SHA`,
Vercel (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`),
`GITHUB_SHA`, then generic commit variables (`COMMIT_SHA`, `GIT_COMMIT_SHA`,
`GIT_COMMIT`, `CI_COMMIT_SHA`, `SOURCE_VERSION`). Blank values are skipped.
`@merchi/error-catch/release` has no imports, so it is safe to load from
`next.config`. Both ESM and CommonJS config loaders are supported, including
Next.js's transpiled `next.config.ts` on Node 20.

```ts
// instrumentation-client.ts
import { isReportingEnabled } from "@merchi/error-catch";
import { initMerchiStorefrontErrors } from "@merchi/error-catch/next";

initMerchiStorefrontErrors({
  apiUrl: process.env.NEXT_PUBLIC_API_URI ?? "",
  domainId: process.env.NEXT_PUBLIC_DOMAIN_ID ?? "",
  releaseSha: process.env.NEXT_PUBLIC_RELEASE_SHA,
  enabled: isReportingEnabled(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_FRONTEND_ERROR_REPORTING_ENABLED,
  ),
});
```

`isReportingEnabled(nodeEnv, flag)` opts in for `1`, `true`, `yes`, and `on`,
opts out for `0`, `false`, `no`, and `off`, and otherwise enables reporting
only when `nodeEnv` is `production`.

```tsx
// app/error.tsx and app/global-error.tsx
"use client";

import { useReportRouteError } from "@merchi/error-catch/next";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useReportRouteError(error);
  return <p>This page is temporarily unavailable.</p>;
}
```

`useReportRouteError` reports the route error and forwards Next.js `digest`.
`initMerchiStorefrontErrors` configures the shared reporter once and installs
global handlers once.

## Capture an error explicitly

```ts
import { captureException } from "@merchi/error-catch";

captureException(error, {
  source: "manual",
});
```

`captureException` never throws and does not return a network promise. Error
reporting therefore cannot create an unhandled rejection or replace the
application's original failure.

```ts
import { captureUnexpected, isExpectedClientError } from "@merchi/error-catch";

captureUnexpected(error, { source: "manual" });
```

`captureUnexpected` uses the same transport as `captureException`. String,
number, boolean, and object rejections are normalised into a
`NonErrorException` event instead of being dropped. It skips expected Merchi
validation failures unless you pass `shouldReport`. React route/boundary
failures remain reportable, even when their underlying error is a validation
error, because the page has already failed.

Those failures are `@merchi/sdk` `ApiError` values and the
`{ errorMessage, statusCode, errorCode }` objects `@merchi/cart` already
handles. Known customer input codes `3`, `5`, `6`, and `7` (duplicate/missing
email, invalid phone/password) are expected only when `statusCode` is absent
or is `400`, `409`, or `422`. Generic `CLIENT_ERROR` (`2`) is expected only
with status `400` or `422`. Other failures, including `401`, `403`, `404`,
`429`, missing domains, unknown errors and server errors, remain reportable.
Other `status` field names are ignored.

```ts
configureFrontendErrors({
  endpoint: "https://api.merchi.co/v6/frontend-errors",
  application: "merchi-dashboard",
  enabled: true,
  shouldReport: (error) => !isExpectedClientError(error),
});
```

`shouldReport` replaces the default validation and extension filters for both
`captureException` and `captureUnexpected`. Omit it and explicit/manual
`captureException` calls keep reporting every enabled event.

Global handlers call `captureUnexpected`, so expected client errors are not
sent and non-Error rejections are normalised. Resource errors that carry no
error value are still ignored.

## Browser extension noise

Both capture methods suppress automatic `window_error` / `unhandled_rejection`
events only when **every** available stack frame belongs to a browser extension
(`chrome-extension`, `moz-extension`, `safari-extension`, `safari-web-extension`,
or `ms-browser-extension`). The MetaMask `Failed to connect to MetaMask` error
with an extension-only `inpage.js` stack is one example. Filtering happens before
deduplication and the page event allowance, so extension noise cannot exhaust it.

Mixed stacks, missing stacks, unparseable/truncated stacks, ordinary HTTPS
third-party scripts, explicit/manual captures and React/component/digest failures
are retained. Message text alone never establishes extension ownership. The
exported `isBrowserExtensionError(event)` helper uses the same rule. A custom
`shouldReport` callback takes full responsibility for filtering; returning `true`
also retains extension-only reports.

The collector independently applies the same rule for older clients. Wire schema
version 1 is unchanged; clients never supply a trusted suppression decision.

## React boundary

```tsx
import { MerchiErrorBoundary } from "@merchi/error-catch/react";

<MerchiErrorBoundary
  fallback={({ reset }) => (
    <div role="alert">
      <p>This section is temporarily unavailable.</p>
      <button type="button" onClick={reset}>Try again</button>
    </div>
  )}
>
  <ProductForm />
</MerchiErrorBoundary>
```

Use boundaries around meaningful recovery areas, not around every component.
Next.js applications should still provide route-level `error.tsx` and
`global-error.tsx` files.

## Wire event

The collector receives schema version 1 with only allowlisted fields:

```json
{
  "schemaVersion": 1,
  "eventId": "c179b372-e48a-46ec-82bc-8bc617f68ef6",
  "occurredAt": "2026-08-14T00:00:00.000Z",
  "application": "merchi-dashboard",
  "releaseSha": "0123456789abcdef",
  "source": "window_error",
  "errorType": "TypeError",
  "message": "Cannot read properties of undefined",
  "route": "/products/{id}",
  "stackTrace": "TypeError: Cannot read properties of undefined\n    at renderProduct (...) ",
  "stackFrames": [
    {
      "file": "https://dashboard.merchi.co/_next/static/chunks/app.js",
      "function": "renderProduct",
      "line": 42,
      "column": 7
    }
  ]
}
```

The browser never supplies a trusted environment, severity, repository, or
System Agent credential. The collector derives those values from its own
project registry and runtime configuration.

## Privacy boundary

The package intentionally does not collect:

- cookies, authorization headers, or browser storage;
- request and response bodies;
- form values or DOM snapshots;
- user IDs, email addresses, IP addresses, or session identifiers;
- query strings or URL fragments.

Client redaction is only the first layer. The collector must validate and
redact every event again before persistence or forwarding.

## Development

```bash
npm install
npm run check
```

`npm run check` runs type checking, tests, a clean package build, and a package
contents dry run.
