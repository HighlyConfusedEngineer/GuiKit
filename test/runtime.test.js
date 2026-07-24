import assert from "node:assert/strict";
import test from "node:test";

import {
  GuiCapabilityRegistry,
  GuiClipboard,
  GuiDiagnostics,
  GuiDragDrop,
  GuiMemoryStorage,
  GuiPersistenceStore,
  GuiRouter,
  GuiTaskManager,
} from "../src/modules/runtime/index.js";

test("persistence migrates versioned serializable state", () => {
  const storage = new GuiMemoryStorage();
  const first = new GuiPersistenceStore({ storage, namespace: "test", version: 1 });
  first.save("settings", { name: "old" });
  const second = new GuiPersistenceStore({
    storage,
    namespace: "test",
    version: 2,
    migrations: {
      2: (value) => ({ ...value, enabled: true }),
    },
  });
  assert.deepEqual(second.load("settings"), { name: "old", enabled: true });
});

test("router resolves parameters and guards navigation", async () => {
  const router = new GuiRouter({
    routes: [{ id: "node", path: "/nodes/:id", title: "Node" }],
  });
  assert.deepEqual(router.resolve("http://localhost/#/nodes/filter?tab=io"), {
    id: "node",
    path: "/nodes/filter",
    title: "Node",
    params: { id: "filter" },
    query: { tab: "io" },
    data: {},
  });
  router.guard(({ to }) => to.params.id !== "blocked");
  assert.equal(await router.navigate("/nodes/blocked", { memoryOnly: true }), false);
  assert.equal(await router.navigate("/nodes/allowed", { memoryOnly: true }), true);
});

test("task manager reports bounded completion state", async () => {
  const manager = new GuiTaskManager({ historyLimit: 2 });
  const task = manager.run({ id: "build", label: "Build" }, async ({ report }) => {
    report(0.5, "Halfway");
    return 42;
  });
  assert.equal(await task.promise, 42);
  assert.equal(manager.get("build").status, "completed");
  assert.equal(manager.get("build").progress, 1);
});

test("failed tasks can be retried with the original runner", async () => {
  const manager = new GuiTaskManager();
  let attempts = 0;
  const first = manager.run({ id: "retry", label: "Retry" }, () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary");
    return "done";
  });
  await assert.rejects(first.promise, /temporary/);
  const retry = manager.retry("retry");
  assert.equal(await retry.promise, "done");
  assert.equal(attempts, 2);
});

test("typed clipboard, capabilities, and diagnostics remain serializable", async () => {
  const clipboard = new GuiClipboard();
  clipboard.registerType("application/test", {
    validate: (value) => typeof value?.name === "string",
  });
  await clipboard.write("application/test", { name: "payload" }, { system: false });
  assert.deepEqual(await clipboard.read("application/test", { system: false }), { name: "payload" });

  const capabilities = new GuiCapabilityRegistry();
  capabilities.register("math.double", ({ value }) => value * 2);
  assert.equal(await capabilities.invoke("math.double", { value: 6 }), 12);

  const diagnostics = new GuiDiagnostics({ maxSamples: 10 });
  diagnostics.record("render", 4);
  diagnostics.record("render", 8);
  assert.equal(diagnostics.summary("render").average, 6);
});

test("typed drag and drop payloads use registered serializers", () => {
  const dragDrop = new GuiDragDrop();
  dragDrop.registerType("application/test", {
    validate: (value) => typeof value?.id === "string",
  });
  const values = new Map();
  const transfer = {
    setData(type, value) { values.set(type, value); },
    getData(type) { return values.get(type) ?? ""; },
  };
  dragDrop.write(transfer, "application/test", { id: "panel" });
  assert.deepEqual(dragDrop.read(transfer, "application/test"), { id: "panel" });
});
