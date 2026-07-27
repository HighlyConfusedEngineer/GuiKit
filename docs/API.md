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

Configure multi-axis, multi-signal series:

```js
const chart = document.querySelector("#telemetry");

chart.setSeries([
  {
    id: "cpu",
    label: "CPU",
    color: "#5b5ce2",
    unit: "%",
    type: "area",
    data: [{ x: Date.now(), y: 42 }],
  },
  { id: "network", label: "Network", axis: "right", type: "step", data: [] },
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
- `setSeriesVisible(id, visible)` and `toggleSeries(id)` control individual
  signals; the interactive legend exposes the same action.
- `setView({ xMin, xMax })` and `resetView()` control the time viewport.
- `setCursor({ x, pinned, rangeStart, rangeEnd })` controls the shared
  multi-signal cursor.
- `setThresholds(...)` and `setAnnotations(...)` add analysis overlays.
- `addDerivedSeries({ source, operation, window })` creates moving-average,
  derivative, integral, or difference signals.
- `requestRender()` schedules a redraw.

Mouse wheel zooms around the pointer; drag pans; Shift-drag marks a range;
click pins the cursor; double-click resets the view. `gui:chart-render`
includes bounded per-signal statistics. `gui:chart-cursor`,
`gui:chart-view-change`, and `gui:chart-series-visibility` report interaction.

`analyzeChartSignal(points)` and `deriveChartSignal(points, options)` are
DOM-independent helpers for analysis pipelines and worker-backed hosts.
`chart.analyzeAsync(seriesId)` runs the same statistics calculation through
the packaged worker where the host permits workers, with a local fallback.

## Editors

Import the editor family from `@gui-template/core/editors`. It includes
`<gui-rich-text-editor>`, `<gui-code-editor>`, `<gui-structured-editor>`,
`<gui-property-inspector>`, `<gui-image-editor>`, `<gui-query-editor>`,
`<gui-timeline-editor>`, `<gui-diagram-editor>`, `<gui-theme-editor>`, and
`<gui-translation-editor>`.

The code editor supports formatting, line numbers, tab insertion, search
requests, and bounded undo history. The structured editor provides JSON text
and tree views. Rich text exposes HTML and a lightweight Markdown projection.
Property, query, token, and translation editors use serializable object state
and `gui:` change events.

`GuiTimelineModel` and `GuiDiagramModel` are DOM-independent models for
keyframes/tracks and shapes/links. They are suitable for validation,
persistence, and host-side transforms.

## Productivity controls

Import the optional family from `@gui-template/core/productivity`. It exposes
`GuiComboboxModel`, `GuiScheduleModel`, `GuiAnalysisSeries`,
`GuiPropertyGridModel`, `GuiUploadQueue`, `GuiNotificationCenter`, and
`GuiShortcutProfiles`, plus their custom elements. The collection covers
virtualized option selection, date ranges and agendas, histogram/scatter/
heatmap/spectrogram/gauge analysis, typed property inspection, host-adapted
file transfers, durable notification history, and named keyboard profiles.

Models emit `gui:` events and can be used without a DOM. Upload adapters own
destination authorization, resume persistence, checksums, and transport
security; the framework only validates queue policy and reports progress. See
[PRODUCTIVITY.md](PRODUCTIVITY.md) for schemas and integration examples.

## TeX documents

The optional `@gui-template/core/tex` entry point provides `GuiTexDocument`,
`GuiTexTemplate`, `GuiTexBridgeCompiler`, `<gui-tex-editor>`, and
`<gui-tex-pdf-preview>`. TeX compilation is always delegated to an explicit
adapter; the default package never embeds or executes a TeX engine. See
[TEX.md](TEX.md) for the bridge response schema and sandbox requirements.

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

Add the `view-transitions` attribute to progressively use the browser View
Transition API. GuiKit falls back to its Web Animations implementation, skips
motion for reduced-motion users, and preserves interruption safety.

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
  routeNodeConnection,
} from "@gui-template/core/node-editor";
```

Use `flow-direction="vertical"` (or `editor.flowDirection`) for top-to-bottom
graphs. `routeNodeConnection()` provides the same obstacle-aware orthogonal
router to alternate renderers. `setWireTypes()` maps validated port types to
wire colors and stroke styles; `allowMultipleConnections` and `maxConnections`
define node-level link policy. See [NODE_EDITOR.md](NODE_EDITOR.md) for schemas,
interaction, routing, methods, events, and performance guidance.

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

`initializeGui()` returns
`{ i18n, bridge, toast, logs, logger, modules, mediaAdapters, commands, history,
persistence, router, tasks, clipboard, capabilities, diagnostics, ready }`. Await `ready` when
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

## Commands and history

The `commands` subpath exports `GuiCommandRegistry`, `GuiHistory`,
`GuiCommandPalette`, and the shared `commands` and `history` instances.
Commands have stable ids, searchable metadata, configurable shortcuts,
enabled/checked state, asynchronous execution, and an abort signal.

`GuiHistory.perform()` executes and records a redo/undo pair.
`GuiHistory.record()` records a change that has already happened.
`begin()`, `commit()`, and `rollback()` group several changes into one
transaction.

## Overlays

The `overlays` subpath exports `<gui-dialog>`, `<gui-popover>`,
`<gui-context-menu>`, `<gui-menu>`, `<gui-tooltip>`, and `overlayController`.
Every open or close operation has a cancelable request event. Dialogs restore
focus, popovers reposition on resize and scroll, and menus implement roving
focus with arrow, Home, and End keys.

## Runtime services

The `runtime` subpath exports:

- `GuiPersistenceStore` and `GuiMemoryStorage` for versioned state envelopes;
- `GuiRouter` for hash/history routes, parameters, queries, and async guards;
- `GuiTaskManager` and `<gui-task-center>` for bounded cancellable work;
- `GuiClipboard` for registered typed payloads and system-clipboard fallback;
- `GuiDragDrop` for registered payloads and reusable drag/drop target cleanup;
- `GuiCapabilityRegistry` for allowlisted, authorizable backend operations;
- `GuiDiagnostics` for bounded metric samples and timing marks.

All snapshots are structured-cloneable.

## Schema forms

`GuiFormModel` owns schemas, values, dependencies, dirty state, and validation.
`<gui-form>` renders native controls and emits `gui:form-change`,
`gui:form-submit-request`, `gui:form-submit`, and `gui:form-invalid`.
Register application-specific input types with `formEditors`.

## Data views

`GuiDataCollection` owns filtering, multi-column sorting, editing, and
selection. `<gui-data-grid>` renders a fixed-height visible window.
`<gui-virtual-list>` accepts an item array and renderer. `GuiTreeModel` and
`<gui-tree-view>` provide expandable hierarchy state and the WAI-ARIA tree
keyboard model. `GuiPagedDataSource` adds bounded async page caching for
server-side datasets. Grids support custom renderers, pinned leading columns,
inline edits, and JSON/CSV export.

## Workspace

`GuiWorkspaceModel` serializes nested tab groups and horizontal/vertical
splits. `<gui-workspace>` uses named slots for panel content and supports tab
dragging, close requests, pointer/keyboard split resizing, presets, persistence,
and host-controlled detach requests.

## Developer tools and adapters

The `devtools` subpath exports `<gui-component-playground>`,
`<gui-diagnostics-panel>`, and `auditAccessibility(root)`. The `adapters`
subpath exports React/Vue wrappers, event binding, lazy element definition, and
`GuiNativeController`. See [ADAPTERS.md](ADAPTERS.md).
