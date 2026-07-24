import assert from "node:assert/strict";
import test from "node:test";

import { GuiFrameScheduler, GuiLazyModuleLoader, GuiPerformanceBudget, GuiResourceGovernor, GuiSignalStore, GuiWorkerTaskRunner } from "../src/modules/performance/index.js";

test("frame scheduler coalesces repeated keyed work", () => {
  const scheduler = new GuiFrameScheduler();
  const calls = [];
  scheduler.schedule("render", () => calls.push("old"));
  scheduler.schedule("render", () => calls.push("new"));
  scheduler.schedule("other", () => calls.push("other"));
  assert.equal(scheduler.pending, 2);
  assert.equal(scheduler.flush(), 2);
  assert.deepEqual(calls, ["new", "other"]);
});

test("performance budgets retain bounded aggregates", () => {
  const budget = new GuiPerformanceBudget({ maxSamples: 2, budgets: { paint: 5 } });
  assert.equal(budget.record("paint", 8).exceeded, true);
  budget.record("paint", 2);
  budget.record("paint", 4);
  assert.deepEqual(budget.snapshot("paint"), { count: 2, average: 3, max: 4, p95: 4 });
});

test("lazy module loader caches successful imports", async () => {
  const loader = new GuiLazyModuleLoader();
  let calls = 0;
  loader.register("analysis", async () => ({ calls: ++calls }));
  assert.deepEqual(await loader.load("analysis"), { calls: 1 });
  assert.deepEqual(await loader.load("analysis"), { calls: 1 });
  assert.equal(calls, 1);
});

test("signal store only notifies selectors whose values change", () => {
  const store = new GuiSignalStore({ chart: 1, theme: "dark" });
  const values = [];
  store.select((state) => state.chart, (value) => values.push(value));
  store.setState({ theme: "light" });
  store.setState({ chart: 2 });
  assert.deepEqual(values, [2]);
});

test("resource governor coordinates explicit constrained modes", () => {
  const governor = new GuiResourceGovernor();
  const modes = [];
  const unregister = governor.register("chart", (mode) => modes.push(mode));
  assert.equal(governor.setMode("constrained"), true);
  assert.equal(governor.setMode("constrained"), false);
  unregister();
  assert.deepEqual(modes, ["normal", "constrained"]);
});

test("worker task runner uses its deterministic fallback outside browser workers", async () => {
  const runner = new GuiWorkerTaskRunner(undefined, { fallback: (type, payload) => `${type}:${payload.value}` });
  assert.equal(runner.workerBacked, false);
  assert.equal(await runner.run("layout", { value: 7 }), "layout:7");
});
