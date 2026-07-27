const GuiElement = globalThis.HTMLElement ?? class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";
const clone = (value) => value === undefined ? undefined : structuredClone(value);
const emit = (target, type, detail, cancelable = false) => typeof CustomEvent === "undefined" || target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, cancelable, detail }));

export function escapeTex(value) {
  const replacements = { "\\": "\\textbackslash{}", "#": "\\#", "$": "\\$", "%": "\\%", "&": "\\&", "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
  return String(value ?? "").replace(/[\\#$%&_{}~^]/g, (character) => replacements[character]);
}

export function validateTex(source, options = {}) {
  const diagnostics = [];
  const text = String(source ?? "");
  const blocked = [
    [/\\write18\b/i, "Shell escape (\\write18) is blocked."],
    [/\\(?:openout|read|input|include)\b/i, "Filesystem reads or writes are blocked in safe mode."],
  ];
  if (options.safeMode !== false) blocked.forEach(([pattern, message]) => {
    const match = text.match(pattern);
    if (match) diagnostics.push({ level: "error", message, index: match.index ?? 0 });
  });
  const opens = (text.match(/\{/g) ?? []).length, closes = (text.match(/\}/g) ?? []).length;
  if (opens !== closes) diagnostics.push({ level: "warning", message: "Braces are unbalanced.", index: text.length });
  if (!/\\begin\{document\}/.test(text)) diagnostics.push({ level: "warning", message: "The source does not contain \\begin{document}.", index: 0 });
  return diagnostics;
}

function normaliseResult(result = {}) {
  const diagnostics = (result.diagnostics ?? []).map((item) => typeof item === "string" ? { level: "error", message: item } : { level: item.level ?? "info", message: String(item.message ?? ""), line: item.line, column: item.column });
  return {
    status: result.status ?? (diagnostics.some((item) => item.level === "error") ? "failed" : "completed"),
    pdfUrl: result.pdfUrl ?? result.url ?? null,
    pdfBase64: result.pdfBase64 ?? null,
    bytes: result.bytes ?? null,
    log: String(result.log ?? ""),
    diagnostics,
    duration: Number(result.duration) || 0,
  };
}

export class GuiTexDocument extends GuiEventTarget {
  #source; #options; #result = null;
  constructor(source = "", options = {}) { super(); this.#source = String(source); this.#options = { engine: options.engine ?? "pdflatex", safeMode: options.safeMode !== false, timeout: Math.max(1000, Number(options.timeout) || 30_000), packages: clone(options.packages ?? []) }; }
  get source() { return this.#source; } get options() { return clone(this.#options); } get result() { return clone(this.#result); }
  setSource(source, options = {}) { const detail = { source: String(source), previous: this.#source, reason: options.reason ?? "api" }; if (!emit(this, "gui:tex-source-request", detail, true)) return false; this.#source = detail.source; emit(this, "gui:tex-change", { operation: "source", source: this.#source, reason: detail.reason }); return true; }
  setOptions(options) { this.#options = { ...this.#options, ...clone(options) }; emit(this, "gui:tex-change", { operation: "options", options: this.options }); }
  diagnostics(options) { return validateTex(this.#source, { safeMode: this.#options.safeMode, ...options }); }
  async compile(compiler, options = {}) {
    if (!compiler?.compile) throw new TypeError("A TeX compiler adapter with compile(source, options) is required.");
    const localDiagnostics = this.diagnostics(options);
    if (localDiagnostics.some((item) => item.level === "error")) { this.#result = normaliseResult({ status: "blocked", diagnostics: localDiagnostics }); emit(this, "gui:tex-compile", { result: this.result }); return this.result; }
    const request = { source: this.#source, options: { ...this.options, ...clone(options) }, diagnostics: localDiagnostics };
    if (!emit(this, "gui:tex-compile-request", request, true)) return null;
    const started = globalThis.performance?.now?.() ?? Date.now();
    try { this.#result = normaliseResult(await compiler.compile(this.#source, request.options)); }
    catch (error) { this.#result = normaliseResult({ status: "failed", diagnostics: [{ level: "error", message: error instanceof Error ? error.message : String(error) }] }); }
    this.#result.duration ||= (globalThis.performance?.now?.() ?? Date.now()) - started;
    emit(this, "gui:tex-compile", { result: this.result }); return this.result;
  }
  toJSON() { return { source: this.#source, options: this.options, result: this.result }; }
}

export class GuiTexBridgeCompiler {
  #bridge; #method;
  constructor(bridge, options = {}) { if (!bridge?.invoke) throw new TypeError("A bridge with invoke(method, params) is required."); this.#bridge = bridge; this.#method = options.method ?? "tex.compile"; }
  async compile(source, options) { return this.#bridge.invoke(this.#method, { source, engine: options.engine, safeMode: options.safeMode, timeout: options.timeout, packages: options.packages }); }
}

export class GuiTexTemplate {
  #source;
  constructor(source) { this.#source = String(source ?? ""); }
  render(values = {}, options = {}) {
    return this.#source.replace(/{{\s*([a-zA-Z][\w.-]*)\s*}}/g, (_match, key) => {
      const value = key.split(".").reduce((current, segment) => current?.[segment], values);
      return options.raw?.includes(key) ? String(value ?? "") : escapeTex(value);
    });
  }
  async compile(values, compiler, options = {}) { const documentModel = new GuiTexDocument(this.render(values, options), options); return documentModel.compile(compiler, options); }
}

const STYLES = `:host{display:block;color:var(--gui-text,#e5e7eb);font:inherit}.shell{display:grid;gap:.6rem;padding:.7rem;border:1px solid var(--gui-border,#334155);border-radius:.65rem;background:var(--gui-surface,#111827)}.row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}textarea,select{box-sizing:border-box;width:100%;min-height:12rem;padding:.65rem;color:inherit;background:var(--gui-surface-raised,#172033);border:1px solid var(--gui-border,#334155);border-radius:.45rem;font:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.83rem;line-height:1.45}select{width:auto;min-height:auto;font:inherit}button{padding:.45rem .7rem;color:inherit;background:transparent;border:1px solid var(--gui-border,#334155);border-radius:.4rem;font:inherit;cursor:pointer}button.primary{background:var(--gui-accent,#6c8cff);color:var(--gui-accent-contrast,#fff);border-color:transparent}.status,small{color:var(--gui-text-muted,#94a3b8)}.diagnostics{margin:0;max-height:8rem;overflow:auto;padding:.55rem;background:var(--gui-surface-raised,#172033);border-radius:.4rem;font:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;white-space:pre-wrap}.error{color:var(--gui-danger,#f87171)}iframe{width:100%;min-height:28rem;border:1px solid var(--gui-border,#334155);border-radius:.45rem;background:#fff}.empty{display:grid;place-items:center;min-height:14rem;color:var(--gui-text-muted,#94a3b8);border:1px dashed var(--gui-border,#334155);border-radius:.45rem}`;
function rootFor(host, markup) { const root = host.shadowRoot ?? host.attachShadow({ mode: "open" }); root.innerHTML = `<style>${STYLES}</style>${markup}`; return root; }

export class GuiTexEditor extends GuiElement {
  #document = new GuiTexDocument(); #compiler = null; #root;
  constructor() { super(); this.#root = rootFor(this, `<div class="shell"><div class="row"><select aria-label="TeX engine"><option value="pdflatex">pdfLaTeX</option><option value="xelatex">XeLaTeX</option><option value="lualatex">LuaLaTeX</option></select><button type="button" class="primary" data-compile>Compile PDF</button><span class="status"></span></div><textarea spellcheck="false" aria-label="TeX source"></textarea><pre class="diagnostics" aria-live="polite"></pre></div>`); this.#root.addEventListener("input", (event) => { if (event.target.matches("textarea")) this.#document.setSource(event.target.value, { reason: "input" }); }); this.#root.addEventListener("change", (event) => { if (event.target.matches("select")) this.#document.setOptions({ engine: event.target.value }); }); this.#root.addEventListener("click", (event) => { if (event.target.closest("[data-compile]")) void this.compile(); }); this.#document.addEventListener("gui:tex-change", () => this.render()); this.#document.addEventListener("gui:tex-compile", () => this.render()); }
  get documentModel() { return this.#document; } set documentModel(value) { if (!(value instanceof GuiTexDocument)) throw new TypeError("documentModel must be a GuiTexDocument."); this.#document = value; value.addEventListener("gui:tex-change", () => this.render()); value.addEventListener("gui:tex-compile", () => this.render()); this.render(); }
  get compiler() { return this.#compiler; } set compiler(value) { this.#compiler = value; }
  get source() { return this.#document.source; } set source(value) { this.#document.setSource(value); } connectedCallback() { this.render(); }
  async compile() { const result = await this.#document.compile(this.#compiler); if (result) emit(this, "gui:tex-editor-compile", { result }); return result; }
  render() { const textarea = this.#root.querySelector("textarea"), engine = this.#root.querySelector("select"), diagnostics = this.#root.querySelector(".diagnostics"), result = this.#document.result; if (textarea.value !== this.#document.source) textarea.value = this.#document.source; engine.value = this.#document.options.engine; const items = result?.diagnostics ?? this.#document.diagnostics(); diagnostics.textContent = items.length ? items.map((item) => `${item.level.toUpperCase()}: ${item.message}`).join("\n") : "Ready to compile through a configured TeX adapter."; diagnostics.classList.toggle("error", items.some((item) => item.level === "error")); this.#root.querySelector(".status").textContent = result ? `${result.status} ${result.duration ? `(${Math.round(result.duration)} ms)` : ""}` : this.#compiler ? "Compiler ready" : "No compiler configured"; }
}

export class GuiTexPdfPreview extends GuiElement {
  #result = null; #url = null; #root;
  constructor() { super(); this.#root = rootFor(this, `<div class="shell"><div class="row"><strong>PDF preview</strong><a hidden target="_blank" rel="noopener">Open PDF</a></div><div class="empty">Compile a TeX document to preview its PDF.</div></div>`); }
  set result(value) { this.#result = clone(value); this.render(); } get result() { return clone(this.#result); }
  connectedCallback() { this.render(); }
  render() { const current = this.#url; if (current?.startsWith("blob:")) URL.revokeObjectURL(current); this.#url = null; const result = this.#result, currentView = this.#root.querySelector(".empty") ?? this.#root.querySelector("iframe"); const link = this.#root.querySelector("a"); if (!result || result.status !== "completed") { const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = result?.diagnostics?.[0]?.message ?? "Compile a TeX document to preview its PDF."; currentView.replaceWith(empty); link.hidden = true; return; } if (result.pdfUrl) this.#url = result.pdfUrl; else if (result.pdfBase64) { const binary = atob(result.pdfBase64); this.#url = URL.createObjectURL(new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: "application/pdf" })); } else if (result.bytes) this.#url = URL.createObjectURL(new Blob([result.bytes], { type: "application/pdf" })); if (!this.#url) return; const frame = document.createElement("iframe"); frame.title = "Compiled TeX PDF"; frame.src = this.#url; currentView.replaceWith(frame); link.href = this.#url; link.hidden = false; }
  disconnectedCallback() { if (this.#url?.startsWith("blob:")) URL.revokeObjectURL(this.#url); }
}

export const texModule = Object.freeze({ id: "tex", version: "0.2.0", description: "Secure TeX documents, host compiler adapters, templates, editors, and PDF previews.", dependencies: [], components: ["gui-tex-editor", "gui-tex-pdf-preview"], setup() { return { GuiTexDocument, GuiTexBridgeCompiler, GuiTexTemplate }; } });

if (hasDOM) [["gui-tex-editor", GuiTexEditor], ["gui-tex-pdf-preview", GuiTexPdfPreview]].forEach(([name, constructor]) => { if (!customElements.get(name)) customElements.define(name, constructor); });
