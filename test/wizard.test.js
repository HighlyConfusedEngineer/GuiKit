import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GuiWizard,
  GuiWizardModel,
  wizardModule,
} from "../src/modules/wizard/index.js";
import {
  GuiWizard as BundledGuiWizard,
  GuiWizardModel as BundledGuiWizardModel,
} from "../src/gui.js";

function createLinearModel() {
  return new GuiWizardModel([
    { id: "account", title: "Account" },
    { id: "integration", title: "Integration", optional: true },
    { id: "review", title: "Review" },
  ], { linear: true });
}

test("wizard module exposes its model, component, and manifest", () => {
  assert.equal(typeof GuiWizard, "function");
  assert.equal(typeof GuiWizard.prototype.next, "function");
  assert.equal(typeof GuiWizard.prototype.setValidator, "function");
  assert.equal(typeof GuiWizardModel, "function");
  assert.equal(BundledGuiWizard, GuiWizard);
  assert.equal(BundledGuiWizardModel, GuiWizardModel);
  assert.equal(wizardModule.id, "wizard");
  assert.deepEqual(wizardModule.components, ["gui-wizard"]);
});

test("wizard model normalizes steps and rejects duplicate ids", () => {
  const model = new GuiWizardModel(["first", { id: "second", optional: true }]);

  assert.equal(model.active, "first");
  assert.equal(model.steps[0].title, "first");
  assert.equal(model.steps[1].optional, true);
  assert.throws(
    () => model.load([{ id: "same" }, { id: "same" }]),
    /already exists/,
  );
  assert.throws(() => model.load([{ title: "Missing id" }]), /non-empty id/);
});

test("linear wizard unlocks steps only after earlier completion", () => {
  const model = createLinearModel();

  assert.equal(model.canVisit("integration"), false);
  assert.equal(model.activate("integration"), false);
  model.setStepState("account", { complete: true });
  assert.equal(model.canVisit("integration"), true);
  assert.equal(model.activate("integration"), true);
  assert.equal(model.canVisit("review"), false);
  model.setStepState("integration", { complete: true });
  assert.equal(model.activate("review"), true);
});

test("non-linear wizard permits direct navigation", () => {
  const model = new GuiWizardModel([
    { id: "first" },
    { id: "second" },
    { id: "third" },
  ]);

  assert.equal(model.canVisit("third"), true);
  assert.equal(model.activate("third"), true);
  assert.equal(model.active, "third");
});

test("optional steps can be skipped while required steps cannot", () => {
  const model = createLinearModel();
  model.setStepState("account", { complete: true });
  model.activate("integration");

  assert.equal(model.skip(), true);
  assert.deepEqual(model.toJSON().skipped, ["integration"]);
  assert.equal(model.canVisit("review"), true);
  assert.throws(
    () => model.setStepState("account", { skipped: true }),
    /not optional/,
  );
});

test("wizard state is serializable, detached, and restorable", () => {
  const model = createLinearModel();
  model.setStepState("account", { complete: true });
  model.activate("integration");
  const state = model.toJSON();
  state.completed.push("outside");

  assert.deepEqual(model.toJSON().completed, ["account"]);

  const restored = createLinearModel();
  restored.restore({
    active: "review",
    completed: ["account", "integration", "unknown"],
    visited: ["account", "integration", "review"],
    finished: true,
  });
  assert.deepEqual(restored.toJSON(), {
    active: "review",
    completed: ["account", "integration"],
    skipped: [],
    visited: ["account", "integration", "review"],
    finished: true,
  });

  restored.reset();
  assert.deepEqual(restored.toJSON(), {
    active: "account",
    completed: [],
    skipped: [],
    visited: ["account"],
    finished: false,
  });
});

test("wizard updates disabled state and falls back from a disabled active step", () => {
  const model = new GuiWizardModel([
    { id: "one" },
    { id: "two" },
  ], { active: "two" });

  model.setStepState("two", { disabled: true });
  assert.equal(model.active, "one");
  assert.equal(model.getStep("two").disabled, true);
});

test("wizard registers only after its browser resources initialize", async () => {
  const source = await readFile(
    new URL("../src/modules/wizard/index.js", import.meta.url),
    "utf8",
  );
  const styles = source.indexOf("const WIZARD_STYLES");
  const automaticRegistration = source.lastIndexOf(
    'customElements.define("gui-wizard", GuiWizard)',
  );

  assert.ok(styles >= 0);
  assert.ok(automaticRegistration > styles);
});
