import {
  GuiDevelopmentSession,
  GuiTexDocument,
  GuiTutorialModel,
  bridge,
  diagnostics,
  guiModules,
  initializeGui,
  logger,
  toast,
} from "../../src/gui.js";

const runtime = initializeGui({ theme: "dark" });
const log = logger.child("pulseops-reference", { station: "north-line-03", mode: "browser-simulation" });
const pages = document.querySelector("#console-pages");
const chart = document.querySelector("#telemetry-chart");
const statusbar = document.querySelector("#telemetry-status");
const eventList = document.querySelector("#event-list");
const alarms = [];
let running = true;
let sample = 0;

statusbar.setItems([
  { id: "connection", type: "status", variant: "success", label: "Gateway", value: "Online", priority: "high" },
  { id: "stream", type: "status", variant: "success", label: "Stream", value: "Live", priority: "high" },
  { id: "samples", type: "text", label: "Samples", value: "0", priority: "normal" },
  { id: "clock", type: "text", align: "end", label: "Local time", value: new Date().toLocaleTimeString(), priority: "normal" },
]);

function point(index, offset = 0, amplitude = 1) {
  return 50 + offset + Math.sin(index / 37) * 10 * amplitude + Math.sin(index / 8) * 2.2 + (Math.random() - .5) * 2;
}
function seedTelemetry(count = 5000) {
  const temperature = [], vibration = [], throughput = [];
  const start = Date.now() - count * 200;
  for (let index = 0; index < count; index += 1) {
    const x = start + index * 200;
    temperature.push({ x, y: point(index, 19, .55) });
    vibration.push({ x, y: point(index, -43, .24) / 5 });
    throughput.push({ x, y: point(index, 24, .8) * 1.45 });
  }
  chart.setSeries([
    { id: "temperature", label: "Motor temperature", color: "#f4b95d", unit: " °C", type: "area", data: temperature },
    { id: "vibration", label: "Vibration RMS", color: "#39d3e6", unit: " mm/s", data: vibration },
    { id: "throughput", label: "Throughput", color: "#42d69b", unit: " units/min", axis: "right", type: "step", data: throughput },
  ]);
  chart.setThresholds([
    { id: "temperature-warning", value: 72, label: "Thermal warning", color: "#f4b95d" },
    { id: "vibration-warning", value: 7.2, label: "Vibration warning", color: "#ff6e7b" },
  ]);
  chart.setAnnotations([{ id: "calibration", x: Date.now() - 180000, label: "Calibration", color: "#5578ff" }]);
  chart.resetView(); sample = count;
}
function addEvent(source, message, context = "") {
  const row = document.createElement("tr");
  [new Date().toLocaleTimeString(), source, message, context].forEach((value, index) => { const cell = document.createElement("td"); cell.textContent = value; if (index === 3) cell.className = "event-context"; row.append(cell); });
  eventList.prepend(row); while (eventList.children.length > 9) eventList.lastElementChild.remove();
}
function renderAlarms() {
  const list = document.querySelector("#alarm-list"); list.replaceChildren();
  if (!alarms.length) { const item = document.createElement("li"); item.className = "alarm-item"; item.innerHTML = "<strong>No active alarms</strong><small>Condition monitor is inside the configured operating envelope.</small>"; list.append(item); }
  alarms.forEach((alarm) => { const item = document.createElement("li"); item.className = `alarm-item ${alarm.severity}`; const title = document.createElement("strong"); title.textContent = alarm.title; const detail = document.createElement("small"); detail.textContent = `${alarm.time} · ${alarm.detail}`; item.append(title, detail); list.append(item); });
  document.querySelector("#alarm-count").textContent = String(alarms.length); document.querySelector("#alarm-badge").textContent = `${alarms.length} open`; document.querySelector("#alarm-state").textContent = alarms.length ? "Action required" : "No escalation";
}
function raiseAlarm(title, detail, severity = "critical") {
  alarms.unshift({ title, detail, severity, time: new Date().toLocaleTimeString() }); renderAlarms(); addEvent("Condition monitor", title, detail); log.warn(title, { detail, severity }); toast.warning(detail, { title });
}
function refreshMetrics() {
  const temperature = point(sample, 19, .55); const vibration = Math.max(1.2, point(sample, -43, .24) / 5); const throughput = point(sample, 24, .8) * 1.45;
  document.querySelector("#temperature-value").textContent = temperature.toFixed(1); document.querySelector("#vibration-value").textContent = vibration.toFixed(2); document.querySelector("#throughput-value").textContent = Math.round(throughput); document.querySelector("#throughput-trend").textContent = `${(Math.sin(sample / 45) * 2.4).toFixed(1)}%`;
  document.querySelector("#temperature-state").textContent = temperature > 71 ? "Watch" : "Nominal"; document.querySelector("#vibration-state").textContent = vibration > 7.2 ? "Elevated" : "Stable"; document.querySelector("#event-rate").textContent = `${Math.min(60, 8 + alarms.length * 6)} events/min`;
  statusbar.setItemValue("samples", (chart.pointCount * 3).toLocaleString(), { announce: false }); statusbar.setItemValue("clock", new Date().toLocaleTimeString(), { announce: false });
}
seedTelemetry(); renderAlarms(); addEvent("Gateway", "Telemetry stream established", "3 signals · 200 ms cadence"); addEvent("Operator", "Shift handover accepted", "M. Chen");

const ticker = setInterval(() => {
  if (!running) return;
  const x = Date.now(); chart.append("temperature", { x, y: point(sample, 19, .55) }); chart.append("vibration", { x, y: Math.max(1.2, point(sample, -43, .24) / 5) }); chart.append("throughput", { x, y: point(sample, 24, .8) * 1.45 }); sample += 1; refreshMetrics();
}, 300);
window.addEventListener("pagehide", () => clearInterval(ticker), { once: true });

document.querySelector("#pause-stream").addEventListener("click", (event) => { running = !running; event.currentTarget.textContent = running ? "Pause stream" : "Resume stream"; statusbar.updateItem("stream", { value: running ? "Live" : "Paused", variant: running ? "success" : "warning" }, { announce: true }); addEvent("Operator", running ? "Live stream resumed" : "Live stream paused"); });
document.querySelector("#chart-cursor").addEventListener("click", () => { chart.setCursor({ x: Date.now(), pinned: true }); toast.info("Cursor pinned. Click the chart to choose a synchronized sample.", { title: "Analysis mode" }); });
document.querySelector("#chart-reset").addEventListener("click", () => chart.resetView());
document.querySelector("#inject-alarm").addEventListener("click", () => raiseAlarm("Vibration above policy threshold", "MTR-03 reached 8.4 mm/s RMS. Inspect coupling and bearing temperature."));
document.querySelector("#acknowledge-alerts").addEventListener("click", () => { const count = alarms.length; alarms.splice(0); renderAlarms(); addEvent("Operator", "Alarm queue acknowledged", `${count} alarm(s)`); toast.success(`${count || "No"} alarms acknowledged.`); });

pages.addEventListener("gui:page-change", (event) => { const title = { overview: "Live overview", signals: "Signal flow", reports: "Shift report", settings: "Station settings" }[event.detail.active] ?? "PulseOps"; document.querySelector("#view-title").textContent = title; document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.guiPageOpen === event.detail.active)); if (event.detail.active === "signals") requestAnimationFrame(() => document.querySelector("#signal-flow").zoomToFit()); });

const flow = document.querySelector("#signal-flow");
flow.setWireTypes({ analog: { label: "Analog sensor", color: "#f06469", width: 3.2 }, digital: { label: "Digital state", color: "#4a8dff", width: 3.2 }, alert: { label: "Alarm event", color: "#ba6dff", width: 3.5 } });
flow.setGraph({ nodes: [
  { id: "accelerometer", title: "Bearing accelerometer", type: "input", x: 48, y: 130, outputs: [{ id: "acc-out", label: "Signal", type: "analog" }], parameters: [{ id: "sample-rate", label: "Rate", type: "readonly", inline: true, value: "4 kHz" }] },
  { id: "filter", title: "Band-pass filter", type: "process", x: 310, y: 120, inputs: [{ id: "filter-in", label: "Signal", type: "analog" }], outputs: [{ id: "filter-out", label: "Filtered", type: "analog" }], parameters: [{ id: "low", label: "Low", type: "range", inline: true, value: 10, min: 1, max: 50, unit: "Hz" }] },
  { id: "rms", title: "RMS calculation", type: "process", x: 565, y: 120, inputs: [{ id: "rms-in", label: "Filtered", type: "analog" }], outputs: [{ id: "rms-out", label: "RMS", type: "analog" }], parameters: [{ id: "window", label: "Window", type: "select", inline: true, value: "1 s", options: ["500 ms", "1 s", "2 s"] }] },
  { id: "policy", title: "Threshold policy", type: "decision", x: 560, y: 340, inputs: [{ id: "policy-in", label: "RMS", type: "analog" }], outputs: [{ id: "policy-out", label: "Alarm", type: "alert" }], parameters: [{ id: "limit", label: "Limit", type: "range", inline: true, value: 7.2, min: 3, max: 12, step: .1, unit: "mm/s" }] },
  { id: "alarm", title: "Maintenance alert", type: "output", x: 830, y: 340, inputs: [{ id: "alarm-in", label: "Alarm", type: "alert" }], parameters: [{ id: "route", label: "Route", type: "readonly", inline: true, value: "On-call" }] },
], links: [
  { id: "acc-filter", from: "acc-out", to: "filter-in", type: "analog" },
  { id: "filter-rms", from: "filter-out", to: "rms-in", type: "analog" },
  { id: "rms-policy", from: "rms-out", to: "policy-in", type: "analog" },
  { id: "policy-alarm", from: "policy-out", to: "alarm-in", type: "alert" },
] });
flow.setExecutionState("accelerometer", "success"); flow.setExecutionState("filter", "running"); flow.setExecutionState("rms", "success"); flow.setExecutionState("policy", "idle");
document.querySelector("#flow-layout").addEventListener("click", () => flow.autoLayout()); document.querySelector("#flow-validate").addEventListener("click", () => { const result = flow.validateGraph(); toast[result.valid ? "success" : "warning"](result.valid ? "Signal flow is valid." : result.errors.join(" "), { title: "Flow validation" }); });

const reportEditor = document.querySelector("#report-editor"); const reportPreview = document.querySelector("#report-preview");
reportEditor.documentModel = new GuiTexDocument("\\documentclass{article}\n\\begin{document}\n\\section*{PulseOps shift report}\n\\textbf{Station:} Plant North / Line 03\\\\\n\\textbf{Throughput:} {{throughput}} units/min\\\\\n\\textbf{Motor temperature:} {{temperature}} C\\\\\n\\textbf{Vibration RMS:} {{vibration}} mm/s\\\\\n\\textbf{Open alarms:} {{alarms}}\\\\\n\\section*{Operator note}\nCondition monitor remains under review after coupling inspection.\\n\\end{document}", { engine: "pdflatex", safeMode: true });
reportEditor.compiler = { async compile(source) { await new Promise((resolve) => setTimeout(resolve, 350)); return { status: "completed", pdfUrl: "about:blank", bytes: source.length, log: "Browser demonstration compiler completed.", diagnostics: [] }; } };
reportEditor.addEventListener("gui:tex-editor-compile", (event) => { reportPreview.result = event.detail.result; addEvent("Reporting", "Shift report compiled", `${event.detail.result.bytes ?? 0} bytes`); });
document.querySelector("#compile-report").addEventListener("click", () => { const source = reportEditor.source.replace("{{throughput}}", document.querySelector("#throughput-value").textContent).replace("{{temperature}}", document.querySelector("#temperature-value").textContent).replace("{{vibration}}", document.querySelector("#vibration-value").textContent).replace("{{alarms}}", String(alarms.length)); reportEditor.source = source; void reportEditor.compile(); });
document.querySelector("#create-report").addEventListener("click", () => pages.open("reports"));

document.querySelector("#station-settings").addEventListener("input", (event) => { if (event.target.name === "threshold") document.querySelector("#threshold-output").textContent = `${event.target.value} mm/s`; });
document.querySelector("#station-settings").addEventListener("submit", (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); addEvent("Operator", "Monitoring policy saved", `${data.station} · warning ${data.threshold} mm/s`); toast.success("Monitoring policy staged for the edge gateway."); });

const development = new GuiDevelopmentSession({ modules: guiModules, diagnostics, logger, bridge, limit: 120 });
const tour = new GuiTutorialModel([
  { id: "overview", target: ".hero-panel", title: "Operations at a glance", description: "This is the shift supervisor’s current operating picture, with action-oriented context rather than a generic dashboard." },
  { id: "analysis", target: "#telemetry-chart", title: "Analyze correlated signals", description: "Temperature, vibration, and throughput share time navigation so an operator can diagnose cause and effect." },
  { id: "alarms", target: "#alarm-list", title: "Act on explainable alarms", description: "Alarms carry a recommendation and are retained in the local audit trail." },
]);
document.querySelector("#telemetry-tour").model = tour; document.querySelector("#start-tour").addEventListener("click", () => tour.start());
diagnostics.record("pulseops.ready", 1); development.record("reference-app", "started", { chartPoints: chart.pointCount, host: bridge.hostKind }); refreshMetrics();
