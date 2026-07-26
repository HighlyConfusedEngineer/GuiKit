import assert from "node:assert/strict";
import test from "node:test";

import { GuiDiagramModel, GuiEditorHistory, GuiTimelineModel, editorsModule, formatStructuredText } from "../src/modules/editors/index.js";

test("editor history supports bounded undo and redo snapshots", () => {
  const history = new GuiEditorHistory({ limit: 2 });
  history.push("one"); history.push("two"); history.push("three");
  assert.equal(history.undo("four"), "three");
  assert.equal(history.redo("two"), "four");
});
test("timeline model snaps movable keyframes", () => {
  const model = new GuiTimelineModel([{ id: "track", keyframes: [{ id: "a", time: 0, value: 1 }] }]);
  assert.equal(model.moveKeyframe("track", "a", .36, { snap: .1 }), true);
  assert.equal(model.tracks[0].keyframes[0].time, .4);
});
test("diagram model validates shape references", () => {
  const model = new GuiDiagramModel(); const first = model.addShape({ label: "Start" }); const second = model.addShape({ label: "End" });
  assert.equal(model.connect(first, second), "link-1");
  assert.throws(() => model.connect(first, "missing"));
});
test("structured formatter and editor module remain dependency free", () => {
  assert.equal(formatStructuredText({ value: 3 }), '{\n  "value": 3\n}');
  assert.equal(editorsModule.components.length, 10);
});
