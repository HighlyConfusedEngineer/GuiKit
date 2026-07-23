import assert from "node:assert/strict";
import test from "node:test";

import {
  GuiPages,
  GuiSidebar,
  GuiTabs,
} from "../src/gui.js";

test("navigation components are available as public exports", () => {
  assert.equal(typeof GuiTabs, "function");
  assert.equal(typeof GuiPages, "function");
  assert.equal(typeof GuiSidebar, "function");
});
