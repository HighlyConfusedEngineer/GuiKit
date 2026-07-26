import assert from "node:assert/strict";
import test from "node:test";

import {
  GuiCommandRegistry,
  GuiDataGrid,
  GuiDialog,
  GuiForm,
  GuiCodeEditor,
  GuiDiagramEditor,
  GuiImageEditor,
  GuiDashboard,
  GuiPages,
  GuiSidebar,
  GuiSwipePages,
  GuiTabs,
  GuiWorkspace,
} from "../src/gui.js";

test("navigation components are available as public exports", () => {
  assert.equal(typeof GuiTabs, "function");
  assert.equal(typeof GuiPages, "function");
  assert.equal(typeof GuiSwipePages, "function");
  assert.equal(typeof GuiDashboard, "function");
  assert.equal(typeof GuiSidebar, "function");
});

test("application framework components are available as public exports", () => {
  [GuiCommandRegistry, GuiDataGrid, GuiDialog, GuiForm, GuiWorkspace, GuiCodeEditor, GuiDiagramEditor, GuiImageEditor]
    .forEach((component) => assert.equal(typeof component, "function"));
});
