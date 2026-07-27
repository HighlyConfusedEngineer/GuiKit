const GuiElement = globalThis.HTMLElement ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}
function developmentEvent(type, detail) {
  if (typeof CustomEvent !== "undefined") return new CustomEvent(type, { detail });
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

function accessibleName(element) {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    return labelledBy.split(/\s+/).map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "").join(" ").trim();
  }
  const nativeLabels = [...(element.labels ?? [])]
    .map((label) => label.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const wrappingLabel = element.closest?.("label")?.textContent?.trim() ?? "";
  return element.getAttribute("aria-label")
    || element.getAttribute("alt")
    || element.getAttribute("title")
    || nativeLabels
    || wrappingLabel
    || element.textContent?.trim()
    || "";
}

export function auditAccessibility(root = document) {
  const issues = [];
  const add = (code, message, element, severity = "error") => {
    issues.push({
      code,
      message,
      severity,
      selector: element?.id
        ? `#${CSS.escape(element.id)}`
        : element?.tagName?.toLocaleLowerCase() ?? "",
    });
  };
  const ids = new Map();
  root.querySelectorAll?.("[id]").forEach((element) => {
    const list = ids.get(element.id) ?? [];
    list.push(element);
    ids.set(element.id, list);
  });
  ids.forEach((elements, id) => {
    if (elements.length > 1) add("duplicate-id", `The id "${id}" is used ${elements.length} times.`, elements[1]);
  });
  root.querySelectorAll?.("img").forEach((image) => {
    if (!image.hasAttribute("alt")) add("image-alt", "Image requires an alt attribute.", image);
  });
  root.querySelectorAll?.("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], [role=tab]")
    .forEach((element) => {
      if (!accessibleName(element)) add("accessible-name", "Interactive element has no accessible name.", element);
    });
  root.querySelectorAll?.("[tabindex]").forEach((element) => {
    if (Number(element.getAttribute("tabindex")) > 0) {
      add("positive-tabindex", "Avoid positive tabindex values.", element, "warning");
    }
  });
  root.querySelectorAll?.("[aria-labelledby], [aria-describedby]").forEach((element) => {
    for (const attribute of ["aria-labelledby", "aria-describedby"]) {
      for (const id of (element.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean)) {
        if (!element.ownerDocument.getElementById(id)) {
          add("broken-reference", `${attribute} references missing id "${id}".`, element);
        }
      }
    }
  });
  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
    checkedAt: new Date().toISOString(),
  };
}

const PLAYGROUND_STYLES = `
  :host { display: grid; grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr); min-height: 26rem;
    overflow: hidden; color: var(--gui-text, #e5e7eb); border: 1px solid var(--gui-border, #334155);
    border-radius: .7rem; }
  aside { display: grid; align-content: start; gap: 1rem; padding: .8rem; overflow: auto;
    background: var(--gui-surface-raised, #172033); border-inline-end: 1px solid var(--gui-border, #334155); }
  main { display: grid; grid-template-rows: 1fr minmax(8rem, .35fr); min-width: 0; }
  .preview { display: grid; place-items: center; min-width: 0; overflow: auto; padding: 1.5rem;
    background-image: linear-gradient(45deg, #0000000a 25%, transparent 25%),
      linear-gradient(-45deg, #0000000a 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #0000000a 75%),
      linear-gradient(-45deg, transparent 75%, #0000000a 75%);
    background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0; }
  .events { overflow: auto; padding: .65rem; border-top: 1px solid var(--gui-border, #334155);
    font: .75rem/1.45 ui-monospace, monospace; }
  h2, h3 { margin: 0; font-size: .9rem; }
  label { display: grid; gap: .3rem; font-size: .78rem; }
  input, select { width: 100%; box-sizing: border-box; padding: .45rem; color: inherit;
    background: var(--gui-surface, #111827); border: 1px solid var(--gui-border, #334155); border-radius: .35rem; }
  button { padding: .5rem .65rem; color: inherit; background: var(--gui-surface, #111827);
    border: 1px solid var(--gui-border, #334155); border-radius: .4rem; }
  .issue { color: var(--gui-danger, #f87171); }
  @media (max-width: 700px) { :host { grid-template-columns: 1fr; } aside { border-inline-end: 0; } }
`;

export class GuiComponentPlayground extends GuiElement {
  #root;
  #preview;
  #controls = [];
  #component = null;
  #events = [];
  #eventNames = [];
  #listeners = [];

  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${PLAYGROUND_STYLES}</style>
      <aside><h2>Properties</h2><div class="controls"></div>
        <button type="button" data-audit>Run accessibility audit</button>
        <div class="audit" role="status"></div>
      </aside>
      <main><div class="preview"></div><div class="events" aria-label="Component events"><h3>Events</h3></div></main>`;
    this.#preview = this.#root.querySelector(".preview");
    this.#root.addEventListener("input", (event) => this.#change(event));
    this.#root.querySelector("[data-audit]").addEventListener("click", () => this.audit());
  }

  set component(value) {
    this.#detachEvents();
    this.#component = value;
    this.#preview?.replaceChildren(value ?? document.createTextNode("No component selected"));
    this.#attachEvents();
  }
  get component() { return this.#component; }
  set controls(value) { this.#controls = clone(value ?? []); this.#renderControls(); }
  get controls() { return clone(this.#controls); }
  set events(value) { this.#eventNames = [...(value ?? [])]; this.#attachEvents(); }
  get events() { return [...this.#eventNames]; }

  connectedCallback() {
    if (!this.#component) {
      const candidate = [...this.children].find((element) => element.tagName !== "SCRIPT");
      if (candidate) this.component = candidate;
    }
    const schema = this.querySelector?.('script[type="application/json"]');
    if (schema) {
      const config = JSON.parse(schema.textContent);
      this.controls = config.controls;
      this.events = config.events;
    }
  }
  disconnectedCallback() { this.#detachEvents(); }

  audit() {
    const result = auditAccessibility(this.#component ?? this.#preview);
    const container = this.#root.querySelector(".audit");
    container.replaceChildren();
    if (result.valid && !result.issues.length) {
      container.textContent = "No common accessibility problems detected.";
    } else {
      result.issues.forEach((issue) => {
        const row = document.createElement("div");
        row.className = issue.severity === "error" ? "issue" : "";
        row.textContent = `${issue.severity}: ${issue.message}`;
        container.append(row);
      });
    }
    this.dispatchEvent(new CustomEvent("gui:accessibility-audit", {
      bubbles: true, composed: true, detail: result,
    }));
    return result;
  }

  #renderControls() {
    const container = this.#root?.querySelector(".controls");
    if (!container) return;
    container.replaceChildren();
    for (const control of this.#controls) {
      const label = document.createElement("label");
      label.textContent = control.label ?? control.property ?? control.attribute;
      let input;
      if (control.type === "boolean") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(control.value);
      } else if (control.options) {
        input = document.createElement("select");
        control.options.forEach((option) => {
          const element = document.createElement("option");
          element.value = typeof option === "object" ? option.value : option;
          element.textContent = typeof option === "object" ? option.label : option;
          input.append(element);
        });
        input.value = control.value ?? "";
      } else {
        input = document.createElement("input");
        input.type = control.type ?? "text";
        input.value = control.value ?? "";
      }
      input.dataset.control = this.#controls.indexOf(control);
      label.append(input);
      container.append(label);
    }
  }

  #change(event) {
    const input = event.target.closest?.("[data-control]");
    if (!input || !this.#component) return;
    const control = this.#controls[Number(input.dataset.control)];
    const value = input.type === "checkbox" ? input.checked : (
      input.type === "number" || input.type === "range" ? Number(input.value) : input.value
    );
    if (control.property) this.#component[control.property] = value;
    if (control.attribute) {
      if (control.type === "boolean") this.#component.toggleAttribute(control.attribute, value);
      else this.#component.setAttribute(control.attribute, value);
    }
  }

  #attachEvents() {
    this.#detachEvents();
    if (!this.#component) return;
    for (const name of this.#eventNames) {
      const listener = (event) => {
        const record = { name, time: new Date().toISOString(), detail: clone(event.detail) };
        this.#events.push(record);
        if (this.#events.length > 100) this.#events.shift();
        const line = document.createElement("div");
        line.textContent = `${record.time.slice(11, 23)} ${name} ${JSON.stringify(record.detail ?? {})}`;
        this.#root.querySelector(".events").append(line);
      };
      this.#component.addEventListener(name, listener);
      this.#listeners.push([name, listener]);
    }
  }

  #detachEvents() {
    for (const [name, listener] of this.#listeners) this.#component?.removeEventListener(name, listener);
    this.#listeners = [];
  }
}

export class GuiDiagnosticsPanel extends GuiElement {
  #diagnostics;
  #root;
  #listener = () => this.render();
  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
  }
  set diagnostics(value) {
    this.#diagnostics?.removeEventListener?.("gui:diagnostic", this.#listener);
    this.#diagnostics = value;
    this.#diagnostics?.addEventListener?.("gui:diagnostic", this.#listener);
    this.render();
  }
  get diagnostics() { return this.#diagnostics; }
  disconnectedCallback() {
    this.#diagnostics?.removeEventListener?.("gui:diagnostic", this.#listener);
  }
  render() {
    if (!this.#root) return;
    this.#root.replaceChildren();
    const table = document.createElement("table");
    const body = document.createElement("tbody");
    for (const [name, metric] of Object.entries(this.#diagnostics?.snapshot?.() ?? {})) {
      const row = document.createElement("tr");
      [name, metric.count, metric.average == null ? "—" : metric.average.toFixed(2), metric.max ?? "—"]
        .forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.append(cell);
        });
      body.append(row);
    }
    table.append(body);
    this.#root.append(table);
  }
}

export class GuiDevelopmentSession extends EventTarget {
  #records = [];
  #limit;
  #sources = [];
  constructor({ limit = 200, modules, diagnostics, logger, bridge } = {}) {
    super();
    this.#limit = Math.max(1, limit);
    if (modules) this.record("modules", "registered", modules.list?.() ?? modules);
    if (diagnostics) this.attach(diagnostics, "gui:diagnostic", "diagnostic");
    if (logger) this.attach(logger, "gui:log", "log");
    if (bridge) this.observeBridge(bridge);
  }
  get records() { return clone(this.#records); }
  record(kind, name, detail) {
    const record = { kind, name, detail: clone(detail), timestamp: new Date().toISOString() };
    this.#records.push(record);
    if (this.#records.length > this.#limit) this.#records.shift();
    this.dispatchEvent(developmentEvent("gui:development-record", record));
    return record;
  }
  attach(source, eventName, kind = eventName) {
    if (!source?.addEventListener) return () => {};
    const listener = (event) => this.record(kind, eventName, event.detail);
    source.addEventListener(eventName, listener);
    const detach = () => source.removeEventListener(eventName, listener);
    this.#sources.push(detach);
    return detach;
  }
  observeBridge(bridge) {
    if (!bridge?.invoke || bridge.__guiKitObserved) return bridge;
    const invoke = bridge.invoke.bind(bridge);
    const session = this;
    Object.defineProperty(bridge, "__guiKitObserved", { value: true, configurable: true });
    bridge.invoke = async function observedInvoke(method, payload) {
      session.record("bridge", "request", { method, payload });
      try { const result = await invoke(method, payload); session.record("bridge", "response", { method, result }); return result; }
      catch (error) { session.record("bridge", "error", { method, message: error?.message ?? String(error) }); throw error; }
    };
    return bridge;
  }
  dispose() { this.#sources.splice(0).forEach((detach) => detach()); }
}

export class GuiDeveloperInspector extends GuiElement {
  #root;
  #session;
  #listener = () => this.render();
  constructor() { super(); if (this.attachShadow) this.#root = this.attachShadow({ mode: "open" }); }
  set session(value) { this.#session?.removeEventListener?.("gui:development-record", this.#listener); this.#session = value; this.#session?.addEventListener?.("gui:development-record", this.#listener); this.render(); }
  get session() { return this.#session; }
  disconnectedCallback() { this.#session?.removeEventListener?.("gui:development-record", this.#listener); }
  render() {
    if (!this.#root) return;
    const records = this.#session?.records ?? [];
    this.#root.innerHTML = `<style>:host{display:block;max-height:20rem;overflow:auto;padding:.7rem;color:var(--gui-text,#e5e7eb);background:var(--gui-surface,#111827);border:1px solid var(--gui-border,#334155);border-radius:.5rem;font:.75rem/1.4 ui-monospace,monospace}h2{margin:0 0 .5rem;font:600 .9rem system-ui}.record{padding:.35rem 0;border-top:1px solid #ffffff12}.kind{color:var(--gui-accent,#38bdf8)}</style><h2>GuiKit development inspector</h2>${records.length ? records.slice().reverse().map((record) => `<div class="record"><span class="kind">${record.kind}</span> ${record.name} <span>${JSON.stringify(record.detail ?? {})}</span></div>`).join("") : "<div>No recorded development activity.</div>"}`;
  }
}

export const devtoolsModule = Object.freeze({
  id: "devtools",
  version: "0.1.0",
  description: "Component playground, event viewer, development inspector, diagnostics panel, and accessibility audit.",
  dependencies: [],
  components: ["gui-component-playground", "gui-diagnostics-panel", "gui-developer-inspector"],
  setup() {
    if (hasDOM) {
      if (!customElements.get("gui-component-playground")) {
        customElements.define("gui-component-playground", GuiComponentPlayground);
      }
      if (!customElements.get("gui-diagnostics-panel")) customElements.define("gui-diagnostics-panel", GuiDiagnosticsPanel);
      if (!customElements.get("gui-developer-inspector")) customElements.define("gui-developer-inspector", GuiDeveloperInspector);
    }
    return { auditAccessibility, GuiDevelopmentSession };
  },
});

if (hasDOM) {
  if (!customElements.get("gui-component-playground")) {
    customElements.define("gui-component-playground", GuiComponentPlayground);
  }
  if (!customElements.get("gui-diagnostics-panel")) {
    customElements.define("gui-diagnostics-panel", GuiDiagnosticsPanel);
  }
  if (!customElements.get("gui-developer-inspector")) customElements.define("gui-developer-inspector", GuiDeveloperInspector);
}
