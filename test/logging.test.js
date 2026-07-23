import assert from "node:assert/strict";
import test from "node:test";

import {
  GUI_LOG_SCHEMA,
  GuiBatchSink,
  GuiLogManager,
  GuiMemorySink,
  loggingModule,
} from "../src/modules/logging/index.js";

function createManager(options = {}) {
  return new GuiLogManager({
    clock: () => new Date("2026-07-23T12:00:00.000Z"),
    idFactory: (() => {
      let id = 0;
      return () => `id-${++id}`;
    })(),
    ...options,
  });
}

test("logging creates structured records with child context", () => {
  const manager = createManager({ context: { application: "test" } });
  const memory = new GuiMemorySink();
  manager.addSink(memory);

  const record = manager.createLogger("backend").child("jobs", { worker: 2 })
    .info("Job accepted", { jobId: 42 });

  assert.equal(record.schema, GUI_LOG_SCHEMA);
  assert.equal(record.logger, "backend.jobs");
  assert.equal(record.timestamp, "2026-07-23T12:00:00.000Z");
  assert.deepEqual(record.context, { application: "test", worker: 2 });
  assert.deepEqual(record.data, { jobId: 42 });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(memory.records[0], record);
});

test("logging filters levels before notifying sinks and subscribers", () => {
  const manager = createManager({ level: "warn" });
  const memory = new GuiMemorySink();
  const observed = [];
  manager.addSink(memory);
  manager.subscribe((record) => observed.push(record.level));
  const log = manager.createLogger();

  assert.equal(log.info("ignored"), null);
  log.warn("kept");
  assert.deepEqual(observed, ["warn"]);
  assert.deepEqual(memory.records.map((record) => record.level), ["warn"]);
});

test("logging redacts secrets, truncates input, and handles circular values", () => {
  const manager = createManager({ maxStringLength: 12, maxArrayLength: 2 });
  const log = manager.createLogger();
  const circular = { password: "never expose this", values: [1, 2, 3] };
  circular.self = circular;

  const record = log.info("a message that is longer", {
    apiToken: "secret",
    nested: circular,
  });

  assert.equal(record.message.endsWith("…"), true);
  assert.equal(record.data.apiToken, "[REDACTED]");
  assert.equal(record.data.nested.password, "[REDACTED]");
  assert.equal(record.data.nested.self, "[Circular]");
  assert.deepEqual(record.data.nested.values, [1, 2, "[1 more items]"]);
});

test("errors and correlated spans use the common schema", () => {
  const manager = createManager();
  const memory = new GuiMemorySink();
  manager.addSink(memory);
  const span = manager.createLogger("importer").startSpan("import", { files: 3 });
  span.startSpan("decode").end({ frames: 5 });
  span.fail(new TypeError("Invalid frame"), { file: "sample.bin" });

  const failed = memory.records.at(-1);
  assert.equal(failed.level, "error");
  assert.equal(failed.error.name, "TypeError");
  assert.equal(failed.trace.traceId, "id-1");
  assert.equal(failed.trace.spanId, "id-2");
  assert.equal(failed.data.status, "error");
  assert.equal(typeof failed.data.durationMs, "number");
});

test("memory sink supports bounded storage, filtering, and JSONL", () => {
  const manager = createManager();
  const memory = new GuiMemorySink({ limit: 2 });
  manager.addSink(memory);
  const log = manager.createLogger("search");
  log.debug("discarded by capacity");
  log.info("needle", { value: 1 });
  log.error("failure", new Error("boom"));

  assert.equal(memory.records.length, 2);
  assert.deepEqual(memory.query({ minLevel: "warn" }).map((entry) => entry.level), ["error"]);
  assert.equal(memory.query({ search: "needle" }).length, 1);
  assert.equal(memory.toJSONLines().split("\n").length, 2);
});

test("batch sink limits queues, reports drops, and flushes batches", async () => {
  const batches = [];
  let releaseFirst;
  const firstWrite = new Promise((resolve) => { releaseFirst = resolve; });
  let writeCount = 0;
  const destination = {
    write() {},
    async writeBatch(records) {
      batches.push(records);
      writeCount += 1;
      if (writeCount === 1) await firstWrite;
    },
  };
  const batch = new GuiBatchSink(destination, {
    batchSize: 2,
    maxQueue: 3,
    interval: 0,
  });
  const pending = [];
  for (let index = 1; index <= 6; index += 1) {
    const result = batch.write({ message: String(index) });
    if (result) pending.push(result);
  }
  releaseFirst();
  await Promise.all(pending);
  await batch.flush();

  assert.deepEqual(batches.flat().map((record) => record.message), ["1", "2", "4", "5", "6"]);
  assert.equal(batches[1][0].transport.droppedBefore, 1);
});

test("sink failures are isolated from application logging", async () => {
  const errors = [];
  const manager = createManager({ onSinkError: (error) => errors.push(error) });
  manager.addSink({ write() { throw new Error("transport unavailable"); } });

  assert.doesNotThrow(() => manager.createLogger().info("still works"));
  assert.equal(errors[0].message, "transport unavailable");

  manager.addSink(new GuiBatchSink({
    write() {},
    async writeBatch() {
      throw new Error("scheduled transport unavailable");
    },
  }, { batchSize: 10, interval: 1 }));
  manager.createLogger().info("scheduled write");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(errors.some((error) => error.message === "scheduled transport unavailable"), true);
});

test("logging module exposes the live viewer", () => {
  assert.equal(loggingModule.id, "logging");
  assert.deepEqual(loggingModule.components, ["gui-log-viewer"]);
});
