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
