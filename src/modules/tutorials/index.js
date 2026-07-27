const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";
const GuiElement = globalThis.HTMLElement ?? class {};

function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function eventOf(type, detail) {
  if (typeof CustomEvent !== "undefined") return new CustomEvent(type, { bubbles: true, composed: true, detail });
  const event = new Event(type); Object.defineProperty(event, "detail", { value: detail }); return event;
}
function normalizeStep(step, index) {
  if (!step || typeof step !== "object") throw new TypeError(`Tutorial step ${index + 1} must be an object.`);
  const id = String(step.id ?? "");
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError(`Tutorial step ${index + 1} requires a lowercase kebab-case id.`);
  if (!step.title) throw new TypeError(`Tutorial step "${id}" requires a title.`);
  if (!step.description) throw new TypeError(`Tutorial step "${id}" requires a description.`);
  if (step.target !== undefined && typeof step.target !== "string") throw new TypeError(`Tutorial step "${id}" target must be a selector.`);
  return { id, title: String(step.title), description: String(step.description), target: step.target ?? null, placement: step.placement ?? "auto", advanceOn: step.advanceOn ? { ...step.advanceOn } : null, ...clone(step) };
}

/** Serializable, DOM-independent state for contextual product tours. */
export class GuiTutorialModel extends EventTarget {
  #steps = []; #index = -1; #active = false;
  constructor(steps = []) { super(); this.load(steps); }
  get steps() { return clone(this.#steps); }
  get active() { return this.#active; }
  get index() { return this.#index; }
  get current() { return this.#index < 0 ? null : clone(this.#steps[this.#index]); }
  load(steps = []) {
    if (!Array.isArray(steps)) throw new TypeError("Tutorial steps must be an array.");
    const ids = new Set(); this.#steps = steps.map(normalizeStep);
    this.#steps.forEach((step) => { if (ids.has(step.id)) throw new Error(`Tutorial step "${step.id}" already exists.`); ids.add(step.id); });
    this.#index = -1; this.#active = false; return this;
  }
  start(step = 0) {
    if (!this.#steps.length) return false;
    const index = typeof step === "string" ? this.#steps.findIndex((item) => item.id === step) : Number(step);
    if (!Number.isInteger(index) || index < 0 || index >= this.#steps.length) throw new RangeError(`Unknown tutorial step: ${step}`);
    this.#active = true; this.#index = index; this.#emit("start"); return true;
  }
  goTo(step) {
    if (!this.#active) return false;
    const index = typeof step === "string" ? this.#steps.findIndex((item) => item.id === step) : Number(step);
    if (!Number.isInteger(index) || index < 0 || index >= this.#steps.length) return false;
    this.#index = index; this.#emit("change"); return true;
  }
  next() { return this.#index >= this.#steps.length - 1 ? this.stop("completed") : this.goTo(this.#index + 1); }
  previous() { return this.#index <= 0 ? false : this.goTo(this.#index - 1); }
  stop(reason = "dismissed") { if (!this.#active) return false; this.#active = false; this.#emit("stop", { reason }); return true; }
  toJSON() { return { active: this.#active, index: this.#index, current: this.current, steps: this.steps }; }
  #emit(kind, extra = {}) { this.dispatchEvent(eventOf("gui:tutorial-change", { kind, ...extra, ...this.toJSON() })); }
}

const STYLES = `:host{position:fixed;inset:0;z-index:2147483000;pointer-events:none}.spotlight{position:fixed;border:2px solid var(--gui-accent,#38bdf8);border-radius:.55rem;box-shadow:0 0 0 100vmax #020617a8,0 0 0 .3rem #38bdf833;transition:all .18s ease;pointer-events:none}.card{position:fixed;z-index:1;width:min(22rem,calc(100vw - 2rem));padding:1rem;color:var(--gui-text,#e5e7eb);background:var(--gui-surface-raised,#172033);border:1px solid var(--gui-border,#334155);border-radius:.7rem;box-shadow:0 .8rem 2.4rem #0008;pointer-events:auto}.eyebrow{margin:0 0 .25rem;color:var(--gui-muted,#94a3b8);font:.75rem system-ui}.title{margin:0;font:600 1rem system-ui}.description{margin:.55rem 0 1rem;font:.9rem/1.45 system-ui}.actions{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.actions div{display:flex;gap:.45rem}.actions button{cursor:pointer;padding:.45rem .65rem;color:inherit;background:#ffffff10;border:1px solid #ffffff25;border-radius:.35rem}.actions button[data-primary]{background:var(--gui-accent,#0284c7);border-color:transparent}.actions button:disabled{opacity:.45;cursor:not-allowed}@media(prefers-reduced-motion:reduce){.spotlight{transition:none}}`;

export class GuiTutorial extends GuiElement {
  #root; #model; #highlighted; #advanceCleanup = () => {}; #positionCleanup = () => {}; #listener = () => this.render();
  constructor() {
    super(); if (!this.attachShadow) return; this.#root = this.attachShadow({ mode: "open" });
    this.#root.addEventListener("click", (event) => { const action = event.target.closest?.("button")?.dataset.action; if (action === "next") this.#model?.next(); if (action === "previous") this.#model?.previous(); if (action === "close") this.#model?.stop(); });
    this.#root.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); this.#model?.stop(); } });
  }
  set steps(value) { this.model = new GuiTutorialModel(value); }
  get steps() { return this.#model?.steps ?? []; }
  set model(value) { this.#model?.removeEventListener("gui:tutorial-change", this.#listener); this.#model = value; this.#model?.addEventListener("gui:tutorial-change", this.#listener); this.render(); }
  get model() { return this.#model; }
  connectedCallback() { if (!this.#model) { const config = this.querySelector?.('script[type="application/json"]'); if (config) this.steps = JSON.parse(config.textContent); } }
  disconnectedCallback() { this.#cleanup(); this.#model?.removeEventListener("gui:tutorial-change", this.#listener); }
  start(step) { return this.#model?.start(step) ?? false; }
  render() {
    this.#cleanup(); if (!this.#root || !this.#model?.active || !this.#model.current) { this.#root.replaceChildren(); return; }
    const step = this.#model.current; const target = step.target ? document.querySelector(step.target) : null;
    if (target) { this.#highlighted = target; target.setAttribute("data-gui-tutorial-active", step.id); target.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" }); }
    this.#root.innerHTML = `<style>${STYLES}</style>${target ? '<div class="spotlight"></div>' : ""}<section class="card" role="dialog" aria-modal="true" aria-labelledby="title" aria-describedby="description" tabindex="-1"><p class="eyebrow"></p><h2 class="title" id="title"></h2><p class="description" id="description"></p><div class="actions"><button type="button" data-action="close">Skip tutorial</button><div><button type="button" data-action="previous">Back</button><button type="button" data-action="next" data-primary></button></div></div></section>`;
    this.#root.querySelector(".eyebrow").textContent = `Tutorial · ${this.#model.index + 1} of ${this.#model.steps.length}`;
    this.#root.querySelector(".title").textContent = step.title;
    this.#root.querySelector(".description").textContent = step.description;
    this.#root.querySelector('[data-action="previous"]').disabled = this.#model.index === 0;
    this.#root.querySelector('[data-action="next"]').textContent = step.advanceOn ? "Continue" : this.#model.index === this.#model.steps.length - 1 ? "Finish" : "Next";
    this.#place(target, step.placement); this.#installAdvance(target, step); this.#root.querySelector(".card")?.focus();
  }
  #cleanup() { this.#highlighted?.removeAttribute("data-gui-tutorial-active"); this.#highlighted = null; this.#advanceCleanup(); this.#advanceCleanup = () => {}; this.#positionCleanup(); this.#positionCleanup = () => {}; }
  #installAdvance(target, step) {
    if (!target || !step.advanceOn?.event) return;
    const listener = () => this.#model?.next(); target.addEventListener(step.advanceOn.event, listener, { once: true });
    this.#advanceCleanup = () => target.removeEventListener(step.advanceOn.event, listener);
  }
  #place(target, placement) {
    const card = this.#root.querySelector(".card"); const spotlight = this.#root.querySelector(".spotlight");
    const update = () => { const rect = target?.getBoundingClientRect(); if (rect && spotlight) { spotlight.style.left = `${rect.left - 4}px`; spotlight.style.top = `${rect.top - 4}px`; spotlight.style.width = `${rect.width + 8}px`; spotlight.style.height = `${rect.height + 8}px`; }
      const cardWidth = Math.min(352, window.innerWidth - 32); const below = !rect || placement === "bottom" || (placement === "auto" && rect.bottom + 210 < window.innerHeight); const top = rect ? (below ? Math.min(window.innerHeight - 180, rect.bottom + 12) : Math.max(16, rect.top - 190)) : Math.max(16, (window.innerHeight - 180) / 2); const left = rect ? Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.left)) : Math.max(16, (window.innerWidth - cardWidth) / 2); card.style.top = `${top}px`; card.style.left = `${left}px`; };
    update(); window.addEventListener("resize", update); window.addEventListener("scroll", update, true); const observer = target && typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null; observer?.observe(target); this.#positionCleanup = () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); observer?.disconnect(); };
  }
}

export const tutorialsModule = Object.freeze({ id: "tutorials", version: "0.2.0", description: "Accessible interactive tutorials with spotlighted UI targets.", dependencies: [], components: ["gui-tutorial"], setup() { if (hasDOM && !customElements.get("gui-tutorial")) customElements.define("gui-tutorial", GuiTutorial); return { GuiTutorial, GuiTutorialModel }; } });
if (hasDOM && !customElements.get("gui-tutorial")) customElements.define("gui-tutorial", GuiTutorial);
