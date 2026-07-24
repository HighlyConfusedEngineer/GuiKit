import {
  GuiBatchSink,
  GuiBridgeLogSink,
  GuiDataBuffer,
  GuiHttpLogSink,
  GuiMemorySink,
  bridge,
  decimateMinMax,
  defineGuiModule,
  guiModules,
  i18n,
  initializeGui,
  logger,
  logs,
  mediaAdapters,
  setTheme,
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
      media: "Media",
      logging: "Logging",
      platform: "Platform",
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
      media: "Medien",
      logging: "Protokolle",
      platform: "Plattform",
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
      media: "Multimedia",
      logging: "Registros",
      platform: "Plataforma",
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
  "gui:node-error",
  "gui:statusbar-action",
  "gui:statusbar-position-change",
  "gui:media-source-change",
  "gui:media-play",
  "gui:media-pause",
  "gui:media-error",
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
  ["✓", "Live media", "media"],
  ["✓", "Structured logging", "logging"],
  ["✓", "i18n and bridge", "platform"],
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
];
localeControls.forEach((control) => {
  control.value = initialLocale;
  control.addEventListener("change", () => {
    localeControls.forEach((other) => { other.value = control.value; });
    storage.set("guikit-full-demo-locale", control.value);
    i18n.setLocale(control.value);
    syncNavigation(demoPages.active);
    demoLog.info("Locale changed", { locale: control.value });
  });
});

const themes = ["system", "light", "dark"];
const themeSelect = document.querySelector("#theme-select");
themeSelect.value = storage.get("gui-theme") ?? "system";
const applyTheme = (theme) => {
  setTheme(theme);
  themeSelect.value = theme;
  document.querySelector("#metric-theme").textContent =
    theme.charAt(0).toUpperCase() + theme.slice(1);
  demoLog.info("Theme changed", { theme });
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

document.querySelectorAll("[data-accent]").forEach((button) => {
  button.addEventListener("click", () => {
    const accent = button.dataset.accent;
    document.documentElement.style.setProperty("--gui-accent", accent);
    document.documentElement.style.setProperty("--gui-accent-soft", `color-mix(in srgb, ${accent} 16%, transparent)`);
    document.querySelector("#accent-value").textContent = `--gui-accent: ${accent}`;
    window.dispatchEvent(new CustomEvent("gui:theme-changed", { detail: { theme: "custom", accent } }));
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
    { id: "cpu", label: "CPU", color: "#6c8cff", data: cpu },
    { id: "memory", label: "Memory", color: "#17a88b", data: memory },
    { id: "network", label: "Network", color: "#d97706", data: network },
  ]);
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
document.querySelector("#chart-reset").addEventListener("click", () => seedChart());
document.querySelector("#chart-clear").addEventListener("click", () => {
  chart.clear();
  updateChartCount();
});

const graphExample = {
  nodes: [
    {
      id: "camera",
      title: "Camera",
      type: "source",
      description: "Produces live image frames.",
      color: "#3285d8",
      x: 0,
      y: 130,
      outputs: [
        { id: "camera:image", label: "Image", type: "image" },
        { id: "camera:time", label: "Timestamp", type: "number" },
      ],
    },
    {
      id: "edges",
      title: "Edge Detection",
      type: "processor",
      description: "Finds high-contrast boundaries.",
      color: "#8b5cf6",
      x: 330,
      y: 60,
      inputs: [
        { id: "edges:image", label: "Image", type: "image" },
        { id: "edges:amount", label: "Amount", type: "number" },
      ],
      outputs: [{ id: "edges:result", label: "Result", type: "image" }],
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
    },
    {
      id: "strength",
      title: "Strength",
      type: "value",
      color: "#d97706",
      x: 60,
      y: 390,
      outputs: [{ id: "strength:value", label: "Value", type: "number" }],
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
let addedNodes = 0;

function fitNodeEditor() {
  // The editor lives on an initially hidden sliding page. Wait until both the
  // page switch and its layout have completed before measuring the viewport.
  requestAnimationFrame(() => requestAnimationFrame(() => nodeEditor.zoomToFit()));
}

function loadGraphExample() {
  nodeEditor.setGraph(graphExample);
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
  });
});
document.querySelector("#node-fit").addEventListener("click", () => nodeEditor.zoomToFit());
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
nodeEditor.addEventListener("gui:node-create-request", (event) => {
  addedNodes += 1;
  nodeEditor.addNode({
    id: `canvas-node-${addedNodes}`,
    title: `Canvas node ${addedNodes}`,
    x: event.detail.position.x,
    y: event.detail.position.y,
    inputs: [{ id: `canvas-node-${addedNodes}:in`, label: "Input", type: "any" }],
    outputs: [{ id: `canvas-node-${addedNodes}:out`, label: "Output", type: "any" }],
  });
});

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
