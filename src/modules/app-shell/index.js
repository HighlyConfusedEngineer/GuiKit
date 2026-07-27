const GuiElement = globalThis.HTMLElement ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

function copy(value) { return value === undefined ? undefined : structuredClone(value); }
function routeEvent(detail) {
  if (typeof CustomEvent !== "undefined") return new CustomEvent("gui:route-change", { detail });
  const event = new Event("gui:route-change"); Object.defineProperty(event, "detail", { value: detail }); return event;
}
function assertId(value, label) {
  if (!/^[a-z][a-z0-9-]*$/.test(value ?? "")) throw new TypeError(`${label} must be lowercase kebab-case.`);
}

export class GuiAppManifest {
  #value;
  constructor(value = {}) { this.#value = GuiAppManifest.validate(value); }
  static validate(value) {
    const app = { id: "gui-app", title: "GuiKit application", locale: "en", theme: "system", pages: [], navigation: "sidebar", ...copy(value) };
    assertId(app.id, "Application id");
    if (!Array.isArray(app.pages) || !app.pages.length) throw new TypeError("App manifest requires at least one page.");
    const ids = new Set();
    app.pages = app.pages.map((page) => {
      if (!page || typeof page !== "object") throw new TypeError("Every page must be an object.");
      assertId(page.id, "Page id");
      if (ids.has(page.id)) throw new TypeError(`Duplicate page id: ${page.id}`);
      ids.add(page.id);
      if (!page.title) throw new TypeError(`Page ${page.id} requires a title.`);
      return { ...page };
    });
    if (!["sidebar", "tabs", "swipe", "dashboard"].includes(app.navigation)) throw new TypeError("navigation must be sidebar, tabs, swipe, or dashboard.");
    return Object.freeze(app);
  }
  get value() { return copy(this.#value); }
  get pages() { return copy(this.#value.pages); }
  toJSON() { return this.value; }
}

export class GuiAppShellModel extends EventTarget {
  #manifest;
  #activePage;
  constructor(manifest) { super(); this.#manifest = manifest instanceof GuiAppManifest ? manifest : new GuiAppManifest(manifest); this.#activePage = this.#manifest.pages[0].id; }
  get manifest() { return this.#manifest; }
  get activePage() { return this.#activePage; }
  select(pageId) {
    const page = this.#manifest.pages.find((candidate) => candidate.id === pageId);
    if (!page) throw new RangeError(`Unknown page: ${pageId}`);
    if (page.id === this.#activePage) return page;
    const previousPage = this.#activePage;
    this.#activePage = page.id;
    this.dispatchEvent(routeEvent({ page, previousPage }));
    return page;
  }
}

const STYLES = `:host { display:block; min-height: 22rem; color: var(--gui-text,#e5e7eb); background: var(--gui-surface,#111827); border:1px solid var(--gui-border,#334155); border-radius:.7rem; overflow:hidden; } .shell {display:grid; min-height:inherit; grid-template-columns: minmax(11rem, 15rem) 1fr;} nav {padding:.65rem; display:grid; align-content:start; gap:.3rem; background:var(--gui-surface-raised,#172033); border-inline-end:1px solid var(--gui-border,#334155)} button {cursor:pointer;text-align:start;padding:.55rem .65rem;color:inherit;border:0;border-radius:.4rem;background:transparent} button[aria-current=page] {background:color-mix(in srgb,var(--gui-accent,#38bdf8) 22%, transparent)} main {padding:1.1rem; min-width:0; animation:gui-page-in .2s ease-out;} h2,p {margin-top:0} :host([navigation=tabs]) .shell {grid-template-columns:1fr;grid-template-rows:auto 1fr} :host([navigation=tabs]) nav {display:flex;border-inline-end:0;border-bottom:1px solid var(--gui-border,#334155)} :host([navigation=dashboard]) nav {display:none} :host([navigation=dashboard]) .shell {grid-template-columns:1fr} @keyframes gui-page-in{from{opacity:.35;transform:translateY(.35rem)}to{opacity:1;transform:none}} @media(max-width:650px){.shell{grid-template-columns:1fr;grid-template-rows:auto 1fr}nav{display:flex;overflow:auto;border-inline-end:0;border-bottom:1px solid var(--gui-border,#334155)}}`;

export class GuiAppShell extends GuiElement {
  #root; #model; #onRoute = () => this.render();
  constructor() { super(); if (this.attachShadow) { this.#root = this.attachShadow({ mode: "open" }); this.#root.addEventListener("click", (event) => { const id = event.target.closest?.("button")?.dataset.page; if (id) this.#model?.select(id); }); } }
  set manifest(value) { this.model = new GuiAppShellModel(value); }
  get manifest() { return this.#model?.manifest; }
  set model(value) { this.#model?.removeEventListener("gui:route-change", this.#onRoute); this.#model = value; this.#model?.addEventListener("gui:route-change", this.#onRoute); this.render(); }
  get model() { return this.#model; }
  connectedCallback() { if (!this.#model) { const source = this.querySelector?.('script[type="application/json"]'); if (source) this.manifest = JSON.parse(source.textContent); } }
  disconnectedCallback() { this.#model?.removeEventListener("gui:route-change", this.#onRoute); }
  render() {
    if (!this.#root || !this.#model) return;
    const { manifest, activePage } = this.#model; const page = manifest.pages.find((item) => item.id === activePage);
    this.setAttribute("navigation", manifest.value.navigation);
    this.#root.innerHTML = `<style>${STYLES}</style><div class="shell"><nav aria-label="Application pages">${manifest.pages.map((item) => `<button type="button" data-page="${item.id}" aria-current="${item.id === activePage ? "page" : "false"}">${item.icon ? `${item.icon} ` : ""}${item.title}</button>`).join("")}</nav><main tabindex="-1"><h2>${page.title}</h2><p>${page.content ?? "Configure this page in your application manifest."}</p></main></div>`;
  }
}

export const appShellModule = Object.freeze({
  id: "app-shell", version: "0.2.0", description: "Manifest-driven responsive application shell.", dependencies: [], components: ["gui-app-shell"],
  setup() { if (hasDOM && !customElements.get("gui-app-shell")) customElements.define("gui-app-shell", GuiAppShell); return { GuiAppManifest, GuiAppShellModel }; },
});
if (hasDOM && !customElements.get("gui-app-shell")) customElements.define("gui-app-shell", GuiAppShell);
