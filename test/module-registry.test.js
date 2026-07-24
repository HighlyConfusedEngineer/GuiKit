import assert from "node:assert/strict";
import test from "node:test";

import { GuiModuleRegistry } from "../src/core/module-registry.js";

test("module registry initializes dependencies before dependents", async () => {
  const registry = new GuiModuleRegistry();
  const order = [];
  registry.register({
    id: "core",
    version: "1.0.0",
    setup() {
      order.push("core");
      return { ready: true };
    },
  });
  registry.register({
    id: "feature",
    version: "1.0.0",
    dependencies: ["core"],
    setup({ dependencies }) {
      order.push("feature");
      assert.equal(dependencies.get("core").ready, true);
      return "complete";
    },
  });

  assert.equal(await registry.initialize("feature"), "complete");
  assert.deepEqual(order, ["core", "feature"]);
  assert.equal(registry.state("feature"), "initialized");
});

test("module setup is cached and runs once", async () => {
  const registry = new GuiModuleRegistry();
  let runs = 0;
  registry.register({
    id: "service",
    version: "1.0.0",
    setup() {
      runs += 1;
      return runs;
    },
  });

  assert.equal(await registry.initialize("service"), 1);
  assert.equal(await registry.initialize("service"), 1);
  assert.equal(runs, 1);
});

test("concurrent initialization shares one setup promise", async () => {
  const registry = new GuiModuleRegistry();
  let runs = 0;
  registry.register({
    id: "service",
    version: "1.0.0",
    async setup() {
      runs += 1;
      await Promise.resolve();
      return "ready";
    },
  });

  assert.deepEqual(
    await Promise.all([
      registry.initialize("service"),
      registry.initialize("service"),
    ]),
    ["ready", "ready"],
  );
  assert.equal(runs, 1);
});

test("module registry reports missing and circular dependencies", async () => {
  const missing = new GuiModuleRegistry();
  missing.register({
    id: "feature",
    version: "1.0.0",
    dependencies: ["missing"],
  });
  await assert.rejects(
    missing.initialize("feature"),
    /depends on missing module "missing"/,
  );

  const circular = new GuiModuleRegistry();
  circular.register({ id: "first", version: "1.0.0", dependencies: ["second"] });
  circular.register({ id: "second", version: "1.0.0", dependencies: ["first"] });
  await assert.rejects(
    circular.initialize("first"),
    /first -> second -> first/,
  );
});

test("module manifests are validated and cannot be replaced", () => {
  const registry = new GuiModuleRegistry();
  assert.throws(() => registry.register({ id: "Bad Id", version: "1.0.0" }));
  registry.register({ id: "valid", version: "1.0.0" });
  assert.throws(() => registry.register({ id: "valid", version: "1.1.0" }));
});

test("lazy modules stay out of initialization until explicitly requested", async () => {
  const registry = new GuiModuleRegistry();
  let imports = 0;
  registry.registerLazy("analysis", async () => ({
    id: "analysis", version: "1.0.0", setup: () => ({ imported: ++imports }),
  }));
  assert.equal(registry.state("analysis"), "lazy");
  assert.deepEqual(await registry.initializeAll(), new Map());
  assert.deepEqual(await registry.initialize("analysis"), { imported: 1 });
  assert.equal(imports, 1);
});
