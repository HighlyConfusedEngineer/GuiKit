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
| Application runtime | Commands, shortcuts, undo/redo, persistence, routing, tasks, clipboard, capabilities |
| Overlays | Dialogs, anchored popovers, menus, tooltips, shared stacking |
| Data entry | Schema forms, conditional fields, validation, custom editors |
| Data views | Virtualized list/grid and accessible tree model |
| Workspaces | Docking tabs, splits, drag/drop, presets, persistence |
| Developer tools | Component playground, event log, diagnostics, accessibility audit |
| Governance | CI, security policy, contribution guide, API and architecture docs |

## Next framework modules

The following modules fit the architecture but are not silently implied to
exist yet:

1. file browser and resumable upload/download queues;
2. canvas and WebGL rendering adapter for very large node graphs;
3. automated visual-regression baselines across browser engines;
4. standalone React, Vue, and Blazor packages generated from the adapter core;
5. application templates for PWA, pywebview, WebView2, WKWebView, and Avalonia;
6. locale-aware date, time, number, and rich text editor modules.

Each should be delivered as a module with a narrow responsibility rather than
expanding `gui.js` indefinitely.

## Compatibility policy

Before `1.0`, module APIs may evolve with changelog and migration notes. At
`1.0`, public attributes, methods, event names, schemas, CSS tokens, and package
exports follow semantic versioning.

Support targets are current evergreen browser engines and the native webviews
built on them. Platform-specific capabilities use detection and graceful
fallback rather than user-agent checks.
