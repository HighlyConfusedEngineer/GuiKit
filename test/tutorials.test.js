import assert from "node:assert/strict";
import test from "node:test";
import { GuiTutorial, GuiTutorialModel, tutorialsModule } from "../src/modules/tutorials/index.js";
import { GuiTutorial as BundledGuiTutorial, GuiTutorialModel as BundledGuiTutorialModel } from "../src/gui.js";

const steps = [
  { id: "welcome", title: "Welcome", description: "A quick tour." },
  { id: "save", title: "Save", description: "Save your changes.", target: "#save", advanceOn: { event: "click" } },
];

test("tutorial module exposes a portable model and component", () => {
  assert.equal(GuiTutorial, BundledGuiTutorial);
  assert.equal(GuiTutorialModel, BundledGuiTutorialModel);
  assert.deepEqual(tutorialsModule.components, ["gui-tutorial"]);
});

test("tutorial model navigates, serializes, and reports lifecycle changes", () => {
  const model = new GuiTutorialModel(steps);
  const changes = [];
  model.addEventListener("gui:tutorial-change", (event) => changes.push(event.detail.kind));
  assert.equal(model.start(), true);
  assert.equal(model.current.id, "welcome");
  assert.equal(model.next(), true);
  assert.equal(model.current.id, "save");
  assert.equal(model.next(), true);
  assert.equal(model.active, false);
  assert.deepEqual(changes, ["start", "change", "stop"]);
  assert.equal(model.toJSON().index, 1);
});

test("tutorial steps validate stable ids and unique definitions", () => {
  assert.throws(() => new GuiTutorialModel([{ id: "Bad", title: "x", description: "y" }]), /kebab-case/);
  assert.throws(() => new GuiTutorialModel([steps[0], steps[0]]), /already exists/);
  assert.throws(() => new GuiTutorialModel([{ id: "ok", title: "x" }]), /description/);
});
