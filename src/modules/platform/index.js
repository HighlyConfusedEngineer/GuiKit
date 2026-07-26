/**
 * Application platform primitives.
 *
 * This module intentionally contains contracts and local implementations, not
 * vendor SDKs. Hosts can attach filesystem, collaboration, AI, and plugin
 * adapters without making a browser-only GuiKit build depend on them.
 */

const hasDOM = typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};
const GuiEventTarget = typeof EventTarget !== "undefined" ? EventTarget : class {};

function event(type, detail = {}) {
  if (typeof CustomEvent !== "undefined") return new CustomEvent(type, { detail, cancelable: true });
  const result = new Event(type, { cancelable: true });
  Object.defineProperty(result, "detail", { value: detail });
  return result;
}

function copy(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function getPath(value, path) {
  return String(path).split(".").filter(Boolean).reduce((current, key) => current?.[key], value);
}

function setPath(value, path, next) {
  const parts = String(path).split(".").filter(Boolean);
  const target = copy(value ?? {});
  let cursor = target;
  for (const key of parts.slice(0, -1)) cursor = cursor[key] ??= {};
  if (parts.length) cursor[parts.at(-1)] = copy(next);
  return target;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

/** In-memory file adapter useful in tests, demos, and browser-only tools. */
export class GuiMemoryFileAdapter {
  #files = new Map();

  constructor(files = {}) { Object.entries(files).forEach(([path, value]) => this.#files.set(path, String(value))); }
  async list() { return [...this.#files.keys()].sort().map((path) => ({ path, name: path.split("/").at(-1) })); }
  async read(path) { if (!this.#files.has(path)) throw new Error(`File not found: ${path}`); return this.#files.get(path); }
  async write(path, content) { this.#files.set(path, String(content)); return { path }; }
  async remove(path) { return this.#files.delete(path); }
  async rename(from, to) { const content = await this.read(from); this.#files.delete(from); this.#files.set(to, content); return { path: to }; }
}

/** A host-adapter workspace with explicit dirty state and file lifecycle. */
export class GuiFileWorkspace extends GuiEventTarget {
  #adapter;
  #files = new Map();
  #activePath = null;

  constructor({ adapter = new GuiMemoryFileAdapter() } = {}) { super(); this.#adapter = adapter; }
  get activePath() { return this.#activePath; }
  get activeFile() { return this.#activePath ? this.#files.get(this.#activePath) ?? null : null; }
  get files() { return [...this.#files.values()].map(copy); }
  async refresh() { const listed = await this.#adapter.list(); this.dispatchEvent(event("fileschange", { files: listed })); return listed; }
  async open(path) { const content = await this.#adapter.read(path); const file = { path, content, dirty: false, openedAt: Date.now() }; this.#files.set(path, file); this.#activePath = path; this.dispatchEvent(event("open", { file: copy(file) })); return copy(file); }
  create(path, content = "") { const file = { path, content: String(content), dirty: true, openedAt: Date.now() }; this.#files.set(path, file); this.#activePath = path; this.dispatchEvent(event("open", { file: copy(file) })); return copy(file); }
  update(path, content) { const file = this.#files.get(path); if (!file) throw new Error(`Open the file before updating it: ${path}`); file.content = String(content); file.dirty = true; this.dispatchEvent(event("change", { file: copy(file) })); return copy(file); }
  async save(path = this.#activePath) { const file = this.#files.get(path); if (!file) throw new Error("No open file to save."); await this.#adapter.write(path, file.content); file.dirty = false; this.dispatchEvent(event("save", { file: copy(file) })); return copy(file); }
  async rename(from, to) { if (this.#adapter.rename) await this.#adapter.rename(from, to); else { await this.#adapter.write(to, await this.#adapter.read(from)); await this.#adapter.remove(from); }
    const file = this.#files.get(from); if (file) { this.#files.delete(from); file.path = to; this.#files.set(to, file); } if (this.#activePath === from) this.#activePath = to;
    this.dispatchEvent(event("rename", { from, to })); return to; }
  async remove(path) { await this.#adapter.remove(path); this.#files.delete(path); if (this.#activePath === path) this.#activePath = null; this.dispatchEvent(event("remove", { path })); }
}

/** Transport-neutral collaboration session. Adapters expose send(operation) and optionally subscribe(listener). */
export class GuiCollaborationSession extends GuiEventTarget {
  #adapter = null;
  #state;
  #peers = new Map();
  #comments = new Map();
  #queued = [];
  #unsubscribe = null;
  #online = false;

  constructor({ clientId = globalThis.crypto?.randomUUID?.() ?? `client-${Date.now()}`, state = {} } = {}) { super(); this.clientId = clientId; this.#state = copy(state); }
  get online() { return this.#online; }
  get state() { return copy(this.#state); }
  get peers() { return [...this.#peers.values()].map(copy); }
  get comments() { return [...this.#comments.values()].map(copy); }
  connect(adapter) { this.disconnect(); this.#adapter = adapter; this.#online = true; this.#unsubscribe = adapter?.subscribe?.((operation) => this.receive(operation)) ?? null; this.#queued.splice(0).forEach((operation) => adapter?.send?.(operation)); this.dispatchEvent(event("connectionchange", { online: true })); }
  disconnect() { this.#unsubscribe?.(); this.#unsubscribe = null; this.#adapter = null; if (this.#online) this.dispatchEvent(event("connectionchange", { online: false })); this.#online = false; }
  apply({ type = "set", path, value, ...rest }) { const operation = { id: `${this.clientId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`, clientId: this.clientId, type, path, value: copy(value), ...rest }; this.#apply(operation); if (this.#online && this.#adapter?.send) this.#adapter.send(operation); else this.#queued.push(operation); return operation; }
  setPresence(presence) { return this.apply({ type: "presence", presence: { ...presence, clientId: this.clientId, updatedAt: Date.now() } }); }
  addComment(comment) { return this.apply({ type: "comment", comment: { id: comment.id ?? `comment-${Date.now()}`, ...comment, authorId: comment.authorId ?? this.clientId, createdAt: comment.createdAt ?? Date.now() } }); }
  receive(operation) { if (!operation || operation.clientId === this.clientId) return; this.#apply(operation); }
  #apply(operation) { if (operation.type === "set") this.#state = setPath(this.#state, operation.path, operation.value); if (operation.type === "presence") this.#peers.set(operation.presence.clientId, copy(operation.presence)); if (operation.type === "comment") this.#comments.set(operation.comment.id, copy(operation.comment)); this.dispatchEvent(event("operation", { operation: copy(operation), state: this.state })); }
}

export function summarizeTable(rows, columns = null) {
  const records = Array.isArray(rows) ? rows : [];
  const keys = columns ?? [...new Set(records.flatMap((row) => Object.keys(row ?? {})))];
  return Object.fromEntries(keys.map((key) => { const values = records.map((row) => Number(row?.[key])).filter(Number.isFinite); const sum = values.reduce((total, value) => total + value, 0); return [key, { count: values.length, missing: records.length - values.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, sum, mean: values.length ? sum / values.length : null }]; }));
}

export function pivotRows(rows, { row, column, value, reduce = "sum" }) {
  const groups = new Map();
  for (const item of rows ?? []) { const rowKey = item?.[row] ?? "(empty)"; const columnKey = item?.[column] ?? "(empty)"; const key = `${rowKey}\u0000${columnKey}`; const values = groups.get(key) ?? []; values.push(Number(item?.[value]) || 0); groups.set(key, values); }
  const result = new Map();
  for (const [key, values] of groups) { const [rowKey, columnKey] = key.split("\u0000"); const target = result.get(rowKey) ?? { [row]: rowKey }; target[columnKey] = reduce === "average" ? values.reduce((a, b) => a + b, 0) / values.length : values.reduce((a, b) => a + b, 0); result.set(rowKey, target); }
  return [...result.values()];
}

export function histogram(values, { bins = 10 } = {}) {
  const numeric = (values ?? []).map(Number).filter(Number.isFinite); if (!numeric.length) return [];
  const min = Math.min(...numeric); const max = Math.max(...numeric); const width = (max - min || 1) / Math.max(1, bins);
  const output = Array.from({ length: bins }, (_, index) => ({ min: min + index * width, max: min + (index + 1) * width, count: 0 }));
  numeric.forEach((value) => { output[Math.min(bins - 1, Math.floor((value - min) / width))].count += 1; }); return output;
}

/** A serializable trigger/condition/action flow with pluggable action executor. */
export class GuiAutomationModel extends GuiEventTarget {
  constructor({ id = `flow-${Date.now()}`, name = "Untitled flow", trigger = { type: "manual" }, steps = [] } = {}) { super(); this.id = id; this.name = name; this.trigger = copy(trigger); this.steps = copy(steps); this.history = []; }
  addStep(step) { const next = { id: step.id ?? `step-${Date.now()}`, retries: 0, ...copy(step) }; this.steps.push(next); this.dispatchEvent(event("change", { flow: this.toJSON() })); return next; }
  async run(context = {}, executor = async () => undefined) { const run = { id: `run-${Date.now()}`, startedAt: Date.now(), status: "running", steps: [] }; this.history.unshift(run); this.dispatchEvent(event("runstart", { run: copy(run) }));
    try { for (const step of this.steps) { if (step.enabled === false) continue; const record = { id: step.id, status: "running", attempts: 0 }; run.steps.push(record); const limit = Number(step.retries ?? 0) + 1; let lastError; for (let attempt = 1; attempt <= limit; attempt += 1) { record.attempts = attempt; try { if (step.condition && !getPath(context, step.condition.path)) { record.status = "skipped"; break; } await executor(copy(step), context); record.status = "complete"; break; } catch (error) { lastError = error; } } if (record.status === "running") throw lastError; } run.status = "complete"; }
    catch (error) { run.status = "failed"; run.error = String(error?.message ?? error); } finally { run.finishedAt = Date.now(); this.dispatchEvent(event("runend", { run: copy(run) })); } return copy(run); }
  toJSON() { return { id: this.id, name: this.name, trigger: copy(this.trigger), steps: copy(this.steps) }; }
}

/** Provider-neutral streaming AI conversation. Providers implement stream(messages, options) or complete(messages, options). */
export class GuiAiSession extends GuiEventTarget {
  constructor({ provider = null, system = "" } = {}) { super(); this.provider = provider; this.messages = system ? [{ role: "system", content: system }] : []; }
  async send(content, options = {}) { const user = { role: "user", content: String(content) }; this.messages.push(user); this.dispatchEvent(event("message", { message: copy(user) })); const assistant = { role: "assistant", content: "", pending: true }; this.messages.push(assistant); const source = this.provider?.stream ? await this.provider.stream(copy(this.messages), options) : await this.provider?.complete?.(copy(this.messages), options);
    if (source && typeof source[Symbol.asyncIterator] === "function") for await (const chunk of source) { assistant.content += typeof chunk === "string" ? chunk : chunk.text ?? ""; this.dispatchEvent(event("stream", { message: copy(assistant) })); } else assistant.content = typeof source === "string" ? source : source?.text ?? "";
    assistant.pending = false; this.dispatchEvent(event("message", { message: copy(assistant) })); return copy(assistant); }
  requestTool(tool, input) { const request = event("toolrequest", { tool, input: copy(input) }); this.dispatchEvent(request); return !request.defaultPrevented; }
}

/** Manifest registry that keeps plugin loading and permissions under host control. */
export class GuiPluginRegistry extends GuiEventTarget {
  #plugins = new Map();
  constructor({ permissions = [] } = {}) { super(); this.permissions = new Set(permissions); }
  list() { return [...this.#plugins.values()].map(({ manifest, active }) => ({ ...copy(manifest), active })); }
  register(manifest, loader = null) { if (!manifest?.id || !manifest?.name) throw new Error("A plugin manifest requires id and name."); if (this.#plugins.has(manifest.id)) throw new Error(`Plugin already registered: ${manifest.id}`); const requested = manifest.permissions ?? []; const denied = requested.filter((permission) => !this.permissions.has(permission)); const entry = { manifest: { version: "0.0.0", contributions: {}, ...copy(manifest) }, loader, active: false, denied }; this.#plugins.set(manifest.id, entry); this.dispatchEvent(event("pluginchange", { id: manifest.id, state: "registered" })); return copy(entry.manifest); }
  async activate(id, context = {}) { const entry = this.#plugins.get(id); if (!entry) throw new Error(`Unknown plugin: ${id}`); if (entry.denied.length) throw new Error(`Plugin permissions not granted: ${entry.denied.join(", ")}`); const plugin = entry.loader ? await entry.loader() : null; await plugin?.activate?.({ registry: this, ...context }); entry.active = true; entry.instance = plugin; this.dispatchEvent(event("pluginchange", { id, state: "active" })); return plugin; }
  async deactivate(id) { const entry = this.#plugins.get(id); await entry?.instance?.deactivate?.(); if (entry) entry.active = false; this.dispatchEvent(event("pluginchange", { id, state: "inactive" })); }
}

export function inspectAccessibility(root = hasDOM ? document : null) {
  if (!root?.querySelectorAll) return { focusable: [], missingLabels: [], headingOrder: [] };
  const focusable = [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].map((element) => ({ tag: element.tagName.toLowerCase(), label: element.getAttribute("aria-label") || element.textContent?.trim() || element.id }));
  const missingLabels = [...root.querySelectorAll("input, select, textarea")].filter((element) => !element.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby")).map((element) => element.name || element.id || element.type);
  const headingOrder = [...root.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((element) => Number(element.tagName.slice(1)));
  return { focusable, missingLabels, headingOrder };
}

/** Records semantic interactions for deterministic regression scripts. */
export class GuiInteractionRecorder extends GuiEventTarget {
  constructor() { super(); this.entries = []; this.#handler = null; }
  #handler;
  record(action) { const entry = { at: Date.now(), ...copy(action) }; this.entries.push(entry); this.dispatchEvent(event("record", { entry })); return entry; }
  start(target) { this.stop(); this.#handler = (native) => this.record({ type: native.type, target: native.target?.dataset?.testid || native.target?.id || native.target?.tagName?.toLowerCase(), value: native.target?.value }); ["click", "input", "change", "keydown"].forEach((type) => target.addEventListener(type, this.#handler)); }
  stop(target = hasDOM ? document : null) { if (this.#handler && target) ["click", "input", "change", "keydown"].forEach((type) => target.removeEventListener(type, this.#handler)); this.#handler = null; }
  async replay(resolve, delay = 0) { for (const entry of this.entries) { const target = await resolve(entry.target, entry); if (!target) throw new Error(`Replay target not found: ${entry.target}`); if ("value" in target && entry.value !== undefined) target.value = entry.value; target.dispatchEvent(new Event(entry.type, { bubbles: true })); if (delay) await new Promise((done) => setTimeout(done, delay)); } }
}

export class GuiMockHostBridge {
  constructor(handlers = {}) { this.handlers = new Map(Object.entries(handlers)); this.calls = []; }
  handle(name, handler) { this.handlers.set(name, handler); return this; }
  async invoke(name, payload) { this.calls.push({ name, payload: copy(payload) }); const handler = this.handlers.get(name); if (!handler) throw new Error(`No mock handler for ${name}`); return handler(payload); }
}

export class GuiDocumentModel extends GuiEventTarget {
  constructor({ title = "Untitled document", template = "<h1>{{title}}</h1>", page = {} } = {}) { super(); this.title = title; this.template = template; this.page = { size: "A4", orientation: "portrait", margin: "18mm", ...page }; }
  render(data = {}) { return this.template.replace(/{{\s*([\w.]+)\s*}}/g, (_, path) => escapeHtml(getPath(data, path) ?? "")); }
  setTemplate(template) { this.template = String(template); this.dispatchEvent(event("change", { document: this.toJSON() })); }
  toPrintHtml(data = {}) { return `<!doctype html><html><head><style>@page { size: ${this.page.size} ${this.page.orientation}; margin: ${this.page.margin}; } body { font: 11pt system-ui; }</style></head><body>${this.render(data)}</body></html>`; }
  toJSON() { return { title: this.title, template: this.template, page: copy(this.page) }; }
}

/** Design-token model with Design Tokens Community Group / Figma Variables-compatible exchange. */
export class GuiDesignSystem extends GuiEventTarget {
  constructor({ tokens = {}, components = {} } = {}) { super(); this.tokens = copy(tokens); this.components = copy(components); }
  setToken(path, value, type = "color") { this.tokens = setPath(this.tokens, path, { $type: type, $value: value }); this.dispatchEvent(event("change", { tokens: copy(this.tokens) })); }
  getToken(path) { const token = getPath(this.tokens, path); return token?.$value ?? token; }
  exportTokens() { return copy(this.tokens); }
  importTokens(tokens) { this.tokens = copy(tokens ?? {}); this.dispatchEvent(event("change", { tokens: copy(this.tokens) })); }
  toFigmaVariables() { const variables = []; const walk = (group, prefix = []) => Object.entries(group ?? {}).forEach(([key, value]) => { if (value && typeof value === "object" && "$value" in value) variables.push({ name: [...prefix, key].join("/"), type: value.$type, value: copy(value.$value) }); else walk(value, [...prefix, key]); }); walk(this.tokens); return variables; }
}

class GuiPlatformSurface extends GuiElement {
  constructor() { super(); if (hasDOM) this.attachShadow({ mode: "open" }); }
  connectedCallback() { this.render(); }
  render() { if (!this.shadowRoot) return; this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--gui-fg,#e9eef8);font:13px/1.45 system-ui}.panel{background:var(--gui-surface,#172030);border:1px solid var(--gui-border,#34435c);border-radius:10px;padding:12px}.muted{color:var(--gui-muted,#9aa8bd)}button{background:#406bdf;border:0;border-radius:6px;color:white;padding:6px 9px;cursor:pointer}input,textarea{box-sizing:border-box;width:100%;margin:5px 0;background:#0e1521;color:inherit;border:1px solid #44526a;border-radius:5px;padding:6px}pre{white-space:pre-wrap;margin:7px 0}</style>${this.content()}`; this.bind?.(); }
  content() { return '<div class="panel">Platform surface</div>'; }
}

export class GuiCollaborationPanel extends GuiPlatformSurface { constructor() { super(); this.session = new GuiCollaborationSession(); } content() { return `<div class="panel"><strong>Collaboration</strong><div class="muted">${this.session.online ? "Connected" : "Offline queue enabled"}</div><pre>${escapeHtml(JSON.stringify(this.session.peers, null, 2))}</pre></div>`; } }
export class GuiFileExplorer extends GuiPlatformSurface { constructor() { super(); this.workspace = new GuiFileWorkspace(); } content() { return `<div class="panel"><strong>Files & workspace</strong><div class="muted">Attach a host file adapter for native or cloud storage.</div><button data-new>New file</button><pre>${escapeHtml(this.workspace.files.map((file) => `${file.dirty ? "• " : ""}${file.path}`).join("\n") || "No open files")}</pre></div>`; } bind() { this.shadowRoot.querySelector("[data-new]")?.addEventListener("click", () => { this.workspace.create(`untitled-${Date.now()}.txt`); this.render(); }); } }
export class GuiAnalysisPanel extends GuiPlatformSurface { constructor() { super(); this.rows = []; } content() { return `<div class="panel"><strong>Analysis & reporting</strong><div class="muted">Summary, pivot, histogram, and printable document primitives.</div><pre>${escapeHtml(JSON.stringify(summarizeTable(this.rows), null, 2))}</pre></div>`; } }
export class GuiAutomationDesigner extends GuiPlatformSurface { constructor() { super(); this.flow = new GuiAutomationModel(); } content() { return `<div class="panel"><strong>Automation designer</strong><div class="muted">${escapeHtml(this.flow.name)} · ${this.flow.steps.length} steps</div><button data-add>Add action</button><pre>${escapeHtml(JSON.stringify(this.flow.toJSON(), null, 2))}</pre></div>`; } bind() { this.shadowRoot.querySelector("[data-add]")?.addEventListener("click", () => { this.flow.addStep({ type: "action", action: "host.invoke" }); this.render(); }); } }
export class GuiAiPanel extends GuiPlatformSurface { constructor() { super(); this.session = new GuiAiSession(); } content() { return `<div class="panel"><strong>AI assistant</strong><div class="muted">Bring your own streaming provider and tool-approval policy.</div><textarea data-input placeholder="Ask your configured provider…"></textarea><button data-send>Send</button><pre>${escapeHtml(this.session.messages.filter((message) => message.role !== "system").map((message) => `${message.role}: ${message.content}`).join("\n"))}</pre></div>`; } bind() { this.shadowRoot.querySelector("[data-send]")?.addEventListener("click", async () => { const input = this.shadowRoot.querySelector("[data-input]"); if (input.value) { await this.session.send(input.value); this.render(); } }); } }
export class GuiPluginManager extends GuiPlatformSurface { constructor() { super(); this.registry = new GuiPluginRegistry(); } content() { return `<div class="panel"><strong>Plugins</strong><div class="muted">Manifests, permissions, contributions, and host-controlled activation.</div><pre>${escapeHtml(JSON.stringify(this.registry.list(), null, 2) || "[]")}</pre></div>`; } }
export class GuiAccessibilityInspector extends GuiPlatformSurface { content() { const result = inspectAccessibility(this.getRootNode?.() ?? null); return `<div class="panel"><strong>Accessibility inspector</strong><div class="muted">Focusable controls: ${result.focusable.length} · missing labels: ${result.missingLabels.length}</div></div>`; } }
export class GuiTestRecorder extends GuiPlatformSurface { constructor() { super(); this.recorder = new GuiInteractionRecorder(); } content() { return `<div class="panel"><strong>Interaction recorder</strong><div class="muted">${this.recorder.entries.length} captured semantic interactions</div><button data-record>Record marker</button></div>`; } bind() { this.shadowRoot.querySelector("[data-record]")?.addEventListener("click", () => { this.recorder.record({ type: "marker", target: "manual" }); this.render(); }); } }
export class GuiDocumentEditor extends GuiPlatformSurface { constructor() { super(); this.documentModel = new GuiDocumentModel(); } content() { return `<div class="panel"><strong>Document & report editor</strong><textarea data-template>${escapeHtml(this.documentModel.template)}</textarea><div class="muted">Live template fields use {{path.to.value}}.</div></div>`; } bind() { this.shadowRoot.querySelector("[data-template]")?.addEventListener("input", (input) => this.documentModel.setTemplate(input.target.value)); } }
export class GuiDesignSystemEditor extends GuiPlatformSurface { constructor() { super(); this.designSystem = new GuiDesignSystem({ tokens: { color: { accent: { $type: "color", $value: "#406bdf" } } } }); } content() { return `<div class="panel"><strong>Design-system builder</strong><div class="muted">DTCG token JSON and Figma Variables-compatible export.</div><pre>${escapeHtml(JSON.stringify(this.designSystem.exportTokens(), null, 2))}</pre></div>`; } }

const definitions = [["gui-collaboration-panel", GuiCollaborationPanel], ["gui-file-explorer", GuiFileExplorer], ["gui-analysis-panel", GuiAnalysisPanel], ["gui-automation-designer", GuiAutomationDesigner], ["gui-ai-panel", GuiAiPanel], ["gui-plugin-manager", GuiPluginManager], ["gui-accessibility-inspector", GuiAccessibilityInspector], ["gui-test-recorder", GuiTestRecorder], ["gui-document-editor", GuiDocumentEditor], ["gui-design-system-editor", GuiDesignSystemEditor]];
if (hasDOM && globalThis.customElements) definitions.forEach(([name, element]) => { if (!customElements.get(name)) customElements.define(name, element); });

export const platformModule = {
  id: "platform",
  version: "1.0.0",
  description: "Host-adapter application platform: collaboration, files, analysis, automation, AI, plugins, accessibility, testing, documents, and design tokens.",
  elements: definitions.map(([name]) => name),
};
