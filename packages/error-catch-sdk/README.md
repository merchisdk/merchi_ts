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
import { captureUnexpected } from "@merchi/error-catch";

captureUnexpected(error, {
  source: "manual",
  operation: { name: "cart.load", outcome: "failed" },
});
```

Both capture methods normalize primitive/object rejections without serializing
arbitrary objects. `DOMException` values retain their name (including AbortError).
Status codes, cancellation wording, and validation-shaped errors alone do not
prove a failure is harmless. Unhandled errors without operation context remain
reportable. The exported `isExpectedClientError` helper is only an input-error
candidate check, not a complete reporting policy.

## Operation context and safe filtering

`CaptureContext.operation` contains an allowlisted `name`, `outcome` (defaults to
`failed`), and optional `reason`. It never contains customer, request, order,
payment, token or session identifiers, URLs, bodies, or arbitrary provider data.
See `FRONTEND_ERROR_OPERATIONS` for the supported names. The SDK independently
copies only numeric `statusCode` / `errorCode` diagnostics and four known Stripe
card-error codes; provider objects and original API payloads are never copied.

Safe suppression requires an explicit, consistent combination:

- `handled` + `validation`: a UI handler completed and a known Merchi input code
  (3/5/6/7) was returned with HTTP status 400/409/422. Generic
  CLIENT_ERROR (2), unknown errors, and auth/server failures remain reported.
- For `payment.confirm`, `handled` + `validation` also covers Stripe `card_error`
  codes `card_declined`, `expired_card`, `incorrect_cvc`, and `incorrect_number`.
  Unknown provider/processing errors stay reported.
- `cancelled`: requires AbortError and an explicit `user_cancelled` reason.
  `navigation` / `superseded` cancellation applies only to noncritical operations.
- `recovered` + `retry_succeeded`: applies only to noncritical operations without
  contradictory API error diagnostics.

Failed/default cart, checkout, and payment operations remain reportable even for
AbortError, client-shaped errors, or extension-only stacks. Their claimed
recovery does not suppress them. React/component failures and automatic digest
failures also remain reportable. API errors 401/403/404/429/5xx override benign
labels. Missing context keeps the error; no message-only network, offline,
ResizeObserver, analytics, or third-party blanket ignore list exists.

Only mark an operation `handled` after the UI handler returns successfully;
only mark it `recovered` after the fallback/retry actually succeeds. For example:

```ts
showValidationError(error); // If this throws, capture the crash as failed.
captureUnexpected(error, {
  operation: { name: "checkout.submit", outcome: "handled", reason: "validation" },
});
```

Cart create/update/shipping/add-item/PDF failures, checkout submission failures,
and shared Stripe initialization/status/confirmation/cancellation failures now
supply operation context. The app's original UI callbacks and payment flow remain
in control. Normal payment cancellation/validation is not inferred from text.

`shouldReport` remains a full override of default filters. A callback returning
false can suppress any report, so callers that supply it own that decision.
Without it, safe filtering runs before dedupe and counting. `maxEventsPerPage`
(default 20) bounds each of two separate allowances: critical operations and other
errors. An unrelated error storm cannot consume the critical allowance. Dedupe
also includes operation/outcome/reason and bounded API/provider codes.

Global handlers retain unhandled input errors lacking explicit handling context.
Resource events with no error value remain ignored.

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

The collector independently applies the same rule for older clients.

## Embedded Chromium / CefSharp noise

Automatic `window_error` / `unhandled_rejection` events whose entire message is
the known CefSharp bridge rejection (`Object Not Found Matching Id:<digits>`,
optionally with `MethodName` and `ParamCount`) are suppressed before transport.
This is Outlook Safe Links and similar embedded Chromium hosts, not storefront
code. Manual captures, React/component/digest failures, critical purchase
operations, and any other "Object Not Found" wording stay reportable. The
exported `isEmbeddedBrowserBridgeError(event)` helper uses the same rule.

The collector independently applies the same rule for older clients. Schema
version 1 gains optional operation/API/Stripe diagnostic fields. Deploy the API
PR before publishing this SDK: an older strict collector rejects the new fields.
Old clients remain valid against the new API. Context is diagnostic input, never
a trusted authorization or remediation decision.

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
  ],
  "client": {
    "userAgent": "Mozilla/5.0 ... Chrome/120.0.6099.130 Safari/537.36",
    "browser": "Chrome",
    "browserVersion": "120.0.6099.130",
    "os": "macOS",
    "osVersion": "14.5.0",
    "platform": "macOS",
    "mobile": false,
    "deviceType": "desktop",
    "language": "en-AU",
    "languages": ["en-AU", "en"],
    "timezone": "Australia/Sydney",
    "screenWidth": 1440,
    "screenHeight": 900,
    "viewportWidth": 1280,
    "viewportHeight": 720,
    "devicePixelRatio": 2
  }
}
```

`client` is optional and contains only allowlisted environment fields: browser,
OS, locale, timezone, screen, viewport, and coarse device hints. Browser and OS
names come from a fixed list. The browser never supplies a trusted environment,
severity, repository, or System Agent credential. The collector derives those
values from its own project registry and runtime configuration.

Schema version 1 gains this optional `client` object. Deploy the API change
that accepts and stores it before publishing this SDK: an older strict
collector rejects unknown fields. Old clients remain valid against the new API.

## Stored client IP

The SDK does not put an IP address in the event. A client-supplied address can
be spoofed, and public IP lookup would be a separate network call. When the
collector persists the report it must store `clientIp` from the trusted
connection (the immediate peer, or `X-Forwarded-For` only when the proxy is
already trusted). Keep that value next to `client` and do not copy an `ip`
field out of the JSON body.

## Privacy boundary

The package collects a bounded client fingerprint so a stored report can show
which browser, operating system, and device produced the error. It still does
not collect:

- cookies, authorization headers, or browser storage;
- request and response bodies;
- form values or DOM snapshots;
- user IDs, email addresses, session identifiers, or a client-supplied IP;
- query strings, URL fragments, canvas data, or WebGL identifiers.

The user agent is length-capped and passed through the same redaction as error
messages. Client redaction is only the first layer. The collector must validate
and redact every event again before persistence or forwarding.

## Development

```bash
npm install
npm run check
```

`npm run check` runs type checking, tests, a clean package build, and a package
contents dry run.

## Optional storefront error recordings

The `@merchi/error-catch/replay` entry point provides `startStorefrontReplay`.
It adds an integration to an existing reporter without changing its filtering,
deduplication or normal error transport. The recorder starts automatically when the merchant enables it on an ordinary
storefront page. There is no visitor permission prompt. The root error SDK never imports rrweb into its browser bundle.

```ts
import { initMerchiStorefrontErrors } from '@merchi/error-catch/next';
import { startStorefrontReplay } from '@merchi/error-catch/replay';

const reporter = initMerchiStorefrontErrors({
  apiUrl: 'https://api.staging.merchi.co/v6/', domainId: 42, enabled: true,
});
const replay = startStorefrontReplay(reporter, {
  apiUrl: 'https://api.staging.merchi.co/v6/', enabled: true,
});
// Optional runtime merchant configuration changes:
replay.setEnabled(false); // Clears buffers and aborts pending uploads.
// Custom payment UI outside the default boundaries:
replay.setSensitiveContext(true); // Stop before opening payment UI.
replay.setSensitiveContext(false); // Resume only after that UI is removed.
// Call replay.stop() if the host permanently tears down the integration.
```

A bounded rolling buffer retains approximately 60 seconds, with complete
snapshots every 10 seconds. Accepted errors upload a baseline immediately and
append up to 15 seconds afterward. Quiet time is included in the timeline.
There are at most three clips per document; a reload starts a fresh buffer.
Recordings are best effort: closing a tab, network failures or large pages can
shorten them. No recordings upload during normal browsing.

All text/input values are masked, DOM attributes are allowlisted, and media,
canvas, uploads and iframes are blocked. CSS classes preserve page layout.
Mark any additional sensitive component with `data-replay-block` or `rr-block`.
Checkout, payment, pay, billing and invoice route segments, quote success pages,
Merchi checkout UI and any mounted `data-replay-payment` element prohibit capture.
Entering a boundary stops recording, clears buffers and pending clips, aborts
uploads, and ignores late collector responses. Leaving starts a fresh buffer;
old clips cannot continue. Payment operation errors retain normal error reporting
without requesting replay. For custom payment UI, set the sensitive context before
mounting it or mark its outermost element. These boundaries cannot be disabled
through storefront configuration. Already uploaded ordinary-page segments remain
subject to the normal retention period.
This version has no text-unmasking override. The server applies masking again.

The v6 collector must return an accepted receipt with `replay: { id, uploadToken }`.
Custom error transports may return that receipt through the extended
`FrontendErrorTransport` return type; transports returning void still work,
without replay uploads. A server suppression response never authorizes replay.
Uploads omit credentials/referrers, have a 10-second timeout and retry once with
an idempotent part index. They require the API's per-domain replay configuration,
private bucket and origin registration; see the API's
`documentation/storefront-error-replays.md` for setup, retention and endpoints.
