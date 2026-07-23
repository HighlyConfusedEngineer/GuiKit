# Releasing GuiKit

GuiKit releases are built by GitHub Actions from an existing semantic version
tag. A release contains:

- an installable `GuiKit-<version>.tgz` package;
- `SHA256SUMS.txt`;
- GitHub-generated release notes and source archives;
- a GitHub build-provenance attestation.

The release workflow does not publish to npm. GitHub Releases therefore require
no npm account, organization, or registry token.

## Version policy

GuiKit follows semantic versioning:

- patch releases fix compatible defects;
- minor releases add compatible functionality;
- major releases may change public APIs;
- suffixes such as `-beta.1` create prereleases.

The tag must be exactly `v` followed by the version in `package.json`. For
example, package version `0.2.0` requires tag `v0.2.0`.

## Release checklist

1. Work from a clean `main` branch synchronized with GitHub.
2. Choose the next semantic version.
3. Move relevant entries from `Unreleased` into a dated changelog section.
4. Update `package.json` and any displayed version strings.
5. Run `npm run check` and `npm run release:check`.
6. Commit the version and changelog changes.
7. Create an annotated tag: `git tag -a v0.2.0 -m "GuiKit 0.2.0"`.
8. Push the commit and tag: `git push origin main --follow-tags`.
9. Verify the Release workflow and its generated GitHub Release.

Do not move or recreate a published release tag. Create a new patch release for
corrections.

## Workflow safeguards

`.github/workflows/release.yml`:

- accepts only semantic `v*` tags;
- checks that the tag and package version match;
- runs the JavaScript suite and Python syntax validation;
- packages only the files allowed by `package.json`;
- creates a SHA-256 checksum;
- generates build provenance with GitHub artifact attestations;
- marks suffix versions as prereleases;
- categorizes generated notes using `.github/release.yml`;
- refuses to create a release when the remote tag does not exist.

The workflow can be retried manually through **Actions → Release → Run
workflow** by supplying an existing tag. It never creates a version tag itself.

## Inspecting the package

Before tagging, inspect the exact package file list:

```powershell
npm run release:check
```

Test a generated archive locally:

```powershell
npm pack
npm install ./gui-template-core-0.2.0.tgz
```

The local npm filename uses the package scope and name. GitHub renames the
release asset to the product-oriented `GuiKit-<version>.tgz`.

## Verifying a download

Check its digest:

```powershell
Get-FileHash .\GuiKit-0.2.0.tgz -Algorithm SHA256
```

Compare the result with `SHA256SUMS.txt`. With GitHub CLI, verify provenance:

```powershell
gh attestation verify .\GuiKit-0.2.0.tgz `
  --repo HighlyConfusedEngineer/GuiKit
```

## npm publication

Publishing to npm is intentionally separate from GitHub Releases. Before adding
it, the maintainers must own the package scope, enable trusted publishing or a
least-privilege automation token, and document package provenance and rollback
expectations.
