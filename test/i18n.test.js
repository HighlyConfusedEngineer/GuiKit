import assert from "node:assert/strict";
import test from "node:test";

import { GuiBridge, GuiI18n } from "../src/gui.js";

test("translation lookup supports nesting, fallback, and interpolation", () => {
  const translator = new GuiI18n({ locale: "de", fallbackLocale: "en" });
  translator.register("en", {
    greeting: "Hello, {name}!",
    nested: { value: "Fallback value" },
  });
  translator.register("de", { greeting: "Hallo, {name}!" });

  assert.equal(translator.t("greeting", { name: "Ada" }), "Hallo, Ada!");
  assert.equal(translator.t("nested.value"), "Fallback value");
  assert.equal(translator.t("missing.key"), "missing.key");
});

test("catalog registration is chainable", () => {
  const translator = new GuiI18n();
  assert.equal(translator.register("en", {}), translator);
});

test("bridge reports no host in a server-side environment", () => {
  assert.equal(new GuiBridge().hostKind, "none");
});
