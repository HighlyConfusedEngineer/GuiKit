const GuiElement = globalThis.HTMLElement ?? class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function emit(target, type, detail, cancelable = false) {
  if (typeof CustomEvent === "undefined") return true;
  return target.dispatchEvent(new CustomEvent(type, {
    bubbles: true,
    cancelable,
    composed: true,
    detail,
  }));
}

function normalizePanel(panel) {
  if (!panel?.id || !/^[a-z][a-z0-9._:-]*$/i.test(panel.id)) {
    throw new TypeError("Every workspace panel requires a stable id.");
  }
  return {
    id: panel.id,
    title: panel.title ?? panel.id,
    icon: panel.icon ?? "",
    closable: panel.closable !== false,
    detachable: panel.detachable !== false,
    data: clone(panel.data ?? {}),
  };
}

function normalizeNode(node, panels) {
  if (!node) return { type: "tabs", id: "root", panels: [...panels.keys()], active: panels.keys().next().value ?? null };
  if (node.type === "split") {
    const children = (node.children ?? []).map((child) => normalizeNode(child, panels));
    if (children.length < 2) throw new Error("A workspace split requires at least two children.");
    let sizes = (node.sizes ?? []).map(Number);
    if (sizes.length !== children.length || sizes.some((size) => !Number.isFinite(size) || size <= 0)) {
      sizes = children.map(() => 1 / children.length);
    }
    const total = sizes.reduce((sum, size) => sum + size, 0);
    return {
      type: "split",
      id: node.id ?? `split-${Math.random().toString(36).slice(2)}`,
      direction: node.direction === "vertical" ? "vertical" : "horizontal",
      sizes: sizes.map((size) => size / total),
      children,
    };
  }
  const ids = [...new Set(node.panels ?? [])].filter((id) => panels.has(id));
  return {
    type: "tabs",
    id: node.id ?? `tabs-${Math.random().toString(36).slice(2)}`,
    panels: ids,
    active: ids.includes(node.active) ? node.active : ids[0] ?? null,
  };
}

function walk(node, callback, parent = null) {
  callback(node, parent);
  if (node.type === "split") node.children.forEach((child) => walk(child, callback, node));
}

export class GuiWorkspaceModel extends GuiEventTarget {
  #panels = new Map();
  #layout;
  #presets = new Map();

  constructor(data = {}) {
    super();
    for (const panel of data.panels ?? []) {
      const normalized = normalizePanel(panel);
      if (this.#panels.has(normalized.id)) throw new Error(`Panel "${normalized.id}" is duplicated.`);
      this.#panels.set(normalized.id, normalized);
    }
    this.#layout = normalizeNode(data.layout, this.#panels);
    for (const [id, preset] of Object.entries(data.presets ?? {})) this.#presets.set(id, clone(preset));
    this.#placeMissingPanels();
  }

  get panels() { return [...this.#panels.values()].map(clone); }
  get layout() { return clone(this.#layout); }

  addPanel(panel, targetGroup = null) {
    const normalized = normalizePanel(panel);
    if (this.#panels.has(normalized.id)) throw new Error(`Panel "${normalized.id}" already exists.`);
    const detail = { panel: clone(normalized), targetGroup };
    if (!emit(this, "gui:workspace-panel-add-request", detail, true)) return false;
    this.#panels.set(normalized.id, normalized);
    const group = this.#findGroup(targetGroup) ?? this.#firstGroup();
    group.panels.push(normalized.id);
    group.active = normalized.id;
    this.#notify("add-panel", detail);
    return true;
  }

  removePanel(id) {
    const panel = this.#panels.get(id);
    if (!panel || !panel.closable) return false;
    const detail = { panel: clone(panel) };
    if (!emit(this, "gui:workspace-panel-close-request", detail, true)) return false;
    this.#panels.delete(id);
    walk(this.#layout, (node) => {
      if (node.type !== "tabs") return;
      node.panels = node.panels.filter((panelId) => panelId !== id);
      if (node.active === id) node.active = node.panels[0] ?? null;
    });
    this.#notify("remove-panel", detail);
    return true;
  }

  activate(id) {
    let group = null;
    walk(this.#layout, (node) => {
      if (node.type === "tabs" && node.panels.includes(id)) group = node;
    });
    if (!group) return false;
    group.active = id;
    this.#notify("activate", { id, group: group.id });
    return true;
  }

  movePanel(id, targetGroupId, index = Infinity) {
    if (!this.#panels.has(id)) throw new Error(`Unknown panel "${id}".`);
    const target = this.#findGroup(targetGroupId);
    if (!target) throw new Error(`Unknown tab group "${targetGroupId}".`);
    const detail = { id, targetGroup: targetGroupId, index };
    if (!emit(this, "gui:workspace-panel-move-request", detail, true)) return false;
    walk(this.#layout, (node) => {
      if (node.type !== "tabs") return;
      node.panels = node.panels.filter((panelId) => panelId !== id);
      if (node.active === id) node.active = node.panels[0] ?? null;
    });
    target.panels.splice(Math.max(0, Math.min(target.panels.length, index)), 0, id);
    target.active = id;
    this.#notify("move-panel", detail);
    return true;
  }

  split(groupId, direction, options = {}) {
    const group = this.#findGroup(groupId);
    if (!group) throw new Error(`Unknown tab group "${groupId}".`);
    const panelIds = options.panels ?? [];
    const nextGroup = normalizeNode({
      type: "tabs",
      id: options.id,
      panels: panelIds,
      active: options.active,
    }, this.#panels);
    const split = {
      type: "split",
      id: options.splitId ?? `split-${Math.random().toString(36).slice(2)}`,
      direction: direction === "vertical" ? "vertical" : "horizontal",
      sizes: [options.ratio ?? 0.5, 1 - (options.ratio ?? 0.5)],
      children: options.before ? [nextGroup, group] : [group, nextGroup],
    };
    if (this.#layout === group) this.#layout = split;
    else {
      walk(this.#layout, (node) => {
        if (node.type !== "split") return;
        const index = node.children.indexOf(group);
        if (index >= 0) node.children[index] = split;
      });
    }
    this.#notify("split", { groupId, split: split.id, group: nextGroup.id });
    return nextGroup.id;
  }

  resize(splitId, sizes) {
    let split;
    walk(this.#layout, (node) => { if (node.id === splitId && node.type === "split") split = node; });
    if (!split) throw new Error(`Unknown split "${splitId}".`);
    if (!Array.isArray(sizes) || sizes.length !== split.children.length) {
      throw new TypeError("Split sizes must match its children.");
    }
    const normalized = sizes.map((size) => Math.max(0.05, Number(size) || 0.05));
    const total = normalized.reduce((sum, size) => sum + size, 0);
    split.sizes = normalized.map((size) => size / total);
    this.#notify("resize", { splitId, sizes: [...split.sizes] });
  }

  detach(id) {
    const panel = this.#panels.get(id);
    if (!panel || !panel.detachable) return false;
    const detail = { panel: clone(panel), layout: this.layout };
    if (!emit(this, "gui:workspace-panel-detach-request", detail, true)) return false;
    emit(this, "gui:workspace-panel-detach", detail);
    return true;
  }

  savePreset(id) {
    this.#presets.set(id, this.layout);
    this.#notify("preset-save", { id });
  }

  restorePreset(id) {
    const preset = this.#presets.get(id);
    if (!preset) return false;
    this.#layout = normalizeNode(preset, this.#panels);
    this.#placeMissingPanels();
    this.#notify("preset-restore", { id });
    return true;
  }

  restore(data) {
    const panels = new Map((data.panels ?? this.panels).map((panel) => {
      const normalized = normalizePanel(panel);
      return [normalized.id, normalized];
    }));
    this.#panels = panels;
    this.#layout = normalizeNode(data.layout, panels);
    this.#placeMissingPanels();
    this.#notify("restore");
  }

  toJSON() {
    return {
      schema: "guikit.workspace/v1",
      panels: this.panels,
      layout: this.layout,
      presets: Object.fromEntries([...this.#presets].map(([id, preset]) => [id, clone(preset)])),
    };
  }

  #findGroup(id) {
    if (!id) return null;
    let group = null;
    walk(this.#layout, (node) => { if (node.type === "tabs" && node.id === id) group = node; });
    return group;
  }

  #firstGroup() {
    let group = null;
    walk(this.#layout, (node) => { if (!group && node.type === "tabs") group = node; });
    return group;
  }

  #placeMissingPanels() {
    const placed = new Set();
    walk(this.#layout, (node) => {
      if (node.type === "tabs") node.panels.forEach((id) => placed.add(id));
    });
    const first = this.#firstGroup();
    for (const id of this.#panels.keys()) {
      if (!placed.has(id)) first.panels.push(id);
    }
    if (!first.active) first.active = first.panels[0] ?? null;
  }

  #notify(operation, detail = {}) {
    emit(this, "gui:workspace-change", {
      operation,
      layout: this.layout,
      ...detail,
    });
  }
}

const WORKSPACE_STYLES = `
  :host { display: block; min-width: 0; min-height: 0; height: 100%; color: var(--gui-text, #e5e7eb); }
  .workspace, .split, .tabs { width: 100%; height: 100%; min-width: 0; min-height: 0; }
  .split { display: flex; }
  .split.vertical { flex-direction: column; }
  .pane { min-width: 0; min-height: 0; overflow: hidden; }
  .splitter { flex: 0 0 5px; background: transparent; position: relative; outline: none; }
  .splitter::after { content: ""; position: absolute; inset: 1px; background: var(--gui-border, #334155); border-radius: 1rem; }
  .split.horizontal > .splitter { cursor: col-resize; }
  .split.vertical > .splitter { cursor: row-resize; }
  .splitter:focus::after, .splitter:hover::after { background: var(--gui-accent, #60a5fa); }
  .tabs { display: grid; grid-template-rows: auto 1fr; background: var(--gui-surface, #111827);
    border: 1px solid var(--gui-border, #334155); }
  [role=tablist] { display: flex; min-width: 0; overflow-x: auto; background: var(--gui-surface-raised, #172033);
    border-bottom: 1px solid var(--gui-border, #334155); }
  [role=tab] { display: flex; align-items: center; gap: .35rem; padding: .48rem .7rem; color: inherit;
    background: transparent; border: 0; border-bottom: 2px solid transparent; font: inherit; white-space: nowrap; }
  [role=tab][aria-selected=true] { border-bottom-color: var(--gui-accent, #60a5fa); }
  [role=tab] .close { padding: 0 .2rem; color: var(--gui-text-muted, #94a3b8); background: transparent; border: 0; }
  [role=tabpanel] { min-width: 0; min-height: 0; overflow: auto; }
  .empty { display: grid; place-items: center; color: var(--gui-text-muted, #94a3b8); }
  .drop-target { outline: 2px solid var(--gui-accent, #60a5fa); outline-offset: -3px; }
`;

export class GuiWorkspace extends GuiElement {
  #model;
  #root;
  #listener = () => this.render();
  #drag = null;
  #persistence = null;
  #storageKey = "workspace";

  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${WORKSPACE_STYLES}</style><div class="workspace"></div>`;
    this.#root.addEventListener("click", (event) => this.#click(event));
    this.#root.addEventListener("keydown", (event) => this.#keydown(event));
    this.#root.addEventListener("dragstart", (event) => this.#dragStart(event));
    this.#root.addEventListener("dragover", (event) => this.#dragOver(event));
    this.#root.addEventListener("dragleave", (event) => event.target.closest?.(".tabs")?.classList.remove("drop-target"));
    this.#root.addEventListener("drop", (event) => this.#drop(event));
    this.#root.addEventListener("pointerdown", (event) => this.#resizeStart(event));
  }

  set model(value) {
    this.#model?.removeEventListener?.("gui:workspace-change", this.#listener);
    this.#model = value;
    this.#model?.addEventListener?.("gui:workspace-change", this.#listener);
    this.render();
  }
  get model() { return this.#model; }
  get value() { return this.#model?.toJSON(); }
  set value(value) {
    if (this.#model) this.#model.restore(value);
    else this.model = new GuiWorkspaceModel(value);
  }

  connectedCallback() {
    if (!this.#model) {
      const inline = this.querySelector?.('script[type="application/json"]');
      this.model = new GuiWorkspaceModel(inline ? JSON.parse(inline.textContent) : {});
    }
  }
  disconnectedCallback() {
    this.#model?.removeEventListener?.("gui:workspace-change", this.#listener);
  }

  usePersistence(store, key = "workspace") {
    this.#persistence = store;
    this.#storageKey = key;
    const saved = store.load(key);
    if (saved) this.#model.restore(saved);
  }

  save() {
    return this.#persistence?.save(this.#storageKey, this.#model.toJSON());
  }

  render() {
    const root = this.#root?.querySelector(".workspace");
    if (!root || !this.#model) return;
    root.replaceChildren(this.#renderNode(this.#model.layout));
  }

  #renderNode(node) {
    if (node.type === "split") {
      const split = document.createElement("div");
      split.className = `split ${node.direction}`;
      split.dataset.split = node.id;
      node.children.forEach((child, index) => {
        const pane = document.createElement("div");
        pane.className = "pane";
        pane.style.flex = `${node.sizes[index]} 1 0`;
        pane.append(this.#renderNode(child));
        split.append(pane);
        if (index < node.children.length - 1) {
          const splitter = document.createElement("div");
          splitter.className = "splitter";
          splitter.tabIndex = 0;
          splitter.role = "separator";
          splitter.dataset.splitter = index;
          splitter.setAttribute("aria-orientation", node.direction === "vertical" ? "horizontal" : "vertical");
          splitter.setAttribute("aria-valuemin", "5");
          splitter.setAttribute("aria-valuemax", "95");
          splitter.setAttribute("aria-valuenow", String(Math.round(node.sizes[index] * 100)));
          split.append(splitter);
        }
      });
      return split;
    }
    const group = document.createElement("section");
    group.className = "tabs";
    group.dataset.group = node.id;
    const tablist = document.createElement("div");
    tablist.role = "tablist";
    for (const panelId of node.panels) {
      const panel = this.#model.panels.find((candidate) => candidate.id === panelId);
      if (!panel) continue;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.role = "tab";
      tab.draggable = true;
      tab.dataset.panel = panel.id;
      tab.setAttribute("aria-selected", String(node.active === panel.id));
      tab.tabIndex = node.active === panel.id ? 0 : -1;
      const title = document.createElement("span");
      title.textContent = panel.title;
      tab.append(title);
      if (panel.closable) {
        const close = document.createElement("span");
        close.className = "close";
        close.dataset.closePanel = panel.id;
        close.role = "button";
        close.setAttribute("aria-label", `Close ${panel.title}`);
        close.textContent = "×";
        tab.append(close);
      }
      tablist.append(tab);
    }
    const content = document.createElement("div");
    content.role = "tabpanel";
    if (node.active) {
      const slot = document.createElement("slot");
      slot.name = node.active;
      content.append(slot);
    } else {
      content.className = "empty";
      content.textContent = this.getAttribute("empty-label") ?? "Drop a panel here";
    }
    group.append(tablist, content);
    return group;
  }

  #click(event) {
    const close = event.target.closest?.("[data-close-panel]");
    if (close) {
      event.stopPropagation();
      this.#model.removePanel(close.dataset.closePanel);
      return;
    }
    const tab = event.target.closest?.("[data-panel]");
    if (tab) this.#model.activate(tab.dataset.panel);
  }

  #keydown(event) {
    const tab = event.target.closest?.('[role="tab"]');
    if (tab) {
      const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
      const index = tabs.indexOf(tab);
      let next;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs.at(-1);
      if (event.key === "Delete") {
        this.#model.removePanel(tab.dataset.panel);
        event.preventDefault();
      } else if (next) {
        this.#model.activate(next.dataset.panel);
        next.focus();
        event.preventDefault();
      }
      return;
    }
    const splitter = event.target.closest?.(".splitter");
    if (!splitter || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const split = splitter.parentElement;
    const layout = this.#findLayout(split.dataset.split);
    const index = Number(splitter.dataset.splitter);
    const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 0.02 : -0.02;
    const sizes = [...layout.sizes];
    sizes[index] += delta;
    sizes[index + 1] -= delta;
    this.#model.resize(layout.id, sizes);
    event.preventDefault();
  }

  #dragStart(event) {
    const tab = event.target.closest?.("[data-panel]");
    if (!tab) return;
    this.#drag = tab.dataset.panel;
    event.dataTransfer?.setData("application/x-guikit-panel", this.#drag);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  #dragOver(event) {
    const group = event.target.closest?.(".tabs");
    if (!group || !this.#drag) return;
    event.preventDefault();
    group.classList.add("drop-target");
  }

  #drop(event) {
    const group = event.target.closest?.(".tabs");
    if (!group) return;
    event.preventDefault();
    group.classList.remove("drop-target");
    const id = event.dataTransfer?.getData("application/x-guikit-panel") || this.#drag;
    this.#drag = null;
    if (id) this.#model.movePanel(id, group.dataset.group);
  }

  #resizeStart(event) {
    const splitter = event.target.closest?.(".splitter");
    if (!splitter || event.button !== 0) return;
    const splitElement = splitter.parentElement;
    const layout = this.#findLayout(splitElement.dataset.split);
    const index = Number(splitter.dataset.splitter);
    const rect = splitElement.getBoundingClientRect();
    const start = layout.direction === "vertical" ? event.clientY : event.clientX;
    const extent = layout.direction === "vertical" ? rect.height : rect.width;
    const initial = [...layout.sizes];
    splitter.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const current = layout.direction === "vertical" ? moveEvent.clientY : moveEvent.clientX;
      const delta = (current - start) / extent;
      const sizes = [...initial];
      sizes[index] += delta;
      sizes[index + 1] -= delta;
      this.#model.resize(layout.id, sizes);
    };
    const end = () => {
      splitter.removeEventListener("pointermove", move);
      splitter.removeEventListener("pointerup", end);
      this.save();
    };
    splitter.addEventListener("pointermove", move);
    splitter.addEventListener("pointerup", end);
  }

  #findLayout(id) {
    let found;
    walk(this.#model.layout, (node) => { if (node.id === id) found = node; });
    return found;
  }
}

export const workspaceModule = Object.freeze({
  id: "workspace",
  version: "0.1.0",
  description: "Dockable, resizable, tabbed, detachable, and persistable workspaces.",
  dependencies: [],
  components: ["gui-workspace"],
  setup() {
    if (hasDOM && !customElements.get("gui-workspace")) customElements.define("gui-workspace", GuiWorkspace);
    return { GuiWorkspaceModel };
  },
});

if (hasDOM && !customElements.get("gui-workspace")) customElements.define("gui-workspace", GuiWorkspace);
