# Logging module

Public implementation lives in `index.js`; Node-only file output lives in
`node.js`. Keep the main entry free of Node imports so it remains usable in a
browser, desktop webview, worker, or backend JavaScript runtime.

All sinks receive immutable `guikit.log/v1` records. New transports should
implement `write(record)` and may optimize batching with `writeBatch(records)`.
They must not mutate records or make application logging throw synchronously.

Privacy limits and redaction happen in `GuiLogManager`, before subscribers or
sinks see a record. Extend that single boundary instead of implementing
transport-specific sanitization.
