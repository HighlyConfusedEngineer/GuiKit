import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GuiStatusbar,
  statusbarModule,
} from "../src/modules/statusbar/index.js";

test("statusbar module exposes its component and manifest", () => {
  assert.equal(typeof GuiStatusbar, "function");
  assert.equal(statusbarModule.id, "statusbar");
  assert.deepEqual(statusbarModule.components, ["gui-statusbar"]);
});

test("statusbar normalizes configurable items", () => {
  const statusbar = new GuiStatusbar();
  const items = statusbar.setItems([
    {
      id: "connection",
      type: "status",
      align: "start",
      variant: "success",
      label: "Backend",
      value: "Online",
    },
    {
      id: "sync",
      type: "progress",
      align: "center",
      progress: 140,
    },
    "Ready",
  ]);

  assert.equal(items.length, 3);
  assert.equal(statusbar.getItem("connection").variant, "success");
  assert.equal(statusbar.getItem("sync").progress, 100);
  assert.equal(items[2].id, "item-3");
  assert.equal(items[2].value, "Ready");
});

test("statusbar updates, upserts, and removes keyed items", () => {
  const statusbar = new GuiStatusbar();
  statusbar.setItems([{ id: "jobs", label: "Jobs", value: 2 }]);

  const updated = statusbar.setItemValue("jobs", 3, { announce: false });
  assert.equal(updated.value, "3");
  assert.equal(statusbar.getItem("jobs").value, "3");

  statusbar.upsertItem({ id: "jobs", variant: "warning" });
  statusbar.upsertItem({ id: "clock", align: "end", value: "12:30" });
  assert.equal(statusbar.getItem("jobs").variant, "warning");
  assert.equal(statusbar.getItem("clock").align, "end");
  assert.equal(statusbar.removeItem("clock"), true);
  assert.equal(statusbar.removeItem("clock"), false);
  const generated = statusbar.addItem("Ready");
  assert.notEqual(generated.id, "jobs");
});

test("statusbar rejects duplicate and unknown item operations", () => {
  const statusbar = new GuiStatusbar();
  statusbar.setItems([{ id: "ready" }]);

  assert.throws(
    () => statusbar.setItems([{ id: "duplicate" }, { id: "duplicate" }]),
    /already exists/,
  );
  assert.equal(statusbar.items.length, 1);
  assert.throws(() => statusbar.addItem({ id: "ready" }), /already exists/);
  assert.throws(() => statusbar.updateItem("missing", {}), /Unknown statusbar item/);
});

test("statusbar snapshots are detached", () => {
  const statusbar = new GuiStatusbar();
  statusbar.setItems([{ id: "state", data: { attempts: 1 } }]);
  const snapshot = statusbar.items;
  snapshot[0].data.attempts = 99;

  assert.equal(statusbar.getItem("state").data.attempts, 1);
  statusbar.clear();
  assert.deepEqual(statusbar.items, []);
});

test("statusbar registers only after its browser resources initialize", async () => {
  const source = await readFile(
    new URL("../src/modules/statusbar/index.js", import.meta.url),
    "utf8",
  );
  const styles = source.indexOf("const STATUSBAR_STYLES");
  const automaticRegistration = source.lastIndexOf(
    'customElements.define("gui-statusbar", GuiStatusbar)',
  );

  assert.ok(styles >= 0);
  assert.ok(automaticRegistration > styles);
});
