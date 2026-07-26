import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const root = await readFile(new URL("../index.html", import.meta.url), "utf8");
const demo = await readFile(new URL("../examples/full-demo/index.html", import.meta.url), "utf8");
const demoApp = await readFile(new URL("../examples/full-demo/app.js", import.meta.url), "utf8");

test("Pages deployment runs checks and writes public build metadata", () => {
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /examples\/full-demo\/build-info\.json/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /testStatus: "passed"/);
});

test("landing page and full demo display deployment status", () => {
  assert.match(root, /pages-build-version/);
  assert.match(root, /build-info\.json/);
  assert.match(demo, /build-version/);
  assert.match(demoApp, /loadBuildInfo/);
});
