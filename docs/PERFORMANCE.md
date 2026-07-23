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
still cause one draw.

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

## Measuring

The chart emits `gui:chart-render` after each draw:

```js
chart.addEventListener("gui:chart-render", ({ detail }) => {
  console.log(detail.points, detail.visiblePoints);
});
```

Measure in the actual deployment webview because GPU, pixel density, window
size, and host-engine versions affect canvas performance.
