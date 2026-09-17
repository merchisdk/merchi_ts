# Merchi Product Form SDK

Contract SDK for AI-built and hand-written **custom Merchi product order forms**.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Custom forms are React components that run inside the Merchi dashboard preview and the product embed. This package defines the **only** imports, components, and helpers those forms may use. Source is validated by a static gate and compiled to a browser bundle that externalises `react` and this SDK to `window` globals.

## Table of Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [How forms run](#how-forms-run)
- [Form component contract](#form-component-contract)
- [Layout and fields](#layout-and-fields)
- [Group variations](#group-variations)
- [Pricing and job building](#pricing-and-job-building)
- [Allowed exports](#allowed-exports)
- [Development](#development)
- [License](#license)

## Installation

```bash
npm install merchi_sdk_product_form
```

Peer dependency: `react` ^18 or ^19.

In the Merchi monorepo, the dashboard installs a packed tarball:

```bash
cd merchi_sdk_product_form
npm run build && npm pack
cd ../merchi_dashboard && npm install
```

## Quick start

A minimal form renders independent variation fields and relies on the host shell for quantity, live pricing, and submit actions:

```tsx
import React from 'react';
import {
  Section,
  Stack,
  Heading,
  Text,
  Field,
} from 'merchi_sdk_product_form';

export default function Form({ product }) {
  const fields = product?.independentVariationFields ?? [];

  return (
    <Stack gap={24}>
      <Section>
        <Heading>{product?.name || 'Order form'}</Heading>
        {product?.description ? <Text muted>{product.description}</Text> : null}
      </Section>
      <Section title="Options">
        <Stack gap={16}>
          {fields.map((field) => (
            <Field key={field.id} field={field} />
          ))}
        </Stack>
      </Section>
    </Stack>
  );
}
```

See `examples/colour-grid-form.tsx` for a per-colour quantity grid (wristbands, multi-SKU products).

## How forms run

1. **Authoring** — Form source is stored as TSX on a `ProductForm` in Merchi.
2. **Gate** — Only imports from `react` and `merchi_sdk_product_form` are allowed (legacy `@merchi/product-form-sdk` is still accepted for older drafts).
3. **Compile** — esbuild bundles the form to an IIFE; `react` → `window.React`, `merchi_sdk_product_form` → `window.MerchiProductFormSdk`.
4. **Host** — The dashboard or embed loads the bundle, provides `createProductFormRuntime`, and wraps the form in `ProductFormShell` (quantity control, live quote footer, submit buttons).

Form authors should **not** reimplement quantity controls or pricing footers. To replace Get quote / Buy now / Add to cart, use `ProductFormActions` (or `Form.footerActions`) — do not hand-roll checkout buttons.

## Form component contract

Default-export a React component matching `ProductFormComponent`:

```tsx
export default function Form({ product, pricing, actions, helpers }) {
  // product  — ProductJson for the item being ordered
  // pricing  — request quotes as the user edits (createPricing wrapper)
  // actions  — submit handlers (addToCart, buyNow, …); may be undefined
  // helpers  — serializeJob, nonEmptyGroups, formatCurrency, urlFor
}
```

Inside composed UI, prefer `useProductForm()` from a `ProductFormProvider` / `ProductFormShell` subtree for quote state and submit wiring.

## Layout and fields

| Export | Purpose |
|--------|---------|
| `Section`, `Stack`, `Card` | Page structure |
| `Heading`, `Text`, `Divider` | Typography |
| `Field` | Render a product variation field (options, text, files, etc.) |
| `theme` | Shared spacing/colour tokens |

Loop `product.independentVariationFields` for options that apply to the **whole order** (`job.variations`).

There is **no** `TextInput`, `Select`, `Button`, or `ColorSwatches` — use `Field` and layout components only.

To change the host footer (for example one **Place order** button that opens the Get quote modal):

```tsx
import { ProductFormActions } from 'merchi_sdk_product_form';

export default function Form({ product }) {
  return (
    <Stack gap={24}>
      <ProductFormActions
        actions={[{ action: 'getQuote', label: 'Place order', primary: true }]}
      />
      {/* layout */}
    </Stack>
  );
}
Form.footerActions = [{ action: 'getQuote', label: 'Place order', primary: true }];
```

## Group variations

Some products need **per-batch** choices (e.g. colour × quantity grids):

| Helper / component | When to use |
|--------------------|-------------|
| `productHasGroups(product)` | Product has `groupVariationFields` |
| `isOptionQuantityGridProduct(product)` | Single option-based group field → use grid |
| `OptionQuantityGrid` | Table: swatch, quantity, row cost, inventory |
| `GroupRows` | Multiple group fields or free-text group fields |
| `Field` with `groupIndex` | Field inside a specific batch row |

When groups exist, each batch has its own `quantity` in `job.variationsGroups`. Do not use top-level `job.quantity` — `ProductFormShell` hides the global quantity control for group products.

## Pricing and job building

| Export | Purpose |
|--------|---------|
| `createPricing` / `createProductFormRuntime` | Host/runtime wiring (embed & dashboard) |
| `buildProductFormJob` | Build a `JobJson` from form state |
| `selectionsToVariations` | Map field selections to variation payloads |
| `serializeJob` | Strip empty groups before submit |
| `nonEmptyGroups` | Filter groups with `quantity > 0` |
| `formatCurrency`, `urlFor` | Display helpers |

## Allowed exports

The compile gate allowlists these **runtime** named imports (type-only imports are erased and not checked):

`SDK_VERSION`, `serializeJob`, `nonEmptyGroups`, `formatCurrency`, `urlFor`, `createPricing`, `createProductFormRuntime`, `productHasGroups`, `groupFieldsOf`, `independentFieldsOf`, `isOptionQuantityGridProduct`, `buildProductFormJob`, `selectionsToVariations`, `Section`, `Stack`, `Card`, `Heading`, `Text`, `Divider`, `Field`, `GroupRows`, `OptionQuantityGrid`, `ProductFormProvider`, `ProductFormShell`, `ProductFormActions`, `useProductForm`, `OPTION_FIELD_TYPES`, `theme`

Keep this list in sync with `src/index.ts` and `merchi_api/common/js/product_form_gate.cjs`.

## Development

```bash
npm install
npm run build    # tsc → dist/
npm test         # jest
npm run lint     # eslint src
npm pack         # merchi_sdk_product_form-<version>.tgz
```

Repository: [github.com/merchisdk/merchi_sdk_product_form](https://github.com/merchisdk/merchi_sdk_product_form)

## License

GPL-3.0 — see [LICENSE](https://www.gnu.org/licenses/gpl-3.0) (same as [merchi_sdk_ts](https://github.com/merchisdk/merchi_sdk_ts)).
