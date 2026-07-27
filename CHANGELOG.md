# Changelog

All notable changes to GuiKit are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Interactive tutorial module with serializable steps, spotlighted targets,
  keyboard navigation, optional action-driven advancement, and a full demo.
- Developer-experience tooling: starter application and extension scaffolds,
  project doctor, bridge-contract and design-token generators, manifest-driven
  app shell, development inspector, test helpers, and workflow recipes.

### Added

- Optional productivity module with a virtualized asynchronous combobox,
  date-range/schedule views, histogram/scatter/heatmap/spectrogram/gauge
  analysis, property grids, host-adapted resumable upload queues, notification
  history, and serializable shortcut profiles. The full demo now exercises all
  seven surfaces.
- Optional TeX document module with safe-mode source checks, templates,
  host/bridge compiler adapters, editor diagnostics, automated PDF creation,
  and PDF preview components.

## [0.2.0] - 2026-07-26

### Added

- Publishable Python wheel and .NET NuGet host packages with bundled GUI assets,
  bridge helpers, CI package builds, release attachments, and checksums.

- Swipe-page carousel and responsive dashboard components with accessibility,
  keyboard navigation, drag ordering, serializable layouts, and live full-demo
  controls.

- Full demo direct API laboratory: every application-platform and production
  feature now has a visible control and serialized live result, with safe
  in-memory adapters for credentials, offline storage, replay data, and visual
  testing.

- Production hardening module: theme/contrast and responsive-layout tooling,
  adapter-first connectors/credential references, observability, node execution
  debugging, FFT/correlation and chart export helpers, offline queues, plugin
  policy, deterministic visual-regression matrices, lazy-element registration,
  and bundle-size budget evaluation.

- Application-platform module with adapter-first collaboration/presence/comments,
  file workspaces, table analysis/pivots/histograms, serializable automation,
  provider-neutral streaming AI, permissioned plugin manifests, accessibility
  inspection, interaction recording/mocks, document templates, and DTCG/Figma
  design-token exchange. The full demo now includes every platform surface.

- Complete editor module: rich text/Markdown, code, structured JSON, property
  inspection, image adjustments/annotations, read-only query composition,
  timelines/keyframes, diagrams, theme tokens, and translation catalogs.
- Analysis-grade live charts: multi-signal and dual-axis rendering, clickable
  legends, shared cursor/tooltip, pan/zoom, range selection, thresholds,
  annotations, area/step lines, derived signals, and DOM-independent analysis
  helpers.
- Performance module with frame batching, timing budgets, lazy feature module
  loading, deduplicated locale loads, virtual-row recycling, and cancellable
  adjacent-page prefetching.
- Central command registry with search, configurable shortcuts, asynchronous
  cancellation, command palette, and transaction-based undo/redo history.
- Shared overlay layer with accessible modal dialogs, anchored popovers,
  keyboard menus, tooltips, focus restoration, light dismissal, and cancelable
  lifecycle requests.
- Versioned persistence migrations, guarded hash/history routing, cancellable
  background tasks and task center, typed clipboard payloads, allowlisted
  capabilities, and bounded runtime diagnostics.
- Schema-driven forms with conditional visibility/enabling, typed coercion,
  dirty state, synchronous/asynchronous validation, generated settings UI, and
  custom editor registration.
- Virtualized list and sortable/editable data grid plus an accessible tree view
  with DOM-independent collection and hierarchy models.
- Serializable docking workspaces with tab dragging, pointer/keyboard split
  resizing, saved presets, persistence, and host-controlled detachment.
- Component playground, bounded event viewer, diagnostics panel, and common
  accessibility integration audit.
- React/Vue/native adapter helpers and packaging guidance for PWA, pywebview,
  WebView2, WKWebView, and Avalonia hosts.
- Advanced node-editor tooling: shared undo history, typed clipboard,
  copy/cut/paste, duplication, box selection, groups, comments, collapse,
  search, minimap, alignment/distribution, auto-layout, manual waypoints,
  validation, breakpoints, and execution visualization.
- Optional same-document View Transition API integration for sliding pages
  with reduced-motion and Web Animations fallbacks.
- Horizontal/vertical node-editor flow and obstacle-aware rounded link routing
  so connections remain visible around intervening nodes.
- Fixed the node-editor connection layer to paint above node cards and route
  backward links around their endpoint surfaces.
- Added typed wire palettes, resolved link types, cancelable double-click wire
  deletion, and node-level per-port/total connection policies.
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
