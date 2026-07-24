import assert from "node:assert/strict";
import test from "node:test";

import { GuiWorkspaceModel, workspaceModule } from "../src/modules/workspace/index.js";

function workspace() {
  return new GuiWorkspaceModel({
    panels: [
      { id: "editor", title: "Editor", closable: false },
      { id: "logs", title: "Logs" },
      { id: "preview", title: "Preview" },
    ],
    layout: {
      type: "split",
      id: "root",
      direction: "vertical",
      sizes: [0.7, 0.3],
      children: [
        { type: "tabs", id: "main", panels: ["editor", "preview"], active: "editor" },
        { type: "tabs", id: "bottom", panels: ["logs"], active: "logs" },
      ],
    },
  });
}

test("workspace moves panels, resizes splits, and persists presets", () => {
  const model = workspace();
  model.movePanel("preview", "bottom");
  assert.deepEqual(model.layout.children[1].panels, ["logs", "preview"]);
  model.resize("root", [1, 1]);
  assert.deepEqual(model.layout.sizes, [0.5, 0.5]);
  model.savePreset("debug");
  model.movePanel("logs", "main");
  model.restorePreset("debug");
  assert.deepEqual(model.layout.children[1].panels, ["logs", "preview"]);
  assert.equal(model.removePanel("editor"), false);
  assert.equal(model.toJSON().schema, "guikit.workspace/v1");
});

test("workspace module exposes its component", () => {
  assert.equal(workspaceModule.id, "workspace");
  assert.deepEqual(workspaceModule.components, ["gui-workspace"]);
});
