import {
  GuiBatchSink,
  GuiBridgeLogSink,
  GuiDataBuffer,
  GuiAiSession,
  GuiAutomationModel,
  GuiCollaborationSession,
  GuiFileWorkspace,
  GuiMemoryFileAdapter,
  GuiAccessibilityLab,
  GuiCachePolicy,
  GuiDataConnectorRegistry,
  GuiCredentialVault,
  GuiFlowDebugger,
  GuiNodeLibrary,
  GuiOfflineSyncQueue,
  GuiProductionOptimizer,
  GuiServiceWorkerBridge,
  GuiVisualRegressionSuite,
  GuiDiagramModel,
  GuiDataCollection,
  GuiFormModel,
  GuiHttpLogSink,
  GuiMemorySink,
  GuiPagedDataSource,
  GuiTreeModel,
  GuiTimelineModel,
  GuiWorkspaceModel,
  GuiObservabilityHub,
  GuiPluginPolicy,
  GuiThemeStudio,
  GuiAnalysisSeries,
  GuiComboboxModel,
  GuiNotificationCenter,
  GuiPropertyGridModel,
  GuiScheduleModel,
  GuiShortcutProfiles,
  GuiUploadQueue,
  contrastRatio,
  correlation,
  createReplayConnector,
  exportChartSvg,
  exportDelimited,
  fftMagnitude,
  histogram,
  inspectAccessibility,
  normalizeAnalysisDataset,
  pivotRows,
  summarizeTable,
  auditAccessibility,
  bridge,
  capabilities,
  clipboard,
  commands,
  decimateMinMax,
  defineGuiModule,
  diagnostics,
  dragDrop,
  guiModules,
  history,
  i18n,
  initializeGui,
  logger,
  logs,
  mediaAdapters,
  persistence,
  router,
  setTheme,
  tasks,
  toast,
} from "../../src/gui.js";

const fullDemoTranslations = {
  en: {
    nav: {
      overview: "Overview",
      navigation: "Navigation",
      components: "Components",
      charts: "Live charts",
      nodes: "Node editor",
      wizard: "Wizard",
      media: "Media",
      logging: "Logging",
      platform: "Platform",
      framework: "Framework",
      editors: "Editors",
      settings: "Settings",
    },
    eyebrow: "Universal interface laboratory",
    overview: {
      eyebrow: "Everything, working together",
      title: "A complete cross-platform GuiKit application.",
      body: "Explore every component, service, module, transport, interaction, and performance primitive.",
      explore: "Explore components",
      runtime: "Inspect runtime",
    },
    platform: {
      translationSample: "This sentence changes with the selected locale.",
    },
  },
  de: {
    nav: {
      overview: "Übersicht",
      navigation: "Navigation",
      components: "Komponenten",
      charts: "Live-Diagramme",
      nodes: "Knoten-Editor",
      wizard: "Assistent",
      media: "Medien",
      logging: "Protokolle",
      platform: "Plattform",
      framework: "Framework",
      editors: "Editoren",
      settings: "Einstellungen",
    },
    eyebrow: "Universelles Interface-Labor",
    overview: {
      eyebrow: "Alles arbeitet zusammen",
      title: "Eine vollständige plattformübergreifende GuiKit-Anwendung.",
      body: "Entdecke alle Komponenten, Dienste, Module, Transporte, Interaktionen und Performance-Grundlagen.",
      explore: "Komponenten entdecken",
      runtime: "Laufzeit prüfen",
    },
    platform: {
      translationSample: "Dieser Satz ändert sich mit der ausgewählten Sprache.",
    },
  },
  es: {
    nav: {
      overview: "Resumen",
      navigation: "Navegación",
      components: "Componentes",
      charts: "Gráficos en vivo",
      nodes: "Editor de nodos",
      wizard: "Asistente",
      media: "Multimedia",
      logging: "Registros",
      platform: "Plataforma",
      framework: "Framework",
      editors: "Editores",
      settings: "Ajustes",
    },
    eyebrow: "Laboratorio de interfaces universal",
    overview: {
      eyebrow: "Todo trabajando en conjunto",
      title: "Una aplicación GuiKit multiplataforma completa.",
      body: "Explora cada componente, servicio, módulo, transporte, interacción y primitiva de rendimiento.",
      explore: "Explorar componentes",
      runtime: "Inspeccionar entorno",
    },
    platform: {
      translationSample: "Esta frase cambia con el idioma seleccionado.",
    },
  },
};

const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* persistence is optional */ }
  },
};

const eventList = document.querySelector("#event-list");
const eventCount = document.querySelector("#event-count");
let observedEvents = 0;
let demoStatusbar;

function recordEvent(name, detail = {}) {
  observedEvents += 1;
  eventCount.textContent = `${observedEvents} events`;
  demoStatusbar?.setItemValue("events", observedEvents, { announce: false });
  const row = document.createElement("li");
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString();
  const message = document.createElement("span");
  const compact = JSON.stringify(detail, (_key, value) =>
    value instanceof Error ? { name: value.name, message: value.message } : value);
  message.textContent = `${name}${compact && compact !== "{}" ? ` · ${compact.slice(0, 150)}` : ""}`;
  row.append(time, message);
  eventList.prepend(row);
  while (eventList.children.length > 30) eventList.lastElementChild.remove();
}

document.querySelector("#events-clear").addEventListener("click", () => {
  eventList.replaceChildren();
  observedEvents = 0;
  eventCount.textContent = "0 events";
  demoStatusbar?.setItemValue("events", 0, { announce: false });
});

const observedNames = [
  "gui:page-change",
  "gui:tab-change",
  "gui:sidebar-change",
  "gui:sidebar-collapse",
  "gui:chart-render",
  "gui:toast-show",
  "gui:toast-action",
  "gui:toast-dismiss",
  "gui:graph-change",
  "gui:node-connect",
  "gui:node-disconnect",
  "gui:node-select",
  "gui:node-settings-open",
  "gui:node-settings-save",
  "gui:node-settings-close",
  "gui:node-parameter-change",
  "gui:node-error",
  "gui:node-execution",
  "gui:node-breakpoint",
  "gui:graph-validation",
  "gui:wizard-step-change",
  "gui:wizard-validation-error",
  "gui:wizard-skip",
  "gui:wizard-finish",
  "gui:wizard-reset",
  "gui:statusbar-action",
  "gui:statusbar-position-change",
  "gui:media-source-change",
  "gui:media-play",
  "gui:media-pause",
  "gui:media-error",
  "gui:settings-change",
  "gui:settings-save",
  "gui:settings-reset",
  "gui:command-complete",
  "gui:history-change",
  "gui:dialog-open",
  "gui:dialog-close",
  "gui:popover-open",
  "gui:popover-close",
  "gui:tasks-change",
  "gui:form-change",
  "gui:form-submit",
  "gui:data-selection-request",
  "gui:tree-selection",
  "gui:workspace-change",
  "gui:accessibility-audit",
];
observedNames.forEach((name) => {
  document.addEventListener(name, (event) => recordEvent(name, event.detail));
});
window.addEventListener("gui:theme-changed", (event) => recordEvent(event.type, event.detail));
window.addEventListener("gui:locale-changed", (event) => recordEvent(event.type, event.detail));
window.addEventListener("gui:host:demo-pulse", (event) => recordEvent(event.type, event.detail));

window.addEventListener("gui:host-request", (event) => {
  event.preventDefault();
  const { request, resolve, reject } = event.detail;
  const handlers = {
    "app.info": () => ({
      host: "Browser host adapter",
      platform: navigator.userAgentData?.platform ?? navigator.platform,
      locale: navigator.language,
      timestamp: new Date().toISOString(),
    }),
    "app.echo": () => request.params,
    "logging.write": () => ({
      accepted: Array.isArray(request.params?.records) ? request.params.records.length : 0,
      transport: "browser bridge mock",
    }),
  };
  try {
    if (!handlers[request.method]) throw new Error(`Unknown demo host method: ${request.method}`);
    resolve(handlers[request.method]());
  } catch (error) {
    reject(error);
  }
});

if (!guiModules.has("demo-inspector")) {
  defineGuiModule({
    id: "demo-inspector",
    version: "0.1.0",
    description: "Full-demo extension proving the documented module contract.",
    dependencies: ["logging", "media-player"],
    setup({ dependencies }) {
      return {
        initializedAt: new Date().toISOString(),
        dependencies: [...dependencies.keys()],
      };
    },
  });
}

await Promise.all(Object.entries(fullDemoTranslations).map(async ([locale, demoCatalog]) => {
  const response = await fetch(`../../locales/${locale}.json`);
  if (!response.ok) throw new Error(`Could not load ${locale} catalog.`);
  const base = await response.json();
  i18n.register(locale, { ...base, fullDemo: demoCatalog });
}));

const savedLocale = storage.get("guikit-full-demo-locale");
const browserLocale = navigator.language.slice(0, 2);
const initialLocale = savedLocale ?? (fullDemoTranslations[browserLocale] ? browserLocale : "en");
const runtime = initializeGui({
  locale: initialLocale,
  theme: storage.get("gui-theme") ?? "system",
});

commands.register({
  id: "demo.refresh",
  label: "Refresh demo data",
  description: "Simulate a refresh across framework services",
  category: "Demo",
  shortcut: "Ctrl+R",
  run: () => {
    toast.success("Demo data refreshed");
    diagnostics.record("demo.refresh", 1);
  },
});
let compactDemo = false;
commands.register({
  id: "demo.compact",
  label: "Toggle compact mode",
  description: "Toggle the demo's compact density",
  category: "Demo",
  checked: () => compactDemo,
  run: () => {
    compactDemo = !compactDemo;
    document.documentElement.toggleAttribute("data-compact", compactDemo);
  },
});
commands.register({
  id: "demo.copy-state",
  label: "Copy runtime state",
  description: "Copy a typed GuiKit state envelope",
  category: "Demo",
  run: async () => {
    if (!clipboard.__demoStateRegistered) {
      clipboard.registerType("application/x-guikit-demo-state");
      Object.defineProperty(clipboard, "__demoStateRegistered", { value: true });
    }
    await clipboard.write("application/x-guikit-demo-state", {
      locale: i18n.locale,
      theme: document.documentElement.dataset.theme,
    }, { system: false });
    toast.info("Runtime state copied");
  },
});

capabilities.register("demo.echo", (params) => ({ ...params, capability: "demo.echo" }), {
  description: "Demonstrates an allowlisted backend capability.",
});
router.add({ id: "demo-station", path: "/station/:id", title: "GuiKit station" });
dragDrop.registerType("application/x-guikit-demo-item", {
  validate: (value) => typeof value?.id === "string",
});

const memorySink = new GuiMemorySink({ limit: 2_000 });
logs.addSink(memorySink);
logs.addSink(new GuiBatchSink(
  new GuiBridgeLogSink(bridge, { minLevel: "warn" }),
  { batchSize: 20, maxQueue: 1_000, interval: 750 },
));
const demoLog = logger.child("full-demo", {
  sessionId: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
  runtime: bridge.hostKind,
});

demoStatusbar = document.querySelector("#demo-statusbar");
demoStatusbar.setItems([
  {
    id: "runtime",
    type: "status",
    variant: "warning",
    label: "Runtime",
    value: "Detecting",
    priority: "high",
  },
  { id: "runtime-separator", type: "separator", align: "start" },
  {
    id: "page",
    icon: "◇",
    label: "View",
    value: "Overview",
    priority: "normal",
  },
  {
    id: "sync",
    type: "progress",
    align: "center",
    label: "Background sync",
    progress: 42,
    value: "42%",
  },
  {
    id: "points",
    align: "end",
    label: "Chart points",
    value: "0",
    priority: "low",
  },
  {
    id: "events",
    align: "end",
    label: "Events",
    value: "0",
    priority: "low",
  },
  {
    id: "placement",
    type: "action",
    align: "end",
    icon: "↕",
    label: "Placement",
    value: "Bottom",
    compact: true,
    tooltip: "Move the statusbar between the top and bottom",
  },
  {
    id: "clock",
    align: "end",
    icon: "◷",
    value: new Date().toLocaleTimeString(),
    compact: true,
    priority: "high",
  },
]);

const featureStations = [
  ["✓", "Responsive layout", "navigation"],
  ["✓", "Tabs and pages", "navigation"],
  ["✓", "Forms and toasts", "components"],
  ["✓", "Configurable statusbar", "components"],
  ["✓", "Live charts", "charts"],
  ["✓", "Node graph", "nodes"],
  ["✓", "Guided wizard", "wizard"],
  ["✓", "Live media", "media"],
  ["✓", "Structured logging", "logging"],
  ["✓", "i18n and bridge", "platform"],
  ["✓", "Application framework", "framework"],
  ["✓", "Persistent settings", "settings"],
];
const featureGrid = document.querySelector("#feature-grid");
featureStations.forEach(([icon, label, page]) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "demo-feature";
  button.dataset.guiPageOpen = page;
  const mark = document.createElement("span");
  mark.textContent = icon;
  const text = document.createElement("span");
  text.textContent = label;
  button.append(mark, text);
  featureGrid.append(button);
});

const demoPages = document.querySelector("#demo-pages");
const syncNavigation = (page) => {
  document.querySelectorAll(".gui-nav [data-gui-page-open]").forEach((button) => {
    if (button.dataset.guiPageOpen === page) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const titleKey = `fullDemo.nav.${page === "nodes" ? "nodes" : page}`;
  const title = i18n.t(titleKey);
  document.querySelector("#page-title").textContent = title;
  demoStatusbar.setItemValue("page", title, { announce: false });
};
demoPages.addEventListener("gui:page-change", (event) => syncNavigation(event.detail.active));

const swipePages = document.querySelector("#navigation-swipe-pages");
const swipeState = document.querySelector("#swipe-page-state");
const updateSwipeState = () => { swipeState.textContent = `${swipePages.index + 1} / 3`; };
document.querySelector("#swipe-next").addEventListener("click", () => swipePages.next());
document.querySelector("#swipe-previous").addEventListener("click", () => swipePages.previous());
document.querySelector("#swipe-loop").addEventListener("change", (input) => { swipePages.loop = input.target.checked; });
swipePages.addEventListener("gui:swipe-page-change", (event) => { updateSwipeState(); recordEvent(event.type, event.detail); });
updateSwipeState();

const navigationDashboard = document.querySelector("#navigation-dashboard");
const dashboardState = document.querySelector("#dashboard-state");
const updateDashboardState = () => { dashboardState.textContent = `${navigationDashboard.columns} columns · ${navigationDashboard.snapshot().map((item) => item.id).join(" / ")}`; };
document.querySelector("#dashboard-columns").addEventListener("change", (input) => { navigationDashboard.columns = Number(input.target.value); updateDashboardState(); });
document.querySelector("#dashboard-span").addEventListener("click", () => {
  const chart = navigationDashboard.snapshot().find((item) => item.id === "chart");
  navigationDashboard.updateCard("chart", { span: chart.span === 8 ? 4 : 8 }); updateDashboardState();
});
document.querySelector("#dashboard-save").addEventListener("click", () => { navigationDashboard.savePreset("demo"); toast.success("Dashboard preset saved"); });
document.querySelector("#dashboard-restore").addEventListener("click", () => { navigationDashboard.restorePreset("demo"); updateDashboardState(); });
navigationDashboard.addEventListener("gui:dashboard-change", (event) => { updateDashboardState(); recordEvent(event.type, event.detail); });
updateDashboardState();

commands.addEventListener("gui:command-complete", (event) => recordEvent(event.type, event.detail));
history.addEventListener("gui:history-change", (event) => recordEvent(event.type, event.detail));
tasks.addEventListener("gui:tasks-change", (event) => recordEvent(event.type, event.detail));
diagnostics.addEventListener("gui:diagnostic", (event) => recordEvent(event.type, {
  name: event.detail.name,
  value: event.detail.sample.value,
}));

const commandPalette = document.querySelector("#demo-command-palette");
document.querySelector("#command-open").addEventListener("click", () => commandPalette.show());
const frameworkMenu = document.querySelector("#framework-menu");
frameworkMenu.commands = commands;
document.querySelector("#framework-context-actions").commands = commands;
const frameworkPopover = document.querySelector("#framework-popover");
document.querySelector("#popover-open").addEventListener("click", () => frameworkPopover.toggle());
frameworkMenu.addEventListener("gui:menu-select", () => frameworkPopover.hide("selection"));
dragDrop.makeDraggable(document.querySelector("#typed-drag-source"), {
  type: "application/x-guikit-demo-item",
  payload: { id: "telemetry", label: "Telemetry source" },
});
dragDrop.makeDropTarget(document.querySelector("#typed-drop-target"), {
  types: ["application/x-guikit-demo-item"],
  onDrop: (value) => {
    document.querySelector("#typed-drop-target").textContent = `Dropped ${value.label}`;
  },
});

const frameworkDialog = document.querySelector("#framework-dialog");
document.querySelector("#dialog-open").addEventListener("click", () => frameworkDialog.show());
document.querySelector("#dialog-cancel").addEventListener("click", () => frameworkDialog.close("cancel", "button"));
document.querySelector("#dialog-confirm").addEventListener("click", () => {
  frameworkDialog.close("confirmed", "button");
  toast.success("Dialog confirmed");
});

document.querySelector("#task-start").addEventListener("click", () => {
  const id = `demo-task-${Date.now()}`;
  const handle = tasks.run({
    id,
    label: "Generate preview",
    detail: "Preparing",
  }, ({ signal, report }) => new Promise((resolve) => {
    let progress = 0;
    const timer = setInterval(() => {
      progress += 0.08;
      report(progress, `${Math.round(progress * 100)}% complete`);
      diagnostics.record("task.progress", progress, { id });
      if (progress >= 1) {
        clearInterval(timer);
        resolve({ id });
      }
    }, 120);
    signal.addEventListener("abort", () => {
      clearInterval(timer);
      resolve(undefined);
    }, { once: true });
  }));
  handle.promise.catch((error) => toast.error(error.message));
});

const frameworkForm = document.querySelector("#framework-form");
frameworkForm.model = new GuiFormModel({
  id: "framework-settings",
  title: "Device profile",
  description: "Generated from a serializable schema.",
  submitLabel: "Apply profile",
  groups: [
    { id: "identity", label: "Identity" },
    { id: "signal", label: "Signal" },
  ],
  fields: [
    { id: "name", label: "Name", group: "identity", required: true, default: "Sensor A" },
    {
      id: "mode",
      label: "Mode",
      type: "select",
      group: "signal",
      options: [
        { value: "automatic", label: "Automatic" },
        { value: "manual", label: "Manual" },
      ],
      default: "automatic",
    },
    {
      id: "gain",
      label: "Gain",
      type: "range",
      group: "signal",
      min: 0,
      max: 10,
      step: 0.1,
      unit: "dB",
      default: 4,
      visibleWhen: { field: "mode", equals: "manual" },
    },
    { id: "enabled", label: "Enabled", type: "boolean", group: "signal", default: true },
    { id: "color", label: "Accent", type: "color", group: "identity", default: "#5b5ce2" },
  ],
});
frameworkForm.addEventListener("gui:form-submit", () => {
  frameworkForm.model.commit();
  persistence.save("demo-form", frameworkForm.value);
  toast.success("Schema profile saved");
});

const frameworkTree = document.querySelector("#framework-tree");
frameworkTree.model = new GuiTreeModel([
  {
    id: "workspace",
    label: "Workspace",
    children: [
      { id: "sources", label: "Sources", children: [{ id: "camera", label: "Camera" }] },
      { id: "pipelines", label: "Pipelines", children: [{ id: "edge", label: "Edge detection" }] },
    ],
  },
  {
    id: "runtime",
    label: "Runtime",
    children: [{ id: "logs-tree", label: "Logs" }, { id: "tasks-tree", label: "Tasks" }],
  },
]);
frameworkTree.model.expandAll();

const frameworkRows = Array.from({ length: 5_000 }, (_, index) => ({
  id: `record-${index}`,
  time: new Date(Date.now() - index * 1000).toLocaleTimeString(),
  level: ["info", "debug", "warning", "error"][index % 4],
  message: `Telemetry event ${index.toLocaleString()} from channel ${index % 12}`,
  value: Math.round(Math.sin(index / 20) * 1000) / 10,
}));
const frameworkGrid = document.querySelector("#framework-grid");
frameworkGrid.columns = [
  { field: "time", label: "Time", width: 120, pinned: true },
  { field: "level", label: "Level", width: 100 },
  { field: "message", label: "Message", width: "minmax(24rem, 1fr)", editable: true },
  { field: "value", label: "Value", width: 100 },
];
frameworkGrid.model = new GuiDataCollection(frameworkRows);
document.querySelector("#grid-filter").addEventListener("input", (event) => {
  frameworkGrid.model.setFilter("message", event.currentTarget.value);
});
document.querySelector("#grid-export").addEventListener("click", () => {
  const csv = frameworkGrid.export("csv");
  toast.success(`Generated ${csv.length.toLocaleString()} CSV characters.`);
});
const frameworkPagedSource = new GuiPagedDataSource(async ({ offset, pageSize, signal }) => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 180);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Canceled", "AbortError"));
    }, { once: true });
  });
  return {
    total: 1_000_000,
    rows: Array.from({ length: pageSize }, (_, index) => ({
      id: `server-${offset + index}`,
      time: new Date().toLocaleTimeString(),
      level: "info",
      message: `Server-side record ${(offset + index).toLocaleString()}`,
      value: offset + index,
    })),
  };
}, { pageSize: 100, maxPages: 4 });
document.querySelector("#grid-page").addEventListener("click", async () => {
  const page = await frameworkGrid.setDataSource(frameworkPagedSource, { page: 1 });
  toast.info(`Loaded ${page.rows.length} of ${page.total.toLocaleString()} server rows.`);
});

const frameworkList = document.querySelector("#framework-list");
frameworkList.itemHeight = 34;
frameworkList.items = frameworkRows;
frameworkList.renderItem = (item, index) => {
  const row = document.createElement("div");
  row.style.padding = ".45rem .65rem";
  row.textContent = `${index + 1}. ${item.message}`;
  return row;
};

const frameworkWorkspace = document.querySelector("#framework-workspace");
frameworkWorkspace.model = new GuiWorkspaceModel({
  panels: [
    { id: "workspace-editor", title: "Editor", closable: false },
    { id: "workspace-preview", title: "Preview" },
    { id: "workspace-logs", title: "Logs" },
  ],
  layout: {
    type: "split",
    id: "framework-root-split",
    direction: "vertical",
    sizes: [0.68, 0.32],
    children: [
      {
        type: "tabs",
        id: "framework-main-tabs",
        panels: ["workspace-editor", "workspace-preview"],
        active: "workspace-editor",
      },
      {
        type: "tabs",
        id: "framework-bottom-tabs",
        panels: ["workspace-logs"],
        active: "workspace-logs",
      },
    ],
  },
});
frameworkWorkspace.model.savePreset("default");
frameworkWorkspace.usePersistence(persistence, "demo-workspace");
document.querySelector("#workspace-preset").addEventListener("click", () => {
  frameworkWorkspace.model.restorePreset("default");
});
document.querySelector("#workspace-save").addEventListener("click", () => {
  frameworkWorkspace.save();
  toast.success("Workspace layout saved");
});

const frameworkPlayground = document.querySelector("#framework-playground");
frameworkPlayground.controls = [
  { label: "Label", property: "textContent", type: "text", value: "Inspectable component" },
  { label: "Disabled", property: "disabled", type: "boolean", value: false },
];
frameworkPlayground.events = ["click"];
document.querySelector("#framework-diagnostics").diagnostics = diagnostics;
diagnostics.record("demo.bootstrap", performance.now());
auditAccessibility(document.querySelector("[data-page=framework]"));

const statusbarPosition = document.querySelector("#statusbar-position");
const statusbarCompact = document.querySelector("#statusbar-compact");
const statusbarFixed = document.querySelector("#statusbar-fixed");
const statusbarMode = document.querySelector("#statusbar-mode");
const demoTopbar = document.querySelector(".demo-topbar");
let statusbarProgress = 42;
let statusbarHealthy = true;

function syncStatusbarOffset() {
  demoStatusbar.style.setProperty(
    "--statusbar-offset",
    demoStatusbar.position === "top"
      ? `${demoTopbar.getBoundingClientRect().height}px`
      : "0px",
  );
}

function applyStatusbarPosition(position) {
  demoStatusbar.position = position;
  if (position === "top") demoPages.before(demoStatusbar);
  else demoPages.after(demoStatusbar);
  statusbarPosition.value = position;
  demoStatusbar.updateItem("placement", {
    value: position === "top" ? "Top" : "Bottom",
  }, { announce: false });
  statusbarMode.textContent =
    `${position === "top" ? "Top" : "Bottom"} · ${demoStatusbar.fixed ? "Fixed" : "Sticky"}`;
  syncStatusbarOffset();
}

statusbarPosition.addEventListener("change", () => {
  applyStatusbarPosition(statusbarPosition.value);
});
statusbarCompact.addEventListener("change", () => {
  demoStatusbar.compact = statusbarCompact.checked;
});
statusbarFixed.addEventListener("change", () => {
  demoStatusbar.fixed = statusbarFixed.checked;
  applyStatusbarPosition(demoStatusbar.position);
});
document.querySelector("#statusbar-progress").addEventListener("click", () => {
  statusbarProgress = (statusbarProgress + 13) % 101;
  demoStatusbar.updateItem("sync", {
    progress: statusbarProgress,
    value: `${statusbarProgress}%`,
  });
});
document.querySelector("#statusbar-health").addEventListener("click", () => {
  statusbarHealthy = !statusbarHealthy;
  demoStatusbar.updateItem("runtime", {
    variant: statusbarHealthy ? "success" : "danger",
    value: statusbarHealthy ? "Online" : "Offline",
  });
});
demoStatusbar.addEventListener("gui:statusbar-action", (event) => {
  if (event.detail.id === "placement") {
    applyStatusbarPosition(demoStatusbar.position === "top" ? "bottom" : "top");
  }
});
applyStatusbarPosition("bottom");
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(syncStatusbarOffset).observe(demoTopbar);
}

const statusbarTimer = setInterval(() => {
  demoStatusbar.setItemValue("clock", new Date().toLocaleTimeString(), {
    announce: false,
  });
}, 1_000);
window.addEventListener("pagehide", () => clearInterval(statusbarTimer), { once: true });

const localeControls = [
  document.querySelector("#locale-select"),
  document.querySelector("#platform-locale"),
  document.querySelector("#settings-language"),
];
const applyLocale = (locale, { fromSettings = false } = {}) => {
  localeControls.forEach((control) => { control.value = locale; });
  storage.set("guikit-full-demo-locale", locale);
  i18n.setLocale(locale);
  syncNavigation(demoPages.active);
  demoLog.info("Locale changed", { locale });
  const settingsExample = document.querySelector("#settings-form");
  if (!fromSettings && settingsExample?.dataset.ready === "true") {
    const settings = updateSettingsPreview();
    setSettingsDirty(true);
    dispatchSettingsEvent("gui:settings-change", {
      name: "language",
      value: locale,
      settings,
    });
  }
};
localeControls.forEach((control) => {
  control.value = initialLocale;
  control.addEventListener("change", () => applyLocale(control.value, {
    fromSettings: control.id === "settings-language",
  }));
});

const themes = ["system", "light", "dark"];
const themeSelect = document.querySelector("#theme-select");
themeSelect.value = storage.get("gui-theme") ?? "system";
const applyTheme = (theme, { fromSettings = false } = {}) => {
  setTheme(theme);
  themeSelect.value = theme;
  document.querySelectorAll('[name="theme"]').forEach((control) => {
    control.checked = control.value === theme;
  });
  document.querySelector("#metric-theme").textContent =
    theme.charAt(0).toUpperCase() + theme.slice(1);
  demoLog.info("Theme changed", { theme });
  const settingsExample = document.querySelector("#settings-form");
  if (!fromSettings && settingsExample?.dataset.ready === "true") {
    const settings = updateSettingsPreview();
    setSettingsDirty(true);
    dispatchSettingsEvent("gui:settings-change", {
      name: "theme",
      value: theme,
      settings,
    });
  }
};
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
document.querySelector("#theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.dataset.theme ?? "system";
  applyTheme(themes[(themes.indexOf(current) + 1) % themes.length]);
});
applyTheme(themeSelect.value);

document.querySelector("#sidebar-collapse-demo").addEventListener("click", () => {
  document.querySelector("#demo-sidebar").toggleCollapse();
});

const buffer = new GuiDataBuffer(1_024);
for (let index = 0; index < 1_600; index += 1) {
  buffer.append(index, 45 + Math.sin(index / 19) * 28 + Math.sin(index / 4) * 8);
}
const decimatedIndices = decimateMinMax(buffer, 0, buffer.length, 30);
const bufferTrack = document.querySelector("#buffer-track");
decimatedIndices.forEach((index) => {
  const bar = document.createElement("span");
  bar.style.setProperty("--value", Math.max(2, Math.min(100, buffer.yAt(index))));
  bufferTrack.append(bar);
});
document.querySelector("#buffer-summary").textContent =
  `1,600 appended → ${buffer.length} retained → ${decimatedIndices.length} peak-preserving render indices`;

document.querySelectorAll("[data-toast]").forEach((button) => {
  button.addEventListener("click", () => {
    const variant = button.dataset.toast;
    toast[variant](`${variant.charAt(0).toUpperCase() + variant.slice(1)} notification from GuiKit.`, {
      title: `${variant} example`,
    });
  });
});
document.querySelector("#toast-action").addEventListener("click", () => {
  toast.info("The previous operation can be restored.", {
    title: "Project archived",
    action: {
      label: "Undo",
      onClick: () => toast.success("Project restored.", { title: "Undo complete" }),
    },
  });
});
document.querySelector("#toast-persistent").addEventListener("click", () => {
  toast.warning("This notification remains until dismissed.", {
    title: "Persistent notification",
    duration: 0,
  });
});
document.querySelector("#form-save").addEventListener("click", () => {
  toast.success(`${document.querySelector("#project-name").value} saved for ${document.querySelector("#environment").value}.`);
});
document.querySelector("#form-reset").addEventListener("click", () => {
  document.querySelector("#project-name").value = "Telemetry Studio";
  document.querySelector("#environment").selectedIndex = 0;
  toast.info("Form reset.");
});

function applyAccent(accent, { fromSettings = false } = {}) {
  document.documentElement.style.setProperty("--gui-accent", accent);
  document.documentElement.style.setProperty(
    "--gui-accent-soft",
    `color-mix(in srgb, ${accent} 16%, transparent)`,
  );
  document.querySelector("#accent-value").textContent = `--gui-accent: ${accent}`;
  const settingsAccent = document.querySelector("#settings-accent");
  if (settingsAccent) settingsAccent.value = accent;
  const settingsAccentValue = document.querySelector("#settings-accent-value");
  if (settingsAccentValue) settingsAccentValue.textContent = accent;
  window.dispatchEvent(new CustomEvent("gui:theme-changed", {
    detail: { theme: "custom", accent },
  }));
  const settingsExample = document.querySelector("#settings-form");
  if (!fromSettings && settingsExample?.dataset.ready === "true") {
    const settings = updateSettingsPreview();
    setSettingsDirty(true);
    dispatchSettingsEvent("gui:settings-change", {
      name: "accent",
      value: accent,
      settings,
    });
  }
}

document.querySelectorAll("[data-accent]").forEach((button) => {
  button.addEventListener("click", () => applyAccent(button.dataset.accent));
});

const SETTINGS_STORAGE_KEY = "guikit-full-demo-settings-v1";
const settingsForm = document.querySelector("#settings-form");
const settingsState = document.querySelector("#settings-state");
const settingsDefaults = {
  displayName: "Alex Morgan",
  email: "alex@example.com",
  workspace: "engineering",
  pageSize: 50,
  theme: "system",
  accent: "#6c8cff",
  density: "comfortable",
  scale: 100,
  reducedMotion: false,
  language: initialLocale,
  timeZone: "Europe/Berlin",
  dateFormat: "locale",
  clock: "24",
  desktopNotifications: true,
  incidentAlerts: true,
  productUpdates: false,
  digest: "weekly",
  quietStart: "22:00",
  quietEnd: "07:00",
  chartRetention: 30_000,
  workers: 4,
  updateChannel: "stable",
  autoLock: "15",
  hardwareAcceleration: true,
  diagnostics: false,
  endpoint: "https://api.example.com/v1",
  timeout: 15,
  logLevel: "info",
  developerMode: false,
};

function loadSavedSettings() {
  try {
    const parsed = JSON.parse(storage.get(SETTINGS_STORAGE_KEY) ?? "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function populateSettingsForm(settings) {
  settingsForm.reset();
  settingsForm.querySelectorAll("[name]").forEach((control) => {
    if (!(control.name in settings)) return;
    if (control.type === "checkbox") {
      control.checked = Boolean(settings[control.name]);
    } else if (control.type === "radio") {
      control.checked = String(settings[control.name]) === control.value;
    } else {
      control.value = String(settings[control.name]);
    }
  });
}

function readSettingsForm() {
  const values = {};
  const numericNames = new Set(
    [...settingsForm.querySelectorAll('input[type="number"], input[type="range"]')]
      .map((control) => control.name)
      .filter(Boolean),
  );
  new FormData(settingsForm).forEach((value, name) => {
    values[name] = numericNames.has(name) ? Number(value) : String(value);
  });
  settingsForm.querySelectorAll('input[type="checkbox"][name]').forEach((control) => {
    values[control.name] = control.checked;
  });
  return values;
}

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts.slice(0, 2).map((part) => part[0]).join("") : "?")
    .toUpperCase();
}

function selectedText(name) {
  const control = settingsForm.elements.namedItem(name);
  return control?.selectedOptions?.[0]?.textContent ?? String(control?.value ?? "");
}

function updateSettingsPreview() {
  const settings = readSettingsForm();
  document.querySelector("#settings-scale-value").textContent = `${settings.scale}%`;
  document.querySelector("#settings-retention-value").textContent =
    `${settings.chartRetention.toLocaleString()} points`;
  document.querySelector("#settings-workers-value").textContent =
    `${settings.workers} ${settings.workers === 1 ? "worker" : "workers"}`;
  document.querySelector("#settings-accent-value").textContent = settings.accent;
  document.querySelector("#settings-preview-name").textContent =
    settings.displayName || "Unnamed user";
  document.querySelector("#settings-avatar").textContent = initials(settings.displayName);
  document.querySelector("#settings-summary-theme").textContent =
    settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1);
  document.querySelector("#settings-summary-language").textContent = selectedText("language");
  document.querySelector("#settings-summary-density").textContent = selectedText("density");
  document.querySelector("#settings-summary-retention").textContent =
    settings.chartRetention.toLocaleString();
  document.querySelector("#settings-preview").textContent =
    JSON.stringify(settings, null, 2);
  return settings;
}

function setSettingsDirty(dirty) {
  settingsState.dataset.dirty = String(dirty);
  settingsState.textContent = dirty ? "Unsaved changes" : "Saved";
}

function dispatchSettingsEvent(name, detail) {
  settingsForm.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  }));
}

const savedSettings = loadSavedSettings();
const initialSettings = { ...settingsDefaults, ...savedSettings };
if (!themes.includes(initialSettings.theme)) initialSettings.theme = "system";
if (!fullDemoTranslations[initialSettings.language]) initialSettings.language = initialLocale;
if (!/^#[0-9a-f]{6}$/i.test(initialSettings.accent)) {
  initialSettings.accent = settingsDefaults.accent;
}
populateSettingsForm(initialSettings);
applyTheme(initialSettings.theme, { fromSettings: true });
applyLocale(initialSettings.language, { fromSettings: true });
applyAccent(initialSettings.accent, { fromSettings: true });
updateSettingsPreview();
setSettingsDirty(false);
settingsForm.dataset.ready = "true";

settingsForm.addEventListener("input", (event) => {
  if (event.target.name === "theme" && event.target.checked) {
    applyTheme(event.target.value, { fromSettings: true });
  }
  if (event.target.name === "accent") {
    applyAccent(event.target.value, { fromSettings: true });
  }
  const settings = updateSettingsPreview();
  setSettingsDirty(true);
  dispatchSettingsEvent("gui:settings-change", {
    name: event.target.name,
    value: settings[event.target.name],
    settings,
  });
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const settings = updateSettingsPreview();
  storage.set(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  setSettingsDirty(false);
  dispatchSettingsEvent("gui:settings-save", { settings });
  demoLog.info("Settings saved", {
    workspace: settings.workspace,
    theme: settings.theme,
    language: settings.language,
  });
  toast.success("Application settings saved.", { title: "Settings" });
});

document.querySelector("#settings-reset").addEventListener("click", () => {
  populateSettingsForm(settingsDefaults);
  applyTheme(settingsDefaults.theme, { fromSettings: true });
  applyLocale(settingsDefaults.language, { fromSettings: true });
  applyAccent(settingsDefaults.accent, { fromSettings: true });
  const settings = updateSettingsPreview();
  storage.set(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  setSettingsDirty(false);
  dispatchSettingsEvent("gui:settings-reset", { settings });
  toast.info("Recommended defaults restored.", { title: "Settings" });
});

document.querySelector("#settings-clear-cache").addEventListener("click", () => {
  const progress = document.querySelector("#settings-storage-progress");
  progress.value = 0;
  document.querySelector("#settings-storage-value").textContent = "0 MB of 2 GB";
  dispatchSettingsEvent("gui:settings-change", {
    name: "cacheUsage",
    value: 0,
    settings: readSettingsForm(),
  });
  toast.success("Local preview cache cleared.", { title: "Storage" });
});

const editorCode = document.querySelector("#editor-code");
editorCode.language = "json";
editorCode.value = JSON.stringify({ pipeline: "telemetry", refreshMs: 1000, alerts: ["cpu", "network"] }, null, 2);
const editorStructured = document.querySelector("#editor-structured");
editorStructured.data = { workspace: { panels: ["editor", "preview"], persisted: true }, capabilities: ["filesystem", "clipboard"] };
const editorProperties = document.querySelector("#editor-properties");
editorProperties.schema = [
  { name: "name", label: "Node name", group: "General", default: "Telemetry processor", description: "Shown in the visual graph." },
  { name: "enabled", label: "Enabled", group: "General", type: "checkbox", default: true },
  { name: "quality", label: "Quality", group: "Rendering", type: "range", min: 1, max: 100, default: 82 },
  { name: "mode", label: "Mode", group: "Rendering", type: "select", options: ["balanced", "quality", "performance"], default: "balanced" },
];
editorProperties.value = { name: "Telemetry processor", enabled: true, quality: 82, mode: "balanced" };
const editorQuery = document.querySelector("#editor-query");
editorQuery.value = "SELECT timestamp, cpu, memory\nFROM telemetry\nWHERE timestamp > :from\nORDER BY timestamp DESC";
editorQuery.parameters = [{ name: "from", label: "From", value: "2026-07-01" }];
document.querySelector("#editor-timeline").model = new GuiTimelineModel([
  { id: "camera", label: "Camera", keyframes: [{ id: "camera-1", time: 0, value: 0 }, { id: "camera-2", time: 2.4, value: 1 }] },
  { id: "filter", label: "Filter", keyframes: [{ id: "filter-1", time: 1.1, value: .5 }, { id: "filter-2", time: 3.2, value: .9 }] },
]);
document.querySelector("#editor-diagram").model = new GuiDiagramModel({
  shapes: [{ id: "source", label: "Source", x: 80, y: 120 }, { id: "review", label: "Review", type: "decision", x: 340, y: 120 }, { id: "publish", label: "Publish", x: 600, y: 120 }],
  links: [{ id: "source-review", from: "source", to: "review" }, { id: "review-publish", from: "review", to: "publish" }],
});
document.querySelector("#editor-theme").tokens = { "--gui-accent": "#5b5ce2", "--gui-radius-md": "0.6rem", "--gui-font": "ui-sans-serif, system-ui" };
document.querySelector("#editor-translations").catalogs = {
  en: { menu: { save: "Save", close: "Close" }, status: "Ready" },
  de: { menu: { save: "Speichern" }, status: "Bereit" },
  es: { menu: { save: "Guardar", close: "Cerrar" }, status: "Listo" },
};

const collaborationDemo = document.querySelector("#platform-collaboration");
collaborationDemo.session = new GuiCollaborationSession({ state: { document: { title: "Incident report" } } });
collaborationDemo.session.setPresence({ name: "Alex", color: "#5b5ce2", cursor: { path: "document.title" } });
collaborationDemo.session.receive({ clientId: "sam", type: "presence", presence: { clientId: "sam", name: "Sam", color: "#00a99d" } });
const fileDemo = document.querySelector("#platform-files");
fileDemo.workspace = new GuiFileWorkspace({ adapter: new GuiMemoryFileAdapter({ "reports/incident.md": "# Incident\nTelemetry nominal." }) });
await fileDemo.workspace.open("reports/incident.md");
const analysisDemo = document.querySelector("#platform-analysis");
analysisDemo.rows = [{ signal: 18, latency: 7 }, { signal: 24, latency: 9 }, { signal: 20, latency: 6 }];
const automationDemo = document.querySelector("#platform-automation");
automationDemo.flow = new GuiAutomationModel({ name: "Escalate anomaly", steps: [{ id: "notify", type: "action", action: "notification" }, { id: "ticket", type: "action", action: "create-ticket", retries: 1 }] });
const aiDemo = document.querySelector("#platform-ai");
aiDemo.session = new GuiAiSession({ provider: { async complete(messages) { return { text: `Demo provider received: ${messages.at(-1).content}` }; } } });
const pluginDemo = document.querySelector("#platform-plugins");
pluginDemo.registry.register({ id: "demo.inspector", name: "Inspector tools", version: "1.0.0", contributions: { panels: ["inspector"] } });
[collaborationDemo, fileDemo, analysisDemo, automationDemo, aiDemo, pluginDemo].forEach((surface) => surface.render());

const productionTheme = document.querySelector("#production-theme");
productionTheme.studio = new GuiThemeStudio({ tokens: { "--gui-accent": "#5b5ce2", "--gui-surface": "#172030", "--gui-fg": "#edf2ff" } });
productionTheme.studio.savePreset("night");
const productionConnectors = document.querySelector("#production-connectors");
productionConnectors.connectors.register(createReplayConnector("telemetry-replay", [{ cpu: 32 }, { cpu: 48 }]));
const productionObservability = document.querySelector("#production-observability");
productionObservability.hub = new GuiObservabilityHub({ alerts: [{ metric: "demo.latency", operator: "gt", value: 120 }] });
productionObservability.hub.metric("demo.latency", 84, { route: "/api/telemetry" });
const pluginPolicyDemo = new GuiPluginPolicy({ permissions: ["storage"] });
pluginPolicyDemo.verify(pluginPolicyDemo.scaffold({ id: "demo.safe-plugin", name: "Safe plugin" }));
[productionTheme, productionConnectors, productionObservability].forEach((surface) => surface.render());

const productivityCombo = document.querySelector("#productivity-combobox");
productivityCombo.model = new GuiComboboxModel({ multiple: true, options: Array.from({ length: 250 }, (_, index) => ({ value: `signal-${index + 1}`, label: `Signal ${index + 1}`, description: index % 4 === 0 ? "Pinned analysis stream" : "Live telemetry stream" })), value: ["signal-1", "signal-5"] });
const productivitySchedule = new GuiScheduleModel({ range: { start: "2026-07-20", end: "2026-07-26", timeZone: "Europe/Berlin" }, events: [{ id: "review", title: "Design review", start: "2026-07-21T09:00:00Z", end: "2026-07-21T10:00:00Z" }, { id: "deploy", title: "Production window", start: "2026-07-24T16:00:00Z", end: "2026-07-24T18:00:00Z" }] });
document.querySelector("#productivity-range").model = productivitySchedule;
document.querySelector("#productivity-scheduler").model = productivitySchedule;
const productivityAnalysis = document.querySelector("#productivity-analysis");
productivityAnalysis.series = new GuiAnalysisSeries();
productivityAnalysis.setData("telemetry", Array.from({ length: 1200 }, (_, index) => ({ x: index, y: 45 + Math.sin(index / 19) * 20 + (index % 17) })), { label: "Telemetry", color: "#20c997" });
const productivityProperties = document.querySelector("#productivity-properties");
productivityProperties.model = new GuiPropertyGridModel({ title: "Inspection camera", enabled: true, exposure: 14, pipeline: { mode: "edge", threshold: 0.68 } }, [{ path: "title", label: "Title", type: "text" }, { path: "enabled", label: "Enabled", type: "boolean" }, { path: "exposure", label: "Exposure", type: "number", min: 1, max: 60 }, { path: "pipeline.mode", label: "Pipeline", options: ["edge", "blur", "raw"] }, { path: "pipeline.threshold", label: "Threshold", type: "number", min: 0, max: 1 }]);
const productivityUpload = document.querySelector("#productivity-upload");
productivityUpload.queue = new GuiUploadQueue({ accept: ["application/json", ".csv"], maxSize: 5_000_000 });
const productivityCenter = new GuiNotificationCenter([{ title: "Analysis completed", message: "Spectrum and heatmap are ready.", level: "success", group: "analysis" }, { title: "Shortcut profile", message: "Engineering profile is active.", group: "workspace", read: true }]);
document.querySelector("#productivity-notifications").center = productivityCenter;
const productivityProfiles = new GuiShortcutProfiles({ default: { "gui.command-palette": "Ctrl+K", "gui.undo": "Ctrl+Z" }, engineering: { "gui.command-palette": "Ctrl+P", "gui.undo": "Ctrl+Z" } });
const productivityShortcuts = document.querySelector("#productivity-shortcuts");
productivityShortcuts.profiles = productivityProfiles;
productivityShortcuts.registry = commands;

const featureResult = document.querySelector("#feature-lab-result");
const credentialMemory = new Map();
const featureVault = new GuiCredentialVault({
  get: async (key) => credentialMemory.get(key),
  set: async (key, value) => credentialMemory.set(key, value),
  remove: async (key) => credentialMemory.delete(key),
});
const featureOfflineStorage = new Map();
const featureOffline = new GuiOfflineSyncQueue({ storage: { get: async (key) => featureOfflineStorage.get(key), set: async (key, value) => featureOfflineStorage.set(key, value) } });
const featureNodes = new GuiNodeLibrary([{ type: "telemetry.filter", title: "Telemetry filter", ports: [{ id: "signal", direction: "input" }, { id: "result", direction: "output" }] }]);
const featureDebugger = new GuiFlowDebugger({ breakpoints: ["filter-1"] });
const featureVisual = new GuiVisualRegressionSuite({ viewports: [375, 1280], themes: ["light", "dark"], locales: ["en", "de"] });
featureVisual.baseline("demo", "baseline");
const featureOptimizer = new GuiProductionOptimizer({ budgets: { "demo.js": 80_000 } });
const featureCache = new GuiCachePolicy([{ match: "\\.json$", strategy: "stale-while-revalidate" }, { match: "\\.(js|css)$", strategy: "cache-first" }]);
const featureAccessibility = new GuiAccessibilityLab({ reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches });
const writeFeatureResult = (name, result) => {
  featureResult.textContent = `${name}\n${JSON.stringify(result, null, 2)}`;
  recordEvent(`feature:${name}`, result);
};
document.querySelectorAll("[data-feature]").forEach((button) => {
  button.addEventListener("click", async () => {
    const feature = button.dataset.feature;
    try {
      if (feature === "collaboration") {
        collaborationDemo.session.apply({ path: "document.title", value: `Incident ${Date.now()}` });
        collaborationDemo.session.addComment({ text: "Reviewed from the direct API laboratory." });
        collaborationDemo.render(); writeFeatureResult(feature, { state: collaborationDemo.session.state, comments: collaborationDemo.session.comments });
      } else if (feature === "files") {
        const path = fileDemo.workspace.activePath; fileDemo.workspace.update(path, "# Incident\nUpdated directly through GuiFileWorkspace."); await fileDemo.workspace.save(); await fileDemo.workspace.rename(path, "reports/incident-reviewed.md"); fileDemo.render(); writeFeatureResult(feature, { activePath: fileDemo.workspace.activePath, files: await fileDemo.workspace.refresh() });
      } else if (feature === "analysis") {
        const rows = analysisDemo.rows; writeFeatureResult(feature, { summary: summarizeTable(rows), pivot: pivotRows(rows.map((row, index) => ({ team: index % 2 ? "B" : "A", metric: "signal", value: row.signal })), { row: "team", column: "metric", value: "value" }), histogram: histogram(rows.map((row) => row.signal), { bins: 3 }) });
      } else if (feature === "automation") {
        writeFeatureResult(feature, await automationDemo.flow.run({ ready: true }, async (step) => demoLog.info("Automation action", { action: step.action })));
      } else if (feature === "ai") {
        writeFeatureResult(feature, await aiDemo.session.send("Summarize this framework demo.")); aiDemo.render();
      } else if (feature === "documents") {
        const report = document.querySelector("#platform-document").documentModel; report.setTemplate("<h1>{{title}}</h1><p>{{status}}</p>"); writeFeatureResult(feature, { html: report.render({ title: "Live report", status: "Ready" }), print: report.toPrintHtml({ title: "Live report", status: "Ready" }).slice(0, 120) });
      } else if (feature === "tokens") {
        const system = document.querySelector("#platform-design-system").designSystem; system.setToken("space.md", "12px", "dimension"); writeFeatureResult(feature, { tokens: system.exportTokens(), figmaVariables: system.toFigmaVariables() });
      } else if (feature === "a11y") {
        writeFeatureResult(feature, { staticAudit: inspectAccessibility(document.querySelector("[data-page=editors]")), focusPlan: featureAccessibility.focusPlan([{ id: "first", order: 1 }, { id: "second", order: 2 }]), motion: featureAccessibility.motion({ duration: 180 }), colorVision: featureAccessibility.colorVision("#5b5ce2", "deuteranopia") });
      } else if (feature === "testing") {
        const recorder = document.querySelector("#platform-tests").recorder; recorder.record({ type: "click", target: "feature-lab" }); let replayed = false; await recorder.replay(async () => ({ dispatchEvent: () => { replayed = true; } })); writeFeatureResult(feature, { entries: recorder.entries, replayed });
      } else if (feature === "theme") {
        productionTheme.studio.set("--gui-accent", "#00a99d"); writeFeatureResult(feature, { css: productionTheme.studio.exportCss(), contrast: contrastRatio("#ffffff", "#172030"), audit: productionTheme.studio.audit([{ foreground: "#ffffff", background: "--gui-surface" }]) }); productionTheme.render();
      } else if (feature === "layout") {
        productionTheme.studio.applyPreset("night"); const layout = document.querySelector("#production-layout").layout; layout.move("chart", { span: { compact: 12, medium: 8, wide: 8 } }); writeFeatureResult(feature, layout.resolve(window.innerWidth));
      } else if (feature === "connector") {
        writeFeatureResult(feature, await productionConnectors.connectors.load("telemetry-replay", { index: 1 }));
      } else if (feature === "credentials") {
        await featureVault.set("demo-api-token", "stored-by-host-adapter"); writeFeatureResult(feature, { reference: "demo-api-token", connected: await featureVault.test("demo-api-token", (value) => value === "stored-by-host-adapter") });
      } else if (feature === "observability") {
        const alerts = []; productionObservability.hub.addEventListener("alert", (event) => alerts.push(event.detail), { once: true }); productionObservability.hub.metric("demo.latency", 140, { route: "/api/telemetry" }); const trace = productionObservability.hub.trace("demo.refresh", { source: "feature-lab" }); trace.span("query").end({ rows: 3 }); productionObservability.render(); writeFeatureResult(feature, { alerts, snapshot: productionObservability.hub.snapshot() });
      } else if (feature === "nodes") {
        const node = featureNodes.create("telemetry.filter", { id: "filter-1" }); const frame = featureDebugger.step(node.id, { result: 42 }); featureDebugger.resume(); writeFeatureResult(feature, { node, frame, paused: featureDebugger.paused });
      } else if (feature === "charts") {
        const samples = [1, 0, -1, 0]; writeFeatureResult(feature, { fft: fftMagnitude(samples), correlation: correlation([1, 2, 3], [2, 4, 6]), csv: exportDelimited([{ signal: "cpu", value: 42 }]), svg: exportChartSvg([{ x: 0, y: 20 }, { x: 1, y: 44 }]), formats: ["scatter", "heatmap", "candlestick"].map((type) => normalizeAnalysisDataset(type, type === "candlestick" ? [{ open: 1, high: 3, low: 0, close: 2 }] : [{ x: 1, y: 2, value: 3 }])) });
      } else if (feature === "productivity") {
        productivityCombo.model.setValue(["signal-1", "signal-8", "signal-13"]); productivitySchedule.upsert({ id: "incident", title: "Incident retrospective", start: "2026-07-25T11:00:00Z", end: "2026-07-25T12:00:00Z" }); productivityProperties.model.update("pipeline.threshold", 0.74); productivityCenter.push({ title: "Profile updated", message: "Productivity controls were exercised.", group: "workspace" }); productivityProfiles.activate("engineering"); productivityProfiles.apply(commands); writeFeatureResult(feature, { selectedSignals: productivityCombo.value, schedule: productivitySchedule.between(), properties: productivityProperties.value, notifications: productivityCenter.toJSON(), shortcuts: productivityProfiles.toJSON(), uploadQueue: productivityUpload.files });
      } else if (feature === "offline") {
        await featureOffline.enqueue({ type: "save", path: "reports/incident.md" }); const sent = []; await featureOffline.flush(async (operation) => sent.push(operation.type)); writeFeatureResult(feature, { sent, snapshot: featureOffline.snapshot({ name: "GuiKit demo" }) });
      } else if (feature === "plugins") {
        writeFeatureResult(feature, await pluginPolicyDemo.verify(pluginPolicyDemo.scaffold({ id: "demo.safe-plugin", name: "Safe plugin" })));
      } else if (feature === "visual") {
        const cases = featureVisual.matrix("settings"); writeFeatureResult(feature, { cases: cases.length, result: await featureVisual.compare("demo", "candidate", async () => ({ passed: true, changedPixels: 0 })) });
      } else if (feature === "optimize") {
        writeFeatureResult(feature, featureOptimizer.evaluateAssets({ "demo.js": 76_400, "styles.css": 18_000 }));
      } else if (feature === "cache") {
        writeFeatureResult(feature, { data: featureCache.resolve("/api/telemetry.json"), assets: featureCache.resolve("/app.js") });
      } else if (feature === "service-worker") {
        const bridge = new GuiServiceWorkerBridge(); writeFeatureResult(feature, { supported: Boolean(navigator.serviceWorker), registration: bridge.registration, note: "Registration remains host-controlled; no worker is installed by the demo." });
      }
    } catch (error) { writeFeatureResult(feature, { error: String(error?.message ?? error) }); }
  });
});

const chart = document.querySelector("#full-chart");
const chartCount = document.querySelector("#chart-count");
let chartRunning = true;
let chartSample = 0;

function chartPoint(index, offset = 0) {
  return {
    x: Date.now() - (30_000 - index) * 20,
    y: 50 + offset + Math.sin(index / (91 + offset)) * 18 + Math.sin(index / 13) * 3,
  };
}

function seedChart(count = 10_000) {
  const cpu = [];
  const memory = [];
  const network = [];
  for (let index = 0; index < count; index += 1) {
    cpu.push(chartPoint(index));
    memory.push(chartPoint(index, 12));
    network.push(chartPoint(index, -14));
  }
  chartSample = count;
  chart.setSeries([
    { id: "cpu", label: "CPU", color: "#6c8cff", unit: "%", type: "area", data: cpu },
    { id: "memory", label: "Memory", color: "#17a88b", unit: " GB", data: memory },
    { id: "network", label: "Network", color: "#d97706", unit: " Mb/s", axis: "right", type: "step", data: network },
  ]);
  chart.setThresholds([
    { id: "cpu-warning", value: 78, label: "CPU warning", color: "#d97706" },
    { id: "network-baseline", value: -8, label: "Network baseline", axis: "right", color: "#d14f7b" },
  ]);
  chart.setAnnotations([
    { id: "deployment", x: cpu.at(-1).x - 45_000, label: "Deployment", color: "#6c8cff" },
    { id: "incident", x: cpu.at(-1).x - 12_000, label: "Investigation", color: "#d14f7b" },
  ]);
  chart.resetView();
  updateChartCount();
}

function updateChartCount() {
  chartCount.textContent = chart.pointCount.toLocaleString();
  document.querySelector("#metric-points").textContent = chart.pointCount.toLocaleString();
  demoStatusbar.setItemValue("points", chart.pointCount.toLocaleString(), {
    announce: false,
  });
}

seedChart();
const chartTimer = setInterval(() => {
  if (!chartRunning) return;
  const x = Date.now();
  chart.append("cpu", { x, y: chartPoint(chartSample).y + Math.random() * 3 });
  chart.append("memory", { x, y: chartPoint(chartSample, 12).y + Math.random() * 2 });
  chart.append("network", { x, y: chartPoint(chartSample, -14).y + Math.random() * 5 });
  chartSample += 1;
  updateChartCount();
}, 100);
window.addEventListener("pagehide", () => clearInterval(chartTimer), { once: true });

chart.addEventListener("gui:chart-render", (event) => {
  document.querySelector("#chart-render-state").textContent =
    `${event.detail.visiblePoints.toLocaleString()} visible`;
});
document.querySelector("#chart-toggle").addEventListener("click", (event) => {
  chartRunning = !chartRunning;
  event.currentTarget.textContent = chartRunning ? "Pause" : "Resume";
});
document.querySelector("#chart-burst").addEventListener("click", () => {
  const series = { cpu: [], memory: [], network: [] };
  const base = Date.now();
  for (let index = 0; index < 10_000; index += 1) {
    const x = base + index;
    series.cpu.push({ x, y: chartPoint(chartSample + index).y });
    series.memory.push({ x, y: chartPoint(chartSample + index, 12).y });
    series.network.push({ x, y: chartPoint(chartSample + index, -14).y });
  }
  Object.entries(series).forEach(([id, points]) => chart.appendBatch(id, points));
  chartSample += 10_000;
  updateChartCount();
  toast.success("30,000 new series samples appended.");
});
document.querySelector("#chart-derived").addEventListener("click", (event) => {
  if (chart.getSeries("cpu-average")) {
    chart.removeSeries("cpu-average");
    event.currentTarget.textContent = "Add moving average";
    return;
  }
  chart.addDerivedSeries({
    id: "cpu-average",
    label: "CPU 30-sample average",
    source: "cpu",
    operation: "moving-average",
    window: 30,
    color: "#a78bfa",
    dash: [6, 3],
    unit: "%",
  });
  event.currentTarget.textContent = "Remove moving average";
});
document.querySelector("#chart-cursor").addEventListener("click", (event) => {
  const next = !chart.cursor.pinned;
  chart.setCursor({ x: chart.cursor.x ?? Date.now(), pinned: next });
  event.currentTarget.textContent = next ? "Release cursor" : "Pin cursor";
});
document.querySelector("#chart-reset-view").addEventListener("click", () => chart.resetView());
document.querySelector("#chart-reset").addEventListener("click", () => seedChart());
document.querySelector("#chart-clear").addEventListener("click", () => {
  chart.clear();
  updateChartCount();
});

const graphExample = {
  nodes: [
    {
      id: "camera",
      groupId: "Inputs",
      title: "Camera",
      type: "source",
      description: "Produces live image frames.",
      color: "#3285d8",
      allowMultipleConnections: false,
      x: 0,
      y: 130,
      outputs: [
        { id: "camera:image", label: "Image", type: "image" },
        { id: "camera:time", label: "Timestamp", type: "number" },
      ],
      parameters: [
        {
          id: "device",
          label: "Device",
          type: "select",
          inline: true,
          value: "front",
          options: [
            { value: "front", label: "Front camera" },
            { value: "rear", label: "Rear camera" },
          ],
        },
        {
          id: "fps",
          label: "Frame rate",
          type: "number",
          inline: true,
          value: 30,
          min: 1,
          max: 120,
          step: 1,
          unit: "fps",
        },
        {
          id: "backendProfile",
          label: "Backend profile",
          type: "text",
          value: "low-latency",
        },
      ],
    },
    {
      id: "edges",
      title: "Edge Detection",
      type: "processor",
      subgraph: {
        nodes: [
          {
            id: "blur",
            title: "Noise reduction",
            x: 40,
            y: 60,
            inputs: [{ id: "blur:in", type: "image" }],
            outputs: [{ id: "blur:out", type: "image" }],
          },
          {
            id: "gradient",
            title: "Gradient",
            x: 360,
            y: 60,
            inputs: [{ id: "gradient:in", type: "image" }],
            outputs: [{ id: "gradient:out", type: "image" }],
          },
        ],
        links: [{ id: "blur-gradient", from: "blur:out", to: "gradient:in" }],
      },
      description: "Finds high-contrast boundaries.",
      color: "#8b5cf6",
      maxConnections: 4,
      x: 330,
      y: 60,
      inputs: [
        { id: "edges:image", label: "Image", type: "image" },
        { id: "edges:amount", label: "Amount", type: "number" },
      ],
      outputs: [{ id: "edges:result", label: "Result", type: "image" }],
      parameters: [
        {
          id: "threshold",
          label: "Threshold",
          type: "range",
          inline: true,
          value: 0.42,
          min: 0,
          max: 1,
          step: 0.01,
        },
        {
          id: "method",
          label: "Method",
          type: "select",
          inline: true,
          value: "sobel",
          options: [
            { value: "sobel", label: "Sobel" },
            { value: "canny", label: "Canny" },
            { value: "laplace", label: "Laplacian" },
          ],
        },
      ],
    },
    {
      id: "preview",
      title: "Preview",
      type: "output",
      description: "Renders the processed image.",
      color: "#17a88b",
      x: 690,
      y: 90,
      inputs: [{ id: "preview:image", label: "Image", type: "image" }],
      parameters: [
        {
          id: "overlay",
          label: "Show overlay",
          type: "boolean",
          inline: true,
          value: true,
        },
        {
          id: "resolution",
          label: "Output",
          type: "readonly",
          inline: true,
          value: "1920 × 1080",
        },
      ],
    },
    {
      id: "strength",
      groupId: "Inputs",
      title: "Strength",
      type: "value",
      color: "#d97706",
      allowMultipleConnections: false,
      x: 60,
      y: 390,
      outputs: [{ id: "strength:value", label: "Value", type: "number" }],
      parameters: [
        {
          id: "value",
          label: "Value",
          type: "range",
          inline: true,
          value: 0.7,
          min: 0,
          max: 1,
          step: 0.05,
        },
      ],
    },
  ],
  links: [
    { id: "camera-edges", from: "camera:image", to: "edges:image" },
    { id: "edges-preview", from: "edges:result", to: "preview:image" },
    { id: "strength-edges", from: "strength:value", to: "edges:amount" },
  ],
};
const nodeEditor = document.querySelector("#full-node-editor");
const graphJson = document.querySelector("#graph-json");
const nodeFlowDirection = document.querySelector("#node-flow-direction");
nodeEditor.history = history;
nodeEditor.clipboard = clipboard;
nodeEditor.setWireTypes({
  image: { label: "Image", color: "#8b5cf6", width: 3.25 },
  number: { label: "Number", color: "#f59e0b", width: 3 },
  analog: { label: "Analog signal", color: "#ef4444", width: 3.5 },
  digital: { label: "Digital signal", color: "#3b82f6", width: 3 },
});
let addedNodes = 0;
let currentNodeFlowDirection = "horizontal";

function fitNodeEditor() {
  // The editor lives on an initially hidden sliding page. Wait until both the
  // page switch and its layout have completed before measuring the viewport.
  requestAnimationFrame(() => requestAnimationFrame(() => nodeEditor.zoomToFit()));
}

function loadGraphExample() {
  const graph = structuredClone(graphExample);
  if (currentNodeFlowDirection === "vertical") {
    graph.nodes.forEach((node) => {
      [node.x, node.y] = [node.y, node.x];
    });
  }
  nodeEditor.flowDirection = currentNodeFlowDirection;
  nodeEditor.setGraph(graph);
  nodeEditor.toggleBreakpoint("edges", true);
  nodeEditor.setExecutionState("camera", "success");
  nodeEditor.setExecutionState("edges", "running", { frame: 1 });
  graphJson.value = JSON.stringify(nodeEditor.getGraph(), null, 2);
  fitNodeEditor();
}
loadGraphExample();
demoPages.addEventListener("gui:page-change", (event) => {
  if (event.detail.active === "nodes") fitNodeEditor();
});
document.querySelector("#node-add").addEventListener("click", () => {
  addedNodes += 1;
  nodeEditor.addNode({
    id: `processor-${addedNodes}`,
    title: `Processor ${addedNodes}`,
    type: "processor",
    x: 260 + addedNodes * 24,
    y: 260 + addedNodes * 20,
    inputs: [{ id: `processor-${addedNodes}:in`, label: "Value", type: "number" }],
    outputs: [{ id: `processor-${addedNodes}:out`, label: "Value", type: "number" }],
    parameters: [{
      id: "gain",
      label: "Gain",
      type: "number",
      inline: true,
      value: 1,
      min: 0,
      max: 10,
      step: 0.1,
      unit: "×",
    }],
  });
});
document.querySelector("#node-fit").addEventListener("click", () => nodeEditor.zoomToFit());
document.querySelector("#node-layout").addEventListener("click", () => nodeEditor.autoLayout());
document.querySelector("#node-duplicate").addEventListener("click", () => {
  if (!nodeEditor.duplicateSelection()) toast.info("Select one or more nodes first.");
});
document.querySelector("#node-comment").addEventListener("click", () => {
  const comment = nodeEditor.addComment({
    title: "Review note",
    text: "Comments and frames can document a graph.",
    x: 350,
    y: 460,
  });
  nodeEditor.selectNode(comment.id);
});
document.querySelector("#node-validate").addEventListener("click", () => {
  const result = nodeEditor.validateGraph();
  toast[result.valid ? "success" : "warning"](
    result.valid
      ? `Graph is valid with ${result.warnings.length} warning(s).`
      : `Graph has ${result.errors.length} error(s).`,
  );
});
document.querySelector("#node-undo").addEventListener("click", () => history.undo());
document.querySelector("#node-redo").addEventListener("click", () => history.redo());
document.querySelector("#node-reset").addEventListener("click", loadGraphExample);
document.querySelector("#node-export").addEventListener("click", () => {
  graphJson.value = JSON.stringify(nodeEditor.getGraph(), null, 2);
  toast.success("Graph serialized to JSON.");
});
document.querySelector("#node-import").addEventListener("click", () => {
  try {
    nodeEditor.setGraph(JSON.parse(graphJson.value));
    fitNodeEditor();
    toast.success("Graph restored from JSON.");
  } catch (error) {
    toast.error(error.message, { title: "Invalid graph" });
  }
});
document.querySelector("#node-readonly").addEventListener("change", (event) => {
  nodeEditor.readOnly = event.currentTarget.checked;
});
nodeFlowDirection.addEventListener("change", () => {
  const direction = nodeFlowDirection.value === "vertical"
    ? "vertical"
    : "horizontal";
  if (direction === currentNodeFlowDirection) return;
  const graph = nodeEditor.getGraph();
  graph.nodes.forEach((node) => {
    [node.x, node.y] = [node.y, node.x];
  });
  currentNodeFlowDirection = direction;
  nodeEditor.flowDirection = direction;
  nodeEditor.setGraph(graph);
  graphJson.value = JSON.stringify(nodeEditor.getGraph(), null, 2);
  fitNodeEditor();
  toast.info(`${direction === "vertical" ? "Vertical" : "Horizontal"} node flow enabled.`);
});
nodeEditor.addEventListener("gui:node-create-request", (event) => {
  addedNodes += 1;
  nodeEditor.addNode({
    id: `canvas-node-${addedNodes}`,
    title: `Canvas node ${addedNodes}`,
    x: event.detail.position.x,
    y: event.detail.position.y,
    inputs: [{ id: `canvas-node-${addedNodes}:in`, label: "Input", type: "any" }],
    outputs: [{ id: `canvas-node-${addedNodes}:out`, label: "Output", type: "any" }],
    parameters: [{
      id: "enabled",
      label: "Enabled",
      type: "boolean",
      inline: true,
      value: true,
    }],
  });
});

const WIZARD_STORAGE_KEY = "guikit-full-demo-wizard-v1";
const fullWizard = document.querySelector("#full-wizard");
const wizardState = document.querySelector("#wizard-demo-state");
const wizardDetail = document.querySelector("#wizard-demo-detail");
const wizardDefaults = {
  workspaceName: "",
  region: "",
  purpose: "",
  template: "",
  loggingIntegration: true,
  mediaIntegration: false,
  bridgeIntegration: true,
};

function readWizardValues() {
  const values = {};
  fullWizard.querySelectorAll("[name]").forEach((control) => {
    if (control.type === "radio") {
      if (control.checked) values[control.name] = control.value;
    } else if (control.type === "checkbox") {
      values[control.name] = control.checked;
    } else {
      values[control.name] = control.value;
    }
  });
  return { ...wizardDefaults, ...values };
}

function populateWizardValues(values = {}) {
  const settings = { ...wizardDefaults, ...values };
  fullWizard.querySelectorAll("[name]").forEach((control) => {
    if (control.type === "radio") {
      control.checked = control.value === settings[control.name];
    } else if (control.type === "checkbox") {
      control.checked = Boolean(settings[control.name]);
    } else {
      control.value = settings[control.name] ?? "";
    }
  });
  updateWizardReview();
}

function updateWizardReview() {
  const values = readWizardValues();
  document.querySelector("#wizard-review-title").textContent =
    values.workspaceName.trim() || "New workspace";
  document.querySelector("#wizard-review-json").textContent =
    JSON.stringify(values, null, 2);
  return values;
}

function setWizardDemoState(label, detail, variant = "") {
  wizardState.textContent = label;
  wizardState.dataset.variant = variant;
  wizardDetail.textContent = detail;
}

fullWizard.setValidator("workspace", async () => {
  setWizardDemoState("Checking", "Validating workspace availability…", "working");
  await new Promise((resolve) => setTimeout(resolve, 320));
  const name = document.querySelector("#wizard-workspace-name").value.trim();
  setWizardDemoState("In progress", "The workflow has unsaved progress.");
  if (name.toLowerCase() === "taken") {
    return "That workspace name is already in use. Choose another name.";
  }
  return true;
});

fullWizard.addEventListener("input", () => {
  updateWizardReview();
  setWizardDemoState("In progress", "The workflow has unsaved progress.");
});

fullWizard.addEventListener("gui:wizard-step-change", (event) => {
  if (event.detail.active === "review") updateWizardReview();
  setWizardDemoState(
    "In progress",
    `Active step: ${event.detail.active}. Progress is not saved.`,
  );
});

fullWizard.addEventListener("gui:wizard-validation-error", (event) => {
  setWizardDemoState("Needs input", event.detail.message);
});

fullWizard.addEventListener("gui:wizard-skip", () => {
  setWizardDemoState("Step skipped", "Optional integrations can be configured later.");
});

fullWizard.addEventListener("gui:wizard-finish", () => {
  const values = updateWizardReview();
  setWizardDemoState(
    "Complete",
    `${values.workspaceName || "Workspace"} is ready to be created.`,
    "success",
  );
  toast.success("Workspace onboarding completed.", { title: "Wizard" });
});

document.querySelector("#wizard-save").addEventListener("click", () => {
  const payload = {
    state: fullWizard.getState(),
    values: readWizardValues(),
    savedAt: new Date().toISOString(),
  };
  storage.set(WIZARD_STORAGE_KEY, JSON.stringify(payload));
  setWizardDemoState("Saved", "Wizard progress and form values were saved locally.", "success");
  toast.success("Wizard progress saved.", { title: "Wizard" });
});

document.querySelector("#wizard-restore").addEventListener("click", () => {
  try {
    const saved = JSON.parse(storage.get(WIZARD_STORAGE_KEY) ?? "null");
    if (!saved?.state || !saved?.values) {
      toast.warning("No saved wizard progress is available.", { title: "Wizard" });
      return;
    }
    populateWizardValues(saved.values);
    fullWizard.restoreState(saved.state);
    setWizardDemoState(
      "Restored",
      `Progress restored from ${new Date(saved.savedAt).toLocaleTimeString()}.`,
      "success",
    );
    toast.success("Wizard progress restored.", { title: "Wizard" });
  } catch (error) {
    toast.error(error.message, { title: "Could not restore wizard" });
  }
});

document.querySelector("#wizard-reset").addEventListener("click", () => {
  fullWizard.reset({ focus: true });
  populateWizardValues(wizardDefaults);
  setWizardDemoState("Ready", "Wizard progress was reset.");
});

populateWizardValues(wizardDefaults);

function createGeneratedMedia() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  if (typeof canvas.captureStream !== "function") {
    throw new Error("Canvas MediaStream capture is not supported by this browser.");
  }
  const context = canvas.getContext("2d");
  const started = performance.now();
  let frame;
  const draw = (time) => {
    const elapsed = (time - started) / 1_000;
    const hue = (elapsed * 24) % 360;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, `hsl(${hue} 70% 42%)`);
    gradient.addColorStop(1, `hsl(${(hue + 105) % 360} 70% 13%)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgb(255 255 255 / .1)";
    for (let x = 0; x < canvas.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    context.fillStyle = "white";
    context.font = "700 68px system-ui";
    context.fillText("GuiKit Live", 82, 120);
    context.font = "32px ui-monospace";
    context.fillText(new Date().toLocaleTimeString(), 86, 178);
    context.fillText("MediaStream · 30 FPS · generated locally", 86, 640);
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  const stream = canvas.captureStream(30);
  return {
    stream,
    stop() {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}

if (!mediaAdapters.list().some((adapter) => adapter.id === "demo-gradient")) {
  mediaAdapters.register({
    id: "demo-gradient",
    priority: 100,
    canHandle: (source) => source.type === "application/x-guikit-gradient",
    attach(_source, video) {
      const generated = createGeneratedMedia();
      video.srcObject = generated.stream;
      video.removeAttribute("src");
      return () => generated.stop();
    },
  });
}
document.querySelector("#adapter-list").textContent =
  mediaAdapters.list().map((adapter) => `${adapter.id} (${adapter.priority})`).join(", ");

const mediaPlayer = document.querySelector("#full-media-player");
let directMedia;
async function stopMedia() {
  await mediaPlayer.detach({ stopTracks: true });
  directMedia?.stop();
  directMedia = null;
}
document.querySelector("#media-stream").addEventListener("click", async () => {
  try {
    await stopMedia();
    directMedia = createGeneratedMedia();
    await mediaPlayer.attachStream(directMedia.stream, {
      live: true,
      autoplay: true,
      label: "Generated direct MediaStream",
    });
  } catch (error) {
    toast.error(error.message);
  }
});
document.querySelector("#media-adapter").addEventListener("click", async () => {
  try {
    await stopMedia();
    await mediaPlayer.setSource({
      src: "guikit:gradient",
      type: "application/x-guikit-gradient",
      live: true,
      autoplay: true,
    });
  } catch (error) {
    toast.error(error.message);
  }
});
document.querySelector("#media-stop").addEventListener("click", stopMedia);
document.querySelector("#media-url-load").addEventListener("click", async () => {
  const url = document.querySelector("#media-url").value.trim();
  if (!url) {
    toast.warning("Enter a media URL first.");
    return;
  }
  try {
    await stopMedia();
    await mediaPlayer.setSource({ src: url, autoplay: true });
  } catch (error) {
    toast.error(error.message, { title: "Media load failed" });
  }
});
window.addEventListener("pagehide", () => {
  directMedia?.stop();
}, { once: true });

const updateMemoryCount = () => {
  document.querySelector("#memory-log-count").textContent = memorySink.records.length.toLocaleString();
};
logs.subscribe(updateMemoryCount);
document.querySelectorAll("[data-log-level]").forEach((button) => {
  button.addEventListener("click", () => {
    const level = button.dataset.logLevel;
    const moduleLog = demoLog.child("logging-station", { feature: "viewer" });
    if (level === "error") {
      moduleLog.error("Demonstration request failed", new TypeError("Invalid demo payload"), {
        requestId: "req-demo",
        authorization: "Bearer secret-value",
        apiKey: "must-not-leave-the-manager",
      });
    } else {
      moduleLog[level](`Example ${level} record`, {
        chartPoints: chart.pointCount,
        locale: i18n.locale,
      });
    }
    updateMemoryCount();
  });
});
document.querySelector("#log-span").addEventListener("click", async () => {
  const parent = demoLog.startSpan("demo.pipeline", { jobs: 2 });
  const child = parent.startSpan("demo.decode", { format: "json" });
  await new Promise((resolve) => setTimeout(resolve, 120));
  child.end({ records: 250 });
  await new Promise((resolve) => setTimeout(resolve, 80));
  parent.end({ result: "complete" });
  updateMemoryCount();
});
document.querySelector("#log-flush").addEventListener("click", async () => {
  await logs.flush();
  toast.success("All logging transports flushed.");
});

async function configureBackendLogging() {
  const status = document.querySelector("#http-sink-status");
  try {
    const response = await fetch("/api/info");
    if (!response.ok) throw new Error("Backend endpoint unavailable");
    const info = await response.json();
    logs.addSink(new GuiBatchSink(
      new GuiHttpLogSink("/api/logs", { minLevel: "info" }),
      { batchSize: 25, maxQueue: 2_000, interval: 900 },
    ));
    status.textContent = "HTTP + rotating file online";
    status.dataset.online = "true";
    document.querySelector("#server-dot").dataset.online = "true";
    document.querySelector("#server-status").textContent = `${info.host} · ${info.runtime}`;
    demoStatusbar.updateItem("runtime", {
      variant: "success",
      value: "Node backend",
    });
    demoLog.info("Backend logging connected", info);
  } catch {
    status.textContent = "HTTP backend unavailable";
    document.querySelector("#server-status").textContent = "Static browser mode";
    demoStatusbar.updateItem("runtime", {
      variant: "warning",
      value: "Static browser",
    });
  }
}
await configureBackendLogging();

document.querySelector("#bridge-info").addEventListener("click", async () => {
  const result = await bridge.invoke("app.info");
  document.querySelector("#bridge-result").textContent = JSON.stringify(result, null, 2);
  demoLog.info("Bridge app.info completed", result);
});
document.querySelector("#bridge-echo").addEventListener("click", async () => {
  const result = await bridge.invoke("app.echo", {
    message: "Hello from GuiKit",
    values: [1, 2, 3],
  });
  document.querySelector("#bridge-result").textContent = JSON.stringify(result, null, 2);
});
document.querySelector("#bridge-event").addEventListener("click", () => {
  bridge.receive({
    channel: "gui-template",
    type: "event",
    name: "demo-pulse",
    data: { source: "simulated host", timestamp: new Date().toISOString() },
  });
});

const moduleResults = await runtime.ready;
document.querySelector("#metric-modules").textContent = guiModules.list().length;
document.querySelector("#modules-ready").textContent = `${moduleResults.size} initialized`;
const moduleTable = document.querySelector("#module-table");
guiModules.list().forEach((module) => {
  const row = document.createElement("div");
  row.className = "demo-module-row";
  const identity = document.createElement("strong");
  identity.textContent = module.id;
  const description = document.createElement("small");
  description.textContent = module.description || "Application extension module";
  const state = document.createElement("span");
  state.className = "gui-badge";
  state.textContent = guiModules.state(module.id);
  row.append(identity, description, state);
  moduleTable.append(row);
});

syncNavigation("overview");
demoLog.info("Full demo initialized", {
  modules: guiModules.list().map((module) => module.id),
  locale: initialLocale,
  adapters: mediaAdapters.list().map((adapter) => adapter.id),
});
updateMemoryCount();
