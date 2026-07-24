const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};

const ITEM_TYPES = new Set(["text", "status", "progress", "action", "separator"]);
const ITEM_ALIGNMENTS = new Set(["start", "center", "end"]);
const ITEM_VARIANTS = new Set(["neutral", "info", "success", "warning", "danger"]);
const ITEM_PRIORITIES = new Set(["low", "normal", "high"]);

function dispatch(target, name, detail = {}, cancelable = false) {
  if (!hasDOM) return true;
  return target.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    cancelable,
    composed: true,
    detail,
  }));
}

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeItem(item, index = 0) {
  const source = typeof item === "string"
    ? { id: `item-${index + 1}`, value: item }
    : { ...clone(item) };
  if (!source.id) throw new TypeError("A statusbar item requires a non-empty id.");

  const type = ITEM_TYPES.has(source.type) ? source.type : "text";
  const align = ITEM_ALIGNMENTS.has(source.align) ? source.align : "start";
  const variant = ITEM_VARIANTS.has(source.variant) ? source.variant : "neutral";
  const priority = ITEM_PRIORITIES.has(source.priority) ? source.priority : "normal";
  const progress = Math.min(100, Math.max(0, finite(source.progress)));
  return {
    ...source,
    id: String(source.id),
    type,
    align,
    variant,
    priority,
    order: finite(source.order, index),
    label: source.label === undefined ? "" : String(source.label),
    value: source.value === undefined ? "" : String(source.value),
    icon: source.icon === undefined ? "" : String(source.icon),
    tooltip: source.tooltip === undefined ? "" : String(source.tooltip),
    progress,
    disabled: Boolean(source.disabled),
    hidden: Boolean(source.hidden),
    compact: Boolean(source.compact),
  };
}

function itemAnnouncement(item) {
  return [item.label, item.value]
    .filter(Boolean)
    .join(": ");
}

/**
 * Configurable application status bar with keyed live updates and optional
 * action items. Custom content can also use the start, center, and end slots.
 */
export class GuiStatusbar extends GuiElement {
  static observedAttributes = ["position", "compact", "fixed", "live", "label"];

  #items = new Map();
  #bar;
  #groups = new Map();
  #slots = new Map();
  #itemElements = new Map();
  #liveRegion;

  connectedCallback() {
    if (!this.shadowRoot) this.#createView();
    this.#syncAttributes();
    this.#render();
  }

  attributeChangedCallback(name, previous) {
    if (!this.#bar) return;
    this.#syncAttributes();
    if (name === "position" && previous !== null) {
      const previousPosition = previous === "top" ? "top" : "bottom";
      if (previousPosition !== this.position) {
        dispatch(this, "gui:statusbar-position-change", {
          position: this.position,
          previous: previousPosition,
        });
      }
    }
  }

  get position() {
    return this.getAttribute("position") === "top" ? "top" : "bottom";
  }

  set position(value) {
    const next = value === "top" ? "top" : "bottom";
    this.setAttribute("position", next);
  }

  get compact() {
    return this.hasAttribute("compact");
  }

  set compact(value) {
    this.toggleAttribute("compact", Boolean(value));
  }

  get fixed() {
    return this.hasAttribute("fixed");
  }

  set fixed(value) {
    this.toggleAttribute("fixed", Boolean(value));
  }

  get live() {
    const value = this.getAttribute("live");
    return ["off", "polite", "assertive"].includes(value) ? value : "polite";
  }

  set live(value) {
    this.setAttribute(
      "live",
      ["off", "polite", "assertive"].includes(value) ? value : "polite",
    );
  }

  get items() {
    return [...this.#items.values()].map((item) => clone(item));
  }

  set items(value) {
    this.setItems(value);
  }

  setItems(items = []) {
    if (!Array.isArray(items)) throw new TypeError("Statusbar items must be an array.");
    const normalized = items.map(normalizeItem);
    const ids = new Set();
    for (const item of normalized) {
      if (ids.has(item.id)) throw new Error(`Statusbar item "${item.id}" already exists.`);
      ids.add(item.id);
    }
    this.#items = new Map(normalized.map((item) => [item.id, item]));
    this.#render();
    this.#changed("set");
    return this.items;
  }

  getItem(id) {
    const item = this.#items.get(String(id));
    return item ? clone(item) : undefined;
  }

  addItem(item) {
    let index = this.#items.size;
    let normalized = normalizeItem(item, index);
    while (typeof item === "string" && this.#items.has(normalized.id)) {
      normalized = normalizeItem(item, ++index);
    }
    if (this.#items.has(normalized.id)) {
      throw new Error(`Statusbar item "${normalized.id}" already exists.`);
    }
    this.#items.set(normalized.id, normalized);
    this.#render();
    this.#announce(normalized);
    this.#changed("add", normalized);
    return clone(normalized);
  }

  upsertItem(item) {
    if (item?.id && this.#items.has(String(item.id))) {
      return this.updateItem(item.id, item);
    }
    return this.addItem(item);
  }

  updateItem(id, patch = {}, options = {}) {
    const itemId = String(id);
    const current = this.#items.get(itemId);
    if (!current) throw new Error(`Unknown statusbar item "${itemId}".`);
    const updated = normalizeItem({ ...current, ...clone(patch), id: itemId });
    this.#items.set(itemId, updated);
    const structuralKeys = ["type", "align", "order", "hidden", "label", "icon"];
    if (structuralKeys.some((key) => updated[key] !== current[key])) {
      this.#render();
    } else {
      this.#patchItemElement(updated);
    }
    if (options.announce !== false) this.#announce(updated);
    this.#changed("update", updated, { previous: clone(current) });
    return clone(updated);
  }

  setItemValue(id, value, options = {}) {
    return this.updateItem(id, { value }, options);
  }

  removeItem(id) {
    const itemId = String(id);
    const item = this.#items.get(itemId);
    if (!item || !this.#items.delete(itemId)) return false;
    this.#render();
    this.#changed("remove", item);
    return true;
  }

  clear() {
    if (!this.#items.size) return;
    this.#items.clear();
    this.#render();
    this.#changed("clear");
  }

  #createView() {
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STATUSBAR_STYLES;

    this.#bar = document.createElement("div");
    this.#bar.className = "bar";
    ["start", "center", "end"].forEach((alignment) => {
      const group = document.createElement("div");
      group.className = `group group--${alignment}`;
      group.dataset.align = alignment;
      const slot = document.createElement("slot");
      slot.name = alignment;
      this.#groups.set(alignment, group);
      this.#slots.set(alignment, slot);
      this.#bar.append(group);
    });

    this.#liveRegion = document.createElement("span");
    this.#liveRegion.className = "live-region";
    root.append(style, this.#bar, this.#liveRegion);
  }

  #syncAttributes() {
    if (this.getAttribute("position") !== this.position) {
      this.setAttribute("position", this.position);
    }
    this.#bar.setAttribute("role", "region");
    this.#bar.setAttribute("aria-label", this.getAttribute("label") ?? "Application status");
    this.#liveRegion.setAttribute("aria-live", this.live);
    this.#liveRegion.setAttribute("aria-atomic", "true");
  }

  #render() {
    if (!this.#bar) return;
    this.#itemElements.clear();
    const grouped = new Map([
      ["start", []],
      ["center", []],
      ["end", []],
    ]);
    [...this.#items.values()]
      .filter((item) => !item.hidden)
      .sort((first, second) => first.order - second.order)
      .forEach((item) => {
        const element = this.#createItem(item);
        this.#itemElements.set(item.id, element);
        grouped.get(item.align).push(element);
      });

    grouped.forEach((elements, alignment) => {
      this.#groups.get(alignment).replaceChildren(
        ...elements,
        this.#slots.get(alignment),
      );
    });
  }

  #createItem(item) {
    if (item.type === "separator") {
      const separator = document.createElement("span");
      separator.className = "separator";
      separator.dataset.itemId = item.id;
      separator.setAttribute("role", "separator");
      separator.setAttribute("aria-orientation", "vertical");
      return separator;
    }

    const element = document.createElement(item.type === "action" ? "button" : "span");
    element.className = `item item--${item.type}`;
    element.dataset.itemId = item.id;
    element.dataset.variant = item.variant;
    element.dataset.priority = item.priority;
    element.dataset.compact = String(item.compact);
    if (item.tooltip) element.title = item.tooltip;

    if (item.type === "action") {
      element.type = "button";
      element.disabled = item.disabled;
      element.addEventListener("click", (sourceEvent) => {
        dispatch(this, "gui:statusbar-action", {
          id: item.id,
          item: clone(item),
          sourceEvent,
        }, true);
      });
    }

    if (item.type === "status") {
      const indicator = document.createElement("i");
      indicator.className = "indicator";
      indicator.setAttribute("aria-hidden", "true");
      element.append(indicator);
    }
    if (item.icon) {
      const icon = document.createElement("span");
      icon.className = "icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.icon;
      element.append(icon);
    }
    if (item.label) {
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.label;
      element.append(label);
    }

    if (item.type === "progress") {
      const progress = document.createElement("progress");
      progress.max = 100;
      progress.value = item.progress;
      progress.setAttribute("aria-label", item.label || item.id);
      element.append(progress);
    }
    if (item.value) {
      const value = document.createElement("strong");
      value.className = "value";
      value.textContent = item.value;
      element.append(value);
    }
    if (!element.textContent.trim() && item.type !== "progress") {
      element.textContent = item.id;
    }
    if (item.type !== "action") {
      element.setAttribute("aria-label", itemAnnouncement(item) || item.id);
    }
    return element;
  }

  #patchItemElement(item) {
    const element = this.#itemElements.get(item.id);
    if (!element) {
      this.#render();
      return;
    }
    element.dataset.variant = item.variant;
    element.dataset.priority = item.priority;
    element.dataset.compact = String(item.compact);
    if (item.tooltip) element.title = item.tooltip;
    else element.removeAttribute("title");
    if (item.type === "action") element.disabled = item.disabled;

    const progress = element.querySelector("progress");
    if (progress) progress.value = item.progress;

    let value = element.querySelector(".value");
    if (item.value) {
      if (!value) {
        value = document.createElement("strong");
        value.className = "value";
        element.append(value);
      }
      value.textContent = item.value;
    } else {
      value?.remove();
    }
    if (item.type !== "action") {
      element.setAttribute("aria-label", itemAnnouncement(item) || item.id);
    }
  }

  #announce(item) {
    if (!this.#liveRegion || this.live === "off") return;
    const message = itemAnnouncement(item);
    if (!message) return;
    this.#liveRegion.textContent = "";
    requestAnimationFrame(() => {
      this.#liveRegion.textContent = message;
    });
  }

  #changed(operation, item, detail = {}) {
    dispatch(this, "gui:statusbar-change", {
      operation,
      item: item ? clone(item) : undefined,
      items: this.items,
      ...detail,
    });
  }
}

export const statusbarModule = Object.freeze({
  id: "statusbar",
  version: "0.1.0",
  description: "Configurable top or bottom application status bar with live items.",
  dependencies: ["core"],
  components: ["gui-statusbar"],
  setup() {
    if (hasDOM && !customElements.get("gui-statusbar")) {
      customElements.define("gui-statusbar", GuiStatusbar);
    }
    return { GuiStatusbar };
  },
});

const STATUSBAR_STYLES = `
  :host {
    --statusbar-height: 2.4rem;
    --statusbar-offset: 0px;
    position: sticky;
    z-index: 25;
    display: block;
    min-width: 0;
    color: var(--gui-text, #17181c);
    font-family: var(--gui-font, ui-sans-serif, system-ui);
    contain: layout style;
  }

  :host([position="top"]) { top: var(--statusbar-offset); }
  :host(:not([position="top"])) { bottom: var(--statusbar-offset); }
  :host([fixed]) {
    position: fixed;
    right: 0;
    left: 0;
  }
  :host([fixed][position="top"]) {
    top: var(--statusbar-offset);
    bottom: auto;
  }
  :host([fixed]:not([position="top"])) {
    top: auto;
    bottom: var(--statusbar-offset);
  }

  *, *::before, *::after { box-sizing: border-box; }

  .bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    min-height: var(--statusbar-height);
    align-items: stretch;
    gap: .55rem;
    padding: .25rem .55rem;
    overflow-x: auto;
    border-top: 1px solid var(--gui-border, #dfe2ea);
    background: color-mix(in srgb, var(--gui-surface-raised, white) 94%, transparent);
    box-shadow: 0 -6px 20px rgb(18 23 38 / .055);
    scrollbar-width: thin;
    backdrop-filter: blur(16px);
  }

  :host([position="top"]) .bar {
    border-top: 0;
    border-bottom: 1px solid var(--gui-border, #dfe2ea);
    box-shadow: 0 6px 20px rgb(18 23 38 / .055);
  }

  :host([compact]) {
    --statusbar-height: 2rem;
  }

  :host([compact]) .bar {
    gap: .3rem;
    padding-block: .16rem;
  }

  .group {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: .28rem;
    white-space: nowrap;
  }

  .group--start { justify-content: flex-start; }
  .group--center { justify-content: center; }
  .group--end { justify-content: flex-end; }

  .item {
    display: inline-flex;
    min-width: 0;
    min-height: 1.75rem;
    align-items: center;
    gap: .38rem;
    padding: .25rem .48rem;
    border-radius: .45rem;
    color: var(--gui-text-muted, #666b78);
    font-size: .72rem;
    line-height: 1;
    animation: statusbar-item-arrive 180ms ease-out;
  }

  .label {
    overflow: hidden;
    max-width: 16rem;
    text-overflow: ellipsis;
  }

  .value {
    overflow: hidden;
    max-width: 18rem;
    color: var(--gui-text, #17181c);
    font-size: .72rem;
    font-weight: 720;
    text-overflow: ellipsis;
  }

  .icon {
    display: grid;
    min-width: 1em;
    place-items: center;
    color: var(--gui-text-muted, #666b78);
    font-size: .84rem;
  }

  .indicator {
    width: .48rem;
    height: .48rem;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--gui-text-muted, #8b90a0);
    box-shadow: 0 0 0 .2rem color-mix(in srgb, currentColor 10%, transparent);
  }

  .item[data-variant="info"] .indicator { background: var(--gui-info, #3285d8); }
  .item[data-variant="success"] .indicator { background: var(--gui-success, #17a88b); }
  .item[data-variant="warning"] .indicator { background: var(--gui-warning, #d97706); }
  .item[data-variant="danger"] .indicator { background: var(--gui-danger, #dc3545); }
  .item[data-variant="info"] .value { color: var(--gui-info, #3285d8); }
  .item[data-variant="success"] .value { color: var(--gui-success, #168671); }
  .item[data-variant="warning"] .value { color: var(--gui-warning, #b96205); }
  .item[data-variant="danger"] .value { color: var(--gui-danger, #c42f3e); }

  button.item {
    border: 0;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    transition: background 150ms, color 150ms, transform 150ms;
  }

  button.item:hover {
    background: var(--gui-accent-soft, #ededff);
    color: var(--gui-accent, #5b5ce2);
  }

  button.item:active { transform: translateY(1px); }
  button.item:focus-visible {
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 0;
  }
  button.item:disabled {
    cursor: not-allowed;
    opacity: .45;
  }

  progress {
    width: clamp(3.5rem, 8vw, 7rem);
    height: .38rem;
    overflow: hidden;
    border: 0;
    border-radius: 999px;
    background: var(--gui-border, #dfe2ea);
    accent-color: var(--gui-accent, #5b5ce2);
  }

  progress::-webkit-progress-bar {
    border-radius: inherit;
    background: var(--gui-border, #dfe2ea);
  }
  progress::-webkit-progress-value {
    border-radius: inherit;
    background: var(--gui-accent, #5b5ce2);
  }
  progress::-moz-progress-bar {
    border-radius: inherit;
    background: var(--gui-accent, #5b5ce2);
  }

  .separator {
    width: 1px;
    height: 1rem;
    flex: 0 0 auto;
    margin-inline: .12rem;
    background: var(--gui-border, #dfe2ea);
  }

  ::slotted(*) {
    flex: 0 0 auto;
    color: var(--gui-text-muted, #666b78);
    font: 550 .72rem/1 var(--gui-font, ui-sans-serif, system-ui);
  }

  .live-region {
    position: fixed;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @keyframes statusbar-item-arrive {
    from { opacity: 0; transform: translateY(.2rem); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 48rem) {
    .item[data-priority="low"] { display: none; }
    .label { max-width: 8rem; }
  }

  @media (max-width: 34rem) {
    .bar {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .group--center { display: none; }
    .item[data-compact="true"] .label { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      transition-duration: .01ms !important;
    }
  }
`;

if (hasDOM && !customElements.get("gui-statusbar")) {
  customElements.define("gui-statusbar", GuiStatusbar);
}
