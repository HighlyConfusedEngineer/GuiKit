# GuiKit full demo

This application exercises every public GuiKit feature in one responsive
interface. It can run as static content or with its Node companion backend.

## Run the complete example

From the repository root:

```powershell
npm run demo:full
```

Open `http://127.0.0.1:4174/examples/full-demo/`.

The Node server adds an HTTP logging collector and a rotating JSONL file sink.
Runtime records are written under `examples/full-demo/runtime/`, which is
excluded from Git.

For browser-only mode, serve the repository with any static server and open
`/examples/full-demo/`. The demo detects that the backend endpoint is absent
and keeps every frontend feature operational.

## Coverage

| Station | Features exercised |
| --- | --- |
| Overview | Cards, responsive grids, `GuiDataBuffer`, min/max decimation, live event stream |
| Navigation | Collapsible sidebar, mobile drawer, tabs, nested tabs, sliding pages, history |
| Components | Inputs, selects, switches, buttons, cards, badges, design tokens, all toast variants and actions |
| Statusbar | Top/bottom and sticky/fixed placement, keyed live items, status, progress, actions, priorities, alignment, and custom slots |
| Live charts | Three responsive series, 30,000 initial points, bounded buffers, append, batch append, clear and render events |
| Node editor | Typed ports, links, drag, pan, zoom, selection, snapping, per-node settings, read-only mode, JSON import/export |
| Media | Direct `MediaStream`, custom media adapter, native URL loading, live controls, PiP and fullscreen capability detection |
| Logging | Levels, child context, errors, redaction, nested spans, memory, console, viewer, batch, bridge and HTTP sinks |
| Platform | English/German/Spanish localization, light/dark/system themes, native bridge calls/events, module registry |
| Node backend | Static hosting, structured backend logger, validated HTTP batches, rotating JSONL files |

The Python and C# examples remain the reference native-webview hosts. The full
demo's browser bridge mock uses the same request and response contract.

## Extension example

`app.js` registers `demo-inspector`, a small feature manifest depending on the
logging and media modules. Its state appears in the module table. This is a
working example of the extension contract described in
[Building GuiKit modules](../../docs/MODULES.md).

## Expected limitations

- Canvas `MediaStream` capture requires a browser engine that implements
  `HTMLCanvasElement.captureStream()`.
- Picture-in-Picture, fullscreen, native HLS, and media codecs depend on the
  host browser or webview.
- GitHub Pages or another static host runs browser-only mode because it cannot
  execute the Node logging backend.
