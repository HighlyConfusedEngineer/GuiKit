import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GuiDialog,
  GuiContextMenu,
  GuiMenu,
  GuiOverlayController,
  GuiPopover,
  GuiTooltip,
  overlaysModule,
} from "../src/modules/overlays/index.js";
import {
  GuiComponentPlayground,
  GuiDiagnosticsPanel,
  devtoolsModule,
} from "../src/modules/devtools/index.js";

test("overlay module exposes all shared overlay components", () => {
  [GuiDialog, GuiContextMenu, GuiMenu, GuiPopover, GuiTooltip, GuiOverlayController]
    .forEach((surface) => assert.equal(typeof surface, "function"));
  assert.deepEqual(overlaysModule.components, [
    "gui-dialog",
    "gui-popover",
    "gui-context-menu",
    "gui-menu",
    "gui-tooltip",
  ]);
});

test("developer tools expose playground, diagnostics, and static audit", async () => {
  assert.equal(typeof GuiComponentPlayground, "function");
  assert.equal(typeof GuiDiagnosticsPanel, "function");
  assert.equal(devtoolsModule.id, "devtools");
  const source = await readFile(
    new URL("../src/modules/devtools/index.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /duplicate-id/);
  assert.match(source, /accessible-name/);
  assert.match(source, /positive-tabindex/);
});
