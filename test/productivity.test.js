import assert from "node:assert/strict";
import test from "node:test";
import {
  GuiComboboxModel,
  GuiNotificationCenter,
  GuiPropertyGridModel,
  GuiScheduleModel,
  GuiShortcutProfiles,
  GuiUploadQueue,
  heatmap,
  analysisHistogram,
  productivityModule,
} from "../src/modules/productivity/index.js";

test("virtual combobox model filters options and preserves multi-selection", async () => {
  const model = new GuiComboboxModel({ multiple: true, options: [{ value: "cpu", label: "CPU", keywords: ["processor"] }, "memory"] });
  model.setValue(["cpu"]);
  model.toggle("memory");
  assert.deepEqual(model.value, ["cpu", "memory"]);
  assert.equal((await model.query("process", { remote: false }))[0].value, "cpu");
});

test("schedule, property, and analysis models stay bounded and serializable", () => {
  const schedule = new GuiScheduleModel({ range: { start: "2026-07-01", end: "2026-07-02" } });
  schedule.upsert({ id: "review", title: "Review", start: "2026-07-01T08:00:00Z", end: "2026-07-01T09:00:00Z" });
  assert.equal(schedule.between().length, 1);
  const grid = new GuiPropertyGridModel({ camera: { gain: 1 } });
  grid.update("camera.gain", 4);
  assert.equal(grid.value.camera.gain, 4);
  assert.equal(analysisHistogram([1, 2, 3], 3).reduce((sum, bin) => sum + bin.count, 0), 3);
  assert.equal(heatmap([{ row: 0, column: 1, value: 9 }], { rows: 2, columns: 2 })[1].value, 9);
});

test("uploads, notifications, and shortcut profiles enforce their policies", async () => {
  const queue = new GuiUploadQueue({ accept: [".csv"], maxSize: 10 });
  queue.add([{ name: "signals.csv", size: 4, type: "text/csv", lastModified: 1 }]);
  await queue.upload({ upload: async (_file, { onProgress }) => { onProgress(4); return { id: "remote" }; } });
  assert.equal(queue.items[0].status, "complete");
  const center = new GuiNotificationCenter([{ id: "one", title: "Ready" }]);
  assert.equal(center.unread, 1); center.markRead(); assert.equal(center.unread, 0);
  const profiles = new GuiShortcutProfiles({ default: { save: "Ctrl+S" } });
  assert.throws(() => profiles.save("invalid", { save: "Ctrl+S", other: "Ctrl+S" }));
  assert.deepEqual(profiles.bindings(), { save: "ctrl+s" });
});

test("productivity module declares every optional surface", () => {
  assert.equal(productivityModule.id, "productivity");
  assert.deepEqual(productivityModule.dependencies, ["commands"]);
  assert.equal(productivityModule.components.length, 8);
});
