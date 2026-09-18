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

For every existing npm package, add this GitHub Actions trusted publisher in
the package settings on npmjs.com:

- Organization: `merchisdk`
- Repository: `merchi_ts`
- Workflow filename: `publish.yml`
- Allowed action: direct `npm publish`

`merchi_image_editor` does not currently exist on npm. Its first publication
must be performed by an npm owner using a short-lived publishing credential or
manual publication. Configure the trusted publisher immediately afterward;
subsequent releases need no long-lived npm token.

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
