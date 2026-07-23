# Changelog

All notable changes to GuiKit are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Canvas-based `<gui-live-chart>` with multiple series, responsive rendering,
  bounded typed-array storage, and min/max downsampling.
- Accessible toast manager with info, success, warning, and error variants.
- Optional persistent desktop sidebar collapsing.
- Coordinated tab, page, navigation, sidebar, and surface transitions.
- Architecture, API, performance, bridge, security, and contribution guides.
- Dependency-free tests and continuous integration configuration.

### Fixed

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
