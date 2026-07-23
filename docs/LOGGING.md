# Structured logging

GuiKit logging uses the same JSON-safe record schema in interfaces, webviews,
workers, and backend modules. Logging stays useful without coupling application
code to the console, a vendor, or a host language.

## Quick start

```js
import {
  GuiMemorySink,
  logger,
  logs,
} from "@gui-template/core/logging";

const memory = new GuiMemorySink({ limit: 2_000 });
logs.addSink(memory);

const apiLog = logger.child("api", { service: "catalog" });
apiLog.info("Request completed", {
  method: "GET",
  path: "/products",
  status: 200,
});
```

The default manager accepts `trace` through `fatal` records and writes `info`
and above to the console. Create an independent manager when an application
needs different isolation, configuration, or lifecycle:

```js
const logs = new GuiLogManager({
  level: production ? "info" : "trace",
  context: { application: "studio", version: "2.4.0" },
  onSinkError(error, sink) {
    reportTransportHealth(error, sink);
  },
});
```

Application logging never waits for a transport. `flush()` is the explicit
durability boundary and should be awaited during a graceful backend shutdown.

## Record schema

Every sink receives a frozen `guikit.log/v1` record:

```json
{
  "schema": "guikit.log/v1",
  "timestamp": "2026-07-23T12:00:00.000Z",
  "sequence": 42,
  "level": "info",
  "levelValue": 30,
  "logger": "app.api",
  "message": "Request completed",
  "context": {
    "application": "studio",
    "requestId": "req-17"
  },
  "data": {
    "status": 200
  },
  "trace": {
    "traceId": "…",
    "spanId": "…"
  }
}
```

`timestamp`, `sequence`, and the trace fields support ordering and correlation.
Consumers must ignore unknown fields so the schema can evolve compatibly.

## Child loggers and backend modules

Create one child logger per subsystem. Context is inherited without being
mutated:

```js
const databaseLog = logger.child("database", { engine: "sqlite" });
const requestLog = databaseLog.withContext({ requestId });

requestLog.debug("Executing query", { statementName: "find-user" });
requestLog.error("Query failed", error, { retry: 2 });
```

Pass a `GuiLogger` into a backend module instead of importing the global:

```js
export class JobRunner {
  constructor({ logger }) {
    this.logger = logger.child("jobs");
  }
}
```

That pattern keeps modules testable and lets the host decide destinations and
minimum levels.

## Errors, timers, and spans

Errors are serialized with name, message, stack, cause, and enumerable custom
properties:

```js
log.capture(error, "Import failed", { source: file.name });

const timer = log.time("Index rebuilt", { index: "products" });
await rebuild();
timer.end({ documents: 12_400 });

const span = log.startSpan("image.process", { imageId });
try {
  await processImage();
  span.end({ result: "cached" });
} catch (error) {
  span.fail(error);
}
```

Nested spans inherit `traceId` and record `parentSpanId`, so a backend or
observability service can reconstruct work across modules.

## Privacy and bounded serialization

Sanitization happens in `GuiLogManager` before subscribers or sinks receive a
record. By default, field names resembling passwords, tokens, secrets,
authorization headers, cookies, API keys, session IDs, and private keys become
`"[REDACTED]"`.

Circular references, DOM elements, functions, symbols, big integers, long
strings, deep objects, large arrays, and objects with many keys are converted
to bounded JSON-safe values. Limits are configurable through the manager.
Additional exact names or regular expressions can be provided with
`redactKeys`.

Redaction is a defense in depth, not permission to log credentials. Avoid
putting sensitive values into a log call at all.

## Sinks and transports

Sinks implement `write(record)` and can optionally provide `writeBatch`,
`flush`, and `dispose`.

- `GuiConsoleSink` writes readable or structured console output.
- `GuiMemorySink` retains a bounded, searchable ring of recent records.
- `GuiBridgeLogSink` sends records to a Python, C#, or other webview host.
- `GuiHttpLogSink` posts `{ records }` to an HTTP collector.
- `GuiNodeFileSink` writes ordered JSONL with bounded size-based rotation.
- `GuiBatchSink` adds batching, a bounded queue, drop accounting, and a flush
  interval to any transport.

Forward logs to a native host without sending one bridge message per record:

```js
import {
  GuiBatchSink,
  GuiBridgeLogSink,
  bridge,
  logs,
} from "@gui-template/core";

logs.addSink(new GuiBatchSink(
  new GuiBridgeLogSink(bridge, { minLevel: "info" }),
  { batchSize: 50, maxQueue: 5_000, interval: 1_000 },
));
```

When the queue is full, the oldest pending records are dropped. The next
delivered record receives `transport.droppedBefore`, making data loss visible
to collectors.

For Node backends:

```js
import { GuiLogManager } from "@gui-template/core/logging";
import { GuiNodeFileSink } from "@gui-template/core/logging/node";

const logs = new GuiLogManager({ context: { process: "worker" } });
logs.addSink(new GuiNodeFileSink("./logs/worker.jsonl", {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 5,
}));
```

The file sink serializes writes to preserve order, creates its parent
directory, and renames older files to `.1`, `.2`, and so on.

## Live viewer

`<gui-log-viewer>` provides level and text filters, pause/resume, clear,
bounded retention, structured detail expansion, and JSONL export:

```html
<gui-log-viewer limit="1000"></gui-log-viewer>
```

It connects to the default manager automatically. Connect an isolated manager
explicitly with `viewer.connect(logs)`. The viewer renders with `textContent`;
logged strings are never interpreted as HTML.

## Native host contract

`GuiBridgeLogSink` invokes `logging.write` with:

```json
{
  "records": [
    { "schema": "guikit.log/v1", "level": "info", "logger": "app", "message": "…" }
  ]
}
```

The handler returns `{ "accepted": number }`. The Python and C# examples
validate the schema and map frontend levels into their standard logging
facilities. Production hosts should also cap batch size and payload bytes,
authenticate remote collectors, and apply a retention policy.

## Maintainer checklist

A new sink should:

1. expose `minLevel`;
2. preserve records without mutation;
3. reject failed asynchronous writes so `onSinkError` can observe them;
4. make `flush()` a meaningful durability boundary;
5. release timers, sockets, or file handles in `dispose()`;
6. document retry, ordering, queue, and data-loss behavior;
7. include tests for failure and capacity limits.
