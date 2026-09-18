# Package releases

The `Publish changed packages` workflow runs after every commit to `main`. It is
also scheduled hourly so an interrupted publish can reconcile and continue.

## Release behaviour

1. Read each package's latest npm version and source commit.
2. Detect package directory changes since its last verified release.
3. Add every workspace consumer of a changed package to the release plan.
4. Choose an unused patch version for each selected package.
5. Build, typecheck, and validate every package archive.
6. Commit the selected versions back to `main` without force-pushing.
7. Publish packages serially in topological dependency order.
8. Verify each exact npm version, allowing up to five minutes for registry
   propagation, then push a package-specific `<name>@<version>` Git tag.

The workflow stops if npm's latest source commit is not contained in `main`, if
another release changes registry state after planning, or if a release tag or
version is already owned by another commit.

Workspace dependency ranges stay as `workspace:` in Git. Immediately before
packing, the release script converts them to the versions selected in the same
release plan, so consumers never reference an unpublished workspace range.

## Required repository setup

This repository is expected to be `merchisdk/merchi_ts`. If the final GitHub
repository name differs, update every package's `repository.url` before the
first release.

All workspace packages publish publicly under the `@merchi` npm organization:

| Package | Legacy package |
| --- | --- |
| `@merchi/sdk` | `merchi_sdk_ts` |
| `@merchi/product-form-sdk` | `merchi_sdk_product_form` |
| `@merchi/product-form` | `merchi_product_form` |
| `@merchi/invoice` | `merchi_invoice` |
| `@merchi/cart` | `merchi_cart` |
| `@merchi/checkout` | `merchi_checkout` |
| `@merchi/error-catch` | `merchi_sdk_error_catch` |
| `@merchi/product-editor` | `merchi_product_editor` |
| `@merchi/image-editor` | `merchi_image_editor` |

Each scoped package must be published once by a member with permission to
publish under `@merchi`. New scoped packages cannot use GitHub Actions trusted
publishing until that first version exists.

Perform the bootstrap publication from the exact commit already present on
`main`, not from an unmerged feature commit. Publish in the order produced by
`pnpm release:plan`; this ensures every internal dependency exists before its
consumers. The current initial order is:

1. `@merchi/error-catch`
2. `@merchi/image-editor`
3. `@merchi/invoice`
4. `@merchi/product-editor`
5. `@merchi/sdk`
6. `@merchi/checkout`
7. `@merchi/product-form`
8. `@merchi/product-form-sdk`
9. `@merchi/cart`

After the first publication, add this GitHub Actions trusted publisher in each
scoped package's settings on npmjs.com:

- Organization: `merchisdk`
- Repository: `merchi_ts`
- Workflow filename: `publish.yml`
- Allowed action: direct `npm publish`

Do not deprecate the legacy unscoped packages until downstream consumers have
migrated and the scoped releases have been verified. Subsequent scoped releases
need no long-lived npm token once trusted publishing is configured.

The workflow requires GitHub Actions to have permission to write repository
contents so it can push release commits and package tags. Branch protection
must allow `github-actions[bot]` to make those non-force pushes.

## Local checks

```sh
pnpm release:test
pnpm release:plan
```

`release:plan` reads npm and Git history but does not change package versions.
The workflow alone calls it with `--write`.
