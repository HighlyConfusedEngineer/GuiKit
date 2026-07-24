# Performance

## Live-chart data path

Each chart series owns two `Float64Array` instances arranged as a ring buffer.
Once full, a new point overwrites the oldest point in O(1) time. Memory cannot
grow beyond:

```text
series × max-points × 16 bytes
```

Two series with 20,000 points therefore use about 640 KB for numeric samples,
excluding small object and canvas overhead.

Rendering is batched with `requestAnimationFrame`. Ten appends in one frame
still cause one draw. Charts also use CSS containment so an off-screen chart
does not invalidate unrelated layout or paint work.

When available, the static grid is drawn on an `OffscreenCanvas` before it is
composited into the interactive canvas. Pointer cursor, focus, and tooltip
remain on the main surface for consistent WebView behavior.

## Downsampling

Drawing every point is wasteful when a 1,000-pixel canvas contains 20,000
samples. GuiKit divides the visible range into horizontal buckets and retains
both the minimum and maximum of each bucket in chronological order. This keeps
short spikes visible while limiting canvas path size to roughly twice the
plot's pixel width.

This is intentionally different from averaging, which can hide the very
outliers telemetry charts are meant to reveal.

## Recommended limits

- Use `appendBatch` when ingesting historical data.
- Set `max-points` to the retention actually needed by the UI.
- Set `window-points` below `max-points` when retaining history but displaying
  only the recent window.
- Aggregate on the producer side for millions of samples or long-term
  analytics. The browser component is a live visualizer, not a time-series
  database.
- Prefer no more than a handful of concurrently animated charts in a single
  view on low-power hardware.
- Use the chart's time viewport and legend visibility controls rather than
  rebuilding data when an operator narrows analysis to one signal.
- Keep long-term history in a server/worker process; the chart keeps a bounded
  interactive window and supports cancellable, adjacent-page prefetching.

## Measuring

The chart emits `gui:chart-render` after each draw:

```js
chart.addEventListener("gui:chart-render", ({ detail }) => {
  console.log(detail.points, detail.visiblePoints);
});
```

Measure in the actual deployment webview because GPU, pixel density, window
size, and host-engine versions affect canvas performance.

## Scheduling, budgets, and lazy features

The `performance` entry point provides three DOM-independent helpers:

```js
import { frameScheduler, lazyModules, performanceBudget } from "@gui-template/core/performance";

frameScheduler.schedule("telemetry", renderTelemetry);
performanceBudget.setBudget("chart-render", 16);
lazyModules.register("heavy-analysis", () => import("./analysis.js"));
```

`GuiPerformanceBudget` retains bounded p95/average/max samples and emits a
budget-exceeded event. `GuiLazyModuleLoader` lets applications dynamically
import optional analyzers, media engines, or editor extensions only when the
user opens the relevant surface.

`GuiSignalStore` delivers selector-based updates so a changed telemetry value
does not rerender unrelated panels. `GuiResourceGovernor` coordinates explicit
`normal`, `balanced`, and `constrained` profiles. A chart can opt in with:

```js
resourceGovernor.register("telemetry", (mode) => chart.setResourceMode(mode));
```

The constrained profile bounds retained samples more aggressively; applications
can register log viewers, previews, and workspace panes in the same way.

For expensive, non-interactive work, `GuiWorkerTaskRunner` implements a
cancellable request/response worker protocol with a deterministic local
fallback. `chart.analyzeAsync("cpu")` uses the packaged analysis worker when
workers are available, while behaving identically in restricted WebViews.

## Logging

Logging serialization is synchronous so a completed call always has an
immutable, JSON-safe record. Keep high-volume `trace` data simple and raise the
manager level in production when it is not needed.

`GuiMemorySink` and `<gui-log-viewer>` have explicit record limits.
`GuiBatchSink` bounds its pending queue and reports how many old records were
dropped when a transport cannot keep up. Use batching for native and network
transports, and call `flush()` at shutdown instead of using a zero interval for
every record.

## Virtualized data views

`<gui-virtual-list>` and `<gui-data-grid>` render the visible window plus a
small overscan region. Collection size therefore does not determine DOM node
count. Virtual-list row shells are recycled between ranges; the grid coalesces
scroll rendering into animation frames. Keep row heights fixed, use text for ordinary cells, and reserve custom
DOM renderers for columns that need them. Sorting and filtering are in-memory;
for datasets that do not fit comfortably in host memory, replace the
collection page through an application data source. `GuiPagedDataSource`
deduplicates in-flight requests, can abort stale page loads, and prefetches
adjacent pages from `<gui-data-grid>`.

The full demo uses 5,000 grid rows and a 5,000-item virtual list. Profile
application-specific cell renderers at the intended viewport size.

## Node editor

The DOM renderer is intended for hundreds of interactive nodes. Minimap
painting is one bounded canvas pass over the model. Obstacle routing cost grows
with visible nodes in a connection corridor; group or collapse complex graphs
and avoid rerouting on unrelated animation frames. A future canvas/WebGL
renderer can consume the same `GuiNodeGraph` serialization when graphs grow
beyond the interactive DOM boundary.
