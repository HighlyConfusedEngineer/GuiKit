import assert from "node:assert/strict";
import test from "node:test";

import {
  GuiCommandPalette,
  GuiCommandRegistry,
  GuiHistory,
  commandsModule,
} from "../src/modules/commands/index.js";

test("command registry discovers, binds, and executes commands", async () => {
  const registry = new GuiCommandRegistry();
  let calls = 0;
  registry.register({
    id: "project.save",
    label: "Save project",
    category: "Project",
    shortcut: "Ctrl+S",
    keywords: ["persist"],
    run: ({ value }) => {
      calls += 1;
      return value * 2;
    },
  });

  assert.equal(registry.get("project.save").shortcut, "Ctrl+S");
  assert.equal(registry.list({ query: "persist" })[0].id, "project.save");
  assert.deepEqual(await registry.execute("project.save", { value: 4 }), {
    status: "completed",
    id: "project.save",
    value: 8,
  });
  assert.equal(calls, 1);
});

test("history supports direct records and grouped transactions", async () => {
  const history = new GuiHistory({ limit: 5 });
  let value = 0;
  value = 1;
  history.record({
    label: "Set one",
    redo: () => { value = 1; },
    undo: () => { value = 0; },
  });
  await history.undo();
  assert.equal(value, 0);
  await history.redo();
  assert.equal(value, 1);

  history.begin("Add twice");
  await history.perform({
    label: "Add one",
    redo: () => { value += 1; },
    undo: () => { value -= 1; },
  });
  await history.perform({
    label: "Add one",
    redo: () => { value += 1; },
    undo: () => { value -= 1; },
  });
  history.commit();
  assert.equal(value, 3);
  await history.undo();
  assert.equal(value, 1);
});

test("commands module exposes its palette and manifest", () => {
  assert.equal(typeof GuiCommandPalette, "function");
  assert.equal(commandsModule.id, "commands");
});
