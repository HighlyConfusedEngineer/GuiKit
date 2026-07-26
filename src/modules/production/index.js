/**
 * Production tooling primitives for GuiKit.
 *
 * All services are deliberately adapter-first: secrets, transports, capture
 * engines, and sandbox hosts stay owned by the application embedding GuiKit.
 */

const hasDOM = typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const clone = (value) => value === undefined ? undefined : typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const emit = (target, type, detail = {}) => target.dispatchEvent?.(typeof CustomEvent !== "undefined" ? new CustomEvent(type, { detail }) : new Event(type));
const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;
const get = (value, path) => String(path).split(".").filter(Boolean).reduce((result, key) => result?.[key], value);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

/** Relative-luminance and WCAG contrast helpers for theme studios and CI. */
export function contrastRatio(foreground, background) {
  const parse = (color) => { const value = String(color).replace("#", ""); if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return null; const hex = value.length === 3 ? [...value].map((part) => part + part).join("") : value; const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4); return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]; };
  const left = parse(foreground); const right = parse(background); return left == null || right == null ? null : (Math.max(left, right) + .05) / (Math.min(left, right) + .05);
}

export class GuiThemeStudio extends GuiEventTarget {
  constructor({ tokens = {}, presets = {} } = {}) { super(); this.tokens = clone(tokens); this.presets = clone(presets); }
  set(name, value) { this.tokens[String(name)] = value; emit(this, "change", { tokens: clone(this.tokens) }); return this; }
  savePreset(name) { this.presets[String(name)] = clone(this.tokens); return clone(this.presets[name]); }
  applyPreset(name) { if (!this.presets[name]) throw new Error(`Unknown theme preset: ${name}`); this.tokens = clone(this.presets[name]); emit(this, "change", { tokens: clone(this.tokens), preset: name }); return clone(this.tokens); }
  audit(pairs = []) { return pairs.map(({ foreground, background, label = `${foreground}/${background}` }) => { const ratio = contrastRatio(this.tokens[foreground] ?? foreground, this.tokens[background] ?? background); return { label, ratio, aa: ratio >= 4.5, aaa: ratio >= 7 }; }); }
  exportCss(selector = ":root") { return `${selector}{${Object.entries(this.tokens).map(([name, value]) => `${name}:${value};`).join("")}}`; }
}

/** Breakpoint-aware layout model that is portable across webviews. */
export class GuiResponsiveLayout extends GuiEventTarget {
  constructor({ breakpoints = { compact: 0, medium: 640, wide: 1024 }, items = [] } = {}) { super(); this.breakpoints = clone(breakpoints); this.items = new Map(items.map((item) => [item.id, clone(item)])); }
  place(item) { if (!item?.id) throw new Error("A layout item requires an id."); const next = { visible: true, span: { compact: 12, medium: 6, wide: 4 }, ...clone(item) }; this.items.set(next.id, next); emit(this, "change", { layout: this.toJSON() }); return clone(next); }
  move(id, patch) { const item = this.items.get(id); if (!item) throw new Error(`Unknown layout item: ${id}`); Object.assign(item, clone(patch)); emit(this, "change", { layout: this.toJSON() }); return clone(item); }
  resolve(width) { const active = Object.entries(this.breakpoints).sort((a, b) => a[1] - b[1]).filter(([, min]) => width >= min).at(-1)?.[0] ?? "compact"; return { breakpoint: active, items: [...this.items.values()].filter((item) => item.visible !== false).map((item) => ({ ...clone(item), columns: item.span?.[active] ?? 12 })) }; }
  toJSON() { return { breakpoints: clone(this.breakpoints), items: [...this.items.values()].map(clone) }; }
}

/** Registry for REST/WebSocket/MQTT/SQL-host/CSV adapters and replayable mocks. */
export class GuiDataConnectorRegistry extends GuiEventTarget {
  #connectors = new Map();
  register(definition) { if (!definition?.id || typeof definition.load !== "function") throw new Error("A data connector needs id and load(context)."); if (this.#connectors.has(definition.id)) throw new Error(`Connector already registered: ${definition.id}`); this.#connectors.set(definition.id, clone({ ...definition, load: undefined })); this.#connectors.get(definition.id).load = definition.load; emit(this, "change", { id: definition.id }); return this; }
  list() { return [...this.#connectors.values()].map(({ load, ...definition }) => clone(definition)); }
  async load(id, context = {}) { const connector = this.#connectors.get(id); if (!connector) throw new Error(`Unknown connector: ${id}`); const result = await connector.load(clone(context)); emit(this, "data", { id, result: clone(result) }); return result; }
}

export function createReplayConnector(id, frames = []) {
  return { id, type: "replay", async load({ index = 0 } = {}) { return clone(frames[Math.max(0, Math.min(frames.length - 1, index))] ?? null); } };
}

/** Host-owned credential references. Values are never retained in the core. */
export class GuiCredentialVault extends GuiEventTarget {
  constructor(adapter) { super(); if (!adapter?.get || !adapter?.set) throw new Error("Credential vault requires host get/set adapter methods."); this.adapter = adapter; }
  async set(reference, value, options = {}) { await this.adapter.set(String(reference), value, clone(options)); emit(this, "changed", { reference: String(reference) }); }
  async get(reference, options = {}) { return this.adapter.get(String(reference), clone(options)); }
  async remove(reference) { await this.adapter.remove?.(String(reference)); emit(this, "removed", { reference: String(reference) }); }
  async test(reference, tester) { const value = await this.get(reference); return tester(value); }
}

/** Correlated, bounded telemetry for metrics, traces, logs and alert rules. */
export class GuiObservabilityHub extends GuiEventTarget {
  constructor({ limit = 500, alerts = [] } = {}) { super(); this.limit = Math.max(1, Number(limit)); this.metrics = new Map(); this.traces = []; this.alerts = clone(alerts); }
  metric(name, value, tags = {}) { const series = this.metrics.get(name) ?? []; const point = { at: Date.now(), value: Number(value), tags: clone(tags) }; series.push(point); if (series.length > this.limit) series.splice(0, series.length - this.limit); this.metrics.set(name, series); this.#evaluate(name, point); emit(this, "metric", { name, point }); return clone(point); }
  trace(name, context = {}) { const trace = { id: uid("trace"), name, startedAt: Date.now(), context: clone(context), spans: [] }; this.traces.unshift(trace); if (this.traces.length > this.limit) this.traces.length = this.limit; return { trace, span: (spanName, attributes = {}) => { const span = { id: uid("span"), name: spanName, startedAt: Date.now(), attributes: clone(attributes) }; trace.spans.push(span); return { end: (result = {}) => { span.finishedAt = Date.now(); span.duration = span.finishedAt - span.startedAt; Object.assign(span, clone(result)); return clone(span); } }; } }; }
  snapshot() { return { metrics: Object.fromEntries([...this.metrics].map(([name, points]) => [name, clone(points)])), traces: clone(this.traces) }; }
  #evaluate(name, point) { this.alerts.filter((rule) => rule.metric === name && ({ gt: point.value > rule.value, gte: point.value >= rule.value, lt: point.value < rule.value, lte: point.value <= rule.value }[rule.operator ?? "gt"])).forEach((rule) => emit(this, "alert", { rule: clone(rule), point: clone(point) })); }
}

/** Library and debugger models that can be mapped onto GuiNodeGraph host APIs. */
export class GuiNodeLibrary {
  constructor(nodes = []) { this.nodes = new Map(nodes.map((node) => [node.type, clone(node)])); }
  register(node) { if (!node?.type) throw new Error("Node library entries require a type."); this.nodes.set(node.type, clone(node)); return this; }
  create(type, patch = {}) { const definition = this.nodes.get(type); if (!definition) throw new Error(`Unknown node type: ${type}`); return { id: patch.id ?? uid("node"), type, title: definition.title ?? type, ports: clone(definition.ports ?? []), parameters: clone(definition.parameters ?? {}), ...clone(patch) }; }
  list() { return [...this.nodes.values()].map(clone); }
}

export class GuiFlowDebugger extends GuiEventTarget {
  constructor({ breakpoints = [] } = {}) { super(); this.breakpoints = new Set(breakpoints); this.events = []; this.values = new Map(); this.paused = false; }
  toggleBreakpoint(nodeId) { this.breakpoints.has(nodeId) ? this.breakpoints.delete(nodeId) : this.breakpoints.add(nodeId); return this.breakpoints.has(nodeId); }
  step(nodeId, values = {}) { const frame = { nodeId, at: Date.now(), values: clone(values), breakpoint: this.breakpoints.has(nodeId) }; this.events.push(frame); Object.entries(values).forEach(([key, value]) => this.values.set(`${nodeId}.${key}`, clone(value))); if (frame.breakpoint) { this.paused = true; emit(this, "break", frame); } else emit(this, "step", frame); return clone(frame); }
  resume() { this.paused = false; emit(this, "resume"); }
}

/** Analysis helpers for spectrum, correlated charts, and analysis-specific exports. */
export function fftMagnitude(samples) {
  const values = Array.from(samples ?? [], Number).filter(Number.isFinite); const size = values.length; if (!size) return [];
  const output = []; for (let frequency = 0; frequency <= Math.floor(size / 2); frequency += 1) { let real = 0; let imaginary = 0; for (let index = 0; index < size; index += 1) { const angle = -2 * Math.PI * frequency * index / size; real += values[index] * Math.cos(angle); imaginary += values[index] * Math.sin(angle); } output.push({ frequency, magnitude: Math.sqrt(real ** 2 + imaginary ** 2) / size }); } return output;
}

export function correlation(left, right) { const a = Array.from(left ?? [], Number); const b = Array.from(right ?? [], Number); const count = Math.min(a.length, b.length); if (!count) return null; const aMean = a.slice(0, count).reduce((sum, value) => sum + value, 0) / count; const bMean = b.slice(0, count).reduce((sum, value) => sum + value, 0) / count; const numerator = a.slice(0, count).reduce((sum, value, index) => sum + (value - aMean) * (b[index] - bMean), 0); const denominator = Math.sqrt(a.slice(0, count).reduce((sum, value) => sum + (value - aMean) ** 2, 0) * b.slice(0, count).reduce((sum, value) => sum + (value - bMean) ** 2, 0)); return denominator ? numerator / denominator : 0; }

export function exportDelimited(rows, { columns = null, delimiter = "," } = {}) { const records = Array.isArray(rows) ? rows : []; const fields = columns ?? [...new Set(records.flatMap((row) => Object.keys(row ?? {})))]; const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`; return [fields.map(cell).join(delimiter), ...records.map((row) => fields.map((field) => cell(row?.[field])).join(delimiter))].join("\n"); }

export function exportChartSvg(series, { width = 800, height = 400, stroke = "#5b5ce2" } = {}) { const points = Array.from(series ?? []); if (!points.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`; const values = points.map((point) => typeof point === "number" ? { x: 0, y: point } : point); const minX = Math.min(...values.map((point, index) => Number(point.x ?? index))); const maxX = Math.max(...values.map((point, index) => Number(point.x ?? index))); const minY = Math.min(...values.map((point) => Number(point.y))); const maxY = Math.max(...values.map((point) => Number(point.y))); const pointText = values.map((point, index) => `${((Number(point.x ?? index) - minX) / (maxX - minX || 1) * width).toFixed(2)},${(height - (Number(point.y) - minY) / (maxY - minY || 1) * height).toFixed(2)}`).join(" "); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><polyline fill="none" stroke="${stroke}" stroke-width="2" points="${pointText}"/></svg>`; }

/** Normalizes scatter, heatmap, and candlestick inputs for configured analysis charts. */
export function normalizeAnalysisDataset(type, values = []) {
  const source = Array.from(values ?? []);
  if (type === "scatter") return source.map((value, index) => ({ x: Number(value.x ?? index), y: Number(value.y), size: Number(value.size ?? 1), label: value.label }));
  if (type === "heatmap") return source.map((value) => ({ x: Number(value.x), y: Number(value.y), value: Number(value.value) }));
  if (type === "candlestick") return source.map((value, index) => ({ x: Number(value.x ?? index), open: Number(value.open), high: Number(value.high), low: Number(value.low), close: Number(value.close), volume: Number(value.volume ?? 0) }));
  throw new Error(`Unsupported analysis dataset: ${type}`);
}

/** Auditable focus/motion rules that complement the static accessibility inspector. */
export class GuiAccessibilityLab extends GuiEventTarget {
  constructor({ reducedMotion = false } = {}) { super(); this.reducedMotion = Boolean(reducedMotion); }
  focusPlan(elements) { const items = Array.from(elements ?? []).filter((item) => item.disabled !== true && item.hidden !== true); return { valid: items.every((item, index) => !item.tabIndex || item.tabIndex >= 0) && items.every((item, index) => index === 0 || !item.order || item.order >= (items[index - 1].order ?? -Infinity)), order: items.map((item) => item.id ?? item.label ?? "control") }; }
  motion(options = {}) { return this.reducedMotion ? { duration: 0, easing: "linear", disabled: true } : { duration: Math.max(0, Number(options.duration ?? 180)), easing: options.easing ?? "ease-out", disabled: false }; }
  colorVision(color, mode = "none") { const value = String(color); const matrices = { none: [1, 1, 1], protanopia: [.57, .43, 1], deuteranopia: [.63, .37, 1], tritanopia: [1, .95, .05] }; return { color: value, mode, multipliers: matrices[mode] ?? matrices.none }; }
}

/** Cache matching policy plus a tiny service-worker registration bridge. */
export class GuiCachePolicy {
  constructor(rules = []) { this.rules = clone(rules); }
  resolve(url, fallback = "network-first") { const pathname = typeof url === "string" ? url : url?.pathname ?? ""; return clone(this.rules.find((rule) => new RegExp(rule.match).test(pathname)) ?? { strategy: fallback }); }
}

export class GuiServiceWorkerBridge extends GuiEventTarget {
  constructor({ navigatorRef = globalThis.navigator } = {}) { super(); this.navigatorRef = navigatorRef; this.registration = null; }
  async register(url, options = {}) { if (!this.navigatorRef?.serviceWorker) throw new Error("Service workers are unavailable in this host."); this.registration = await this.navigatorRef.serviceWorker.register(url, options); emit(this, "registered", { scope: this.registration.scope }); return this.registration; }
  async message(payload) { const worker = this.registration?.active ?? this.navigatorRef?.serviceWorker?.controller; if (!worker) throw new Error("No active service worker."); worker.postMessage(clone(payload)); }
}

/** Offline operation queue and portable project snapshots. */
export class GuiOfflineSyncQueue extends GuiEventTarget {
  constructor({ storage = null, key = "guikit-sync", limit = 1_000 } = {}) { super(); this.storage = storage; this.key = key; this.limit = limit; this.operations = []; }
  async restore() { this.operations = clone(await this.storage?.get?.(this.key) ?? []); return clone(this.operations); }
  async enqueue(operation) { this.operations.push({ id: operation.id ?? uid("op"), at: Date.now(), ...clone(operation) }); if (this.operations.length > this.limit) this.operations.splice(0, this.operations.length - this.limit); await this.#persist(); emit(this, "queued", { pending: this.operations.length }); return clone(this.operations.at(-1)); }
  async flush(send) { const sent = []; while (this.operations.length) { const operation = this.operations[0]; await send(clone(operation)); sent.push(this.operations.shift()); await this.#persist(); } emit(this, "flushed", { count: sent.length }); return sent; }
  snapshot(project) { return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), project: clone(project), pending: clone(this.operations) }); }
  import(snapshot) { const parsed = typeof snapshot === "string" ? JSON.parse(snapshot) : clone(snapshot); if (parsed.version !== 1) throw new Error("Unsupported project snapshot."); this.operations = clone(parsed.pending ?? []); return clone(parsed.project); }
  async #persist() { await this.storage?.set?.(this.key, clone(this.operations)); }
}

/** Conservative plugin policy for host sandbox, signatures, and compatibility checks. */
export class GuiPluginPolicy {
  constructor({ apiVersion = "1", permissions = [], verifySignature = null } = {}) { this.apiVersion = String(apiVersion); this.permissions = new Set(permissions); this.verifySignature = verifySignature; }
  async verify(manifest) { const reasons = []; if (String(manifest?.apiVersion ?? this.apiVersion) !== this.apiVersion) reasons.push("incompatible-api"); (manifest?.permissions ?? []).filter((permission) => !this.permissions.has(permission)).forEach((permission) => reasons.push(`denied:${permission}`)); if (this.verifySignature && !await this.verifySignature(manifest)) reasons.push("invalid-signature"); return { valid: reasons.length === 0, reasons, sandbox: manifest?.sandbox ?? "iframe" }; }
  scaffold({ id, name, version = "0.1.0" }) { return { id, name, version, apiVersion: this.apiVersion, sandbox: "iframe", permissions: [], contributions: { commands: [], panels: [], nodes: [] } }; }
}

/** Deterministic visual-test matrix and image-comparison contract. */
export class GuiVisualRegressionSuite extends GuiEventTarget {
  constructor({ viewports = [375, 1024, 1440], themes = ["light", "dark"], locales = ["en"] } = {}) { super(); this.viewports = viewports; this.themes = themes; this.locales = locales; this.baselines = new Map(); }
  matrix(component) { return this.viewports.flatMap((width) => this.themes.flatMap((theme) => this.locales.map((locale) => ({ id: `${component}:${width}:${theme}:${locale}`, component, width, theme, locale })))); }
  baseline(id, image) { this.baselines.set(id, image); }
  async compare(id, image, comparator) { const baseline = this.baselines.get(id); if (!baseline) return { id, status: "missing-baseline", diff: null }; const diff = await comparator(baseline, image); const result = { id, status: diff?.passed ? "passed" : "failed", ...clone(diff) }; emit(this, "result", result); return result; }
}

/** Size budgets, optional-element registration, and asset-manifest checks for CI. */
export class GuiProductionOptimizer extends GuiEventTarget {
  constructor({ budgets = {} } = {}) { super(); this.budgets = new Map(Object.entries(budgets)); this.elements = new Map(); }
  setBudget(asset, bytes) { this.budgets.set(String(asset), Number(bytes)); return this; }
  evaluateAssets(assets) { return Object.entries(assets ?? {}).map(([asset, bytes]) => ({ asset, bytes: Number(bytes), budget: this.budgets.get(asset) ?? null, passed: !this.budgets.has(asset) || Number(bytes) <= this.budgets.get(asset) })); }
  registerLazyElement(name, loader) { if (typeof loader !== "function") throw new TypeError("Lazy element loader must be a function."); this.elements.set(name, loader); return this; }
  async loadElement(name) { if (globalThis.customElements?.get(name)) return customElements.get(name); const loader = this.elements.get(name); if (!loader) throw new Error(`No lazy element registered: ${name}`); await loader(); const element = globalThis.customElements?.get(name); if (!element) throw new Error(`Lazy loader did not define ${name}`); emit(this, "elementloaded", { name }); return element; }
}

class GuiProductionSurface extends GuiElement {
  constructor() { super(); if (hasDOM) this.attachShadow({ mode: "open" }); }
  connectedCallback() { this.render(); }
  render() { if (!this.shadowRoot) return; this.shadowRoot.innerHTML = `<style>:host{display:block;font:13px/1.4 system-ui;color:var(--gui-fg,#e9eef8)}section{background:var(--gui-surface,#172030);border:1px solid var(--gui-border,#34435c);border-radius:10px;padding:12px}.muted{color:#9aa8bd}pre{white-space:pre-wrap;overflow:auto}</style>${this.content()}`; }
  content() { return "<section>Production tool</section>"; }
}
export class GuiThemeStudioEditor extends GuiProductionSurface { constructor() { super(); this.studio = new GuiThemeStudio({ tokens: { "--gui-accent": "#5b5ce2", "--gui-surface": "#172030" } }); } content() { return `<section><strong>Theme studio</strong><div class="muted">Token presets, CSS export, and contrast audit</div><pre>${escapeHtml(this.studio.exportCss())}</pre></section>`; } }
export class GuiLayoutDesigner extends GuiProductionSurface { constructor() { super(); this.layout = new GuiResponsiveLayout({ items: [{ id: "chart", span: { compact: 12, medium: 12, wide: 8 } }, { id: "inspector", span: { compact: 12, medium: 12, wide: 4 } }] }); } content() { return `<section><strong>Layout designer</strong><div class="muted">${escapeHtml(JSON.stringify(this.layout.resolve(1280), null, 2))}</div></section>`; } }
export class GuiConnectorManager extends GuiProductionSurface { constructor() { super(); this.connectors = new GuiDataConnectorRegistry(); } content() { return `<section><strong>Data connectors</strong><div class="muted">REST · WebSocket · MQTT · SQL host bridge · CSV · replay mocks</div></section>`; } }
export class GuiObservabilityDashboard extends GuiProductionSurface { constructor() { super(); this.hub = new GuiObservabilityHub(); } content() { return `<section><strong>Observability</strong><div class="muted">Bounded metrics, traces, and alert rules</div><pre>${escapeHtml(JSON.stringify(this.hub.snapshot(), null, 2))}</pre></section>`; } }
export class GuiVisualRegressionPanel extends GuiProductionSurface { constructor() { super(); this.suite = new GuiVisualRegressionSuite(); } content() { return `<section><strong>Visual regression matrix</strong><div class="muted">${this.suite.matrix("dashboard").length} deterministic viewport/theme/locale cases</div></section>`; } }

const definitions = [["gui-theme-studio", GuiThemeStudioEditor], ["gui-layout-designer", GuiLayoutDesigner], ["gui-connector-manager", GuiConnectorManager], ["gui-observability-dashboard", GuiObservabilityDashboard], ["gui-visual-regression-panel", GuiVisualRegressionPanel]];
if (hasDOM && globalThis.customElements) definitions.forEach(([name, element]) => { if (!customElements.get(name)) customElements.define(name, element); });

export const productionModule = { id: "production", version: "1.0.0", description: "Production hardening: themes, layouts, connectors, observability, offline sync, plugin policy, visual regression, and optimization.", dependencies: ["core"], elements: definitions.map(([name]) => name) };
