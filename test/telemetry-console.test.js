import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../examples/telemetry-console/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../examples/telemetry-console/app.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../examples/telemetry-console/README.md", import.meta.url), "utf8");

test("PulseOps is a complete real-use-case reference application", () => {
  ["gui-sidebar", "gui-pages", "gui-live-chart", "gui-node-editor", "gui-tex-editor", "gui-tex-pdf-preview", "gui-statusbar", "gui-tutorial"].forEach((tag) => assert.match(html, new RegExp(`<${tag}(?:\\s|>)`)));
  ["Live overview", "Signal flow", "Shift report", "Station settings", "Alarm lifecycle"].forEach((concept) => assert.match(`${html}\n${readme}`, new RegExp(concept)));
});

test("PulseOps uses live telemetry, operational alarms, a flow, and a host-replaceable report boundary", () => {
  ["seedTelemetry", "chart.append", "raiseAlarm", "flow.setGraph", "flow.setWireTypes", "GuiTexDocument", "reportEditor.compiler", "GuiTutorialModel"].forEach((surface) => assert.match(app, new RegExp(surface.replaceAll(".", "\\."))));
});
