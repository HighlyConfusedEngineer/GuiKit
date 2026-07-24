const GuiElement = globalThis.HTMLElement ?? class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

function emit(target, type, detail, cancelable = false) {
  if (typeof CustomEvent === "undefined") return true;
  return target.dispatchEvent(new CustomEvent(type, {
    bubbles: true,
    cancelable,
    composed: true,
    detail,
  }));
}

export class GuiOverlayController extends GuiEventTarget {
  #stack = [];

  get stack() {
    return this.#stack.map(({ overlay, kind, modal }) => ({
      id: overlay.id,
      kind,
      modal,
    }));
  }

  open(overlay, options = {}) {
    this.close(overlay, "reopen");
    const record = {
      overlay,
      kind: options.kind ?? "popover",
      modal: Boolean(options.modal),
      restoreFocus: options.restoreFocus ?? document.activeElement,
    };
    this.#stack.push(record);
    this.#sync();
    emit(this, "gui:overlay-change", { operation: "open", overlay: this.#snapshot(record) });
    return record;
  }

  close(overlay, reason = "programmatic") {
    const index = this.#stack.findIndex((record) => record.overlay === overlay);
    if (index < 0) return false;
    const [record] = this.#stack.splice(index, 1);
    this.#sync();
    if (reason !== "reopen") record.restoreFocus?.focus?.();
    emit(this, "gui:overlay-change", {
      operation: "close",
      reason,
      overlay: this.#snapshot(record),
    });
    return true;
  }

  closeTop(reason = "programmatic") {
    const record = this.#stack.at(-1);
    return record ? this.close(record.overlay, reason) : false;
  }

  #snapshot(record) {
    return { id: record.overlay.id, kind: record.kind, modal: record.modal };
  }

  #sync() {
    this.#stack.forEach(({ overlay }, index) => {
      overlay.style?.setProperty("--gui-overlay-index", String(index));
    });
  }
}

const DIALOG_STYLES = `
  :host { display: contents; }
  dialog { width: min(var(--gui-dialog-width, 36rem), calc(100vw - 2rem)); max-height: calc(100dvh - 2rem);
    padding: 0; overflow: hidden; color: var(--gui-text, #e5e7eb); background: var(--gui-surface, #111827);
    border: 1px solid var(--gui-border, #334155); border-radius: .8rem; box-shadow: 0 24px 80px #0009; }
  dialog::backdrop { background: color-mix(in srgb, #020617 55%, transparent); backdrop-filter: blur(2px); }
  header, footer { display: flex; align-items: center; gap: .75rem; padding: .8rem 1rem; }
  header { border-bottom: 1px solid var(--gui-border, #334155); }
  footer { justify-content: end; border-top: 1px solid var(--gui-border, #334155); }
  h2 { flex: 1; margin: 0; font: inherit; font-weight: 700; }
  .body { padding: 1rem; overflow: auto; }
  button.close { color: inherit; background: transparent; border: 0; border-radius: .3rem; font-size: 1.25rem; }
  @media (prefers-reduced-motion: no-preference) {
    dialog[open] { animation: gui-dialog-in 150ms ease-out; }
    @keyframes gui-dialog-in { from { opacity: 0; transform: translateY(.5rem) scale(.98); } }
  }
`;

export class GuiDialog extends GuiElement {
  #dialog;
  #title;
  #returnValue;

  static observedAttributes = ["label", "close-label"];

  constructor() {
    super();
    if (!this.attachShadow) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${DIALOG_STYLES}</style>
      <dialog>
        <header><h2></h2><slot name="header"></slot><button class="close" type="button" aria-label="Close">×</button></header>
        <div class="body"><slot></slot></div>
        <footer><slot name="footer"></slot></footer>
      </dialog>`;
    this.#dialog = root.querySelector("dialog");
    this.#title = root.querySelector("h2");
    root.querySelector(".close").addEventListener("click", () => this.close("", "close-button"));
    this.#dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close("", "escape");
    });
    this.#dialog.addEventListener("click", (event) => {
      if (event.target !== this.#dialog || !this.hasAttribute("light-dismiss")) return;
      const rect = this.#dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom) {
        this.close("", "backdrop");
      }
    });
  }

  connectedCallback() { this.#sync(); }
  attributeChangedCallback() { this.#sync(); }
  get open() { return Boolean(this.#dialog?.open); }
  get returnValue() { return this.#returnValue ?? ""; }

  show(options = {}) {
    if (!this.#dialog || this.open) return;
    const detail = { modal: options.modal !== false };
    if (!emit(this, "gui:dialog-open-request", detail, true)) return;
    overlayController.open(this, { kind: "dialog", modal: detail.modal });
    if (detail.modal && this.#dialog.showModal) this.#dialog.showModal();
    else if (this.#dialog.show) this.#dialog.show();
    else this.#dialog.setAttribute("open", "");
    emit(this, "gui:dialog-open", detail);
  }

  close(returnValue = "", reason = "programmatic") {
    if (!this.open) return false;
    const detail = { returnValue, reason };
    if (!emit(this, "gui:dialog-close-request", detail, true)) return false;
    this.#returnValue = String(returnValue);
    this.#dialog.close?.(this.#returnValue);
    if (this.#dialog.open) this.#dialog.removeAttribute("open");
    overlayController.close(this, reason);
    emit(this, "gui:dialog-close", detail);
    return true;
  }

  #sync() {
    if (!this.#dialog) return;
    const label = this.getAttribute("label") ?? "Dialog";
    this.#title.textContent = label;
    this.shadowRoot.querySelector(".close").setAttribute(
      "aria-label",
      this.getAttribute("close-label") ?? "Close",
    );
  }
}

const POPOVER_STYLES = `
  :host { position: fixed; inset: auto; z-index: calc(1000 + var(--gui-overlay-index, 0));
    display: none; max-width: min(24rem, calc(100vw - 1rem)); color: var(--gui-text, #e5e7eb);
    background: var(--gui-surface, #111827); border: 1px solid var(--gui-border, #334155);
    border-radius: .55rem; box-shadow: 0 12px 36px #0007; }
  :host([open]) { display: block; }
  .surface { padding: var(--gui-popover-padding, .65rem); }
  @media (prefers-reduced-motion: no-preference) {
    :host([open]) { animation: gui-popover-in 110ms ease-out; transform-origin: top; }
    @keyframes gui-popover-in { from { opacity: 0; transform: scale(.97); } }
  }
`;

export class GuiPopover extends GuiElement {
  #outside = (event) => {
    const anchor = this.anchor;
    if (!this.contains(event.target) && !anchor?.contains?.(event.target)) this.hide("outside");
  };
  #escape = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      this.hide("escape");
    }
  };
  #resize = () => this.reposition();

  constructor() {
    super();
    if (!this.attachShadow) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${POPOVER_STYLES}</style><div class="surface" role="presentation"><slot></slot></div>`;
  }

  get open() { return this.hasAttribute?.("open") ?? false; }
  get anchor() {
    const id = this.getAttribute?.("anchor");
    return id ? document.getElementById(id) : this._anchor;
  }
  set anchor(value) { this._anchor = value; }

  show(anchor = this.anchor) {
    if (!anchor) throw new Error("A popover requires an anchor element.");
    this._anchor = anchor;
    if (!emit(this, "gui:popover-open-request", { anchor }, true)) return;
    overlayController.open(this, { kind: "popover", modal: false, restoreFocus: anchor });
    this.setAttribute("open", "");
    this.reposition();
    document.addEventListener("pointerdown", this.#outside, true);
    document.addEventListener("keydown", this.#escape, true);
    globalThis.addEventListener?.("resize", this.#resize);
    globalThis.addEventListener?.("scroll", this.#resize, true);
    emit(this, "gui:popover-open", {});
  }

  showAt(x, y) {
    const point = {
      contains: () => false,
      focus: () => {},
      getBoundingClientRect: () => ({
        x, y, left: x, right: x, top: y, bottom: y, width: 0, height: 0,
      }),
    };
    this.show(point);
  }

  hide(reason = "programmatic") {
    if (!this.open) return false;
    if (!emit(this, "gui:popover-close-request", { reason }, true)) return false;
    this.removeAttribute("open");
    document.removeEventListener("pointerdown", this.#outside, true);
    document.removeEventListener("keydown", this.#escape, true);
    globalThis.removeEventListener?.("resize", this.#resize);
    globalThis.removeEventListener?.("scroll", this.#resize, true);
    overlayController.close(this, reason);
    emit(this, "gui:popover-close", { reason });
    return true;
  }

  toggle(anchor = this.anchor) {
    if (this.open) this.hide();
    else this.show(anchor);
  }

  reposition() {
    if (!this.open || !this.anchor?.getBoundingClientRect) return;
    const anchor = this.anchor.getBoundingClientRect();
    const own = this.getBoundingClientRect();
    const gap = Number(this.getAttribute("gap")) || 6;
    const placement = this.getAttribute("placement") ?? "bottom-start";
    let top = placement.startsWith("top") ? anchor.top - own.height - gap : anchor.bottom + gap;
    let left = placement.endsWith("end") ? anchor.right - own.width : anchor.left;
    top = Math.max(4, Math.min(top, innerHeight - own.height - 4));
    left = Math.max(4, Math.min(left, innerWidth - own.width - 4));
    this.style.top = `${top}px`;
    this.style.left = `${left}px`;
  }
}

export class GuiContextMenu extends GuiPopover {
  #target = null;
  #listener = (event) => {
    event.preventDefault();
    this.showAt(event.clientX, event.clientY);
    queueMicrotask(() => this.querySelector("gui-menu")?.focusFirst());
  };

  connectedCallback() {
    const id = this.getAttribute("for");
    this.target = id ? document.getElementById(id) : this.previousElementSibling;
  }

  disconnectedCallback() {
    this.target = null;
    this.hide("disconnect");
  }

  set target(value) {
    this.#target?.removeEventListener?.("contextmenu", this.#listener);
    this.#target = value;
    this.#target?.addEventListener?.("contextmenu", this.#listener);
  }

  get target() {
    return this.#target;
  }
}

const MENU_STYLES = `
  :host { display: block; min-width: 12rem; }
  ::slotted([role^=menuitem]) { display: flex; width: 100%; box-sizing: border-box; gap: .6rem;
    padding: .5rem .65rem; color: inherit; background: transparent; border: 0; border-radius: .35rem; text-align: start; }
  ::slotted([role^=menuitem]:focus), ::slotted([role^=menuitem]:hover) {
    outline: none; background: color-mix(in srgb, var(--gui-accent, #60a5fa) 18%, transparent); }
`;

export class GuiMenu extends GuiElement {
  #slot;
  #commands = null;

  constructor() {
    super();
    if (!this.attachShadow) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${MENU_STYLES}</style><div role="menu"><slot></slot></div>`;
    this.#slot = root.querySelector("slot");
    this.#slot.addEventListener("slotchange", () => this.refresh());
    this.addEventListener("keydown", (event) => this.#keydown(event));
    this.addEventListener("click", (event) => this.#activate(event));
  }

  set commands(value) {
    this.#commands = value;
    this.refresh();
  }
  get commands() { return this.#commands; }

  connectedCallback() {
    this.setAttribute("role", "presentation");
    this.refresh();
  }

  items() {
    return [...this.children].filter((item) => item.matches("[role^=menuitem]"));
  }

  refresh() {
    for (const item of this.items()) {
      item.tabIndex = -1;
      const id = item.dataset.command;
      const command = id && this.#commands?.get(id);
      if (command) {
        item.toggleAttribute("disabled", !command.enabled);
        item.setAttribute("aria-disabled", String(!command.enabled));
        if (item.getAttribute("role") === "menuitemcheckbox") {
          item.setAttribute("aria-checked", String(command.checked));
        }
      }
    }
    const first = this.items().find((item) => !item.disabled);
    if (first) first.tabIndex = 0;
  }

  focusFirst() {
    this.items().find((item) => !item.disabled)?.focus();
  }

  #keydown(event) {
    const items = this.items().filter((item) => !item.disabled);
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (event.key === "ArrowDown") next = items[(index + 1 + items.length) % items.length];
    if (event.key === "ArrowUp") next = items[(index - 1 + items.length) % items.length];
    if (event.key === "Home") next = items[0];
    if (event.key === "End") next = items.at(-1);
    if (next) {
      event.preventDefault();
      items.forEach((item) => { item.tabIndex = item === next ? 0 : -1; });
      next.focus();
    }
  }

  #activate(event) {
    const item = event.target.closest?.("[role^=menuitem]");
    if (!item || item.disabled || item.getAttribute("aria-disabled") === "true") return;
    const commandId = item.dataset.command;
    if (commandId && this.#commands) {
      void this.#commands.execute(commandId, { source: "menu", menu: this });
    }
    emit(this, "gui:menu-select", { value: item.dataset.value, commandId });
  }
}

const TOOLTIP_STYLES = `
  :host { position: fixed; z-index: 1200; display: none; max-width: 20rem; padding: .35rem .5rem;
    color: var(--gui-tooltip-text, white); background: var(--gui-tooltip-background, #0f172a);
    border-radius: .35rem; box-shadow: 0 5px 18px #0006; font-size: .8rem; pointer-events: none; }
  :host([open]) { display: block; }
`;

export class GuiTooltip extends GuiElement {
  #target;
  #show = () => this.show();
  #hide = () => this.hide();

  constructor() {
    super();
    if (!this.attachShadow) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${TOOLTIP_STYLES}</style><div role="tooltip"><slot></slot></div>`;
  }

  connectedCallback() {
    const targetId = this.getAttribute("for");
    this.target = targetId ? document.getElementById(targetId) : this.previousElementSibling;
  }
  disconnectedCallback() { this.target = null; }

  set target(value) {
    if (this.#target) {
      this.#target.removeEventListener("mouseenter", this.#show);
      this.#target.removeEventListener("focus", this.#show);
      this.#target.removeEventListener("mouseleave", this.#hide);
      this.#target.removeEventListener("blur", this.#hide);
      this.#target.removeAttribute("aria-describedby");
    }
    this.#target = value;
    if (value) {
      if (!this.id) this.id = `gui-tooltip-${Math.random().toString(36).slice(2)}`;
      value.setAttribute("aria-describedby", this.id);
      value.addEventListener("mouseenter", this.#show);
      value.addEventListener("focus", this.#show);
      value.addEventListener("mouseleave", this.#hide);
      value.addEventListener("blur", this.#hide);
    }
  }
  get target() { return this.#target; }

  show() {
    if (!this.#target) return;
    this.setAttribute("open", "");
    const anchor = this.#target.getBoundingClientRect();
    const own = this.getBoundingClientRect();
    this.style.left = `${Math.max(4, Math.min(anchor.left + (anchor.width - own.width) / 2, innerWidth - own.width - 4))}px`;
    this.style.top = `${Math.max(4, anchor.top - own.height - 6)}px`;
  }
  hide() { this.removeAttribute("open"); }
}

export const overlayController = new GuiOverlayController();

export const overlaysModule = Object.freeze({
  id: "overlays",
  version: "0.1.0",
  description: "Accessible dialogs, popovers, menus, tooltips, and overlay stacking.",
  dependencies: [],
  components: ["gui-dialog", "gui-popover", "gui-context-menu", "gui-menu", "gui-tooltip"],
  setup() {
    if (hasDOM) {
      [
        ["gui-dialog", GuiDialog],
        ["gui-popover", GuiPopover],
        ["gui-context-menu", GuiContextMenu],
        ["gui-menu", GuiMenu],
        ["gui-tooltip", GuiTooltip],
      ].forEach(([name, constructor]) => {
        if (!customElements.get(name)) customElements.define(name, constructor);
      });
    }
    return { overlayController };
  },
});

if (hasDOM) {
  [
    ["gui-dialog", GuiDialog],
    ["gui-popover", GuiPopover],
    ["gui-context-menu", GuiContextMenu],
    ["gui-menu", GuiMenu],
    ["gui-tooltip", GuiTooltip],
  ].forEach(([name, constructor]) => {
    if (!customElements.get(name)) customElements.define(name, constructor);
  });
}
