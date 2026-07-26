# Architecture

GuiKit is split into four layers that deliberately know as little as possible
about one another.

```text
Application
    │
    ├── domain state, routing policy, persistence policy, permissions policy
    │
GuiKit components
    │
    ├── tabs, sidebars, pages, charts, forms, grids, workspaces, overlays
    │
GuiKit services
    │
    ├── localization, themes, bridge, commands, persistence, routing,
    │   tasks, clipboard, capabilities, diagnostics
    │
Web platform
    └── custom elements, canvas, CSS, DOM events, postMessage
```

## Source boundaries

```text
src/
  gui.js                       stable default-bundle entry point
  gui.css                      shared design tokens and base components
  core/
    module-registry.js         dependency and setup lifecycle
  modules/
    logging/                   runtime-neutral records and transport sinks
    commands/                  actions, shortcuts, palette, undo history
    overlays/                  dialogs, popovers, menus, tooltips
    runtime/                   persistence, routing, tasks, capabilities
    forms/                     schema form model and renderer
    data-views/                virtual list/grid/tree models and renderers
    performance/               frame batching, performance budgets, lazy loading
    editors/                   composable authoring components and visual models
    workspace/                 serializable docking layout
    devtools/                  playground, diagnostics, accessibility audit
    <feature>/
      index.js                 public implementation and manifest
      index.d.ts               public type contract
      README.md                focused maintainer guide
```

`gui.js` is the compatibility entry point for the default bundle. New,
self-contained features belong under `src/modules/` and receive a package
subpath export. A module must not reach into another module's private files.
Shared infrastructure moves to `src/core/` only after at least two modules need
it.

Cross-cutting modules receive a logger through setup or constructor context.
They do not import a global logger internally. The logging core remains
runtime-neutral; platform-specific persistence is isolated behind the
`logging/node` subpath. This keeps the browser bundle free of Node built-ins.

The module registry owns initialization order, not feature logic. Module
manifests name dependencies by stable ids, which keeps filesystem organization
and runtime composition independent.

## Web Components

Components use standard custom elements so a page can consume them without a
framework. React, Vue, Svelte, Blazor, or server-rendered HTML can treat them as
ordinary DOM nodes and call their explicit methods when necessary.

Most layout components use the light DOM. This lets applications style and
compose their own content. The live chart uses a shadow root because its canvas
and legend are implementation details; design tokens still cross that boundary.

## Design tokens

CSS custom properties form the public visual API. Component rules consume
semantic tokens such as `--gui-surface`, `--gui-text-muted`, and
`--gui-accent`. Applications can replace tokens without forking component CSS.

## State and events

GuiKit owns only presentation state:

- which tab or page is active;
- whether a mobile drawer is open;
- buffered chart points;
- active toast lifetimes;
- current locale and theme.

Application state stays outside the library. Public events use the `gui:`
prefix and bubble when they originate from DOM components.

Features with structural rules split those rules into a DOM-independent model.
`GuiNodeGraph` validates graph structure while `<gui-node-editor>` owns pointer
and keyboard interaction. This model/view boundary is the preferred pattern for
data grids, form builders, timelines, and other complex future modules.

The command registry owns action discovery and invocation, not application
business logic. History entries contain local redo/undo functions plus optional
serializable metadata. Runtime services return detached snapshots so native
hosts never need to receive JavaScript callbacks.

`GuiPersistenceStore` wraps a storage adapter in a versioned envelope and runs
explicit migrations. `GuiCapabilityRegistry` is an allowlist: web content
cannot invoke a backend operation until the host registers and authorizes it.

`<gui-media-player>` demonstrates the capability-adapter pattern. The core
uses native playback and `MediaStream`; protocol engines register against
`mediaAdapters` and own their cleanup. Optional integrations therefore do not
inflate the base runtime.

`<gui-statusbar>` demonstrates serializable keyed configuration. Applications
send plain item records and receive detached snapshots and bubbling action
events, so Python, C#, JavaScript, and other hosts share the same contract
without callbacks crossing the bridge. Named slots remain available for
framework-owned custom content.

## Native hosts

Host languages are transport adapters, not UI implementations. The front end
sends a small JSON envelope and the native host dispatches an allowlisted
method. Python and C# examples implement the same contract.

## Compatibility

The target is current evergreen browser engines and the webviews based on them:
Chromium/WebView2, WebKit/WKWebView, and pywebview backends. The library uses no
browser-specific styling API. A resize-event fallback is provided when
`ResizeObserver` is unavailable.

## Extending the architecture

Run `npm run create:module -- <id>` instead of copying an existing feature by
hand. The generated files encode the expected API, types, tests, documentation,
and package export. The full contract and review checklist are in
[MODULES.md](MODULES.md).
