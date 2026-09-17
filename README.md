# Merchi TypeScript

Monorepo for Merchi's TypeScript SDK and related reusable libraries.

## Packages

| Package | Directory | Description |
| --- | --- | --- |
| `merchi_sdk_ts` | `packages/sdk` | TypeScript client for the Merchi API |
| `merchi_sdk_product_form` | `packages/product-form-sdk` | Contracts and runtime helpers for custom product forms |
| `merchi_product_form` | `packages/product-form` | React components for configuring Merchi products |
| `merchi_invoice` | `packages/invoice` | React components for displaying and paying Merchi invoices |

## Development

This repository uses pnpm workspaces and Turborepo.

```sh
pnpm install
pnpm build
pnpm test
```

Package versions and public npm names remain independent. Applications and
storefronts are consumers of this repository and are not part of the monorepo.
