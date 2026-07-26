import assert from "node:assert/strict";
import test from "node:test";
import {
  GuiCredentialVault,
  GuiAccessibilityLab,
  GuiCachePolicy,
  GuiDataConnectorRegistry,
  GuiFlowDebugger,
  GuiNodeLibrary,
  GuiObservabilityHub,
  GuiOfflineSyncQueue,
  GuiPluginPolicy,
  GuiProductionOptimizer,
  GuiResponsiveLayout,
  GuiThemeStudio,
  GuiVisualRegressionSuite,
  contrastRatio,
  correlation,
  createReplayConnector,
  exportChartSvg,
  exportDelimited,
  fftMagnitude,
  normalizeAnalysisDataset,
  productionModule,
} from "../src/modules/production/index.js";

test("production module declares its optional UI surfaces", () => {
  assert.equal(productionModule.id, "production");
  assert.equal(productionModule.elements.length, 5);
});

test("theme studio audits contrast and retains portable presets", () => {
  const studio = new GuiThemeStudio({ tokens: { fg: "#ffffff", bg: "#000000" } });
  assert.equal(contrastRatio("#fff", "#000"), 21);
  assert.equal(studio.audit([{ foreground: "fg", background: "bg" }])[0].aaa, true);
  studio.savePreset("dark"); studio.set("fg", "#111111"); studio.applyPreset("dark");
  assert.equal(studio.tokens.fg, "#ffffff");
});

test("layout resolver applies breakpoint-specific spans", () => {
  const layout = new GuiResponsiveLayout({ items: [{ id: "chart", span: { compact: 12, wide: 8 } }] });
  assert.equal(layout.resolve(400).items[0].columns, 12);
  assert.equal(layout.resolve(1200).items[0].columns, 8);
});

test("connectors and host-owned credentials are adapter based", async () => {
  const connectors = new GuiDataConnectorRegistry(); connectors.register(createReplayConnector("demo", [{ value: 1 }]));
  assert.deepEqual(await connectors.load("demo"), { value: 1 });
  const data = new Map(); const vault = new GuiCredentialVault({ get: async (key) => data.get(key), set: async (key, value) => data.set(key, value), remove: async (key) => data.delete(key) });
  await vault.set("api", "secret"); assert.equal(await vault.test("api", (value) => value === "secret"), true); await vault.remove("api"); assert.equal(await vault.get("api"), undefined);
});

test("observability and node debugging remain bounded and serializable", () => {
  const hub = new GuiObservabilityHub({ alerts: [{ metric: "latency", value: 10 }] }); let alerted = false; hub.addEventListener("alert", () => { alerted = true; }); hub.metric("latency", 12); assert.equal(alerted, true);
  const trace = hub.trace("request"); trace.span("db").end({ ok: true }); assert.equal(hub.snapshot().traces[0].spans[0].ok, true);
  const nodes = new GuiNodeLibrary([{ type: "math", ports: [{ id: "out" }] }]); assert.equal(nodes.create("math").type, "math");
  const debuggerModel = new GuiFlowDebugger({ breakpoints: ["math-1"] }); debuggerModel.step("math-1", { out: 5 }); assert.equal(debuggerModel.paused, true);
});

test("analysis and chart exports cover spectrum, correlation, CSV, and SVG", () => {
  assert.equal(fftMagnitude([1, 0, -1, 0]).length, 3);
  assert.equal(correlation([1, 2, 3], [2, 4, 6]), 1);
  assert.match(exportDelimited([{ name: "a,b", value: 2 }]), /"a,b"/);
  assert.match(exportChartSvg([{ x: 0, y: 0 }, { x: 1, y: 1 }]), /<polyline/);
  assert.deepEqual(normalizeAnalysisDataset("candlestick", [{ open: 1, high: 3, low: 0, close: 2 }])[0], { x: 0, open: 1, high: 3, low: 0, close: 2, volume: 0 });
});

test("accessibility and cache policies make offline behavior explicit", () => {
  const accessibility = new GuiAccessibilityLab({ reducedMotion: true });
  assert.equal(accessibility.motion({ duration: 200 }).duration, 0);
  assert.deepEqual(accessibility.focusPlan([{ id: "first", order: 1 }, { id: "second", order: 2 }]).order, ["first", "second"]);
  const policy = new GuiCachePolicy([{ match: "\\.json$", strategy: "stale-while-revalidate" }]);
  assert.equal(policy.resolve("/data/config.json").strategy, "stale-while-revalidate");
});

test("offline sync and sandbox policy preserve host control", async () => {
  const storage = new Map(); const queue = new GuiOfflineSyncQueue({ storage: { get: async (key) => storage.get(key), set: async (key, value) => storage.set(key, value) } });
  await queue.enqueue({ type: "save" }); const sent = []; await queue.flush(async (operation) => sent.push(operation.type)); assert.deepEqual(sent, ["save"]);
  const project = queue.import(queue.snapshot({ name: "Demo" })); assert.equal(project.name, "Demo");
  const policy = new GuiPluginPolicy({ permissions: ["storage"] }); assert.equal((await policy.verify({ apiVersion: "1", permissions: ["network"] })).valid, false);
});

test("visual matrix and budget checks make CI deterministic", async () => {
  const suite = new GuiVisualRegressionSuite({ viewports: [320], themes: ["dark"], locales: ["en", "de"] }); assert.equal(suite.matrix("card").length, 2); suite.baseline("card", "before"); assert.equal((await suite.compare("card", "after", async () => ({ passed: true, changedPixels: 0 }))).status, "passed");
  const optimizer = new GuiProductionOptimizer({ budgets: { "main.js": 10 } }); assert.equal(optimizer.evaluateAssets({ "main.js": 11 })[0].passed, false);
});
