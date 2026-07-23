import assert from "node:assert/strict";
import test from "node:test";

import { GuiToastManager } from "../src/gui.js";

test("toast manager remains safe in a non-DOM host", () => {
  const manager = new GuiToastManager();
  const handle = manager.success("Saved");

  assert.match(handle.id, /^gui-toast-/);
  assert.equal(handle.dismiss(), false);
});
