# Production readiness

This guide turns GuiKit's feature set into a dependable shipped product. It is
an operational baseline, not a substitute for application-specific threat
modeling or regulatory review.

## Release gates

Every change is expected to pass the normal CI workflow. It checks the
dependency-free test suite, the npm package file list, Python host syntax and
wheel build, and the .NET NuGet package build. Pull requests additionally run
dependency review. CodeQL scans JavaScript/TypeScript, Python, and C# on pull
requests, `main`, and a weekly schedule.

Mark CI, Dependency review, and CodeQL as required checks in GitHub branch
protection before accepting external contributions. Require pull requests,
linear history if desired, and at least one code-owner review for release and
security workflow changes.

## Supply-chain controls

- Releases are built from annotated semantic-version tags.
- The release workflow validates that the tag and package version agree.
- npm, wheel, and NuGet artifacts are built by CI, checksummed together, and
  attached to the GitHub Release.
- Public-repository releases produce a GitHub artifact attestation for the npm
  archive. PyPI trusted publishing produces PyPI package attestations.
- Dependabot tracks GitHub Actions, Python, and NuGet dependency metadata.
- Registry publishing is separate, manual, and environment-protected. Follow
  [the release guide](RELEASING.md#registry-publication) before enabling it.

Verify downloaded artifacts against `SHA256SUMS.txt`; verify GitHub
provenance with `gh attestation verify` where available.

## Compatibility promise

GuiKit supports current evergreen Chromium-based browsers and the current
WebView2/WebKit backends supplied by the host platform. The core package
requires Node.js 20 or newer for development and CI. `GuiKit.WebView` targets
.NET 8, and `guikit-webview` requires Python 3.10 or newer.

Keep browser and native webview smoke tests in the consuming application's
release process: the framework cannot test every platform-specific host shell.
When changing public APIs, update declarations, docs, changelog entries, and
provide a migration note before a breaking release.

## Host security checklist

1. Load local bundled assets or an explicitly allowlisted HTTPS origin.
2. Disable arbitrary navigation, popups, downloads, and developer tools in
   production unless the product requires them.
3. Use a restrictive CSP; start with `default-src 'self'` and grant only the
   required `connect-src`, `media-src`, and worker sources.
4. Treat every bridge request as untrusted input. Validate method names,
   parameters, authorization, file paths, and result size in the native host.
5. Do not expose generic filesystem, process, shell, SQL, token, or credential
   APIs through the bridge.
6. Configure log redaction, retention, encrypted transport, and incident
   access controls in the host application.

## Performance and accessibility gates

Set application-specific budgets for startup time, bundle size, memory, input
latency, and chart/node-editor data volume. GuiKit supplies bounded buffers,
downsampling, worker fallbacks, and performance budgets; the host must choose
the appropriate limits and test them on its target hardware.

Before each application release, exercise keyboard-only navigation, visible
focus, screen-reader labels, reduced motion, contrast, zoom, narrow layouts,
and the locales your product ships. Test error, offline, permission-denied,
and slow-backend states—not only the ideal path.

## Incident response

Use the private vulnerability route in [SECURITY.md](../SECURITY.md). Preserve
the affected version, a minimal redacted reproduction, host/browser versions,
and relevant checksums. For package compromise, stop registry publication,
revoke the affected registry credential, publish a corrected patch version,
and communicate the affected version range in the GitHub advisory or release
notes.
