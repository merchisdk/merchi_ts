# Merchi TypeScript

Monorepo for Merchi's TypeScript SDK and related reusable libraries.

## Packages

| Package | Directory | Description |
| --- | --- | --- |
| `@merchi/sdk` | `packages/sdk` | TypeScript client for the Merchi API |
| `@merchi/product-form-sdk` | `packages/product-form-sdk` | Contracts and runtime helpers for custom product forms |
| `@merchi/product-form` | `packages/product-form` | React components for configuring Merchi products |
| `@merchi/invoice` | `packages/invoice` | React components for displaying and paying Merchi invoices |
| `@merchi/cart` | `packages/cart` | React components for the Merchi shopping cart |
| `@merchi/checkout` | `packages/checkout` | React components for custom Merchi checkout flows |
| `@merchi/error-catch` | `packages/error-catch-sdk` | Browser and React error capture SDK |
| `@merchi/product-editor` | `packages/product-editor` | Fabric.js-based React product image editor |
| `@merchi/image-editor` | `packages/image-editor` | Pintura-based React image editor |

## Development

This repository uses pnpm workspaces and Turborepo.

```sh
pnpm install
pnpm build
pnpm test
```

Package versions remain independent. The legacy unscoped packages remain
available during migration; new development should use the `@merchi/*` names.
Applications and storefronts are consumers of this repository and are not part
of the monorepo.
