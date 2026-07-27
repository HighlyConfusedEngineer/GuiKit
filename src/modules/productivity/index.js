const GuiElement = globalThis.HTMLElement ?? class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

const clone = (value) => value === undefined ? undefined : structuredClone(value);
const emit = (target, type, detail, cancelable = false) => {
  if (typeof CustomEvent === "undefined") return true;
  return target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, cancelable, detail }));
};
const unique = (values) => [...new Set(values)];
const normaliseShortcut = (shortcut) => String(shortcut ?? "")
  .trim().split("+").map((part) => part.trim().toLowerCase())
  .filter(Boolean).sort((a, b) => ["ctrl", "meta", "alt", "shift"].includes(a) ? -1 : 1).join("+");

function normaliseOption(option) {
  if (option == null) throw new TypeError("A combobox option cannot be null.");
  const value = typeof option === "object" ? option.value : option;
  return {
    value: String(value),
    label: String(typeof option === "object" ? option.label ?? value : option),
    description: String(typeof option === "object" ? option.description ?? "" : ""),
    disabled: Boolean(typeof option === "object" && option.disabled),
    keywords: (typeof option === "object" ? option.keywords ?? [] : []).map(String),
  };
}

export class GuiComboboxModel extends GuiEventTarget {
  #options = [];
  #value = null;
  #multiple;
  #loader = null;
  constructor(options = {}) {
    super();
    this.#multiple = Boolean(options.multiple);
    this.setOptions(options.options ?? []);
    this.setValue(options.value ?? (this.#multiple ? [] : null));
    if (options.loader) this.setLoader(options.loader);
  }
  get multiple() { return this.#multiple; }
  get options() { return clone(this.#options); }
  get value() { return clone(this.#value); }
  setOptions(options) {
    const values = new Set();
    this.#options = options.map(normaliseOption);
    for (const option of this.#options) {
      if (values.has(option.value)) throw new Error(`Combobox option "${option.value}" is duplicated.`);
      values.add(option.value);
    }
    this.#notify("options");
  }
  setLoader(loader) {
    if (loader != null && typeof loader !== "function") throw new TypeError("A combobox loader must be a function.");
    this.#loader = loader;
  }
  async query(query = "", options = {}) {
    const text = String(query).trim().toLowerCase();
    if (this.#loader && options.remote !== false) {
      const loaded = await this.#loader(text, { signal: options.signal });
      if (Array.isArray(loaded)) this.setOptions(loaded);
    }
    return this.#options.filter((option) => !text || [option.label, option.value, option.description, ...option.keywords]
      .some((value) => value.toLowerCase().includes(text)));
  }
  setValue(value, options = {}) {
    const next = this.#multiple ? unique((value ?? []).map(String)) : (value == null || value === "" ? null : String(value));
    const selected = this.#multiple ? next : next == null ? [] : [next];
    for (const item of selected) if (!this.#options.some((option) => option.value === item)) throw new Error(`Unknown combobox value "${item}".`);
    const detail = { value: clone(next), previous: this.value, source: options.source ?? "api" };
    if (!emit(this, "gui:combobox-value-request", detail, true)) return false;
    this.#value = next;
    this.#notify("value", detail);
    return true;
  }
  toggle(value, options) {
    if (!this.#multiple) return this.setValue(value, options);
    const next = this.#value.includes(String(value)) ? this.#value.filter((item) => item !== String(value)) : [...this.#value, String(value)];
    return this.setValue(next, options);
  }
  #notify(operation, detail = {}) { emit(this, "gui:combobox-change", { operation, value: this.value, ...detail }); }
}

function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}
function normaliseEvent(event) {
  if (!event?.id || !event.start) throw new TypeError("Schedule events require id and start.");
  const start = new Date(event.start);
  const end = new Date(event.end ?? event.start);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) throw new RangeError("Schedule event dates are invalid.");
  return { id: String(event.id), title: String(event.title ?? event.id), start: start.toISOString(), end: end.toISOString(), allDay: Boolean(event.allDay), data: clone(event.data ?? {}) };
}

export class GuiScheduleModel extends GuiEventTarget {
  #range = { start: "", end: "", timeZone: "UTC" };
  #events = new Map();
  constructor(options = {}) { super(); this.setRange(options.range ?? {}); this.setEvents(options.events ?? []); }
  get range() { return clone(this.#range); }
  get events() { return [...this.#events.values()].map(clone); }
  setRange(range) {
    const start = localDate(range.start ?? this.#range.start);
    const end = localDate(range.end ?? this.#range.end);
    if (start && end && end < start) throw new RangeError("A schedule range cannot end before it starts.");
    this.#range = { start, end, timeZone: String(range.timeZone ?? this.#range.timeZone ?? "UTC") };
    emit(this, "gui:schedule-change", { operation: "range", range: this.range });
  }
  setEvents(events) { this.#events.clear(); for (const event of events) this.upsert(event, { silent: true }); emit(this, "gui:schedule-change", { operation: "events", events: this.events }); }
  upsert(event, options = {}) {
    const next = normaliseEvent(event);
    const detail = { event: clone(next), previous: clone(this.#events.get(next.id)) };
    if (!options.silent && !emit(this, "gui:schedule-event-request", detail, true)) return false;
    this.#events.set(next.id, next);
    if (!options.silent) emit(this, "gui:schedule-change", { operation: "event", ...detail });
    return true;
  }
  remove(id) { const event = this.#events.get(String(id)); if (!event) return false; this.#events.delete(String(id)); emit(this, "gui:schedule-change", { operation: "remove", event: clone(event) }); return true; }
  between(start = this.#range.start, end = this.#range.end) {
    const from = new Date(`${start}T00:00:00.000Z`).valueOf(); const to = new Date(`${end}T23:59:59.999Z`).valueOf();
    return this.events.filter((event) => new Date(event.end).valueOf() >= from && new Date(event.start).valueOf() <= to).sort((a, b) => a.start.localeCompare(b.start));
  }
}

export function analysisHistogram(values, bins = 24) {
  const numbers = values.map((value) => Number(typeof value === "object" ? value.y : value)).filter(Number.isFinite);
  if (!numbers.length) return [];
  const min = Math.min(...numbers), max = Math.max(...numbers), width = (max - min || 1) / Math.max(1, bins);
  const result = Array.from({ length: Math.max(1, bins) }, (_, index) => ({ x0: min + index * width, x1: min + (index + 1) * width, count: 0 }));
  numbers.forEach((value) => result[Math.min(result.length - 1, Math.floor((value - min) / width))].count += 1);
  return result;
}

export function heatmap(values, options = {}) {
  const rows = Math.max(1, Number(options.rows) || 16), columns = Math.max(1, Number(options.columns) || 24);
  const cells = Array.from({ length: rows * columns }, (_, index) => ({ row: Math.floor(index / columns), column: index % columns, value: 0, count: 0 }));
  values.forEach((sample, index) => {
    const row = Math.max(0, Math.min(rows - 1, Number(sample.row ?? Math.floor(index / columns))));
    const column = Math.max(0, Math.min(columns - 1, Number(sample.column ?? index % columns)));
    const cell = cells[row * columns + column]; cell.value += Number(sample.value ?? sample.y ?? sample) || 0; cell.count += 1;
  });
  return cells.map((cell) => ({ ...cell, value: cell.count ? cell.value / cell.count : 0 }));
}

export class GuiAnalysisSeries extends GuiEventTarget {
  #series = new Map();
  set(id, samples, options = {}) {
    if (!id) throw new TypeError("Analysis series need an id.");
    const normalised = samples.map((sample, index) => typeof sample === "object" ? { x: Number(sample.x ?? index), y: Number(sample.y ?? sample.value) } : { x: index, y: Number(sample) }).filter((sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y));
    this.#series.set(String(id), { id: String(id), label: String(options.label ?? id), color: options.color ?? "#6c8cff", samples: normalised });
    emit(this, "gui:analysis-series-change", { id: String(id), size: normalised.length });
  }
  get(id) { const series = this.#series.get(String(id)); return series && clone(series); }
  list() { return [...this.#series.values()].map(clone); }
  remove(id) { return this.#series.delete(String(id)); }
}

function inferProperty(value, path = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) return Object.entries(value).flatMap(([key, child]) => inferProperty(child, path ? `${path}.${key}` : key));
  return [{ path, type: Array.isArray(value) ? "json" : typeof value, value: clone(value) }];
}
function readPath(target, path) { return path.split(".").reduce((value, key) => value?.[key], target); }
function writePath(target, path, value) { const parts = path.split("."); const key = parts.pop(); const parent = parts.reduce((item, part) => item[part] ??= {}, target); parent[key] = value; }

export class GuiPropertyGridModel extends GuiEventTarget {
  #value = {};
  #schema = [];
  constructor(value = {}, schema = []) { super(); this.set(value, schema); }
  get value() { return clone(this.#value); }
  get schema() { return clone(this.#schema); }
  set(value, schema = this.#schema) {
    this.#value = clone(value ?? {}); this.#schema = (schema.length ? schema : inferProperty(this.#value)).map((field) => ({ path: String(field.path), label: field.label ?? field.path, type: field.type ?? typeof field.value, readonly: Boolean(field.readonly), min: field.min, max: field.max, options: clone(field.options ?? []) }));
    emit(this, "gui:property-grid-change", { operation: "schema", value: this.value });
  }
  update(path, value, options = {}) {
    const field = this.#schema.find((candidate) => candidate.path === path); if (!field) throw new Error(`Unknown property "${path}".`); if (field.readonly) return false;
    let next = value;
    if (field.type === "number") { next = Number(value); if (!Number.isFinite(next)) throw new TypeError(`Property "${path}" must be a number.`); if (field.min != null) next = Math.max(field.min, next); if (field.max != null) next = Math.min(field.max, next); }
    if (field.type === "boolean") next = Boolean(value);
    if (field.type === "json") next = typeof value === "string" ? JSON.parse(value) : clone(value);
    const detail = { path, value: clone(next), previous: clone(readPath(this.#value, path)), source: options.source ?? "api" };
    if (!emit(this, "gui:property-change-request", detail, true)) return false;
    writePath(this.#value, path, next); emit(this, "gui:property-grid-change", { operation: "value", value: this.value, ...detail }); return true;
  }
}

function normaliseFile(file) { return { id: String(file.id ?? `${file.name}:${file.size}:${file.lastModified ?? 0}`), name: String(file.name), size: Math.max(0, Number(file.size) || 0), type: String(file.type ?? ""), file, progress: 0, status: "queued", offset: 0, error: null }; }
export class GuiUploadQueue extends GuiEventTarget {
  #items = new Map();
  #options;
  constructor(options = {}) { super(); this.#options = { accept: options.accept ?? [], maxFiles: options.maxFiles ?? Infinity, maxSize: options.maxSize ?? Infinity }; }
  get items() { return [...this.#items.values()].map(({ file, ...item }) => clone(item)); }
  add(files) {
    const accepted = [];
    for (const raw of files ?? []) {
      if (this.#items.size >= this.#options.maxFiles) break;
      const item = normaliseFile(raw); const allowed = !this.#options.accept.length || this.#options.accept.some((type) => item.type === type || item.name.endsWith(type.replace("*", "")));
      if (!allowed || item.size > this.#options.maxSize) { item.status = "error"; item.error = allowed ? "File is too large." : "File type is not accepted."; }
      this.#items.set(item.id, item); accepted.push(clone({ ...item, file: undefined }));
    }
    emit(this, "gui:upload-change", { operation: "add", items: accepted }); return accepted;
  }
  remove(id) { const item = this.#items.get(String(id)); if (!item) return false; this.#items.delete(String(id)); emit(this, "gui:upload-change", { operation: "remove", item: clone({ ...item, file: undefined }) }); return true; }
  async upload(adapter, options = {}) {
    if (!adapter?.upload) throw new TypeError("An upload adapter with upload(file, context) is required.");
    const targets = options.ids ? options.ids.map((id) => this.#items.get(String(id))).filter(Boolean) : [...this.#items.values()];
    for (const item of targets) {
      if (item.status === "error" || item.status === "complete") continue;
      item.status = "uploading"; emit(this, "gui:upload-change", { operation: "start", item: clone({ ...item, file: undefined }) });
      try {
        const result = await adapter.upload(item.file, { id: item.id, offset: item.offset, signal: options.signal, onProgress: (loaded) => { item.offset = Math.max(item.offset, Number(loaded) || 0); item.progress = item.size ? Math.min(1, item.offset / item.size) : 1; emit(this, "gui:upload-progress", { id: item.id, progress: item.progress, loaded: item.offset, total: item.size }); } });
        item.status = "complete"; item.progress = 1; item.result = clone(result); emit(this, "gui:upload-change", { operation: "complete", item: clone({ ...item, file: undefined }) });
      } catch (error) { item.status = "error"; item.error = error instanceof Error ? error.message : String(error); emit(this, "gui:upload-change", { operation: "error", item: clone({ ...item, file: undefined }) }); }
    }
    return this.items;
  }
}

export class GuiNotificationCenter extends GuiEventTarget {
  #items = new Map();
  constructor(items = []) { super(); items.forEach((item) => this.push(item)); }
  get items() { return [...this.#items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone); }
  get unread() { return this.items.filter((item) => !item.read).length; }
  push(item) {
    const id = String(item.id ?? globalThis.crypto?.randomUUID?.() ?? `notification-${Date.now()}-${Math.random()}`);
    const next = { id, title: String(item.title ?? "Notification"), message: String(item.message ?? ""), level: item.level ?? "info", group: String(item.group ?? "general"), read: Boolean(item.read), createdAt: item.createdAt ?? new Date().toISOString(), data: clone(item.data ?? {}) };
    this.#items.set(id, next); emit(this, "gui:notification-change", { operation: "push", notification: clone(next), unread: this.unread }); return id;
  }
  markRead(ids) { for (const id of ids ?? this.#items.keys()) { const item = this.#items.get(String(id)); if (item) item.read = true; } emit(this, "gui:notification-change", { operation: "read", unread: this.unread }); }
  remove(id) { const result = this.#items.delete(String(id)); if (result) emit(this, "gui:notification-change", { operation: "remove", unread: this.unread }); return result; }
  clear(options = {}) { for (const item of this.#items.values()) if (!options.unreadOnly || !item.read) this.#items.delete(item.id); emit(this, "gui:notification-change", { operation: "clear", unread: this.unread }); }
  toJSON() { return { items: this.items }; }
}

export class GuiShortcutProfiles extends GuiEventTarget {
  #profiles = new Map(); #active = "default";
  constructor(profiles = { default: {} }) { super(); for (const [id, bindings] of Object.entries(profiles)) this.save(id, bindings); }
  get active() { return this.#active; }
  list() { return [...this.#profiles.keys()]; }
  bindings(id = this.#active) { return clone(this.#profiles.get(id) ?? {}); }
  save(id, bindings) {
    const next = {}; const used = new Map();
    for (const [command, shortcut] of Object.entries(bindings ?? {})) { const value = normaliseShortcut(shortcut); if (!value) continue; if (used.has(value)) throw new Error(`Shortcut "${value}" is already assigned to "${used.get(value)}".`); used.set(value, command); next[String(command)] = value; }
    this.#profiles.set(String(id), next); emit(this, "gui:shortcut-profile-change", { operation: "save", id: String(id), bindings: clone(next) });
  }
  activate(id, registry) { if (!this.#profiles.has(String(id))) throw new Error(`Unknown shortcut profile "${id}".`); this.#active = String(id); if (registry) this.apply(registry); emit(this, "gui:shortcut-profile-change", { operation: "activate", id: this.#active, bindings: this.bindings() }); }
  apply(registry) { if (!registry?.bind) throw new TypeError("A command registry is required."); const bindings = this.bindings(); Object.entries(bindings).forEach(([command, shortcut]) => registry.bind(command, shortcut)); return bindings; }
  toJSON() { return { active: this.#active, profiles: Object.fromEntries([...this.#profiles].map(([id, bindings]) => [id, clone(bindings)])) }; }
}

const STYLES = `:host{display:block;color:var(--gui-text,#e5e7eb);font:inherit}.shell{border:1px solid var(--gui-border,#334155);border-radius:.65rem;background:var(--gui-surface,#111827);padding:.65rem}.row{display:flex;gap:.5rem;align-items:center}.row input,.row select{min-width:0;flex:1;padding:.5rem;color:inherit;background:var(--gui-surface-raised,#172033);border:1px solid var(--gui-border,#334155);border-radius:.4rem;font:inherit}button{font:inherit;color:inherit;background:transparent;border:1px solid var(--gui-border,#334155);border-radius:.4rem;padding:.4rem .6rem;cursor:pointer}.list{max-height:15rem;overflow:auto;margin-top:.5rem}.item{display:grid;width:100%;grid-template-columns:1fr auto;text-align:left;border:0;border-radius:0}.item[aria-selected=true]{background:color-mix(in srgb,var(--gui-accent,#6c8cff) 22%,transparent)}small{display:block;color:var(--gui-text-muted,#94a3b8)}.chips{display:flex;flex-wrap:wrap;gap:.3rem}.chip{font-size:.78rem;padding:.15rem .4rem;border-radius:99px;background:var(--gui-surface-raised,#172033)}.grid{display:grid;gap:.5rem}.events{display:grid;gap:.35rem;max-height:20rem;overflow:auto}.event{padding:.5rem;border-left:3px solid var(--gui-accent,#6c8cff);background:var(--gui-surface-raised,#172033)}svg{width:100%;min-height:12rem;background:var(--gui-surface-raised,#172033);border-radius:.4rem}.drop{min-height:8rem;display:grid;place-items:center;border:2px dashed var(--gui-border,#334155);border-radius:.5rem;text-align:center}.drop.drag{border-color:var(--gui-accent,#6c8cff);background:color-mix(in srgb,var(--gui-accent,#6c8cff) 10%,transparent)}progress{width:100%}.notification{display:grid;grid-template-columns:1fr auto;gap:.35rem;padding:.55rem;border-bottom:1px solid var(--gui-border,#334155)}.notification[data-read=false]{border-left:3px solid var(--gui-accent,#6c8cff)}.property{display:grid;grid-template-columns:minmax(8rem,.8fr) minmax(0,1.2fr);gap:.6rem;align-items:center}.property input,.property select,.property textarea{box-sizing:border-box;width:100%;padding:.4rem;color:inherit;background:var(--gui-surface-raised,#172033);border:1px solid var(--gui-border,#334155);border-radius:.35rem;font:inherit}.property textarea{min-height:4rem}`;
function shadow(host) { if (!host.shadowRoot) host.attachShadow({ mode: "open" }); return host.shadowRoot; }
function create(host, body) { const root = shadow(host); root.innerHTML = `<style>${STYLES}</style>${body}`; return root; }

export class GuiCombobox extends GuiElement {
  #model = new GuiComboboxModel(); #root; #query = ""; #active = 0;
  constructor() { super(); this.#root = create(this, `<div class="shell"><div class="chips"></div><div class="row"><input role="combobox" aria-expanded="true" aria-autocomplete="list"><button type="button" data-clear>Clear</button></div><div class="list" role="listbox"></div></div>`); this.#root.addEventListener("input", (event) => { if (event.target.matches("input")) { this.#query = event.target.value; void this.render(); } }); this.#root.addEventListener("click", (event) => { const option = event.target.closest("[data-value]"); if (option) this.#model.toggle(option.dataset.value, { source: "pointer" }); if (event.target.closest("[data-clear]")) this.#model.setValue(this.#model.multiple ? [] : null); }); this.#root.addEventListener("keydown", (event) => this.#key(event)); this.#model.addEventListener("gui:combobox-change", () => this.render()); }
  get model() { return this.#model; } set model(value) { if (!(value instanceof GuiComboboxModel)) throw new TypeError("model must be a GuiComboboxModel."); this.#model = value; this.#model.addEventListener("gui:combobox-change", () => this.render()); this.render(); }
  get value() { return this.#model.value; } set value(value) { this.#model.setValue(value); } set options(value) { this.#model.setOptions(value); } get options() { return this.#model.options; }
  connectedCallback() { if (this.hasAttribute("multiple") && !this.#model.multiple) this.#model = new GuiComboboxModel({ multiple: true, options: this.#model.options, value: [] }); this.render(); }
  async render() { const options = await this.#model.query(this.#query); const list = this.#root.querySelector(".list"), selected = this.#model.multiple ? this.value : [this.value].filter(Boolean); this.#root.querySelector(".chips").replaceChildren(...selected.map((value) => { const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = this.options.find((item) => item.value === value)?.label ?? value; return chip; })); list.replaceChildren(...options.slice(0, Number(this.getAttribute("virtual-window")) || 80).map((option, index) => { const button = document.createElement("button"); button.type = "button"; button.className = "item"; button.dataset.value = option.value; button.role = "option"; button.disabled = option.disabled; button.setAttribute("aria-selected", String(selected.includes(option.value))); button.tabIndex = index === this.#active ? 0 : -1; button.textContent = option.label; if (option.description) { const description = document.createElement("small"); description.textContent = option.description; button.append(description); } return button; })); }
  #key(event) { const items = [...this.#root.querySelectorAll("[data-value]")]; if (!items.length) return; if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); this.#active = (this.#active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[this.#active].focus(); } else if (event.key === "Enter") { const option = items[this.#active]; if (option) { event.preventDefault(); this.#model.toggle(option.dataset.value, { source: "keyboard" }); } } }
}

export class GuiDateRangePicker extends GuiElement {
  #model = new GuiScheduleModel(); #root;
  constructor() { super(); this.#root = create(this, `<div class="shell grid"><div class="row"><input data-start type="date" aria-label="Start date"><span>to</span><input data-end type="date" aria-label="End date"></div><select data-zone aria-label="Time zone"><option>UTC</option><option>Europe/Berlin</option><option>America/New_York</option><option>Asia/Tokyo</option></select></div>`); this.#root.addEventListener("change", () => this.#model.setRange({ start: this.#root.querySelector("[data-start]").value, end: this.#root.querySelector("[data-end]").value, timeZone: this.#root.querySelector("[data-zone]").value })); this.#model.addEventListener("gui:schedule-change", () => this.render()); }
  get model() { return this.#model; } set model(value) { this.#model = value; this.#model.addEventListener("gui:schedule-change", () => this.render()); this.render(); } get value() { return this.#model.range; } set value(value) { this.#model.setRange(value); } connectedCallback() { this.render(); }
  render() { const range = this.#model.range; this.#root.querySelector("[data-start]").value = range.start; this.#root.querySelector("[data-end]").value = range.end; this.#root.querySelector("[data-zone]").value = range.timeZone; }
}

export class GuiScheduler extends GuiElement {
  #model = new GuiScheduleModel(); #root;
  constructor() { super(); this.#root = create(this, `<div class="shell"><div class="row"><strong>Schedule</strong><span class="range"></span></div><div class="events"></div></div>`); this.#root.addEventListener("click", (event) => { const item = event.target.closest("[data-event]"); if (item) emit(this, "gui:schedule-select", { event: this.#model.events.find((entry) => entry.id === item.dataset.event) }); }); this.#model.addEventListener("gui:schedule-change", () => this.render()); }
  get model() { return this.#model; } set model(value) { this.#model = value; this.#model.addEventListener("gui:schedule-change", () => this.render()); this.render(); } connectedCallback() { this.render(); }
  render() { const range = this.#model.range; this.#root.querySelector(".range").textContent = `${range.start || "Any date"} – ${range.end || "Any date"} (${range.timeZone})`; const events = this.#root.querySelector(".events"); events.replaceChildren(...this.#model.between().map((event) => { const button = document.createElement("button"); button.className = "event"; button.dataset.event = event.id; button.type = "button"; button.textContent = event.title; const meta = document.createElement("small"); meta.textContent = `${event.start.slice(0, 16).replace("T", " ")} – ${event.end.slice(0, 16).replace("T", " ")}`; button.append(meta); return button; })); }
}

export class GuiAnalysisChart extends GuiElement {
  #series = new GuiAnalysisSeries(); #root;
  constructor() { super(); this.#root = create(this, `<div class="shell"><div class="row"><select aria-label="Analysis type"><option value="histogram">Histogram</option><option value="scatter">Scatter</option><option value="heatmap">Heatmap</option><option value="spectrogram">Spectrogram</option><option value="gauge">Gauge</option></select><span class="summary"></span></div><svg viewBox="0 0 100 50" role="img" aria-label="Analysis chart"></svg></div>`); this.#root.addEventListener("change", () => this.render()); this.#series.addEventListener("gui:analysis-series-change", () => this.render()); }
  get series() { return this.#series; } set series(value) { this.#series = value; this.#series.addEventListener("gui:analysis-series-change", () => this.render()); this.render(); } setData(id, samples, options) { this.#series.set(id, samples, options); } connectedCallback() { this.render(); }
  render() { const svg = this.#root.querySelector("svg"), type = this.#root.querySelector("select").value, series = this.#series.list()[0], samples = series?.samples ?? []; svg.replaceChildren(); this.#root.querySelector(".summary").textContent = `${samples.length.toLocaleString()} samples`; if (!samples.length) return; const add = (name, attrs) => { const element = document.createElementNS("http://www.w3.org/2000/svg", name); Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value)); svg.append(element); };
    if (type === "histogram") { const bins = analysisHistogram(samples, 28), max = Math.max(...bins.map((bin) => bin.count), 1); bins.forEach((bin, index) => add("rect", { x: index * (100 / bins.length), y: 48 - bin.count / max * 44, width: 100 / bins.length - .8, height: bin.count / max * 44, fill: series.color })); }
    else if (type === "heatmap" || type === "spectrogram") { const cells = heatmap(samples.map((sample, index) => ({ row: type === "spectrogram" ? Math.floor(index / 24) : sample.x % 16, column: index % 24, value: sample.y })), { rows: type === "spectrogram" ? 12 : 16, columns: 24 }), max = Math.max(...cells.map((cell) => Math.abs(cell.value)), 1); cells.forEach((cell) => add("rect", { x: cell.column * 100 / 24, y: cell.row * 50 / (type === "spectrogram" ? 12 : 16), width: 100 / 24 + .2, height: 50 / (type === "spectrogram" ? 12 : 16) + .2, fill: `hsl(${220 - Math.min(1, Math.abs(cell.value) / max) * 220} 85% 58%)` })); }
    else if (type === "gauge") { const value = samples.at(-1).y, min = Math.min(...samples.map((sample) => sample.y)), max = Math.max(...samples.map((sample) => sample.y)); add("path", { d: "M 15 42 A 35 35 0 0 1 85 42", fill: "none", stroke: "#334155", "stroke-width": "8" }); add("path", { d: "M 15 42 A 35 35 0 0 1 85 42", fill: "none", stroke: series.color, "stroke-width": "8", "stroke-dasharray": `${Math.max(4, (value - min) / (max - min || 1) * 110)} 120` }); }
    else { const maxX = Math.max(...samples.map((sample) => sample.x)), minX = Math.min(...samples.map((sample) => sample.x)), maxY = Math.max(...samples.map((sample) => sample.y)), minY = Math.min(...samples.map((sample) => sample.y)); samples.slice(-500).forEach((sample) => add("circle", { cx: 4 + (sample.x - minX) / (maxX - minX || 1) * 92, cy: 46 - (sample.y - minY) / (maxY - minY || 1) * 42, r: .8, fill: series.color })); }
  }
}

export class GuiPropertyGrid extends GuiElement {
  #model = new GuiPropertyGridModel(); #root;
  constructor() { super(); this.#root = create(this, `<div class="shell grid"></div>`); this.#root.addEventListener("change", (event) => { const control = event.target.closest("[data-path]"); if (!control) return; const field = this.#model.schema.find((candidate) => candidate.path === control.dataset.path); this.#model.update(field.path, field.type === "boolean" ? control.checked : control.value, { source: "input" }); }); this.#model.addEventListener("gui:property-grid-change", () => this.render()); }
  get model() { return this.#model; } set model(value) { this.#model = value; this.#model.addEventListener("gui:property-grid-change", () => this.render()); this.render(); } set value(value) { this.#model.set(value); } get value() { return this.#model.value; } connectedCallback() { this.render(); }
  render() { const root = this.#root.querySelector(".grid"); root.replaceChildren(...this.#model.schema.map((field) => { const row = document.createElement("label"); row.className = "property"; const name = document.createElement("span"); name.textContent = field.label; let control; const value = readPath(this.#model.value, field.path); if (field.type === "boolean") { control = document.createElement("input"); control.type = "checkbox"; control.checked = Boolean(value); } else if (field.options?.length) { control = document.createElement("select"); field.options.forEach((option) => { const item = document.createElement("option"); item.value = typeof option === "object" ? option.value : option; item.textContent = typeof option === "object" ? option.label ?? option.value : option; control.append(item); }); control.value = String(value ?? ""); } else if (field.type === "json") { control = document.createElement("textarea"); control.value = JSON.stringify(value, null, 2); } else { control = document.createElement("input"); control.type = field.type === "number" ? "number" : "text"; control.value = String(value ?? ""); if (field.min != null) control.min = field.min; if (field.max != null) control.max = field.max; } control.dataset.path = field.path; control.disabled = field.readonly; row.append(name, control); return row; })); }
}

export class GuiFileDrop extends GuiElement {
  #queue = new GuiUploadQueue(); #root;
  constructor() { super(); this.#root = create(this, `<div class="shell"><label class="drop" tabindex="0">Drop files here or choose files<input type="file" hidden multiple></label><div class="grid files"></div></div>`); const drop = this.#root.querySelector(".drop"), input = this.#root.querySelector("input"); input.addEventListener("change", () => { this.#queue.add(input.files); input.value = ""; }); drop.addEventListener("dragover", (event) => { event.preventDefault(); drop.classList.add("drag"); }); drop.addEventListener("dragleave", () => drop.classList.remove("drag")); drop.addEventListener("drop", (event) => { event.preventDefault(); drop.classList.remove("drag"); this.#queue.add(event.dataTransfer.files); }); drop.addEventListener("click", () => input.click()); this.#queue.addEventListener("gui:upload-change", () => this.render()); }
  get queue() { return this.#queue; } set queue(value) { this.#queue = value; this.#queue.addEventListener("gui:upload-change", () => this.render()); this.render(); } get files() { return this.#queue.items; } connectedCallback() { this.render(); }
  render() { const files = this.#root.querySelector(".files"); files.replaceChildren(...this.#queue.items.map((item) => { const row = document.createElement("div"); row.textContent = `${item.name} (${Math.round(item.size / 1024)} KB)`; const progress = document.createElement("progress"); progress.value = item.progress; progress.max = 1; const note = document.createElement("small"); note.textContent = item.error ?? item.status; row.append(progress, note); return row; })); }
}

export class GuiNotificationCenterElement extends GuiElement {
  #center = new GuiNotificationCenter(); #root;
  constructor() { super(); this.#root = create(this, `<div class="shell"><div class="row"><button type="button" data-mark>Mark all read</button><strong class="count"></strong></div><div class="items"></div></div>`); this.#root.addEventListener("click", (event) => { if (event.target.closest("[data-mark]")) this.#center.markRead(); const remove = event.target.closest("[data-remove]"); if (remove) this.#center.remove(remove.dataset.remove); }); this.#center.addEventListener("gui:notification-change", () => this.render()); }
  get center() { return this.#center; } set center(value) { this.#center = value; this.#center.addEventListener("gui:notification-change", () => this.render()); this.render(); } connectedCallback() { this.render(); }
  render() { this.#root.querySelector(".count").textContent = `${this.#center.unread} unread`; const items = this.#root.querySelector(".items"); items.replaceChildren(...this.#center.items.map((item) => { const row = document.createElement("article"); row.className = "notification"; row.dataset.read = String(item.read); const text = document.createElement("div"); const title = document.createElement("strong"); title.textContent = item.title; const message = document.createElement("small"); message.textContent = item.message; text.append(title, message); const remove = document.createElement("button"); remove.type = "button"; remove.dataset.remove = item.id; remove.textContent = "Dismiss"; row.append(text, remove); return row; })); }
}

export class GuiShortcutEditor extends GuiElement {
  #profiles = new GuiShortcutProfiles(); #registry; #root;
  constructor() { super(); this.#root = create(this, `<div class="shell"><div class="row"><select aria-label="Shortcut profile"></select><button type="button" data-save>Apply</button></div><div class="grid bindings"></div></div>`); this.#root.addEventListener("change", (event) => { if (event.target.matches("select")) this.#profiles.activate(event.target.value); }); this.#root.addEventListener("click", (event) => { if (event.target.closest("[data-save]") && this.#registry) this.#profiles.apply(this.#registry); }); this.#profiles.addEventListener("gui:shortcut-profile-change", () => this.render()); }
  get profiles() { return this.#profiles; } set profiles(value) { this.#profiles = value; this.#profiles.addEventListener("gui:shortcut-profile-change", () => this.render()); this.render(); } get registry() { return this.#registry; } set registry(value) { this.#registry = value; this.render(); } connectedCallback() { this.render(); }
  render() { const select = this.#root.querySelector("select"); select.replaceChildren(...this.#profiles.list().map((id) => { const option = document.createElement("option"); option.value = id; option.textContent = id; return option; })); select.value = this.#profiles.active; const bindings = this.#root.querySelector(".bindings"); bindings.replaceChildren(...Object.entries(this.#profiles.bindings()).map(([command, shortcut]) => { const row = document.createElement("label"); row.className = "property"; const name = document.createElement("span"); name.textContent = command; const value = document.createElement("input"); value.value = shortcut; value.addEventListener("change", () => { const next = this.#profiles.bindings(); next[command] = value.value; this.#profiles.save(this.#profiles.active, next); }); row.append(name, value); return row; })); }
}

export const productivityModule = Object.freeze({
  id: "productivity",
  version: "0.2.0",
  description: "Virtual selection, scheduling, advanced analysis, inspection, uploads, notification history, and shortcut profiles.",
  dependencies: ["commands"],
  components: ["gui-combobox", "gui-date-range-picker", "gui-scheduler", "gui-analysis-chart", "gui-property-grid", "gui-file-drop", "gui-notification-center", "gui-shortcut-editor"],
  setup() { return { GuiComboboxModel, GuiScheduleModel, GuiAnalysisSeries, GuiPropertyGridModel, GuiUploadQueue, GuiNotificationCenter, GuiShortcutProfiles }; },
});

if (hasDOM) [
  ["gui-combobox", GuiCombobox], ["gui-date-range-picker", GuiDateRangePicker], ["gui-scheduler", GuiScheduler], ["gui-analysis-chart", GuiAnalysisChart], ["gui-property-grid", GuiPropertyGrid], ["gui-file-drop", GuiFileDrop], ["gui-notification-center", GuiNotificationCenterElement], ["gui-shortcut-editor", GuiShortcutEditor],
].forEach(([name, constructor]) => { if (!customElements.get(name)) customElements.define(name, constructor); });
