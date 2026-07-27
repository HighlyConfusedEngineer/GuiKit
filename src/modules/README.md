# GuiKit modules

Each subdirectory is a self-contained feature with implementation, public
types, focused documentation, and tests.

Start with [the module authoring guide](../../docs/MODULES.md), or generate a
new module:

```powershell
npm run create:module -- my-feature
```

Current reference module:

- [`node-editor`](node-editor/) demonstrates a DOM-independent model, custom
  element, cancelable request events, shadow-DOM styling, serialization,
  accessibility, and package subpath export.
- [`media-player`](media-player/) demonstrates browser capability detection,
  live object properties, async resource cleanup, adapter registration,
  responsive controls, and media accessibility.
- [`statusbar`](statusbar/) demonstrates keyed live updates, responsive item
  priority, named slots, action events, and configurable viewport placement.
- [`commands`](commands/) centralizes actions, shortcuts, command discovery,
  cancellation, and undo/redo history.
- [`overlays`](overlays/) provides the common dialog, popover, menu, tooltip,
  focus, and dismissal layer.
- [`runtime`](runtime/) contains persistence, routing, tasks, typed clipboard,
  capabilities, and diagnostics.
- [`forms`](forms/) demonstrates schema-driven models and generated editors.
- [`data-views`](data-views/) contains virtual list/grid and accessible tree
  models and renderers.
- [`workspace`](workspace/) implements serializable docking layouts.
- [`devtools`](devtools/) provides the component laboratory and audit surfaces.
- [`app-shell`](app-shell/) provides a serializable application manifest and
  responsive navigation shell for starter projects and native hosts.
- [`performance`](performance/) supplies frame batching, lazy feature loading,
  and bounded performance-budget telemetry.
- [`editors`](editors/) provides rich text, code, structured data, property,
  image, query, timeline, diagram, token, and translation editing surfaces.
- [`platform`](platform/) supplies adapter-first collaboration, files,
  analysis, automation, AI, plugins, accessibility, testing, documents, and
  design-token primitives.
- [`productivity`](productivity/) provides virtual comboboxes, scheduling,
  analysis displays, property grids, host-managed uploads, notification
  history, and shortcut profiles.
- [`tex`](tex/) provides TeX source models, secure compiler adapters, template
  automation, diagnostics, editing, and PDF preview without bundling a TeX
  runtime.
- [`production`](production/) supplies delivery hardening: layouts/themes,
  connectors, observability, offline sync, plugin policy, visual tests, and
  performance/bundle budgets.
