# GuiKit

[![CI](https://github.com/HighlyConfusedEngineer/GuiKit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HighlyConfusedEngineer/GuiKit/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/HighlyConfusedEngineer/GuiKit?display_name=tag&sort=semver)](https://github.com/HighlyConfusedEngineer/GuiKit/releases/latest)
[![License](https://img.shields.io/github/license/HighlyConfusedEngineer/GuiKit)](LICENSE)

GuiKit is a lightweight GUI foundation for interfaces that need to run in a
browser, a desktop webview, or both. The UI is written once with standard HTML,
CSS, and JavaScript. Python, C#, or another host language supplies native
capabilities through a small request/response bridge.

The current `0.2` foundation includes:

- responsive desktop sidebar and mobile drawer;
- optional persistent desktop sidebar collapsing;
- accessible, keyboard-navigable tab views;
- interruption-safe animated tabs and sliding pages with back history;
- touch/trackpad swipeable pages with keyboard controls and configurable,
  drag-reorderable responsive dashboard cards;
- analysis-grade live charts with multi-signal/dual-axis views, cursors,
  thresholds, annotations, pan/zoom, derived signals, and bounded rendering;
- accessible toast notifications with actions and four severity levels;
- validated, resumable multi-step wizards with asynchronous hooks;
- a visual node editor with typed ports, links, pan, zoom, and serialization;
- responsive native video and live MediaStream playback with adapter support;
- structured cross-runtime logging with redaction, spans, batching, transports,
  rotating Node JSONL files, and a live viewer;
- a dependency-aware module registry and feature generator;
- a central command palette, configurable shortcuts, cancellation, and
  transaction-based undo/redo;
- accessible dialogs, popovers, menus, tooltips, and shared overlay stacking;
- schema-driven forms with dependencies, custom editors, dirty state, and
  asynchronous validation;
- virtualized lists, sortable/editable data grids, and keyboard-navigable
  trees;
- dockable, draggable, resizable, and persistable application workspaces;
- guarded routing, background task progress, typed clipboard payloads,
  allowlisted capabilities, and bounded performance diagnostics;
- a component playground with event inspection and accessibility auditing;
- a full editor suite: rich text, code, structured data, property inspection,
  image, query, timeline, diagram, theme-token, and translation editors;
- an adapter-first application platform for collaboration, file workspaces,
  analysis/reporting, automation, streaming AI, plugin manifests,
  accessibility inspection, interaction testing, documents, and design tokens;
- frame batching, bounded performance budgets, cancellable data prefetching,
  virtual-row recycling, and lazy optional feature imports;
- light, dark, and system themes powered by CSS variables;
- runtime localization with fallback and interpolation;
- a promise-based host bridge for pywebview, WebView2, WebKit, and browser mocks;
- packaged Python (`guikit-webview`) and .NET (`GuiKit.WebView`) host assets and bridge helpers;
- virtual comboboxes, scheduling, advanced analysis views, property grids,
  host-managed uploads, notification history, and shortcut profiles;
- adapter-based TeX editing, template automation, sandboxed PDF compilation,
  diagnostics, and native/browser PDF preview;
- no runtime npm dependencies and no framework requirement.

## Try the showcase

Only Node.js is needed to serve the static files:

```powershell
npm run dev
```

Or use Python's standard-library server:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173`. Where Node.js is available, run the checks
with:

```powershell
npm run check
```

The HTML can also be served by any static server or packaged directly with a
native application.

### Python and .NET packages

Release builds include a self-contained Python wheel and .NET NuGet package in
addition to the npm archive. Build them locally with `npm run package:python`
and `npm run package:dotnet`; see [host packages](docs/HOST_PACKAGES.md) for
installation and WebView2/pywebview integration.

### GitHub README status

The badges above are shown directly in the GitHub README: **CI** reflects the
latest `main` test/build run, while **Latest release** shows the current tagged
version. No GitHub Pages deployment is required.

### Full feature demo

Run the complete browser-and-backend example:

```powershell
npm run demo:full
```

Then open `http://127.0.0.1:4174/examples/full-demo/`. It demonstrates every
public component and service, plus HTTP log batching and rotating Node JSONL
files. See the [full-demo guide](examples/full-demo/README.md) for its coverage
matrix and static-host fallback.

### Logging

```js
import {
  bridge,
  GuiBatchSink,
  GuiBridgeLogSink,
  logger,
  logs,
} from "@gui-template/core";

const moduleLog = logger.child("backend.sync", { service: "inventory" });
moduleLog.info("Synchronization started", { items: 1200 });

logs.addSink(new GuiBatchSink(new GuiBridgeLogSink(bridge), {
  batchSize: 50,
  interval: 1000,
}));
```

Records share one JSON-safe schema across frontend and backend runtimes.
Sensitive fields are redacted before transport. See
[Structured logging](docs/LOGGING.md) for Node file rotation, HTTP and native
bridge sinks, tracing, shutdown flushing, and the live viewer.

### Application platform

The optional `@gui-template/core/platform` entry point supplies models and Web
Components for application-grade tooling while keeping transports and vendors
outside the core package:

```js
import { GuiFileWorkspace, GuiMemoryFileAdapter, GuiAutomationModel } from "@gui-template/core/platform";

const workspace = new GuiFileWorkspace({ adapter: new GuiMemoryFileAdapter() });
workspace.create("notes/brief.md", "# Brief");
await workspace.save();

const flow = new GuiAutomationModel({ steps: [{ type: "action", action: "publish" }] });
await flow.run({}, async (step) => host.invoke(step.action));
```

See the [application-platform guide](docs/PLATFORM.md) for collaboration/CRDT
bridging, host file adapters, AI safety, plugin boundaries, report templates,
test recording, and DTCG/Figma token exchange.

### Production hardening

`@gui-template/core/production` provides the remaining delivery tooling:
theme/contrast and responsive-layout studios, adapter-first connectors and
credential references, offline sync, bounded observability, node execution
debugging, FFT/correlation/export helpers, plugin policy, visual-regression
matrices, lazy-element loading, and bundle-size budgets. Read the
[production guide](docs/PRODUCTION.md) for host and CI integration.

## Use the library

Import the stylesheet and module:

```html
<link rel="stylesheet" href="./src/gui.css">
<script type="module">
  import { initializeGui } from "./src/gui.js";
  initializeGui();
</script>
```

### Tabs

```html
<gui-tabs active="general">
  <div role="tablist" aria-label="Settings">
    <button data-tab="general">General</button>
    <button data-tab="advanced">Advanced</button>
  </div>
  <section data-tab-panel="general">General settings</section>
  <section data-tab-panel="advanced">Advanced settings</section>
</gui-tabs>
```

Listen for `gui:tab-change` when application state needs to follow the UI.

### Sidebar

```html
<button data-gui-sidebar-toggle="app-sidebar">Menu</button>
<button data-gui-sidebar-collapse="app-sidebar">Collapse</button>
<gui-sidebar id="app-sidebar" collapsible persist-key="workspace">
  <nav class="gui-nav">...</nav>
</gui-sidebar>
```

The sidebar is permanently visible on larger screens and behaves as a drawer
below `52rem`. Pressing Escape closes an open drawer. Desktop collapsing is
opt-in with `collapsible`; `persist-key` remembers the choice when local storage
is available.

### Sliding pages

```html
<gui-pages id="pages" active="home">
  <section data-page="home">
    <button data-gui-page-open="details">Open details</button>
  </section>
  <section data-page="details">
    <button data-gui-page-back>Back</button>
  </section>
</gui-pages>
```

For multiple page containers, point an action at one with
`data-gui-pages="#pages"`.

### Live charts

The chart stores each series in a fixed-size typed-array ring buffer and
downsamples dense ranges without hiding peaks:

```html
<gui-live-chart
  id="telemetry"
  max-points="20000"
  window-points="5000"
  label="CPU telemetry">
</gui-live-chart>
```

```js
const chart = document.querySelector("#telemetry");
chart.setSeries([{ id: "cpu", label: "CPU", data: historicalPoints }]);
chart.append("cpu", { x: Date.now(), y: 42 });
chart.appendBatch("cpu", incomingPoints);
```

See [the chart API](docs/API.md#live-chart) and
[performance notes](docs/PERFORMANCE.md) for retention and ingestion guidance.

### Toast notifications

```js
import { toast } from "./src/gui.js";

toast.success("Settings saved", {
  action: { label: "Undo", onClick: restoreSettings },
});
```

Notifications support info, success, warning, and error states. Dismiss timers
pause during hover and keyboard focus.

### Node editor

```html
<gui-node-editor
  id="workflow"
  flow-direction="vertical"
  snap="16">
</gui-node-editor>
```

```js
const editor = document.querySelector("#workflow");
editor.setGraph({
  nodes: [
    {
      id: "source",
      outputs: [{ id: "source:value", type: "number" }],
      parameters: [
        {
          id: "rate",
          label: "Rate",
          type: "range",
          value: 30,
          min: 1,
          max: 60,
          unit: "fps",
          inline: true,
        },
      ],
    },
    {
      id: "display",
      x: 320,
      inputs: [{ id: "display:value", type: "number" }],
    },
  ],
  links: [
    { id: "value-link", from: "source:value", to: "display:value" },
  ],
});
```

The pure `GuiNodeGraph` model validates types and link limits without a DOM.
Nodes can selectively expose typed parameters directly on their surface with
`inline: true`; text, number, range, select, boolean, and read-only displays are
supported. Each node also includes a settings icon for editing its name, type,
description, accent, and JSON data. Cancel `gui:node-settings-request` to
provide a custom domain-specific inspector instead. Set `flow-direction` to
`horizontal` or `vertical`; ports and obstacle-aware rounded links follow the
selected direction, route around node surfaces, and remain visible on a
dedicated foreground connection layer. Port types can use independent wire
palettes—for example red `analog` links and blue `digital` links—while the graph
continues to reject incompatible types. Nodes can cap links per port or in
total, and users can double-click a wire to remove it.
The editor also supports shared command history, typed copy/cut/paste, box
selection, groups, comments, collapsible nodes, alignment and distribution,
automatic layout, minimap navigation, search, manual reroute points, graph
validation, breakpoints, and execution-state visualization.
See [the node-editor guide](docs/NODE_EDITOR.md).

### Application framework

```js
import {
  commands,
  history,
  tasks,
} from "@gui-template/core";

commands.register({
  id: "project.save",
  label: "Save project",
  shortcut: "Ctrl+S",
  run: ({ signal }) => saveProject({ signal }),
});

await history.perform({
  label: "Rename node",
  redo: () => renameNode("Filter"),
  undo: () => renameNode("Processor"),
});

tasks.run({ id: "export", label: "Export project" }, async ({ signal, report }) => {
  await exportProject({ signal, report });
});
```

Focused package subpaths are available for `commands`, `overlays`, `runtime`,
`forms`, `data-views`, `workspace`, `devtools`, and `adapters`.

### Wizard

```html
<gui-wizard id="setup" linear label="Project setup">
  <section data-wizard-step="project" data-title="Project">
    <input name="project" required>
  </section>
  <section data-wizard-step="extras" data-title="Extras" data-optional>
    Optional integrations
  </section>
</gui-wizard>
```

```js
setup.setValidator("project", async () => {
  return await projectNameAvailable()
    ? true
    : "That project name is already in use.";
});

localStorage.setItem("setup-progress", JSON.stringify(setup.getState()));
```

The module supports linear or free navigation, native and asynchronous
validation, optional steps, cancelable policy events, progress persistence,
focus management, and a DOM-independent state model. See
[the wizard guide](docs/WIZARD.md).

### Live media

```html
<gui-media-player autoplay muted live></gui-media-player>
```

```js
await player.attachStream(webRtcStream, { live: true, autoplay: true });
```

The module supports native video, live `MediaStream`, captions, fullscreen,
Picture-in-Picture, live-edge seeking, and pluggable HLS/DASH adapters. See
[the media-player guide](docs/MEDIA_PLAYER.md).

### Statusbar

```html
<gui-statusbar id="app-status" position="bottom"></gui-statusbar>
```

```js
const statusbar = document.querySelector("#app-status");
statusbar.setItems([
  {
    id: "backend",
    type: "status",
    variant: "success",
    label: "Backend",
    value: "Online",
  },
  {
    id: "jobs",
    type: "progress",
    align: "center",
    label: "Jobs",
    progress: 72,
    value: "72%",
  },
  {
    id: "details",
    type: "action",
    align: "end",
    label: "Details",
  },
]);
```

Items support keyed live updates, actions, progress, variants, responsive
priority, and start/center/end alignment. The bar can be sticky or fixed at
the top or bottom. See [the statusbar guide](docs/STATUSBAR.md).

## Localization

Catalogs are plain nested JSON objects:

```json
{
  "welcome": {
    "title": "Hello, {name}!"
  }
}
```

Register or load them, select a locale, and mark translatable elements:

```js
import { i18n } from "./src/gui.js";

await i18n.load("en", "./locales/en.json");
i18n.setLocale("en");
console.log(i18n.t("welcome.title", { name: "Ada" }));
```

```html
<h1 data-i18n="welcome.title"></h1>
<input data-i18n-placeholder="search.placeholder">
```

Text content, placeholders, titles, and accessible labels are supported with
`data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, and
`data-i18n-aria-label`.

## Native bridge

The web UI always calls the same API:

```js
import { bridge } from "./src/gui.js";

const information = await bridge.invoke("app.info", { verbose: true });
```

Requests sent to WebView2 or WebKit use this envelope:

```json
{
  "channel": "gui-template",
  "type": "request",
  "id": "gui-...",
  "method": "app.info",
  "params": {}
}
```

The host replies with:

```json
{
  "channel": "gui-template",
  "type": "response",
  "id": "gui-...",
  "result": {},
  "error": null
}
```

In a browser, the bridge emits `gui:host-request`. This makes development and
testing possible without a native process. The showcase contains a mock.

- [Python example](examples/python/app.py) uses `pywebview` and runs on
  Windows, macOS, and Linux where a supported webview backend is available.
- [C# example](examples/csharp/README.md) uses WPF and WebView2 on Windows.
  The protocol is independent of WPF, so it can also back Avalonia, .NET MAUI,
  or another host with a webview and message API.

## Theming

Use `setTheme("light")`, `setTheme("dark")`, or `setTheme("system")`. Override
tokens at the application level:

```css
:root {
  --gui-accent: #0a7f68;
  --gui-radius-md: 0.4rem;
  --gui-sidebar-width: 19rem;
}
```

Tokens cover colors, spacing, radii, motion, elevation, and layout. The
components respect the operating system's reduced-motion setting.

## Project structure

```text
src/
  gui.js          components, localization, themes, native bridge
  gui.css         tokens, layouts, components, utilities
  gui.d.ts        TypeScript declarations
  core/           module lifecycle and shared extension infrastructure
  modules/        self-contained optional features
locales/          showcase translation catalogs
examples/
  python/         cross-platform pywebview host
  csharp/         WebView2 host and bridge dispatcher
test/             dependency-free Node tests
tools/            local static development server
docs/             architecture, API, bridge, and performance references
```

## Design boundaries

GuiKit owns presentation and reusable mechanisms for navigation, persistence,
permissions, localization, and host transport. Application code owns domain
data and policy: what may be saved, which route is allowed, and who may invoke
a capability. This boundary lets the same front end run against several host
languages without teaching UI components about Python or .NET.

The core intentionally avoids a build step. A later package can add optional
framework bindings or advanced components without increasing the base runtime.

## Add a module

Generate the standard implementation, types, documentation, tests, and package
export:

```powershell
npm run create:module -- command-palette
```

The [module authoring guide](docs/MODULES.md) defines lifecycle, API, event,
styling, accessibility, testing, and documentation conventions. The node editor
is the reference implementation for larger features.

## Documentation

- [API reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Framework and native adapters](docs/ADAPTERS.md)
- [Packaging profiles](docs/PACKAGING.md)
- [Native bridge protocol](docs/BRIDGE.md)
- [Chart performance](docs/PERFORMANCE.md)
- [Node editor](docs/NODE_EDITOR.md)
- [Wizard](docs/WIZARD.md)
- [Statusbar](docs/STATUSBAR.md)
- [Media player](docs/MEDIA_PLAYER.md)
- [Structured logging](docs/LOGGING.md)
- [Module authoring](docs/MODULES.md)
- [Release process](docs/RELEASING.md)
- [Production readiness and operations](docs/PRODUCTION_READINESS.md)
- [Productivity controls](docs/PRODUCTIVITY.md)
- [TeX documents and PDF creation](docs/TEX.md)
- [Developer workflow, generators, and inspector](docs/DEVELOPER_EXPERIENCE.md)
- [Implementation recipes](docs/RECIPES.md)
- [Framework roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Changelog](CHANGELOG.md)
