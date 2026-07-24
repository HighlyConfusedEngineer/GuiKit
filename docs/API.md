# API reference

Public JavaScript exports come from `src/gui.js`. TypeScript declarations live
in `src/gui.d.ts`.

## Initialization

### `initializeGui(options?)`

Initializes delegated controls, applies the saved or requested theme, and
translates the document. Repeated calls are safe.

```js
initializeGui({
  locale: "en",
  fallbackLocale: "en",
  theme: "system",
});
```

### `setTheme(theme)`

Accepts `"light"`, `"dark"`, or `"system"`. The choice is saved when storage
is available and emits `gui:theme-changed`.

## Live chart

```html
<gui-live-chart
  id="telemetry"
  max-points="20000"
  window-points="5000"
  min="0"
  max="100"
  label="CPU and memory utilization">
</gui-live-chart>
```

Attributes:

| Attribute | Default | Meaning |
| --- | ---: | --- |
| `max-points` | `10000` | Maximum retained points per series |
| `window-points` | `max-points` | Newest points rendered per series |
| `min` | automatic | Fixed vertical minimum |
| `max` | automatic | Fixed vertical maximum |
| `label` | `Live data chart` | Accessible canvas description |

Configure and update series:

```js
const chart = document.querySelector("#telemetry");

chart.setSeries([
  {
    id: "cpu",
    label: "CPU",
    color: "#5b5ce2",
    data: [{ x: Date.now(), y: 42 }],
  },
  { id: "memory", label: "Memory", data: [] },
]);

chart.append("cpu", { x: Date.now(), y: 48 });
chart.appendBatch("memory", [
  [Date.now() - 1000, 63],
  [Date.now(), 64],
]);
```

Point inputs may be numbers, `[x, y]` tuples, or `{ x, y }` objects. Numbers
receive monotonically increasing x values. Appends schedule at most one draw
per animation frame.

Methods:

- `setSeries(configurations)` replaces every series.
- `addSeries(configuration)` adds or replaces one series and returns its id.
- `append(seriesId, point)` adds one point.
- `appendBatch(seriesId, points)` adds many points with a single redraw.
- `clear(seriesId?)` clears one series or all series.
- `requestRender()` schedules a redraw.

The component emits `gui:chart-render` with total and visible point counts.

## Toasts

The exported `toast` singleton creates a stack on first use:

```js
import { toast } from "./src/gui.js";

const handle = toast.success("Saved", {
  title: "Project",
  duration: 4000,
  action: {
    label: "Undo",
    onClick: undoSave,
  },
});

handle.dismiss();
```

Methods:

- `toast.show(message, options)`
- `toast.info(message, options)`
- `toast.success(message, options)`
- `toast.warning(message, options)`
- `toast.error(message, options)`
- `toast.dismiss(id)`

Options include `title`, `duration`, `dismissible`, `closeLabel`, and `action`.
A duration of `0` creates a persistent notification. Timers pause while a toast
is hovered or contains keyboard focus.

The stack emits `gui:toast-show`, `gui:toast-action`, and
`gui:toast-dismiss`.

## Tabs

Set the `active` attribute or call `select(name, focus?)`. The component emits
`gui:tab-change`. Tab activation uses an interruption-safe entrance transition;
rapid selection always leaves exactly one visible panel. Arrow Left,
Arrow Right, Home, and End provide keyboard navigation.

## Pages

Set the `active` attribute, call `open(name, options?)`, or call `back()`. The
component emits `gui:page-change`. Forward and back navigation use coordinated
entrance and exit motion. Starting another navigation safely cancels and
replaces the current transition.

## Sidebar

The mobile drawer API remains `toggle(force?)`. Desktop collapse is optional:

```html
<button
  data-gui-sidebar-collapse="navigation"
  data-expanded-label="Collapse sidebar"
  data-collapsed-label="Expand sidebar">
  ‹
</button>

<gui-sidebar
  id="navigation"
  collapsible
  persist-key="primary-navigation">
  ...
</gui-sidebar>
```

Use the `collapsed` property or `toggleCollapse(force?)` method from
JavaScript. The component emits `gui:sidebar-collapse`. When `persist-key` is
present, the state is stored under a namespaced local-storage key. The
collapsed layout is ignored at mobile drawer sizes.

Elements whose visual content should contract can use
`.gui-sidebar-label`. Icon-only controls must retain an accessible name.

## Localization

`i18n.register(locale, catalog)`, `i18n.load(locale, url)`,
`i18n.setLocale(locale)`, and `i18n.t(key, variables?)` form the localization
API. See the main README for markup attributes.

## Native bridge

`bridge.invoke(method, params?, options?)` returns a Promise and rejects on host
errors or timeout. `bridge.hostKind` reports the currently detected transport.
See [BRIDGE.md](BRIDGE.md) for the wire protocol.

## Node editor

The default bundle exports `GuiNodeEditor`, `GuiNodeGraph`, and
`nodeEditorModule`. A smaller subpath import is also available:

```js
import {
  GuiNodeEditor,
  GuiNodeGraph,
} from "@gui-template/core/node-editor";
```

See [NODE_EDITOR.md](NODE_EDITOR.md) for schemas, interaction, methods, events,
and performance guidance.

## Wizard

The default bundle exports `GuiWizard`, `GuiWizardModel`, and `wizardModule`.
A direct subpath import is available:

```js
import {
  GuiWizard,
  GuiWizardModel,
} from "@gui-template/core/wizard";
```

Use native form constraints or `setValidator()` before calling `next()`,
`goTo()`, or `finish()`. Progress from `getState()` is serializable and can be
restored with `restoreState()`. See [WIZARD.md](WIZARD.md) for declarative step
markup, linear navigation, asynchronous validation, optional steps, events,
focus behavior, and persistence.

## Statusbar

The default bundle exports `GuiStatusbar` and `statusbarModule`. A smaller
subpath import is available:

```js
import {
  GuiStatusbar,
  statusbarModule,
} from "@gui-template/core/statusbar";
```

Use `setItems()`, `updateItem()`, and `setItemValue()` for serializable keyed
updates. See [STATUSBAR.md](STATUSBAR.md) for item schemas, top/bottom
placement, responsive priority, named slots, and events.

## Module registry

`GuiModuleRegistry` provides dependency-aware feature initialization.
`guiModules` is the default registry and `defineGuiModule(manifest)` registers
a manifest with it.

```js
import {
  defineGuiModule,
  guiModules,
} from "@gui-template/core/modules";

defineGuiModule(featureModule);
await guiModules.initialize(featureModule.id, applicationContext);
```

`initializeGui()` now returns
`{ i18n, bridge, toast, logs, logger, modules, mediaAdapters, ready }`. Await `ready` when
application startup depends on module setup results. See
[MODULES.md](MODULES.md) for the complete extension contract.

## Media player

The default bundle exports `GuiMediaPlayer`, `GuiMediaAdapterRegistry`,
`mediaAdapters`, and `mediaPlayerModule`. A direct subpath is available:

```js
import {
  GuiMediaPlayer,
  mediaAdapters,
} from "@gui-template/core/media-player";
```

See [MEDIA_PLAYER.md](MEDIA_PLAYER.md) for native video, MediaStream, HLS/DASH
adapters, captions, methods, events, keyboard behavior, and lifecycle rules.

## Structured logging

The default bundle exports `logs`, `logger`, `GuiLogManager`,
`GuiMemorySink`, `GuiConsoleSink`, `GuiBatchSink`, `GuiBridgeLogSink`, and
`GuiHttpLogSink`. Node file output has a separate platform-safe subpath:

```js
import { logger, logs } from "@gui-template/core/logging";
import { GuiNodeFileSink } from "@gui-template/core/logging/node";
```

Use `logger.child(name, context)` for a module, `startSpan()` for correlated
work, and `logs.flush()` at a durability boundary. See
[LOGGING.md](LOGGING.md) for the record contract, privacy behavior, transports,
viewer, and backend examples.
