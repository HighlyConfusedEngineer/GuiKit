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
    "gui-swipe-pages",
    "gui-dashboard",
    "gui-tabs",
    "gui-live-chart",
    "gui-node-editor",
    "gui-wizard",
    "gui-statusbar",
    "gui-media-player",
    "gui-log-viewer",
    "gui-command-palette",
    "gui-dialog",
    "gui-popover",
    "gui-context-menu",
    "gui-menu",
    "gui-tooltip",
    "gui-task-center",
    "gui-form",
    "gui-virtual-list",
    "gui-data-grid",
    "gui-tree-view",
    "gui-workspace",
    "gui-component-playground",
    "gui-diagnostics-panel",
    "gui-developer-inspector",
    "gui-app-shell",
    "gui-tutorial",
    "gui-rich-text-editor",
    "gui-code-editor",
    "gui-structured-editor",
    "gui-property-inspector",
    "gui-image-editor",
    "gui-query-editor",
    "gui-timeline-editor",
    "gui-diagram-editor",
    "gui-theme-editor",
    "gui-translation-editor",
    "gui-collaboration-panel",
    "gui-file-explorer",
    "gui-analysis-panel",
    "gui-automation-designer",
    "gui-ai-panel",
    "gui-plugin-manager",
    "gui-accessibility-inspector",
    "gui-test-recorder",
    "gui-document-editor",
    "gui-design-system-editor",
    "gui-theme-studio",
    "gui-layout-designer",
    "gui-connector-manager",
    "gui-observability-dashboard",
    "gui-visual-regression-panel",
    "gui-combobox",
    "gui-date-range-picker",
    "gui-scheduler",
    "gui-analysis-chart",
    "gui-property-grid",
    "gui-file-drop",
    "gui-notification-center",
    "gui-shortcut-editor",
    "gui-tex-editor",
    "gui-tex-pdf-preview",
  ].forEach((tag) => assert.match(html, new RegExp(`<${tag}(?:\\s|>)`)));
});

test("full demo exercises application-platform adapters and surfaces", () => {
  ["GuiCollaborationSession", "GuiMemoryFileAdapter", "GuiFileWorkspace", "GuiAutomationModel", "GuiAiSession", "pluginDemo.registry.register"].forEach((surface) => assert.match(app, new RegExp(surface.replaceAll(".", "\\."))));
});

test("full demo configures production studio services", () => {
  ["GuiThemeStudio", "createReplayConnector", "GuiObservabilityHub", "GuiPluginPolicy"].forEach((surface) => assert.match(app, new RegExp(surface.replaceAll(".", "\\."))));
});

test("full demo exposes developer workflow inspection and a manifest shell", () => {
  ["framework-inspector", "framework-app-shell", "GuiDevelopmentSession"].forEach((surface) => {
    assert.match(`${html}\n${app}`, new RegExp(surface));
  });
});

test("full demo provides an interactive contextual tutorial", () => {
  assert.match(html, /id="start-tutorial"/);
  assert.match(html, /id="demo-tutorial"/);
  assert.match(app, /GuiTutorialModel/);
  assert.match(app, /demoTutorial\.start/);
});

test("full demo has a searchable Feature Atlas that maps all domains to live stations", () => {
  assert.match(html, /data-page="atlas"/);
  ["atlas-search", "atlas-filter", "atlas-grid", "atlas-total"].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  ["const featureAtlas", "renderFeatureAtlas", "Foundation", "Navigation", "Data and analysis", "Automation", "Media", "Editors", "Productivity", "Workspace", "Platform", "Production", "Documents"].forEach((surface) => assert.match(app, new RegExp(surface.replaceAll(".", "\\."))));
});

test("full demo demonstrates swipe pages and configurable dashboards", () => {
  ["navigation-swipe-pages", "swipe-previous", "swipe-next", "swipe-loop", "navigation-dashboard", "dashboard-columns", "dashboard-span", "dashboard-save", "dashboard-restore"].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  ["swipePages.next", "swipePages.previous", "swipePages.loop", "navigationDashboard.updateCard", "navigationDashboard.savePreset", "navigationDashboard.restorePreset"].forEach((surface) => assert.match(app, new RegExp(surface.replaceAll(".", "\\."))));
});

test("full demo exposes direct interactions for every platform and production contract", () => {
  [
    "collaboration", "files", "analysis", "automation", "ai", "documents", "tokens", "a11y", "testing",
    "theme", "layout", "connector", "credentials", "observability", "nodes", "charts", "productivity", "tex", "offline", "plugins", "visual", "optimize", "cache", "service-worker",
  ].forEach((feature) => assert.match(html, new RegExp(`data-feature="${feature}"`), feature));
  [
    "summarizeTable", "pivotRows", "histogram", "flow.run", "session.send", "toPrintHtml", "toFigmaVariables",
    "GuiCredentialVault", "GuiFlowDebugger", "fftMagnitude", "normalizeAnalysisDataset", "GuiOfflineSyncQueue",
    "GuiVisualRegressionSuite", "GuiProductionOptimizer", "GuiCachePolicy", "GuiServiceWorkerBridge",
  ].forEach((surface) => assert.match(app, new RegExp(surface.replaceAll(".", "\\.")), surface));
});

test("full demo configures every editor surface", () => {
  ["editor-rich", "editor-code", "editor-structured", "editor-properties", "editor-image", "editor-query", "editor-timeline", "editor-diagram", "editor-theme", "editor-translations"].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  ["GuiTimelineModel", "GuiDiagramModel", "editorProperties.schema", "editorQuery.parameters"].forEach((surface) => assert.match(app, new RegExp(surface.replace(".", "\\."))));
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

test("full demo includes a comprehensive persistent settings station", () => {
  assert.match(html, /data-page="settings"/);
  assert.match(html, /id="settings-form"/);
  [
    "text",
    "email",
    "number",
    "radio",
    "color",
    "range",
    "checkbox",
    "time",
    "url",
  ].forEach((type) => {
    assert.match(html, new RegExp(`type="${type}"`), type);
  });
  assert.match(html, /<progress id="settings-storage-progress"/);
  assert.match(html, /readonly>/);
  assert.match(app, /guikit-full-demo-settings-v1/);
  assert.match(app, /new FormData\(settingsForm\)/);
  assert.match(app, /gui:settings-change/);
  assert.match(app, /gui:settings-save/);
  assert.match(app, /gui:settings-reset/);
});

test("full demo exercises wizard validation, persistence, and completion", () => {
  assert.match(html, /<gui-wizard/);
  assert.match(html, /data-wizard-step="workspace"/);
  assert.match(html, /data-wizard-step="integrations"[\s\S]*data-optional/);
  assert.match(app, /fullWizard\.setValidator/);
  assert.match(app, /fullWizard\.getState/);
  assert.match(app, /fullWizard\.restoreState/);
  assert.match(app, /gui:wizard-finish/);
  assert.match(app, /guikit-full-demo-wizard-v1/);
});

test("full demo switches node-editor flow direction and layout", () => {
  assert.match(html, /id="node-flow-direction"/);
  assert.match(html, /<option value="vertical">Vertical<\/option>/);
  assert.match(app, /nodeEditor\.flowDirection = direction/);
  assert.match(app, /\[node\.x, node\.y\] = \[node\.y, node\.x\]/);
  assert.match(app, /nodeEditor\.setWireTypes/);
  assert.match(app, /allowMultipleConnections/);
  assert.match(app, /maxConnections/);
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
    "demoStatusbar.setItems",
    "demoStatusbar.updateItem",
  ].forEach((surface) => assert.match(app, new RegExp(surface.replace(".", "\\."))));
});

test("full demo exercises the application framework milestone", () => {
  [
    "commands.register",
    "nodeEditor.history = history",
    "nodeEditor.clipboard = clipboard",
    "new GuiFormModel",
    "new GuiDataCollection",
    "new GuiPagedDataSource",
    "new GuiTreeModel",
    "new GuiWorkspaceModel",
    "tasks.run",
    "persistence.save",
    "capabilities.register",
    "diagnostics.record",
    "dragDrop.makeDraggable",
    "auditAccessibility",
  ].forEach((surface) => assert.match(app, new RegExp(surface.replace(".", "\\."))));
  assert.match(html, /data-page="framework"/);
  assert.match(html, /view-transitions/);
});

test("full demo backend bounds and validates log ingestion", () => {
  assert.match(server, /1_048_576/);
  assert.match(server, /slice\(0, 1_000\)/);
  assert.match(server, /guikit\.log\/v1/);
  assert.match(server, /GuiNodeFileSink/);
  assert.match(server, /filePath\.startsWith\(allowedRoot\)/);
});
