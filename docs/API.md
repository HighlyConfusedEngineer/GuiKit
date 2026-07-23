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
`gui:tab-change`.

## Pages

Set the `active` attribute, call `open(name, options?)`, or call `back()`. The
component emits `gui:page-change`.

## Localization

`i18n.register(locale, catalog)`, `i18n.load(locale, url)`,
`i18n.setLocale(locale)`, and `i18n.t(key, variables?)` form the localization
API. See the main README for markup attributes.

## Native bridge

`bridge.invoke(method, params?, options?)` returns a Promise and rejects on host
errors or timeout. `bridge.hostKind` reports the currently detected transport.
See [BRIDGE.md](BRIDGE.md) for the wire protocol.
