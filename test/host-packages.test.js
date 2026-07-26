import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pyproject = await readFile(new URL("../packages/python/pyproject.toml", import.meta.url), "utf8");
const pythonHost = await readFile(new URL("../packages/python/src/guikit_webview/host.py", import.meta.url), "utf8");
const project = await readFile(new URL("../packages/dotnet/GuiKit.WebView/GuiKit.WebView.csproj", import.meta.url), "utf8");
const bridge = await readFile(new URL("../packages/dotnet/GuiKit.WebView/GuiKitBridge.cs", import.meta.url), "utf8");
const release = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

test("Python host package bundles assets behind an optional native launcher", () => {
  assert.match(pyproject, /name = "guikit-webview"/);
  assert.match(pyproject, /pywebview>=5/);
  assert.match(pythonHost, /class GuiKitServer/);
  assert.match(pythonHost, /files\("guikit_webview"\)/);
});

test(".NET host package carries static assets and bridge helper", () => {
  assert.match(project, /PackageId>GuiKit.WebView/);
  assert.match(project, /contentFiles\/any\/any\/GuiKit/);
  assert.match(bridge, /HandleAsync/);
  assert.match(bridge, /gui-template/);
});

test("release pipeline publishes Python and NuGet artifacts", () => {
  assert.match(release, /package:python/);
  assert.match(release, /GuiKit.WebView\.csproj/);
  assert.match(release, /release\/python\/\*\.whl/);
  assert.match(release, /release\/dotnet\/\*\.nupkg/);
});
