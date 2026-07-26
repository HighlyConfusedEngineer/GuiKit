const hasDOM = typeof window !== "undefined" && typeof document !== "undefined" && typeof customElements !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};

function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function emit(target, type, detail, cancelable = false) {
  if (typeof CustomEvent === "undefined") return true;
  return target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, cancelable, detail }));
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}
function parseStructuredText(value, format = "json") {
  const text = String(value ?? "");
  if (!text.trim()) return { value: {}, error: null };
  if (format !== "json") return { value: text, error: null };
  try { return { value: JSON.parse(text), error: null }; }
  catch (error) { return { value: null, error: error.message }; }
}
export function formatStructuredText(value, format = "json") {
  if (format !== "json" || typeof value === "string") return String(value ?? "");
  return JSON.stringify(value, null, 2);
}

const BASE_STYLE = `
  :host { display:block; min-width:0; color:var(--gui-text,#e5e7eb); font:inherit; }
  *,*::before,*::after { box-sizing:border-box; }
  .surface { border:1px solid var(--gui-border,#334155); border-radius:.6rem; overflow:hidden; background:var(--gui-surface,#111827); }
  .toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:.35rem; padding:.45rem; border-bottom:1px solid var(--gui-border,#334155); background:var(--gui-surface-raised,#172033); }
  button { border:1px solid var(--gui-border,#334155); border-radius:.35rem; padding:.3rem .5rem; color:inherit; background:transparent; font:inherit; cursor:pointer; }
  button:hover,button:focus-visible { border-color:var(--gui-accent,#60a5fa); outline:0; }
  input,textarea,select { min-width:0; border:1px solid var(--gui-border,#334155); border-radius:.35rem; padding:.45rem; color:inherit; background:var(--gui-surface,#111827); font:inherit; }
  textarea { width:100%; min-height:12rem; resize:vertical; font:500 .82rem/1.5 ui-monospace,SFMono-Regular,Consolas,monospace; tab-size:2; }
  .hint,.status { color:var(--gui-text-muted,#94a3b8); font-size:.75rem; }
  .error { color:var(--gui-error,#ef4444); }
`;

/** Shared history model for editor commands and host-managed persistence. */
export class GuiEditorHistory extends GuiEventTarget {
  #past = []; #future = []; #limit;
  constructor(options = {}) { super(); this.#limit = Math.max(1, Number(options.limit) || 100); }
  get canUndo() { return this.#past.length > 0; }
  get canRedo() { return this.#future.length > 0; }
  push(value) { this.#past.push(clone(value)); if (this.#past.length > this.#limit) this.#past.shift(); this.#future = []; emit(this, "gui:editor-history", this.snapshot()); }
  undo(current) { if (!this.canUndo) return undefined; this.#future.push(clone(current)); const value = this.#past.pop(); emit(this, "gui:editor-history", this.snapshot()); return clone(value); }
  redo(current) { if (!this.canRedo) return undefined; this.#past.push(clone(current)); const value = this.#future.pop(); emit(this, "gui:editor-history", this.snapshot()); return clone(value); }
  snapshot() { return { undo: this.#past.length, redo: this.#future.length }; }
}

export class GuiCodeEditor extends GuiElement {
  #textarea; #lines; #status; #history = new GuiEditorHistory(); #language = "text";
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get value() { return this.#textarea?.value ?? this.getAttribute("value") ?? ""; }
  set value(value) { if (this.#textarea) this.#textarea.value = String(value ?? ""); else this.setAttribute("value", String(value ?? "")); this.#update(); }
  get language() { return this.#language; }
  set language(value) { this.#language = String(value ?? "text"); this.#update(); }
  focus() { this.#textarea?.focus(); }
  format() { const parsed = parseStructuredText(this.value, this.language); if (parsed.error) return false; if (this.language === "json") this.value = formatStructuredText(parsed.value); return true; }
  find(query) { const from = this.value.toLowerCase().indexOf(String(query ?? "").toLowerCase()); if (from < 0) return -1; this.#textarea?.focus(); this.#textarea?.setSelectionRange(from, from + String(query).length); return from; }
  #create() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${BASE_STYLE}.body{display:grid;grid-template-columns:3rem minmax(0,1fr)}.lines{padding:.5rem .4rem;text-align:right;user-select:none;color:var(--gui-text-muted,#94a3b8);background:color-mix(in srgb,var(--gui-surface-raised,#172033) 70%,transparent);font:500 .82rem/1.5 ui-monospace,monospace}.status{padding:.35rem .5rem;border-top:1px solid var(--gui-border,#334155)}</style><div class="surface"><div class="toolbar"><button data-action="format" title="Format document">Format</button><button data-action="undo">Undo</button><button data-action="redo">Redo</button><span class="hint"></span></div><div class="body"><pre class="lines" aria-hidden="true">1</pre><textarea spellcheck="false" aria-label="Code editor"></textarea></div><div class="status"></div></div>`;
    this.#textarea = root.querySelector("textarea"); this.#lines = root.querySelector(".lines"); this.#status = root.querySelector(".status");
    this.#textarea.value = this.getAttribute("value") ?? "";
    this.#textarea.addEventListener("input", () => { this.#history.push(this.value); this.#update(); emit(this, "gui:code-change", { value: this.value, language: this.language }); });
    this.#textarea.addEventListener("keydown", (event) => { if (event.key === "Tab") { event.preventDefault(); const start = this.#textarea.selectionStart; this.#textarea.setRangeText("  ", start, this.#textarea.selectionEnd, "end"); this.#textarea.dispatchEvent(new Event("input")); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); emit(this, "gui:code-search-request", { value: this.value }, true); } });
    root.querySelector(".toolbar").addEventListener("click", (event) => { const action = event.target.closest("button")?.dataset.action; if (action === "format") this.format(); if (action === "undo") { const value = this.#history.undo(this.value); if (value !== undefined) this.value = value; } if (action === "redo") { const value = this.#history.redo(this.value); if (value !== undefined) this.value = value; } });
    this.#update();
  }
  #update() { if (!this.#textarea) return; const lines = this.value.split("\n").length; this.#lines.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n"); const parsed = parseStructuredText(this.value, this.language); this.#status.textContent = parsed.error ? `Line data invalid: ${parsed.error}` : `${this.language} · ${lines} lines · ${this.value.length.toLocaleString()} characters`; this.#status.className = `status${parsed.error ? " error" : ""}`; this.shadowRoot.querySelector(".hint").textContent = this.language; }
}

export class GuiStructuredEditor extends GuiElement {
  #code; #tree; #mode = "tree"; #format = "json";
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get value() { return this.#code?.value ?? this.getAttribute("value") ?? "{}"; }
  set value(value) { if (this.#code) { this.#code.value = typeof value === "string" ? value : formatStructuredText(value, this.#format); this.#renderTree(); } else this.setAttribute("value", typeof value === "string" ? value : formatStructuredText(value)); }
  get data() { return parseStructuredText(this.value, this.#format).value; }
  set data(value) { this.value = value; }
  get mode() { return this.#mode; }
  set mode(value) { this.#mode = value === "text" ? "text" : "tree"; this.#renderTree(); }
  #create() {
    const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}.tree{padding:.65rem;min-height:12rem;font:500 .82rem/1.5 ui-monospace,monospace;white-space:pre-wrap}.tree[hidden],textarea[hidden]{display:none}.key{color:var(--gui-accent,#60a5fa)}.string{color:var(--gui-success,#22c55e)}.number{color:var(--gui-warning,#f59e0b)}</style><div class="surface"><div class="toolbar"><button data-mode="tree">Tree</button><button data-mode="text">Text</button><button data-action="format">Format</button><span class="status"></span></div><div class="tree" role="tree"></div><textarea aria-label="Structured document"></textarea></div>`;
    this.#code = root.querySelector("textarea"); this.#tree = root.querySelector(".tree"); this.#code.value = this.getAttribute("value") ?? "{}";
    this.#code.addEventListener("input", () => { this.#renderTree(); emit(this, "gui:structured-change", { value: this.value, data: this.data }); });
    root.querySelector(".toolbar").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; if (button.dataset.mode) this.mode = button.dataset.mode; if (button.dataset.action === "format" && this.data != null) this.value = this.data; }); this.#renderTree();
  }
  #renderTree() { if (!this.#tree) return; const parsed = parseStructuredText(this.value, this.#format); const textMode = this.#mode === "text"; this.#code.hidden = !textMode; this.#tree.hidden = textMode; const status = this.shadowRoot.querySelector(".status"); status.textContent = parsed.error ?? (textMode ? "Editable JSON" : "Expandable JSON preview"); status.className = `status${parsed.error ? " error" : ""}`; if (textMode) return; if (parsed.error) { this.#tree.textContent = parsed.error; return; } this.#tree.innerHTML = renderStructuredTree(parsed.value); }
}
function renderStructuredTree(value, depth = 0) {
  if (value == null || typeof value !== "object") return `<span class="${typeof value}">${escapeHtml(JSON.stringify(value))}</span>`;
  const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
  return `${Array.isArray(value) ? "[" : "{"}${entries.map(([key, item]) => `\n${"  ".repeat(depth + 1)}<span class="key">${escapeHtml(key)}</span>: ${renderStructuredTree(item, depth + 1)}`).join(",")}${entries.length ? `\n${"  ".repeat(depth)}` : ""}${Array.isArray(value) ? "]" : "}"}`;
}

export class GuiRichTextEditor extends GuiElement {
  #editor; #history = new GuiEditorHistory();
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get value() { return this.#editor?.innerHTML ?? this.getAttribute("value") ?? ""; }
  set value(value) { if (this.#editor) this.#editor.innerHTML = String(value ?? ""); else this.setAttribute("value", String(value ?? "")); }
  get markdown() { return this.value.replace(/<strong>(.*?)<\/strong>/g, "**$1**").replace(/<em>(.*?)<\/em>/g, "_$1_").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, ""); }
  exec(command, value = undefined) { this.#editor?.focus(); document.execCommand?.(command, false, value); this.#changed(); }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}.editor{min-height:12rem;padding:.7rem;outline:0;line-height:1.5}.editor:focus{box-shadow:inset 0 0 0 2px var(--gui-accent,#60a5fa)}</style><div class="surface"><div class="toolbar"><button data-command="bold"><b>B</b></button><button data-command="italic"><i>I</i></button><button data-command="insertUnorderedList">• List</button><button data-command="formatBlock" data-value="pre">Code</button><button data-action="undo">Undo</button><button data-action="redo">Redo</button></div><div class="editor" contenteditable="true" role="textbox" aria-multiline="true"></div></div>`; this.#editor = root.querySelector(".editor"); this.value = this.getAttribute("value") ?? "<p>Start writing…</p>"; this.#editor.addEventListener("input", () => this.#changed()); root.querySelector(".toolbar").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; if (button.dataset.command) this.exec(button.dataset.command, button.dataset.value); if (button.dataset.action === "undo") { const value = this.#history.undo(this.value); if (value !== undefined) this.value = value; } if (button.dataset.action === "redo") { const value = this.#history.redo(this.value); if (value !== undefined) this.value = value; } }); }
  #changed() { this.#history.push(this.value); emit(this, "gui:rich-text-change", { value: this.value, markdown: this.markdown }); }
}

export class GuiPropertyInspector extends GuiElement {
  #schema = []; #value = {};
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get schema() { return clone(this.#schema); }
  set schema(value) { this.#schema = clone(value ?? []); this.#render(); }
  get value() { return clone(this.#value); }
  set value(value) { this.#value = clone(value ?? {}); this.#render(); }
  reset(name) { const field = this.#schema.find((item) => item.name === name); if (!field) return false; this.#value[name] = clone(field.default); this.#render(); emit(this, "gui:property-change", { name, value: this.#value[name], object: this.value }); return true; }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}.group{padding:.65rem;border-bottom:1px solid var(--gui-border,#334155)}.field{display:grid;grid-template-columns:minmax(7rem,.8fr) minmax(0,1.2fr) auto;gap:.45rem;align-items:center;padding:.25rem 0}.field small{grid-column:2 / -1;color:var(--gui-text-muted,#94a3b8)}</style><div class="surface" role="form"></div>`; root.addEventListener("change", (event) => this.#change(event)); root.addEventListener("click", (event) => { const name = event.target.closest("[data-reset]")?.dataset.reset; if (name) this.reset(name); }); this.#render(); }
  #render() { const surface = this.shadowRoot?.querySelector(".surface"); if (!surface) return; const groups = new Map(); this.#schema.forEach((field) => { const list = groups.get(field.group ?? "Properties") ?? []; list.push(field); groups.set(field.group ?? "Properties", list); }); surface.replaceChildren(...[...groups].flatMap(([group, fields]) => { const section = document.createElement("section"); section.className = "group"; const title = document.createElement("strong"); title.textContent = group; section.append(title); fields.forEach((field) => section.append(this.#field(field))); return [section]; })); }
  #field(field) { const row = document.createElement("label"); row.className = "field"; row.append(document.createTextNode(field.label ?? field.name)); let input; const current = this.#value[field.name] ?? field.default ?? ""; if (field.type === "select") { input = document.createElement("select"); (field.options ?? []).forEach((option) => { const item = document.createElement("option"); item.value = typeof option === "object" ? option.value : option; item.textContent = typeof option === "object" ? option.label : option; item.selected = item.value === String(current); input.append(item); }); } else { input = document.createElement("input"); input.type = field.type ?? "text"; input.value = field.type === "checkbox" ? "on" : current; input.checked = field.type === "checkbox" && Boolean(current); if (field.min != null) input.min = field.min; if (field.max != null) input.max = field.max; } input.name = field.name; input.disabled = field.readOnly; row.append(input); const reset = document.createElement("button"); reset.type = "button"; reset.dataset.reset = field.name; reset.textContent = "Reset"; reset.disabled = field.default === undefined; row.append(reset); if (field.description) { const hint = document.createElement("small"); hint.textContent = field.description; row.append(hint); } return row; }
  #change(event) { const input = event.target; if (!input.name) return; const field = this.#schema.find((item) => item.name === input.name) ?? {}; let value = input.type === "checkbox" ? input.checked : input.value; if (field.type === "number" || field.type === "range") value = Number(value); this.#value[input.name] = value; emit(this, "gui:property-change", { name: input.name, value, object: this.value }); }
}

export class GuiImageEditor extends GuiElement {
  #canvas; #context; #image = null; #state = { rotate: 0, brightness: 100, contrast: 100, annotations: [] };
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  set source(value) { this.load(value); }
  get source() { return this.getAttribute("src") ?? ""; }
  get state() { return clone(this.#state); }
  async load(source) { if (!source || !hasDOM) return false; const image = new Image(); image.crossOrigin = "anonymous"; await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; }); this.#image = image; this.#draw(); emit(this, "gui:image-load", { source }); return true; }
  rotate(degrees = 90) { this.#state.rotate = (this.#state.rotate + Number(degrees)) % 360; this.#draw(); }
  addAnnotation(annotation) { this.#state.annotations.push({ id: annotation.id ?? `annotation-${this.#state.annotations.length + 1}`, x: Number(annotation.x) || 0, y: Number(annotation.y) || 0, text: String(annotation.text ?? "Note") }); this.#draw(); }
  export(type = "image/png") { return this.#canvas?.toDataURL(type); }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}canvas{display:block;width:100%;min-height:14rem;background:repeating-conic-gradient(#1f2937 0 25%,#111827 0 50%) 50%/1.25rem 1.25rem}.controls{display:flex;gap:.5rem;align-items:center}.controls input{width:7rem}</style><div class="surface"><div class="toolbar"><button data-rotate="-90">↶ Rotate</button><button data-rotate="90">Rotate ↷</button><label class="controls">Brightness <input data-filter="brightness" type="range" min="20" max="180" value="100"></label><label class="controls">Contrast <input data-filter="contrast" type="range" min="20" max="180" value="100"></label></div><canvas width="960" height="520" role="img" aria-label="Image editing canvas"></canvas></div>`; this.#canvas = root.querySelector("canvas"); this.#context = this.#canvas.getContext("2d"); root.addEventListener("click", (event) => { const degrees = event.target.closest("[data-rotate]")?.dataset.rotate; if (degrees) this.rotate(degrees); }); root.addEventListener("input", (event) => { const filter = event.target.dataset.filter; if (filter) { this.#state[filter] = Number(event.target.value); this.#draw(); } }); const src = this.getAttribute("src"); if (src) this.load(src).catch(() => {}); else this.#draw(); }
  #draw() { if (!this.#context) return; const { width, height } = this.#canvas; this.#context.clearRect(0, 0, width, height); if (!this.#image) { this.#context.fillStyle = "#94a3b8"; this.#context.textAlign = "center"; this.#context.fillText("Load an image to edit", width / 2, height / 2); return; } this.#context.save(); this.#context.filter = `brightness(${this.#state.brightness}%) contrast(${this.#state.contrast}%)`; this.#context.translate(width / 2, height / 2); this.#context.rotate(this.#state.rotate * Math.PI / 180); const scale = Math.min(width / this.#image.width, height / this.#image.height) * .92; this.#context.drawImage(this.#image, -this.#image.width * scale / 2, -this.#image.height * scale / 2, this.#image.width * scale, this.#image.height * scale); this.#context.restore(); this.#state.annotations.forEach((annotation) => { this.#context.fillStyle = "#f59e0b"; this.#context.beginPath(); this.#context.arc(annotation.x, annotation.y, 5, 0, Math.PI * 2); this.#context.fill(); this.#context.fillText(annotation.text, annotation.x + 8, annotation.y); }); emit(this, "gui:image-change", this.state); }
}

export class GuiQueryEditor extends GuiElement {
  #textarea; #parameters = []; #suggestions = [];
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get value() { return this.#textarea?.value ?? ""; } set value(value) { if (this.#textarea) this.#textarea.value = String(value ?? ""); }
  get parameters() { return clone(this.#parameters); } set parameters(value) { this.#parameters = clone(value ?? []); this.#renderParameters(); }
  get suggestions() { return clone(this.#suggestions); } set suggestions(value) { this.#suggestions = [...(value ?? [])]; this.#renderSuggestions(); }
  validate(options = {}) { const query = this.value.trim(); const error = !query ? "A query is required." : (!options.allowWrite && /\b(insert|update|delete|drop|alter)\b/i.test(query) ? "Write statements are disabled." : null); emit(this, "gui:query-validate", { valid: !error, error, query }); return { valid: !error, error }; }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}.layout{display:grid;grid-template-columns:minmax(0,1fr) 14rem;gap:.5rem;padding:.5rem}.suggestions{display:grid;align-content:start;gap:.25rem}.parameters{padding:.5rem;border-top:1px solid var(--gui-border,#334155)}.parameter{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;padding:.2rem 0}</style><div class="surface"><div class="toolbar"><button data-action="validate">Validate</button><button data-action="format">Format</button><span class="status"></span></div><div class="layout"><textarea aria-label="Query editor" placeholder="SELECT * FROM telemetry WHERE …"></textarea><div class="suggestions" aria-label="Query suggestions"></div></div><div class="parameters"></div></div>`; this.#textarea = root.querySelector("textarea"); this.#textarea.addEventListener("input", () => emit(this, "gui:query-change", { query: this.value })); root.addEventListener("click", (event) => { const action = event.target.closest("button")?.dataset.action; if (action === "validate") { const result = this.validate(); root.querySelector(".status").textContent = result.error ?? "Read-only query is valid."; } if (action === "format") this.value = this.value.replace(/\s+/g, " ").replace(/\s+(from|where|order by|group by)\s+/ig, "\n$1 "); }); this.suggestions = ["SELECT * FROM telemetry", "WHERE timestamp > :from", "ORDER BY timestamp DESC"]; this.#renderParameters(); }
  #renderSuggestions() { const node = this.shadowRoot?.querySelector(".suggestions"); if (!node) return; node.replaceChildren(...this.#suggestions.map((suggestion) => { const button = document.createElement("button"); button.type = "button"; button.textContent = suggestion; button.addEventListener("click", () => { this.value += `${this.value ? "\n" : ""}${suggestion}`; this.#textarea.dispatchEvent(new Event("input")); }); return button; })); }
  #renderParameters() { const node = this.shadowRoot?.querySelector(".parameters"); if (!node) return; node.replaceChildren(...this.#parameters.map((parameter) => { const row = document.createElement("label"); row.className = "parameter"; row.textContent = parameter.label ?? parameter.name; const input = document.createElement("input"); input.name = parameter.name; input.value = parameter.value ?? ""; input.addEventListener("change", () => emit(this, "gui:query-parameter-change", { name: parameter.name, value: input.value })); row.append(input); return row; })); }
}

export class GuiTimelineModel extends GuiEventTarget {
  #tracks = [];
  constructor(tracks = []) { super(); this.setTracks(tracks); }
  get tracks() { return clone(this.#tracks); }
  setTracks(tracks) { this.#tracks = clone(tracks ?? []).map((track, index) => ({ id: track.id ?? `track-${index + 1}`, label: track.label ?? `Track ${index + 1}`, keyframes: [...(track.keyframes ?? [])].sort((a, b) => a.time - b.time) })); emit(this, "gui:timeline-change", this.tracks); }
  addKeyframe(trackId, keyframe) { const track = this.#tracks.find((item) => item.id === trackId); if (!track) return false; track.keyframes.push({ id: keyframe.id ?? `${trackId}-${track.keyframes.length + 1}`, time: Math.max(0, Number(keyframe.time) || 0), value: clone(keyframe.value) }); track.keyframes.sort((a, b) => a.time - b.time); emit(this, "gui:timeline-change", this.tracks); return true; }
  moveKeyframe(trackId, keyframeId, time, options = {}) { const frame = this.#tracks.find((track) => track.id === trackId)?.keyframes.find((item) => item.id === keyframeId); if (!frame) return false; const snap = Math.max(0, Number(options.snap) || 0); const next = Math.max(0, Number(time) || 0); frame.time = snap ? Math.round(next / snap) * snap : next; emit(this, "gui:timeline-change", this.tracks); return true; }
}

export class GuiTimelineEditor extends GuiElement {
  #model = new GuiTimelineModel(); #playhead = 0; #zoom = 70;
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get model() { return this.#model; } set model(value) { this.#model = value instanceof GuiTimelineModel ? value : new GuiTimelineModel(value); this.#render(); }
  get playhead() { return this.#playhead; } set playhead(value) { this.#playhead = Math.max(0, Number(value) || 0); this.#render(); emit(this, "gui:timeline-playhead", { time: this.#playhead }); }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}.ruler{position:relative;height:2rem;padding-left:9rem;border-bottom:1px solid var(--gui-border,#334155);overflow:hidden}.track{display:grid;grid-template-columns:9rem minmax(20rem,1fr);min-height:2.65rem;border-bottom:1px solid var(--gui-border,#334155)}.label{padding:.65rem}.lane{position:relative;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 1px),color-mix(in srgb,var(--gui-border,#334155) 45%,transparent) calc(10% - 1px) 10%)}.key{position:absolute;top:.8rem;width:.8rem;height:.8rem;rotate:45deg;border:1px solid var(--gui-accent,#60a5fa);background:var(--gui-surface-raised,#172033);cursor:ew-resize}.playhead{position:absolute;inset:0 auto 0 9rem;width:1px;background:var(--gui-error,#ef4444);pointer-events:none}</style><div class="surface"><div class="toolbar"><button data-action="add">Add keyframe</button><label>Zoom <input type="range" min="30" max="160" value="70"></label><span class="status"></span></div><div class="ruler">0s <span class="playhead"></span></div><div class="tracks"></div></div>`; root.querySelector("input").addEventListener("input", (event) => { this.#zoom = Number(event.target.value); this.#render(); }); root.querySelector("[data-action=add]").addEventListener("click", () => { const track = this.#model.tracks[0]; if (track) this.#model.addKeyframe(track.id, { time: this.#playhead, value: 0 }); this.#render(); }); root.addEventListener("pointerdown", (event) => { const lane = event.target.closest(".lane"); if (lane && !event.target.closest(".key")) { const rect = lane.getBoundingClientRect(); this.playhead = (event.clientX - rect.left) / this.#zoom; } }); this.#model.addEventListener("gui:timeline-change", () => this.#render()); this.#render(); }
  #render() { const tracks = this.shadowRoot?.querySelector(".tracks"); if (!tracks) return; tracks.replaceChildren(...this.#model.tracks.map((track) => { const row = document.createElement("div"); row.className = "track"; const label = document.createElement("div"); label.className = "label"; label.textContent = track.label; const lane = document.createElement("div"); lane.className = "lane"; track.keyframes.forEach((keyframe) => { const key = document.createElement("button"); key.className = "key"; key.title = `${keyframe.time.toFixed(2)}s`; key.style.left = `${keyframe.time * this.#zoom}px`; key.addEventListener("pointerdown", (event) => { event.stopPropagation(); const start = event.clientX; const initial = keyframe.time; const move = (moveEvent) => this.#model.moveKeyframe(track.id, keyframe.id, initial + (moveEvent.clientX - start) / this.#zoom, { snap: .1 }); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }); lane.append(key); }); row.append(label, lane); return row; })); const playhead = this.shadowRoot.querySelector(".playhead"); playhead.style.left = `${9 * 16 + this.#playhead * this.#zoom}px`; this.shadowRoot.querySelector(".status").textContent = `${this.#model.tracks.length} tracks · ${this.#playhead.toFixed(2)}s`; }
}

function normalizeDiagramShape(shape, index = 0) {
  return { id: String(shape.id ?? `shape-${index + 1}`), label: shape.label ?? `Shape ${index + 1}`, type: shape.type ?? "process", x: Number(shape.x) || 0, y: Number(shape.y) || 0, width: Number(shape.width) || 150, height: Number(shape.height) || 70 };
}
export class GuiDiagramModel extends GuiEventTarget {
  #shapes = []; #links = [];
  constructor(data = {}) { super(); this.set(data); }
  get shapes() { return clone(this.#shapes); } get links() { return clone(this.#links); }
  set(data = {}) { this.#shapes = (data.shapes ?? []).map(normalizeDiagramShape); this.#links = clone(data.links ?? []); emit(this, "gui:diagram-change", this.toJSON()); }
  addShape(shape) { const normalized = normalizeDiagramShape(shape, this.#shapes.length); const id = normalized.id; if (this.#shapes.some((item) => item.id === id)) throw new Error(`Duplicate diagram shape "${id}".`); this.#shapes.push(normalized); emit(this, "gui:diagram-change", this.toJSON()); return id; }
  connect(from, to, options = {}) { const id = String(options.id ?? `link-${this.#links.length + 1}`); if (!this.#shapes.some((shape) => shape.id === from) || !this.#shapes.some((shape) => shape.id === to)) throw new Error("Diagram links require existing shapes."); this.#links.push({ id, from, to, label: options.label ?? "" }); emit(this, "gui:diagram-change", this.toJSON()); return id; }
  toJSON() { return { shapes: this.shapes, links: this.links }; }
}

export class GuiDiagramEditor extends GuiElement {
  #model = new GuiDiagramModel(); #svg;
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get model() { return this.#model; } set model(value) { this.#model = value instanceof GuiDiagramModel ? value : new GuiDiagramModel(value); this.#model.addEventListener("gui:diagram-change", () => this.#render()); this.#render(); }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}svg{display:block;width:100%;height:20rem;background:radial-gradient(circle at 1px 1px,color-mix(in srgb,var(--gui-border,#334155) 50%,transparent) 1px,transparent 0);background-size:1rem 1rem}.shape{cursor:move}.shape rect{fill:var(--gui-surface-raised,#172033);stroke:var(--gui-accent,#60a5fa);stroke-width:1.5}.shape text{fill:var(--gui-text,#e5e7eb);font:600 12px system-ui}</style><div class="surface"><div class="toolbar"><button data-add="process">Process</button><button data-add="decision">Decision</button><span class="status"></span></div><svg viewBox="0 0 900 420" role="img" aria-label="Diagram editor"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs><g class="links"></g><g class="shapes"></g></svg></div>`; this.#svg = root.querySelector("svg"); root.addEventListener("click", (event) => { const type = event.target.closest("[data-add]")?.dataset.add; if (type) this.#model.addShape({ type, label: type === "decision" ? "Decision" : "Process", x: 80 + this.#model.shapes.length * 35, y: 70 + this.#model.shapes.length * 25 }); }); this.model = this.#model; }
  #render() { if (!this.#svg) return; const shapes = this.#model.shapes; const byId = new Map(shapes.map((shape) => [shape.id, shape])); const links = this.#svg.querySelector(".links"); const shapeLayer = this.#svg.querySelector(".shapes"); links.replaceChildren(...this.#model.links.map((link) => { const from = byId.get(link.from); const to = byId.get(link.to); const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", `M ${from.x + from.width} ${from.y + from.height / 2} C ${(from.x + to.x) / 2} ${from.y + from.height / 2}, ${(from.x + to.x) / 2} ${to.y + to.height / 2}, ${to.x} ${to.y + to.height / 2}`); path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("marker-end", "url(#arrow)"); return path; })); shapeLayer.replaceChildren(...shapes.map((shape) => { const group = document.createElementNS("http://www.w3.org/2000/svg", "g"); group.classList.add("shape"); group.dataset.id = shape.id; group.setAttribute("transform", `translate(${shape.x} ${shape.y})`); const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); rect.setAttribute("width", shape.width); rect.setAttribute("height", shape.height); rect.setAttribute("rx", shape.type === "decision" ? "22" : "8"); const text = document.createElementNS("http://www.w3.org/2000/svg", "text"); text.setAttribute("x", "12"); text.setAttribute("y", "38"); text.textContent = shape.label; group.append(rect, text); group.addEventListener("pointerdown", (event) => { const start = { x: event.clientX, y: event.clientY, sx: shape.x, sy: shape.y }; const move = (moveEvent) => { shape.x = start.sx + moveEvent.clientX - start.x; shape.y = start.sy + moveEvent.clientY - start.y; this.#render(); }; const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); emit(this, "gui:diagram-change", this.#model.toJSON()); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }); return group; })); this.shadowRoot.querySelector(".status").textContent = `${shapes.length} shapes · ${this.#model.links.length} links`; }
}

export class GuiThemeEditor extends GuiElement {
  #tokens = {};
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get tokens() { return clone(this.#tokens); }
  set tokens(value) { this.#tokens = clone(value ?? {}); this.#render(); }
  apply(target = document.documentElement) { Object.entries(this.#tokens).forEach(([name, value]) => target.style.setProperty(name.startsWith("--") ? name : `--${name}`, value)); emit(this, "gui:theme-token-apply", { tokens: this.tokens }); }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}.tokens{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.5rem;padding:.65rem}.token{display:grid;grid-template-columns:1fr auto;gap:.4rem;align-items:center}.preview{margin:.65rem;padding:.75rem;border-radius:.45rem;background:var(--gui-accent,#60a5fa);color:white}</style><div class="surface"><div class="toolbar"><button data-action="apply">Apply tokens</button><span class="status"></span></div><div class="tokens"></div><div class="preview">Live token preview</div></div>`; root.addEventListener("click", (event) => { if (event.target.closest("[data-action=apply]")) this.apply(); }); root.addEventListener("input", (event) => { const name = event.target.name; if (!name) return; this.#tokens[name] = event.target.value; root.querySelector(".preview").style.background = this.#tokens["--gui-accent"] ?? this.#tokens["gui-accent"] ?? "#60a5fa"; emit(this, "gui:theme-token-change", { name, value: event.target.value, tokens: this.tokens }); }); this.tokens = { "--gui-accent": "#5b5ce2", "--gui-radius-md": "0.6rem", "--gui-font": "ui-sans-serif, system-ui" }; }
  #render() { const node = this.shadowRoot?.querySelector(".tokens"); if (!node) return; node.replaceChildren(...Object.entries(this.#tokens).map(([name, value]) => { const label = document.createElement("label"); label.className = "token"; label.append(document.createTextNode(name)); const input = document.createElement("input"); input.name = name; input.value = value; input.type = /^#[\da-f]{3,8}$/i.test(value) ? "color" : "text"; label.append(input); return label; })); this.shadowRoot.querySelector(".status").textContent = `${Object.keys(this.#tokens).length} tokens`; }
}

function flattenCatalog(catalog, prefix = "", output = {}) { Object.entries(catalog ?? {}).forEach(([key, value]) => { const path = prefix ? `${prefix}.${key}` : key; if (value && typeof value === "object") flattenCatalog(value, path, output); else output[path] = String(value); }); return output; }
export class GuiTranslationEditor extends GuiElement {
  #catalogs = {}; #sourceLocale = "en"; #targetLocale = "de";
  connectedCallback() { if (!this.shadowRoot) this.#create(); }
  get catalogs() { return clone(this.#catalogs); } set catalogs(value) { this.#catalogs = clone(value ?? {}); this.#render(); }
  setLocales(source, target) { this.#sourceLocale = source; this.#targetLocale = target; this.#render(); }
  missing() { const source = flattenCatalog(this.#catalogs[this.#sourceLocale]); const target = flattenCatalog(this.#catalogs[this.#targetLocale]); return Object.keys(source).filter((key) => !target[key]); }
  #create() { const root = this.attachShadow({ mode: "open" }); root.innerHTML = `<style>${BASE_STYLE}table{width:100%;border-collapse:collapse;font-size:.82rem}th,td{padding:.45rem;text-align:left;border-bottom:1px solid var(--gui-border,#334155);vertical-align:top}td input{width:100%}.missing{color:var(--gui-warning,#f59e0b)}</style><div class="surface"><div class="toolbar"><label>Source <select data-locale="source"></select></label><label>Target <select data-locale="target"></select></label><span class="status"></span></div><table><thead><tr><th>Key</th><th>Source</th><th>Translation</th></tr></thead><tbody></tbody></table></div>`; root.addEventListener("change", (event) => { const select = event.target.closest("[data-locale]"); if (select) { if (select.dataset.locale === "source") this.#sourceLocale = select.value; else this.#targetLocale = select.value; this.#render(); } const input = event.target.closest("input[data-key]"); if (input) { const target = flattenCatalog(this.#catalogs[this.#targetLocale]); target[input.dataset.key] = input.value; this.#catalogs[this.#targetLocale] = expandCatalog(target); emit(this, "gui:translation-change", { locale: this.#targetLocale, key: input.dataset.key, value: input.value, catalogs: this.catalogs }); } }); this.#render(); }
  #render() { const root = this.shadowRoot; if (!root) return; const locales = Object.keys(this.#catalogs); ["source", "target"].forEach((kind) => { const select = root.querySelector(`[data-locale=${kind}]`); const current = kind === "source" ? this.#sourceLocale : this.#targetLocale; select.replaceChildren(...locales.map((locale) => { const option = document.createElement("option"); option.value = locale; option.textContent = locale; option.selected = locale === current; return option; })); }); const source = flattenCatalog(this.#catalogs[this.#sourceLocale]); const target = flattenCatalog(this.#catalogs[this.#targetLocale]); const body = root.querySelector("tbody"); body.replaceChildren(...Object.keys(source).sort().map((key) => { const row = document.createElement("tr"); const missing = target[key] == null || target[key] === ""; row.innerHTML = `<td class="${missing ? "missing" : ""}">${escapeHtml(key)}</td><td>${escapeHtml(source[key])}</td><td><input data-key="${escapeHtml(key)}" value="${escapeHtml(target[key] ?? "")}" aria-label="Translation for ${escapeHtml(key)}"></td>`; return row; })); root.querySelector(".status").textContent = `${this.missing().length} missing keys`; }
}
function expandCatalog(flat) { const root = {}; Object.entries(flat).forEach(([path, value]) => { const parts = path.split("."); let target = root; parts.forEach((part, index) => { if (index === parts.length - 1) target[part] = value; else target = target[part] ??= {}; }); }); return root; }

export const editorsModule = Object.freeze({
  id: "editors", version: "0.1.0", description: "Composable rich text, code, structured data, visual, and domain editors.", dependencies: ["core"],
  components: ["gui-rich-text-editor", "gui-code-editor", "gui-structured-editor", "gui-property-inspector", "gui-image-editor", "gui-query-editor", "gui-timeline-editor", "gui-diagram-editor", "gui-theme-editor", "gui-translation-editor"],
  setup() { return { GuiCodeEditor, GuiStructuredEditor, GuiRichTextEditor, GuiPropertyInspector, GuiImageEditor, GuiQueryEditor, GuiTimelineEditor, GuiTimelineModel, GuiDiagramEditor, GuiDiagramModel, GuiThemeEditor, GuiTranslationEditor }; },
});
if (hasDOM) {
  const elements = [["gui-rich-text-editor", GuiRichTextEditor], ["gui-code-editor", GuiCodeEditor], ["gui-structured-editor", GuiStructuredEditor], ["gui-property-inspector", GuiPropertyInspector], ["gui-image-editor", GuiImageEditor], ["gui-query-editor", GuiQueryEditor], ["gui-timeline-editor", GuiTimelineEditor], ["gui-diagram-editor", GuiDiagramEditor], ["gui-theme-editor", GuiThemeEditor], ["gui-translation-editor", GuiTranslationEditor]];
  elements.forEach(([tag, element]) => { if (!customElements.get(tag)) customElements.define(tag, element); });
}
