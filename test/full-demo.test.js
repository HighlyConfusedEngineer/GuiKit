import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../examples/full-demo/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../examples/full-demo/app.js", import.meta.url), "utf8");
const server = await readFile(new URL("../examples/full-demo/server.mjs", import.meta.url), "utf8");

test("full demo contains every GuiKit custom element", () => {
  [
    "gui-sidebar",
    "gui-pages",
    "gui-tabs",
    "gui-live-chart",
    "gui-node-editor",
    "gui-media-player",
    "gui-log-viewer",
  ].forEach((tag) => assert.match(html, new RegExp(`<${tag}(?:\\s|>)`)));
});

test("full demo navigation targets existing pages", () => {
  const targets = [...html.matchAll(/data-gui-page-open="([^"]+)"/g)]
    .map((match) => match[1]);
  const pages = new Set(
    [...html.matchAll(/data-page="([^"]+)"/g)].map((match) => match[1]),
  );
  targets.forEach((target) => assert.equal(pages.has(target), true, target));
});

test("full demo element ids are unique", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("full demo exercises services, transports, and module extension", () => {
  [
    "GuiDataBuffer",
    "decimateMinMax",
    "GuiMemorySink",
    "GuiBridgeLogSink",
    "GuiHttpLogSink",
    "defineGuiModule",
    "mediaAdapters.register",
    "attachStream",
    "bridge.invoke",
    "i18n.setLocale",
    "setTheme",
  ].forEach((surface) => assert.match(app, new RegExp(surface.replace(".", "\\."))));
});

test("full demo backend bounds and validates log ingestion", () => {
  assert.match(server, /1_048_576/);
  assert.match(server, /slice\(0, 1_000\)/);
  assert.match(server, /guikit\.log\/v1/);
  assert.match(server, /GuiNodeFileSink/);
  assert.match(server, /filePath\.startsWith\(allowedRoot\)/);
});
