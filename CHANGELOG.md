# Changelog

All notable changes to GuiKit are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Horizontal/vertical node-editor flow and obstacle-aware rounded link routing
  so connections remain visible around intervening nodes.
- Fixed the node-editor connection layer to paint above node cards and route
  backward links around their endpoint surfaces.
- Reusable `<gui-wizard>` and DOM-independent `GuiWizardModel` with linear or
  free navigation, native and asynchronous validation, optional steps,
  resumable state, cancelable lifecycle events, focus management, and
  responsive progress UI.
- Comprehensive persistent settings-page example with account, appearance,
  locale, notifications, performance, storage, and advanced integration
  controls plus live preview and application events.
- Typed inline node parameters with selective per-node visibility, live editing,
  validation, units, read-only values, and cancelable change events.
- Configurable `<gui-statusbar>` with top/bottom and sticky/fixed placement,
  keyed live items, status variants, progress, actions, responsive priority,
  start/center/end alignment, live announcements, and custom slots.
- Per-node settings buttons with an accessible modal editor, JSON data
  validation, read-only inspection, and cancelable extension events.
- Comprehensive full-demo application covering every component, service,
  feature module, backend log transport, and documented extension pattern.
- Tag-driven GitHub Release packaging with semantic-version validation,
  checksums, retained workflow artifacts, and build-provenance attestations.
- Canvas-based `<gui-live-chart>` with multiple series, responsive rendering,
  bounded typed-array storage, and min/max downsampling.
- Accessible toast manager with info, success, warning, and error variants.
- Optional persistent desktop sidebar collapsing.
- Coordinated tab, page, navigation, sidebar, and surface transitions.
- Visual node editor with a pure graph model, typed ports, interactive links,
  pan/zoom, selection, snapping, and serialization.
- Dependency-aware feature registry with cycle and missing-dependency checks.
- Module generator that creates source, types, tests, documentation, and
  package exports.
- Responsive media player for native web video and live `MediaStream` sources,
  with captions, live edge, Picture-in-Picture, fullscreen, and keyboard
  controls.
- Priority-based media adapter registry for optional HLS, DASH, or custom
  streaming engines.
- Framework quality bar and capability roadmap.
- Structured cross-runtime logging with child context, error serialization,
  trace spans, secret redaction, bounded memory and batching, console, bridge,
  HTTP, rotating Node JSONL sinks, and `<gui-log-viewer>`.
- Architecture, API, performance, bridge, security, and contribution guides.
- Dependency-free tests and continuous integration configuration.

### Fixed

- Node-editor and media-player custom elements now upgrade safely when their
  markup exists before the module finishes loading.
- Node-editor view defaults no longer collapse graphs to 5% zoom when optional
  zoom and grid attributes are omitted.
- The full demo refits node graphs after their sliding page becomes visible.
- Rapid page changes no longer leave stale or hidden transition states.
- Nested tab views no longer send child tab clicks or key events to a parent.
- Tab activation always leaves one accessible, interactive panel.

## [0.1.0] - 2026-07-23

### Added

- Responsive sidebar and mobile drawer.
- Keyboard-accessible tabs.
- Animated sliding pages with navigation history.
- CSS-token light, dark, and system themes.
- Runtime localization with English, German, and Spanish catalogs.
- Browser, WebView2, WebKit, and pywebview host bridge.
- Python and C# integration examples.
