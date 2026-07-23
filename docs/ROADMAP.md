# Framework quality bar and roadmap

GuiKit's goal is a state-of-the-art cross-platform interface framework, not a
collection of unrelated widgets. Every feature is measured against the same
quality bar.

## Quality bar

A production-ready GuiKit module has:

- complete keyboard and screen-reader behavior;
- narrow, wide, light, dark, and reduced-motion states;
- deterministic cleanup of listeners, timers, workers, streams, and adapters;
- DOM-independent models for meaningful data invariants;
- cancelable request events before application-controlled mutations;
- serializable public state suitable for Python and C# bridges;
- bounded memory and documented performance limits;
- TypeScript declarations equal to the runtime API;
- unit tests, interactive tests, focused documentation, and changelog entries;
- no required framework and no runtime dependency without strong justification.

## Current foundation

| Area | Available |
| --- | --- |
| Layout | Responsive sidebar/drawer, optional collapse, cards, grids, stacks |
| Navigation | Accessible tabs, animated pages, history, interruption-safe motion |
| Feedback | Toast queue, severities, actions, timed and persistent notifications |
| Visualization | Responsive multi-series live charts with bounded buffers |
| Workflows | Typed visual node editor with graph model and serialization |
| Media | Native video, live MediaStream, captions, PiP, fullscreen, adapters |
| Observability | Structured logs, privacy limits, spans, batching, live viewer, backend sinks |
| Platform | Themes, localization, native bridge, Web Components, TypeScript |
| Extensibility | Module registry, dependency lifecycle, generator, subpath exports |
| Governance | CI, security policy, contribution guide, API and architecture docs |

## Next framework modules

The following modules fit the architecture but are not silently implied to
exist yet:

1. accessible dialogs, popovers, menus, tooltips, and command palette;
2. virtualized data grid and tree view with keyboard navigation;
3. schema-driven forms, validation, date/time, and rich input controls;
4. docking, resizable panels, split views, and persisted workspaces;
5. drag-and-drop and sortable collections;
6. file browser, upload queue, and progress surfaces;
7. canvas and WebGL rendering adapter for very large node graphs;
8. automated browser accessibility and visual-regression suites;
9. optional React, Vue, Blazor, Python, and C# convenience bindings;
10. packaging profiles for PWA, pywebview, WebView2, WKWebView, and Avalonia.

Each should be delivered as a module with a narrow responsibility rather than
expanding `gui.js` indefinitely.

## Compatibility policy

Before `1.0`, module APIs may evolve with changelog and migration notes. At
`1.0`, public attributes, methods, event names, schemas, CSS tokens, and package
exports follow semantic versioning.

Support targets are current evergreen browser engines and the native webviews
built on them. Platform-specific capabilities use detection and graceful
fallback rather than user-agent checks.
