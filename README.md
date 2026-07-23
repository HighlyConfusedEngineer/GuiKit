# GuiKit

GuiKit is a lightweight GUI foundation for interfaces that need to run in a
browser, a desktop webview, or both. The UI is written once with standard HTML,
CSS, and JavaScript. Python, C#, or another host language supplies native
capabilities through a small request/response bridge.

The current `0.1` foundation includes:

- responsive desktop sidebar and mobile drawer;
- optional persistent desktop sidebar collapsing;
- accessible, keyboard-navigable tab views;
- interruption-safe animated tabs and sliding pages with back history;
- responsive live charts for thousands of continuously updated data points;
- accessible toast notifications with actions and four severity levels;
- a visual node editor with typed ports, links, pan, zoom, and serialization;
- responsive native video and live MediaStream playback with adapter support;
- structured cross-runtime logging with redaction, spans, batching, transports,
  rotating Node JSONL files, and a live viewer;
- a dependency-aware module registry and feature generator;
- light, dark, and system themes powered by CSS variables;
- runtime localization with fallback and interpolation;
- a promise-based host bridge for pywebview, WebView2, WebKit, and browser mocks;
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
<gui-node-editor id="workflow" snap="16"></gui-node-editor>
```

```js
const editor = document.querySelector("#workflow");
editor.setGraph({
  nodes: [
    {
      id: "source",
      outputs: [{ id: "source:value", type: "number" }],
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
See [the node-editor guide](docs/NODE_EDITOR.md).

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

GuiKit owns presentation, navigation primitives, localization, and host
transport. Application code should own domain data, persistence, permissions,
and routing policy. This boundary lets the same front end run against several
host languages without teaching UI components about Python or .NET.

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
- [Native bridge protocol](docs/BRIDGE.md)
- [Chart performance](docs/PERFORMANCE.md)
- [Node editor](docs/NODE_EDITOR.md)
- [Media player](docs/MEDIA_PLAYER.md)
- [Module authoring](docs/MODULES.md)
- [Framework roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
