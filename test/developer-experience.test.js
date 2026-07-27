import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GuiAppManifest, GuiAppShellModel } from "../src/modules/app-shell/index.js";
import { GuiDevelopmentSession } from "../src/modules/devtools/index.js";
import { createBridgeMock, createGuiTestHost, waitForGuiEvent } from "../src/testing/index.js";
import { createApp, createAppFiles } from "../tools/create-app.mjs";
import { inspectGuiKitProject } from "../tools/doctor.mjs";
import { generateBridgeArtifacts } from "../tools/generate-bridge.mjs";
import { generateTokenArtifacts } from "../tools/tokens.mjs";
import { createExtension } from "../tools/create-extension.mjs";

test("app manifests validate page contracts and emit route changes", async () => {
  const manifest = new GuiAppManifest({ id: "sample-app", pages: [{ id: "home", title: "Home" }, { id: "settings", title: "Settings" }] });
  const model = new GuiAppShellModel(manifest);
  const changed = waitForGuiEvent(model, "gui:route-change");
  assert.equal(model.select("settings").title, "Settings");
  assert.equal((await changed).detail.previousPage, "home");
  assert.throws(() => new GuiAppManifest({ id: "bad id", pages: [] }), /kebab-case/);
});

test("development sessions retain bounded bridge activity", async () => {
  const bridge = { async invoke(method, payload) { return { method, payload }; } };
  const session = new GuiDevelopmentSession({ bridge, limit: 2 });
  await bridge.invoke("system.info", { verbose: true });
  assert.equal(session.records.length, 2);
  assert.deepEqual(session.records.map((record) => record.name), ["request", "response"]);
});

test("test helpers record bridge calls and application events", async () => {
  const bridge = createBridgeMock({ "app.read": ({ id }) => ({ id }) });
  assert.deepEqual(await bridge.invoke("app.read", { id: "a" }), { id: "a" });
  assert.equal(bridge.calls.length, 1);
  const host = createGuiTestHost();
  const event = waitForGuiEvent(host.target, "ready");
  host.emit("ready", { ok: true });
  assert.equal((await event).detail.ok, true);
});

test("scaffolder and extension generator create portable source files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guikit-dx-"));
  try {
    assert.match(createAppFiles({ name: "demo-app", target: "python", modules: ["tex"] })["src/main.js"], /GuiAppManifest/);
    await createApp(path.join(directory, "demo-app"), { name: "demo-app", target: "csharp" });
    assert.match(await readFile(path.join(directory, "demo-app", "Host.cs"), "utf8"), /GuiKit.WebView/);
    const extension = await createExtension(directory, "sample-tool");
    assert.match(await readFile(path.join(extension, "manifest.json"), "utf8"), /sample-tool/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("doctor reports configuration issues without changing the project", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guikit-doctor-"));
  try {
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ dependencies: { "@gui-template/core": "^0.2.0" }, engines: { node: ">=20" } }));
    await writeFile(path.join(directory, "index.html"), "<!doctype html>");
    const report = await inspectGuiKitProject(directory);
    assert.equal(report.healthy, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("bridge and token generators emit cross-platform artifacts", () => {
  const bridge = generateBridgeArtifacts({ namespace: "DemoBridge", methods: [{ id: "device.read", params: { id: "string" }, result: "boolean" }] });
  assert.match(bridge["BridgeContracts.cs"], /ReadAsync/);
  assert.match(bridge["bridge-python.py"], /async def read/);
  const tokens = generateTokenArtifacts({ color: { accent: { $value: "#0af", $type: "color" } } });
  assert.match(tokens["guikit.tokens.css"], /--gui-color-accent/);
});
