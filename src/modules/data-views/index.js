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

export class GuiDataCollection extends GuiEventTarget {
  #source = [];
  #view = [];
  #key;
  #sort = [];
  #filters = new Map();
  #selection = new Set();

  constructor(rows = [], options = {}) {
    super();
    this.#key = options.key ?? "id";
    this.setRows(rows);
  }

  get length() { return this.#view.length; }
  get sourceLength() { return this.#source.length; }
  get sort() { return clone(this.#sort); }
  get selectedKeys() { return [...this.#selection]; }

  setRows(rows) {
    if (!Array.isArray(rows)) throw new TypeError("Rows must be an array.");
    this.#source = rows.map((row, index) => ({
      ...clone(row),
      [this.#key]: row?.[this.#key] ?? `row-${index}`,
    }));
    this.#apply("rows");
  }

  append(rows) {
    const records = Array.isArray(rows) ? rows : [rows];
    const offset = this.#source.length;
    this.#source.push(...records.map((row, index) => ({
      ...clone(row),
      [this.#key]: row?.[this.#key] ?? `row-${offset + index}`,
    })));
    this.#apply("append");
  }

  at(index) { return clone(this.#view[index]); }
  keyAt(index) { return this.#view[index]?.[this.#key]; }
  indexOf(key) { return this.#view.findIndex((row) => Object.is(row[this.#key], key)); }
  slice(start, end) { return clone(this.#view.slice(start, end)); }

  setSort(sort = []) {
    this.#sort = (Array.isArray(sort) ? sort : [sort])
      .filter((rule) => rule?.field)
      .map((rule) => ({ field: rule.field, direction: rule.direction === "desc" ? "desc" : "asc" }));
    this.#apply("sort");
  }

  setFilter(field, predicate) {
    if (predicate == null || predicate === "") this.#filters.delete(field);
    else if (typeof predicate === "function") this.#filters.set(field, predicate);
    else {
      const query = String(predicate).toLocaleLowerCase();
      this.#filters.set(field, (value) => String(value ?? "").toLocaleLowerCase().includes(query));
    }
    this.#apply("filter");
  }

  clearFilters() {
    this.#filters.clear();
    this.#apply("filter");
  }

  select(key, options = {}) {
    const row = this.#source.find((candidate) => Object.is(candidate[this.#key], key));
    if (!row) return false;
    const next = options.additive ? new Set(this.#selection) : new Set();
    if (options.toggle && next.has(key)) next.delete(key);
    else next.add(key);
    const detail = { selectedKeys: [...next], key, row: clone(row) };
    if (!emit(this, "gui:data-selection-request", detail, true)) return false;
    this.#selection = next;
    this.#notify("selection");
    return true;
  }

  clearSelection() {
    if (!this.#selection.size) return;
    this.#selection.clear();
    this.#notify("selection");
  }

  update(key, patch) {
    const row = this.#source.find((candidate) => Object.is(candidate[this.#key], key));
    if (!row) return false;
    Object.assign(row, clone(patch), { [this.#key]: key });
    this.#apply("update");
    return true;
  }

  groups(field) {
    const groups = new Map();
    for (const row of this.#view) {
      const key = row[field];
      const rows = groups.get(key) ?? [];
      rows.push(clone(row));
      groups.set(key, rows);
    }
    return [...groups].map(([value, rows]) => ({ value: clone(value), rows }));
  }

  toCSV(fields = undefined) {
    const columns = fields?.length
      ? [...fields]
      : [...new Set(this.#view.flatMap((row) => Object.keys(row)))];
    const escape = (value) => {
      const text = value == null ? "" : (
        typeof value === "object" ? JSON.stringify(value) : String(value)
      );
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    return [
      columns.map(escape).join(","),
      ...this.#view.map((row) => columns.map((field) => escape(row[field])).join(",")),
    ].join("\r\n");
  }

  toJSON() {
    return {
      rows: clone(this.#source),
      sort: this.sort,
      selectedKeys: this.selectedKeys,
    };
  }

  #apply(operation) {
    this.#view = this.#source.filter((row) => (
      [...this.#filters].every(([field, predicate]) => predicate(row[field], clone(row)))
    ));
    if (this.#sort.length) {
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
      this.#view.sort((first, second) => {
        for (const rule of this.#sort) {
          const a = first[rule.field];
          const b = second[rule.field];
          const result = typeof a === "number" && typeof b === "number"
            ? a - b
            : collator.compare(String(a ?? ""), String(b ?? ""));
          if (result) return rule.direction === "desc" ? -result : result;
        }
        return 0;
      });
    }
    this.#selection = new Set([...this.#selection].filter((key) => (
      this.#source.some((row) => Object.is(row[this.#key], key))
    )));
    this.#notify(operation);
  }

  #notify(operation) {
    emit(this, "gui:data-change", {
      operation,
      length: this.length,
      sourceLength: this.sourceLength,
      selectedKeys: this.selectedKeys,
    });
  }
}

export class GuiPagedDataSource extends GuiEventTarget {
  #loader;
  #cache = new Map();
  #maxPages;
  constructor(loader, options = {}) {
    super();
    if (typeof loader !== "function") throw new TypeError("A paged data source requires a loader.");
    this.#loader = loader;
    this.pageSize = Math.max(1, Number(options.pageSize) || 100);
    this.total = Math.max(0, Number(options.total) || 0);
    this.#maxPages = Math.max(1, Number(options.maxPages) || 10);
  }
  async page(index, options = {}) {
    const page = Math.max(0, Math.floor(Number(index) || 0));
    if (this.#cache.has(page) && !options.reload) return clone(this.#cache.get(page));
    const result = await this.#loader({
      page,
      pageSize: this.pageSize,
      offset: page * this.pageSize,
      signal: options.signal,
      sort: clone(options.sort ?? []),
      filters: clone(options.filters ?? {}),
    });
    const normalized = {
      page,
      rows: clone(result?.rows ?? result ?? []),
      total: Math.max(0, Number(result?.total ?? this.total) || 0),
    };
    this.total = normalized.total;
    this.#cache.set(page, normalized);
    while (this.#cache.size > this.#maxPages) this.#cache.delete(this.#cache.keys().next().value);
    emit(this, "gui:data-page", clone(normalized));
    return clone(normalized);
  }
  invalidate(page = undefined) {
    if (page === undefined) this.#cache.clear();
    else this.#cache.delete(Math.max(0, Math.floor(Number(page) || 0)));
  }
}

export class GuiTreeModel extends GuiEventTarget {
  #roots = [];
  #expanded = new Set();
  #key;
  #children;

  constructor(nodes = [], options = {}) {
    super();
    this.#key = options.key ?? "id";
    this.#children = options.children ?? "children";
    this.setNodes(nodes);
  }

  setNodes(nodes) {
    this.#roots = clone(nodes ?? []);
    this.#assertUnique();
    emit(this, "gui:tree-change", { operation: "nodes" });
  }

  toggle(key, force) {
    const node = this.find(key);
    if (!node) return false;
    const next = force ?? !this.#expanded.has(key);
    if (next) this.#expanded.add(key);
    else this.#expanded.delete(key);
    emit(this, "gui:tree-change", { operation: "toggle", key, expanded: next });
    return next;
  }

  expandAll() {
    for (const item of this.flatten({ includeCollapsed: true })) {
      if (item.hasChildren) this.#expanded.add(item.key);
    }
    emit(this, "gui:tree-change", { operation: "expand-all" });
  }

  collapseAll() {
    this.#expanded.clear();
    emit(this, "gui:tree-change", { operation: "collapse-all" });
  }

  find(key) {
    return clone(this.flatten({ includeCollapsed: true }).find((item) => Object.is(item.key, key))?.node);
  }

  flatten(options = {}) {
    const result = [];
    const walk = (nodes, level, parentKey = null) => {
      for (const node of nodes ?? []) {
        const key = node[this.#key];
        const children = node[this.#children] ?? [];
        const expanded = this.#expanded.has(key);
        result.push({
          key,
          node: clone(node),
          level,
          parentKey,
          expanded,
          hasChildren: children.length > 0,
          positionInSet: (nodes ?? []).indexOf(node) + 1,
          setSize: nodes.length,
        });
        if (children.length && (expanded || options.includeCollapsed)) walk(children, level + 1, key);
      }
    };
    walk(this.#roots, 1);
    return result;
  }

  toJSON() { return { nodes: clone(this.#roots), expanded: [...this.#expanded] }; }

  #assertUnique() {
    const keys = new Set();
    for (const item of this.flatten({ includeCollapsed: true })) {
      if (item.key == null) throw new Error("Every tree node requires an id.");
      if (keys.has(item.key)) throw new Error(`Tree node "${item.key}" is duplicated.`);
      keys.add(item.key);
    }
  }
}

const VIRTUAL_STYLES = `
  :host { display: block; min-height: 8rem; overflow: auto; contain: strict;
    color: var(--gui-text, #e5e7eb); }
  .space { position: relative; min-width: 100%; }
  .items { position: absolute; inset: 0 0 auto; }
  .item { position: absolute; left: 0; right: 0; box-sizing: border-box; overflow: hidden; }
`;

export class GuiVirtualList extends GuiElement {
  #items = [];
  #root;
  #space;
  #layer;
  #itemHeight = 36;
  #overscan = 5;
  #renderItem = null;
  #resizeObserver;
  #scheduled = false;

  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${VIRTUAL_STYLES}</style><div class="space"><div class="items"></div></div>`;
    this.#space = this.#root.querySelector(".space");
    this.#layer = this.#root.querySelector(".items");
    this.addEventListener("scroll", () => this.requestRender(), { passive: true });
    this.#resizeObserver = globalThis.ResizeObserver
      ? new ResizeObserver(() => this.requestRender())
      : null;
  }

  connectedCallback() {
    this.#resizeObserver?.observe(this);
    this.render();
  }
  disconnectedCallback() { this.#resizeObserver?.disconnect(); }
  get itemHeight() { return this.#itemHeight; }
  set itemHeight(value) {
    this.#itemHeight = Math.max(16, Number(value) || 36);
    this.render();
  }
  get overscan() { return this.#overscan; }
  set overscan(value) { this.#overscan = Math.max(0, Number(value) || 0); this.render(); }
  get items() { return clone(this.#items); }
  set items(value) { this.#items = [...(value ?? [])]; this.render(); }
  set renderItem(value) { this.#renderItem = value; this.render(); }
  get renderItem() { return this.#renderItem; }

  scrollToIndex(index, options = {}) {
    const top = Math.max(0, Math.min(this.#items.length - 1, index)) * this.#itemHeight;
    this.scrollTo({ top, behavior: options.behavior ?? "auto" });
  }

  requestRender() {
    if (this.#scheduled) return;
    this.#scheduled = true;
    requestAnimationFrame(() => {
      this.#scheduled = false;
      this.render();
    });
  }

  render() {
    if (!this.#space || !this.#layer) return;
    const height = this.clientHeight || 300;
    const start = Math.max(0, Math.floor(this.scrollTop / this.#itemHeight) - this.#overscan);
    const count = Math.ceil(height / this.#itemHeight) + this.#overscan * 2;
    const end = Math.min(this.#items.length, start + count);
    this.#space.style.height = `${this.#items.length * this.#itemHeight}px`;
    this.#layer.replaceChildren();
    for (let index = start; index < end; index += 1) {
      const row = document.createElement("div");
      row.className = "item";
      row.style.top = `${index * this.#itemHeight}px`;
      row.style.height = `${this.#itemHeight}px`;
      row.dataset.index = index;
      const content = this.#renderItem?.(clone(this.#items[index]), index);
      if (content instanceof Node) row.append(content);
      else row.textContent = content == null ? String(this.#items[index] ?? "") : String(content);
      this.#layer.append(row);
    }
    emit(this, "gui:virtual-range", { start, end, total: this.#items.length });
  }
}

const GRID_STYLES = `
  :host { display: grid; grid-template-rows: auto 1fr; min-height: 12rem; overflow: hidden;
    color: var(--gui-text, #e5e7eb); border: 1px solid var(--gui-border, #334155); border-radius: .55rem; }
  .header { display: grid; min-width: max-content; background: var(--gui-surface-raised, #172033);
    border-bottom: 1px solid var(--gui-border, #334155); }
  .header button { min-width: 0; padding: .55rem .65rem; color: inherit; background: transparent;
    border: 0; border-inline-end: 1px solid var(--gui-border, #334155); text-align: start; font: inherit; font-weight: 700; }
  .viewport { position: relative; overflow: auto; outline: none; }
  .space { position: relative; min-width: max-content; }
  .rows { position: absolute; inset: 0 0 auto; }
  .row { position: absolute; display: grid; min-width: max-content; box-sizing: border-box;
    border-bottom: 1px solid color-mix(in srgb, var(--gui-border, #334155) 70%, transparent); }
  .row[aria-selected=true] { background: color-mix(in srgb, var(--gui-accent, #60a5fa) 18%, transparent); }
  .cell { min-width: 0; overflow: hidden; padding: .5rem .65rem; text-overflow: ellipsis; white-space: nowrap; }
  .pinned { position: sticky; z-index: 2; background: var(--gui-surface-raised, #172033); }
  .row .pinned { background: var(--gui-surface, #111827); }
  .row[aria-selected=true] .pinned {
    background: color-mix(in srgb, var(--gui-accent, #60a5fa) 18%, var(--gui-surface, #111827));
  }
  .cell[contenteditable=true]:focus { outline: 2px solid var(--gui-accent, #60a5fa); outline-offset: -2px; }
`;

export class GuiDataGrid extends GuiElement {
  #root;
  #header;
  #viewport;
  #space;
  #rowsLayer;
  #model;
  #columns = [];
  #rowHeight = 38;
  #active = 0;
  #modelListener = () => this.render();
  #renderers = new Map();
  #dataSource = null;
  #page = 0;

  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${GRID_STYLES}</style>
      <div class="header" role="row"></div>
      <div class="viewport" role="grid" tabindex="0"><div class="space"><div class="rows"></div></div></div>`;
    this.#header = this.#root.querySelector(".header");
    this.#viewport = this.#root.querySelector(".viewport");
    this.#space = this.#root.querySelector(".space");
    this.#rowsLayer = this.#root.querySelector(".rows");
    this.#viewport.addEventListener("scroll", () => this.render(), { passive: true });
    this.#viewport.addEventListener("keydown", (event) => this.#keydown(event));
    this.#root.addEventListener("click", (event) => this.#click(event));
    this.#root.addEventListener("focusout", (event) => this.#edit(event));
  }

  set model(value) {
    this.#model?.removeEventListener?.("gui:data-change", this.#modelListener);
    this.#model = value;
    this.#model?.addEventListener?.("gui:data-change", this.#modelListener);
    this.render();
  }
  get model() { return this.#model; }
  set rows(value) {
    if (!this.#model) this.model = new GuiDataCollection(value);
    else this.#model.setRows(value);
  }
  get rows() { return this.#model?.slice(0, this.#model.length) ?? []; }
  set columns(value) {
    this.#columns = (value ?? []).map((column) => ({
      field: column.field,
      label: column.label ?? column.field,
      width: column.width ?? "minmax(8rem, 1fr)",
      pinned: column.pinned === "end" ? "end" : (column.pinned ? "start" : null),
      sortable: column.sortable !== false,
      editable: Boolean(column.editable),
      renderer: column.renderer,
    }));
    this.render();
  }
  get columns() { return clone(this.#columns); }
  set rowHeight(value) { this.#rowHeight = Math.max(24, Number(value) || 38); this.render(); }
  get rowHeight() { return this.#rowHeight; }

  registerRenderer(id, renderer) {
    this.#renderers.set(id, renderer);
    this.render();
    return () => this.#renderers.delete(id);
  }

  async setDataSource(source, options = {}) {
    this.#dataSource = source;
    return this.loadPage(options.page ?? 0, options);
  }

  async loadPage(index, options = {}) {
    if (!this.#dataSource?.page) throw new Error("No paged data source is configured.");
    const result = await this.#dataSource.page(index, {
      ...options,
      sort: this.#model?.sort ?? [],
    });
    this.#page = result.page;
    this.rows = result.rows;
    emit(this, "gui:grid-page", {
      page: result.page,
      pageSize: this.#dataSource.pageSize,
      total: result.total,
    });
    return result;
  }

  export(format = "json", fields = this.#columns.map((column) => column.field)) {
    if (format === "csv") return this.#model.toCSV(fields);
    return JSON.stringify(this.#model.slice(0, this.#model.length), null, 2);
  }

  connectedCallback() {
    if (!this.#model) this.model = new GuiDataCollection();
    this.render();
  }
  disconnectedCallback() {
    this.#model?.removeEventListener?.("gui:data-change", this.#modelListener);
  }

  render() {
    if (!this.#model || !this.#viewport) return;
    const template = this.#columns.map((column) => (
      typeof column.width === "number" ? `${column.width}px` : column.width
    )).join(" ");
    this.#header.style.gridTemplateColumns = template;
    this.#header.replaceChildren();
    const activeSort = this.#model.sort[0];
    let pinnedStart = 0;
    let pinnedEnd = 0;
    const pinnedEndOffsets = new Map();
    for (const column of [...this.#columns].reverse()) {
      if (column.pinned !== "end") continue;
      pinnedEndOffsets.set(column.field, pinnedEnd);
      pinnedEnd += typeof column.width === "number" ? column.width : 128;
    }
    for (const column of this.#columns) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.sort = column.field;
      button.disabled = !column.sortable;
      button.role = "columnheader";
      button.textContent = `${column.label}${activeSort?.field === column.field ? (activeSort.direction === "asc" ? " ↑" : " ↓") : ""}`;
      button.setAttribute("aria-sort", activeSort?.field === column.field
        ? (activeSort.direction === "asc" ? "ascending" : "descending")
        : "none");
      if (column.pinned === "start") {
        button.classList.add("pinned");
        button.style.left = `${pinnedStart}px`;
        pinnedStart += typeof column.width === "number" ? column.width : 128;
      } else if (column.pinned === "end") {
        button.classList.add("pinned");
        button.style.right = `${pinnedEndOffsets.get(column.field)}px`;
      }
      this.#header.append(button);
    }
    const height = this.#viewport.clientHeight || 300;
    const start = Math.max(0, Math.floor(this.#viewport.scrollTop / this.#rowHeight) - 4);
    const end = Math.min(this.#model.length, start + Math.ceil(height / this.#rowHeight) + 8);
    this.#space.style.height = `${this.#model.length * this.#rowHeight}px`;
    this.#space.style.width = `max(100%, ${this.#columns.length * 128}px)`;
    this.#rowsLayer.replaceChildren();
    for (let index = start; index < end; index += 1) {
      const rowData = this.#model.at(index);
      const row = document.createElement("div");
      row.className = "row";
      row.role = "row";
      row.dataset.index = index;
      row.dataset.key = String(this.#model.keyAt(index));
      row.style.top = `${index * this.#rowHeight}px`;
      row.style.height = `${this.#rowHeight}px`;
      row.style.gridTemplateColumns = template;
      row.setAttribute("aria-rowindex", String(index + 1));
      row.setAttribute("aria-selected", String(this.#model.selectedKeys.includes(this.#model.keyAt(index))));
      let cellPinnedStart = 0;
      for (const column of this.#columns) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.role = "gridcell";
        cell.dataset.field = column.field;
        cell.contentEditable = String(column.editable);
        const renderer = typeof column.renderer === "function"
          ? column.renderer
          : this.#renderers.get(column.renderer);
        const content = renderer?.(rowData[column.field], clone(rowData), { row: index, column });
        if (content instanceof Node) cell.append(content);
        else cell.textContent = content == null ? String(rowData[column.field] ?? "") : String(content);
        if (column.pinned === "start") {
          cell.classList.add("pinned");
          cell.style.left = `${cellPinnedStart}px`;
          cellPinnedStart += typeof column.width === "number" ? column.width : 128;
        } else if (column.pinned === "end") {
          cell.classList.add("pinned");
          cell.style.right = `${pinnedEndOffsets.get(column.field)}px`;
        }
        row.append(cell);
      }
      this.#rowsLayer.append(row);
    }
    this.#viewport.setAttribute("aria-rowcount", String(this.#model.length));
    this.#viewport.setAttribute("aria-colcount", String(this.#columns.length));
    emit(this, "gui:grid-range", { start, end, total: this.#model.length });
  }

  #click(event) {
    const sort = event.target.closest?.("[data-sort]");
    if (sort) {
      const current = this.#model.sort[0];
      this.#model.setSort([{
        field: sort.dataset.sort,
        direction: current?.field === sort.dataset.sort && current.direction === "asc" ? "desc" : "asc",
      }]);
      return;
    }
    const row = event.target.closest?.(".row");
    if (!row) return;
    this.#active = Number(row.dataset.index);
    this.#model.select(this.#model.keyAt(this.#active), {
      additive: event.ctrlKey || event.metaKey,
      toggle: event.ctrlKey || event.metaKey,
    });
  }

  #keydown(event) {
    if (!this.#model.length) return;
    if (event.key === "ArrowDown") this.#active = Math.min(this.#model.length - 1, this.#active + 1);
    else if (event.key === "ArrowUp") this.#active = Math.max(0, this.#active - 1);
    else if (event.key === "Home") this.#active = 0;
    else if (event.key === "End") this.#active = this.#model.length - 1;
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      this.#model.select(this.#model.keyAt(this.#active), { toggle: event.ctrlKey || event.metaKey });
      return;
    } else return;
    event.preventDefault();
    this.#model.select(this.#model.keyAt(this.#active));
    this.#viewport.scrollTo({
      top: Math.max(0, this.#active * this.#rowHeight - this.#viewport.clientHeight / 2),
    });
  }

  #edit(event) {
    const cell = event.target.closest?.(".cell[contenteditable=true]");
    if (!cell) return;
    const row = cell.closest(".row");
    const key = this.#model.keyAt(Number(row.dataset.index));
    const detail = { key, field: cell.dataset.field, value: cell.textContent };
    if (emit(this, "gui:grid-edit-request", detail, true)) {
      this.#model.update(key, { [detail.field]: detail.value });
      emit(this, "gui:grid-edit", detail);
    } else this.render();
  }
}

const TREE_STYLES = `
  :host { display: block; min-height: 8rem; overflow: auto; color: var(--gui-text, #e5e7eb); }
  [role=treeitem] { display: flex; align-items: center; gap: .35rem; min-height: 2rem;
    padding-inline-start: calc((var(--level) - 1) * 1.15rem + .35rem); border-radius: .35rem; outline: none; }
  [role=treeitem][aria-selected=true], [role=treeitem]:focus {
    background: color-mix(in srgb, var(--gui-accent, #60a5fa) 18%, transparent); }
  button { width: 1.4rem; color: inherit; background: transparent; border: 0; }
`;

export class GuiTreeView extends GuiElement {
  #model;
  #root;
  #active = 0;
  #selected = null;
  #listener = () => this.render();
  #label = "label";

  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${TREE_STYLES}</style><div role="tree" tabindex="0"></div>`;
    this.#root.addEventListener("click", (event) => this.#click(event));
    this.#root.querySelector("[role=tree]").addEventListener("keydown", (event) => this.#keydown(event));
  }

  set model(value) {
    this.#model?.removeEventListener?.("gui:tree-change", this.#listener);
    this.#model = value;
    this.#model?.addEventListener?.("gui:tree-change", this.#listener);
    this.render();
  }
  get model() { return this.#model; }
  set nodes(value) {
    if (!this.#model) this.model = new GuiTreeModel(value);
    else this.#model.setNodes(value);
  }
  get nodes() { return this.#model?.toJSON().nodes ?? []; }
  set labelField(value) { this.#label = value || "label"; this.render(); }
  get labelField() { return this.#label; }
  get selected() { return this.#selected; }

  connectedCallback() {
    if (!this.#model) this.model = new GuiTreeModel();
    this.render();
  }
  disconnectedCallback() { this.#model?.removeEventListener?.("gui:tree-change", this.#listener); }

  render() {
    const tree = this.#root?.querySelector("[role=tree]");
    if (!tree || !this.#model) return;
    const items = this.#model.flatten();
    this.#active = Math.min(this.#active, Math.max(0, items.length - 1));
    tree.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.role = "treeitem";
      row.tabIndex = index === this.#active ? 0 : -1;
      row.dataset.key = String(item.key);
      row.style.setProperty("--level", item.level);
      row.setAttribute("aria-level", item.level);
      row.setAttribute("aria-setsize", item.setSize);
      row.setAttribute("aria-posinset", item.positionInSet);
      row.setAttribute("aria-selected", String(Object.is(this.#selected, item.key)));
      if (item.hasChildren) row.setAttribute("aria-expanded", String(item.expanded));
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.dataset.toggle = String(item.key);
      toggle.tabIndex = -1;
      toggle.textContent = item.hasChildren ? (item.expanded ? "▾" : "▸") : "";
      toggle.setAttribute("aria-label", item.expanded ? "Collapse" : "Expand");
      const label = document.createElement("span");
      label.textContent = String(item.node[this.#label] ?? item.key);
      row.append(toggle, label);
      tree.append(row);
    });
  }

  #click(event) {
    const row = event.target.closest?.("[role=treeitem]");
    if (!row) return;
    const items = this.#model.flatten();
    this.#active = [...row.parentElement.children].indexOf(row);
    const item = items[this.#active];
    if (event.target.closest("[data-toggle]")) {
      this.#model.toggle(item.key);
    } else this.#select(item);
  }

  #keydown(event) {
    const items = this.#model.flatten();
    if (!items.length) return;
    const current = items[this.#active];
    if (event.key === "ArrowDown") this.#active = Math.min(items.length - 1, this.#active + 1);
    else if (event.key === "ArrowUp") this.#active = Math.max(0, this.#active - 1);
    else if (event.key === "Home") this.#active = 0;
    else if (event.key === "End") this.#active = items.length - 1;
    else if (event.key === "ArrowRight" && current.hasChildren) {
      if (!current.expanded) this.#model.toggle(current.key, true);
      else this.#active += 1;
    } else if (event.key === "ArrowLeft") {
      if (current.expanded) this.#model.toggle(current.key, false);
      else if (current.parentKey != null) this.#active = items.findIndex((item) => Object.is(item.key, current.parentKey));
    } else if (event.key === "Enter" || event.key === " ") this.#select(current);
    else return;
    event.preventDefault();
    this.render();
    this.#root.querySelectorAll("[role=treeitem]")[this.#active]?.focus();
  }

  #select(item) {
    const detail = { key: item.key, node: clone(item.node) };
    if (!emit(this, "gui:tree-selection-request", detail, true)) return;
    this.#selected = item.key;
    emit(this, "gui:tree-selection", detail);
    this.render();
  }
}

export const dataViewsModule = Object.freeze({
  id: "data-views",
  version: "0.1.0",
  description: "Virtualized lists, data grids, and accessible hierarchical tree views.",
  dependencies: [],
  components: ["gui-virtual-list", "gui-data-grid", "gui-tree-view"],
  setup() {
    if (hasDOM) {
      [
        ["gui-virtual-list", GuiVirtualList],
        ["gui-data-grid", GuiDataGrid],
        ["gui-tree-view", GuiTreeView],
      ].forEach(([name, constructor]) => {
        if (!customElements.get(name)) customElements.define(name, constructor);
      });
    }
    return { GuiDataCollection, GuiTreeModel };
  },
});

if (hasDOM) {
  [
    ["gui-virtual-list", GuiVirtualList],
    ["gui-data-grid", GuiDataGrid],
    ["gui-tree-view", GuiTreeView],
  ].forEach(([name, constructor]) => {
    if (!customElements.get(name)) customElements.define(name, constructor);
  });
}
