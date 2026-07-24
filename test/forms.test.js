import assert from "node:assert/strict";
import test from "node:test";

import { GuiFormModel, formsModule } from "../src/modules/forms/index.js";

function schema() {
  return {
    id: "device",
    fields: [
      { id: "name", label: "Name", required: true, minLength: 3 },
      { id: "manual", type: "boolean", default: false },
      {
        id: "gain",
        type: "number",
        min: 0,
        max: 10,
        default: 5,
        visibleWhen: { field: "manual", equals: true },
      },
    ],
  };
}

test("form model coerces values, dependencies, validation, and dirty state", async () => {
  const model = new GuiFormModel(schema());
  assert.equal(model.state("gain").visible, false);
  model.set("manual", true);
  model.set("gain", 99);
  assert.equal(model.get("gain"), 10);
  assert.equal(model.state("gain").visible, true);
  assert.equal(model.dirty, true);
  assert.deepEqual(await model.validate(), {
    valid: false,
    errors: { name: "Name is required." },
    values: { name: "", manual: true, gain: 10 },
  });
  model.set("name", "Sensor");
  assert.equal((await model.validate()).valid, true);
  model.commit();
  assert.equal(model.dirty, false);
});

test("forms module follows the module contract", () => {
  assert.equal(formsModule.id, "forms");
  assert.deepEqual(formsModule.components, ["gui-form"]);
});
