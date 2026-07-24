const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};

function dispatch(target, name, detail = {}, cancelable = false) {
  if (!hasDOM) return true;
  return target.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    cancelable,
    composed: true,
    detail,
  }));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizePort(port, direction, nodeId, index) {
  const normalized = typeof port === "string" ? { id: port, label: port } : { ...port };
  const id = String(normalized.id ?? `${nodeId}:${direction}:${index + 1}`);
  const defaultLimit = direction === "input" ? 1 : Infinity;
  const requestedLimit = Number(normalized.maxLinks);
  return {
    ...normalized,
    id,
    label: String(normalized.label ?? id),
    direction,
    type: String(normalized.type ?? "any"),
    maxLinks: normalized.maxLinks === undefined
      ? defaultLimit
      : requestedLimit === Infinity
        ? Infinity
        : Math.max(0, finite(requestedLimit, defaultLimit)),
  };
}

function normalizeNode(node) {
  if (!node?.id) throw new TypeError("A node requires a non-empty id.");
  const id = String(node.id);
  return {
    ...clone(node),
    id,
    title: String(node.title ?? id),
    type: String(node.type ?? "default"),
    x: finite(node.x),
    y: finite(node.y),
    width: Math.max(160, finite(node.width, 220)),
    inputs: (node.inputs ?? []).map((port, index) => normalizePort(port, "input", id, index)),
    outputs: (node.outputs ?? []).map((port, index) => normalizePort(port, "output", id, index)),
  };
}

/**
 * Pure graph model used by <gui-node-editor>. It can also be used from a host
 * process or unit test without a DOM.
 */
export class GuiNodeGraph {
  #nodes = new Map();
  #links = new Map();
  #ports = new Map();
  #linkSequence = 0;

  constructor(graph = {}) {
    this.load(graph);
  }

  get nodes() {
    return [...this.#nodes.values()].map((node) => clone(node));
  }

  get links() {
    return [...this.#links.values()].map((link) => clone(link));
  }

  getNode(id) {
    const node = this.#nodes.get(String(id));
    return node ? clone(node) : undefined;
  }

  getLink(id) {
    const link = this.#links.get(String(id));
    return link ? clone(link) : undefined;
  }

  getPort(id) {
    const port = this.#ports.get(String(id));
    return port ? clone(port) : undefined;
  }

  load(graph = {}) {
    this.clear();
    for (const node of graph.nodes ?? []) this.addNode(node);
    for (const link of graph.links ?? []) {
      this.connect(link.from, link.to, {
        ...link,
        id: link.id,
        replaceInput: false,
      });
    }
    return this;
  }

  clear() {
    this.#nodes.clear();
    this.#links.clear();
    this.#ports.clear();
    this.#linkSequence = 0;
  }

  addNode(node) {
    const normalized = normalizeNode(node);
    if (this.#nodes.has(normalized.id)) {
      throw new Error(`Node "${normalized.id}" already exists.`);
    }

    const nextPorts = [...normalized.inputs, ...normalized.outputs];
    const nextPortIds = new Set();
    for (const port of nextPorts) {
      if (this.#ports.has(port.id) || nextPortIds.has(port.id)) {
        throw new Error(`Port "${port.id}" already exists.`);
      }
      nextPortIds.add(port.id);
    }

    this.#nodes.set(normalized.id, normalized);
    nextPorts.forEach((port) => {
      this.#ports.set(port.id, { ...port, nodeId: normalized.id });
    });
    return clone(normalized);
  }

  updateNode(id, patch) {
    const nodeId = String(id);
    const current = this.#nodes.get(nodeId);
    if (!current) throw new Error(`Unknown node "${nodeId}".`);

    const links = this.links;
    const candidate = normalizeNode({ ...current, ...clone(patch), id: nodeId });
    const otherPortIds = new Set(
      [...this.#ports.values()]
        .filter((port) => port.nodeId !== nodeId)
        .map((port) => port.id),
    );
    const candidatePortIds = new Set();
    for (const port of [...candidate.inputs, ...candidate.outputs]) {
      if (otherPortIds.has(port.id) || candidatePortIds.has(port.id)) {
        throw new Error(`Port "${port.id}" already exists.`);
      }
      candidatePortIds.add(port.id);
    }

    [...current.inputs, ...current.outputs].forEach((port) => this.#ports.delete(port.id));
    this.#nodes.set(nodeId, candidate);
    [...candidate.inputs, ...candidate.outputs].forEach((port) => {
      this.#ports.set(port.id, { ...port, nodeId });
    });

    this.#links.clear();
    for (const link of links) {
      if (this.#ports.has(link.from) && this.#ports.has(link.to)) {
        try {
          this.connect(link.from, link.to, { ...link, replaceInput: false });
        } catch {
          // Port edits intentionally discard links that are no longer valid.
        }
      }
    }
    return clone(candidate);
  }

  moveNode(id, x, y) {
    const node = this.#nodes.get(String(id));
    if (!node) throw new Error(`Unknown node "${id}".`);
    node.x = finite(x, node.x);
    node.y = finite(y, node.y);
    return { x: node.x, y: node.y };
  }

  removeNode(id) {
    const nodeId = String(id);
    const node = this.#nodes.get(nodeId);
    if (!node) return false;
    const portIds = new Set([...node.inputs, ...node.outputs].map((port) => port.id));
    for (const [linkId, link] of this.#links) {
      if (portIds.has(link.from) || portIds.has(link.to)) this.#links.delete(linkId);
    }
    portIds.forEach((portId) => this.#ports.delete(portId));
    this.#nodes.delete(nodeId);
    return true;
  }

  connect(firstPortId, secondPortId, options = {}) {
    const first = this.#ports.get(String(firstPortId));
    const second = this.#ports.get(String(secondPortId));
    if (!first) throw new Error(`Unknown port "${firstPortId}".`);
    if (!second) throw new Error(`Unknown port "${secondPortId}".`);
    if (first.direction === second.direction) {
      throw new Error("A link must connect one output to one input.");
    }

    const output = first.direction === "output" ? first : second;
    const input = first.direction === "input" ? first : second;
    if (
      output.type !== "any"
      && input.type !== "any"
      && output.type !== input.type
    ) {
      throw new Error(
        `Cannot connect ${output.type} output "${output.id}" to ${input.type} input "${input.id}".`,
      );
    }

    const duplicate = [...this.#links.values()].find(
      (link) => link.from === output.id && link.to === input.id,
    );
    if (duplicate) return clone(duplicate);

    const inputLinks = [...this.#links.values()].filter((link) => link.to === input.id);
    if (inputLinks.length >= input.maxLinks) {
      if (options.replaceInput === false || input.maxLinks === 0) {
        throw new Error(`Input "${input.id}" reached its link limit.`);
      }
      const removeCount = inputLinks.length - input.maxLinks + 1;
      inputLinks.slice(0, removeCount).forEach((link) => this.#links.delete(link.id));
    }

    const outputLinks = [...this.#links.values()].filter((link) => link.from === output.id);
    if (outputLinks.length >= output.maxLinks) {
      throw new Error(`Output "${output.id}" reached its link limit.`);
    }

    let generatedId;
    do {
      generatedId = `link-${++this.#linkSequence}`;
    } while (this.#links.has(generatedId));
    const id = String(options.id ?? generatedId);
    if (this.#links.has(id)) throw new Error(`Link "${id}" already exists.`);
    const sequence = /^link-(\d+)$/.exec(id);
    if (sequence) this.#linkSequence = Math.max(this.#linkSequence, Number(sequence[1]));
    const link = {
      ...clone(options),
      id,
      from: output.id,
      to: input.id,
    };
    delete link.replaceInput;
    this.#links.set(id, link);
    return clone(link);
  }

  removeLink(id) {
    return this.#links.delete(String(id));
  }

  toJSON() {
    return {
      nodes: this.nodes.map((node) => ({
        ...node,
        inputs: node.inputs.map(serializePort),
        outputs: node.outputs.map(serializePort),
      })),
      links: this.links,
    };
  }
}

function serializePort(port) {
  const serialized = { ...port };
  if (serialized.maxLinks === Infinity) delete serialized.maxLinks;
  return serialized;
}

export class GuiNodeEditor extends GuiElement {
  static observedAttributes = ["readonly", "label"];

  #graph = new GuiNodeGraph();
  #viewport;
  #world;
  #linkLayer;
  #nodeLayer;
  #zoomLabel;
  #nodeElements = new Map();
  #portElements = new Map();
  #selectedNodes = new Set();
  #selectedLink = null;
  #view = { x: 64, y: 48, zoom: 1 };
  #interaction = null;
  #connectionFrame;
  #resizeObserver;

  connectedCallback() {
    if (!this.shadowRoot) this.#createView();
    this.#viewport.setAttribute("aria-label", this.label);
    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver(() => this.#scheduleConnections());
      this.#resizeObserver.observe(this);
    }
    window.addEventListener("gui:theme-changed", this.#scheduleConnections);
    this.#render();
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    window.removeEventListener("gui:theme-changed", this.#scheduleConnections);
    cancelAnimationFrame(this.#connectionFrame);
  }

  attributeChangedCallback(name) {
    // Existing elements are upgraded synchronously by customElements.define().
    // Attribute callbacks can therefore run before connectedCallback creates
    // the shadow view, even though the element is already connected.
    if (!this.#viewport) return;
    if (name === "label") this.#viewport.setAttribute("aria-label", this.label);
  }

  get label() {
    return this.getAttribute("label") ?? "Node editor";
  }

  get readOnly() {
    return this.hasAttribute("readonly");
  }

  set readOnly(value) {
    this.toggleAttribute("readonly", Boolean(value));
  }

  get graph() {
    return this.#graph;
  }

  get selectedNodes() {
    return [...this.#selectedNodes];
  }

  get selectedLink() {
    return this.#selectedLink;
  }

  setGraph(graph) {
    this.#graph = graph instanceof GuiNodeGraph
      ? new GuiNodeGraph(graph.toJSON())
      : new GuiNodeGraph(graph);
    this.#selectedNodes.clear();
    this.#selectedLink = null;
    this.#render();
    this.#graphChanged("load");
  }

  getGraph() {
    return this.#graph.toJSON();
  }

  addNode(node) {
    const created = this.#graph.addNode(node);
    this.#render();
    this.#graphChanged("node-add", { node: created });
    return created;
  }

  updateNode(id, patch) {
    const updated = this.#graph.updateNode(id, patch);
    this.#render();
    this.#graphChanged("node-update", { node: updated });
    return updated;
  }

  removeNode(id) {
    const removed = this.#graph.removeNode(id);
    if (!removed) return false;
    this.#selectedNodes.delete(String(id));
    this.#render();
    this.#graphChanged("node-remove", { id: String(id) });
    return true;
  }

  connect(from, to, options = {}) {
    const allowed = dispatch(this, "gui:node-connect-request", { from, to, options }, true);
    if (!allowed) return null;
    try {
      const before = this.#graph.links;
      const link = this.#graph.connect(from, to, options);
      if (before.some((existing) => existing.id === link.id)) return link;
      const remainingIds = new Set(this.#graph.links.map((existing) => existing.id));
      before
        .filter((existing) => !remainingIds.has(existing.id))
        .forEach((removed) => {
          dispatch(this, "gui:node-disconnect", { link: removed, reason: "replaced" });
        });
      this.#renderConnections();
      dispatch(this, "gui:node-connect", { link });
      this.#graphChanged("link-add", { link });
      return link;
    } catch (error) {
      dispatch(this, "gui:node-error", { operation: "connect", error });
      throw error;
    }
  }

  disconnect(id) {
    const link = this.#graph.getLink(id);
    if (!link || !this.#graph.removeLink(id)) return false;
    if (this.#selectedLink === String(id)) this.#selectedLink = null;
    this.#renderConnections();
    dispatch(this, "gui:node-disconnect", { link });
    this.#graphChanged("link-remove", { link });
    return true;
  }

  clear() {
    this.#graph.clear();
    this.#selectedNodes.clear();
    this.#selectedLink = null;
    this.#render();
    this.#graphChanged("clear");
  }

  selectNode(id, additive = false) {
    const node = this.#graph.getNode(id);
    if (!node) return false;
    if (!additive) this.#selectedNodes.clear();
    if (additive && this.#selectedNodes.has(node.id)) this.#selectedNodes.delete(node.id);
    else this.#selectedNodes.add(node.id);
    this.#selectedLink = null;
    this.#syncSelection();
    dispatch(this, "gui:node-select", {
      nodes: this.selectedNodes,
      link: null,
    });
    return true;
  }

  selectLink(id) {
    if (!this.#graph.getLink(id)) return false;
    this.#selectedNodes.clear();
    this.#selectedLink = String(id);
    this.#syncSelection();
    dispatch(this, "gui:node-select", { nodes: [], link: this.#selectedLink });
    return true;
  }

  clearSelection() {
    this.#selectedNodes.clear();
    this.#selectedLink = null;
    this.#syncSelection();
    dispatch(this, "gui:node-select", { nodes: [], link: null });
  }

  setView({ x = this.#view.x, y = this.#view.y, zoom = this.#view.zoom }) {
    this.#view = {
      x: finite(x, this.#view.x),
      y: finite(y, this.#view.y),
      zoom: Math.min(this.maxZoom, Math.max(this.minZoom, finite(zoom, this.#view.zoom))),
    };
    this.#applyView();
  }

  zoomToFit(padding = 72) {
    const nodes = this.#graph.nodes;
    const bounds = this.#viewport.getBoundingClientRect();
    if (!nodes.length || !bounds.width || !bounds.height) {
      this.setView({ x: 64, y: 48, zoom: 1 });
      return;
    }

    const boxes = nodes.map((node) => {
      const element = this.#nodeElements.get(node.id);
      return {
        left: node.x,
        top: node.y,
        right: node.x + node.width,
        bottom: node.y + (element?.offsetHeight ?? 160),
      };
    });
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const graphWidth = Math.max(1, right - left);
    const graphHeight = Math.max(1, bottom - top);
    const zoom = Math.min(
      this.maxZoom,
      Math.max(
        this.minZoom,
        Math.min(
          (bounds.width - padding * 2) / graphWidth,
          (bounds.height - padding * 2) / graphHeight,
        ),
      ),
    );
    this.setView({
      zoom,
      x: (bounds.width - graphWidth * zoom) / 2 - left * zoom,
      y: (bounds.height - graphHeight * zoom) / 2 - top * zoom,
    });
  }

  get minZoom() {
    return Math.max(0.05, finite(this.getAttribute("min-zoom") ?? 0.25, 0.25));
  }

  get maxZoom() {
    return Math.max(
      this.minZoom,
      finite(this.getAttribute("max-zoom") ?? 2.5, 2.5),
    );
  }

  get gridSize() {
    return Math.max(8, finite(this.getAttribute("grid-size") ?? 24, 24));
  }

  get snapSize() {
    if (!this.hasAttribute("snap")) return 0;
    return Math.max(1, finite(this.getAttribute("snap"), this.gridSize));
  }

  #createView() {
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = NODE_EDITOR_STYLES;

    this.#viewport = document.createElement("div");
    this.#viewport.className = "viewport";
    this.#viewport.tabIndex = 0;
    this.#viewport.setAttribute("role", "application");

    this.#world = document.createElement("div");
    this.#world.className = "world";
    this.#linkLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.#linkLayer.classList.add("links");
    this.#linkLayer.setAttribute("aria-hidden", "true");
    this.#nodeLayer = document.createElement("div");
    this.#nodeLayer.className = "nodes";
    this.#world.append(this.#linkLayer, this.#nodeLayer);

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Node editor view controls");
    toolbar.append(
      this.#toolbarButton("−", "Zoom out", () => this.#zoomAroundCenter(0.85)),
      this.#toolbarButton("+", "Zoom in", () => this.#zoomAroundCenter(1.18)),
      this.#toolbarButton("⌗", "Fit nodes", () => this.zoomToFit()),
    );
    this.#zoomLabel = document.createElement("span");
    this.#zoomLabel.className = "zoom-label";
    toolbar.append(this.#zoomLabel);

    const help = document.createElement("div");
    help.className = "help";
    help.textContent = "Drag to pan · Wheel to zoom · Double-click to create";

    this.#viewport.append(this.#world, toolbar, help);
    root.append(style, this.#viewport);

    this.#viewport.addEventListener("pointerdown", this.#onPointerDown);
    this.#viewport.addEventListener("pointermove", this.#onPointerMove);
    this.#viewport.addEventListener("pointerup", this.#onPointerUp);
    this.#viewport.addEventListener("pointercancel", this.#onPointerUp);
    this.#viewport.addEventListener("wheel", this.#onWheel, { passive: false });
    this.#viewport.addEventListener("dblclick", this.#onDoubleClick);
    this.#viewport.addEventListener("keydown", this.#onKeyDown);
  }

  #toolbarButton(text, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);
    return button;
  }

  #render() {
    if (!this.#nodeLayer) return;
    this.#nodeElements.clear();
    this.#portElements.clear();
    this.#nodeLayer.replaceChildren();
    for (const node of this.#graph.nodes) {
      const element = this.#createNodeElement(node);
      this.#nodeElements.set(node.id, element);
      this.#nodeLayer.append(element);
    }
    this.#applyView();
    this.#syncSelection();
    this.#scheduleConnections();
  }

  #createNodeElement(node) {
    const element = document.createElement("article");
    element.className = "node";
    element.dataset.nodeId = node.id;
    element.dataset.nodeType = node.type;
    element.tabIndex = 0;
    element.setAttribute("aria-label", `${node.title} node`);
    element.style.width = `${node.width}px`;
    element.style.transform = `translate(${node.x}px, ${node.y}px)`;
    if (node.color) element.style.setProperty("--node-color", node.color);

    const header = document.createElement("header");
    header.className = "node-header";
    const title = document.createElement("strong");
    title.textContent = node.title;
    const type = document.createElement("span");
    type.textContent = node.type;
    header.append(title, type);

    const body = document.createElement("div");
    body.className = "node-body";
    const inputs = document.createElement("div");
    inputs.className = "port-list port-list--inputs";
    const outputs = document.createElement("div");
    outputs.className = "port-list port-list--outputs";
    node.inputs.forEach((port) => inputs.append(this.#createPortElement(port, node.id)));
    node.outputs.forEach((port) => outputs.append(this.#createPortElement(port, node.id)));
    body.append(inputs, outputs);

    if (node.description) {
      const description = document.createElement("p");
      description.className = "node-description";
      description.textContent = node.description;
      body.append(description);
    }
    element.append(header, body);
    element.addEventListener("focus", () => this.selectNode(node.id));
    element.addEventListener("animationend", this.#scheduleConnections, { once: true });
    return element;
  }

  #createPortElement(port, nodeId) {
    const row = document.createElement("div");
    row.className = `port-row port-row--${port.direction}`;
    const button = document.createElement("button");
    button.className = `port port--${port.direction}`;
    button.type = "button";
    button.dataset.portId = port.id;
    button.dataset.nodeId = nodeId;
    button.dataset.direction = port.direction;
    button.dataset.portType = port.type;
    button.setAttribute(
      "aria-label",
      `${port.direction === "input" ? "Input" : "Output"} ${port.label}, type ${port.type}`,
    );
    button.title = `${port.label} · ${port.type}`;
    const dot = document.createElement("i");
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = port.label;
    if (port.direction === "input") button.append(dot, label);
    else button.append(label, dot);
    row.append(button);
    this.#portElements.set(port.id, button);
    return row;
  }

  #renderConnections() {
    if (!this.#linkLayer) return;
    this.#linkLayer.replaceChildren();
    for (const link of this.#graph.links) {
      const from = this.#portCenter(link.from);
      const to = this.#portCenter(link.to);
      if (!from || !to) continue;
      const pathData = this.#connectionPath(from, to);
      const visible = document.createElementNS("http://www.w3.org/2000/svg", "path");
      visible.classList.add("link");
      visible.dataset.linkId = link.id;
      visible.setAttribute("d", pathData);
      visible.dataset.selected = String(link.id === this.#selectedLink);
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hit.classList.add("link-hit");
      hit.dataset.linkId = link.id;
      hit.setAttribute("d", pathData);
      this.#linkLayer.append(visible, hit);
    }

    if (this.#interaction?.type === "link") {
      const start = this.#portCenter(this.#interaction.portId);
      if (start) {
        const port = this.#graph.getPort(this.#interaction.portId);
        const from = port.direction === "output" ? start : this.#interaction.current;
        const to = port.direction === "output" ? this.#interaction.current : start;
        const preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
        preview.classList.add("link", "link--preview");
        preview.setAttribute("d", this.#connectionPath(from, to));
        this.#linkLayer.append(preview);
      }
    }
  }

  #scheduleConnections = () => {
    cancelAnimationFrame(this.#connectionFrame);
    this.#connectionFrame = requestAnimationFrame(() => {
      this.#connectionFrame = undefined;
      this.#renderConnections();
    });
  };

  #portCenter(id) {
    const element = this.#portElements.get(id);
    if (!element) return null;
    const bounds = element.querySelector("i").getBoundingClientRect();
    return this.#clientToWorld(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
  }

  #connectionPath(from, to) {
    const distance = Math.abs(to.x - from.x);
    const control = Math.max(48, Math.min(180, distance * 0.52));
    return `M ${from.x} ${from.y} C ${from.x + control} ${from.y}, ${to.x - control} ${to.y}, ${to.x} ${to.y}`;
  }

  #clientToWorld(clientX, clientY) {
    const bounds = this.#viewport.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - this.#view.x) / this.#view.zoom,
      y: (clientY - bounds.top - this.#view.y) / this.#view.zoom,
    };
  }

  #applyView() {
    if (!this.#world) return;
    this.#world.style.transform = `translate(${this.#view.x}px, ${this.#view.y}px) scale(${this.#view.zoom})`;
    const grid = this.gridSize * this.#view.zoom;
    this.#viewport.style.setProperty("--grid-size", `${grid}px`);
    this.#viewport.style.setProperty("--grid-x", `${this.#view.x % grid}px`);
    this.#viewport.style.setProperty("--grid-y", `${this.#view.y % grid}px`);
    this.#zoomLabel.textContent = `${Math.round(this.#view.zoom * 100)}%`;
    this.#scheduleConnections();
  }

  #syncSelection() {
    this.#nodeElements.forEach((element, id) => {
      const selected = this.#selectedNodes.has(id);
      element.dataset.selected = String(selected);
      element.setAttribute("aria-selected", String(selected));
    });
    this.#linkLayer?.querySelectorAll(".link[data-link-id]").forEach((element) => {
      element.dataset.selected = String(element.dataset.linkId === this.#selectedLink);
    });
  }

  #zoomAroundCenter(factor) {
    const bounds = this.#viewport.getBoundingClientRect();
    this.#zoomAt(bounds.width / 2, bounds.height / 2, this.#view.zoom * factor);
  }

  #zoomAt(localX, localY, requestedZoom) {
    const zoom = Math.min(this.maxZoom, Math.max(this.minZoom, requestedZoom));
    const worldX = (localX - this.#view.x) / this.#view.zoom;
    const worldY = (localY - this.#view.y) / this.#view.zoom;
    this.setView({
      zoom,
      x: localX - worldX * zoom,
      y: localY - worldY * zoom,
    });
  }

  #onPointerDown = (event) => {
    if (event.target.closest(".toolbar")) return;
    const link = event.target.closest(".link-hit");
    if (link) {
      event.preventDefault();
      this.selectLink(link.dataset.linkId);
      return;
    }

    const port = event.target.closest(".port");
    if (port && !this.readOnly && event.button === 0) {
      event.preventDefault();
      this.selectNode(port.dataset.nodeId);
      this.#interaction = {
        type: "link",
        pointerId: event.pointerId,
        portId: port.dataset.portId,
        current: this.#clientToWorld(event.clientX, event.clientY),
      };
      this.#viewport.setPointerCapture(event.pointerId);
      this.dataset.interaction = "link";
      this.#renderConnections();
      return;
    }

    const node = event.target.closest(".node");
    if (node) {
      this.selectNode(node.dataset.nodeId, event.ctrlKey || event.metaKey);
      if (
        !this.readOnly
        && event.button === 0
        && event.target.closest(".node-header")
      ) {
        event.preventDefault();
        const model = this.#graph.getNode(node.dataset.nodeId);
        this.#interaction = {
          type: "node",
          pointerId: event.pointerId,
          nodeId: model.id,
          startX: event.clientX,
          startY: event.clientY,
          nodeX: model.x,
          nodeY: model.y,
        };
        this.#viewport.setPointerCapture(event.pointerId);
        this.dataset.interaction = "node";
        node.dataset.dragging = "true";
      }
      return;
    }

    if (event.button === 0 || event.button === 1) {
      event.preventDefault();
      this.clearSelection();
      this.#interaction = {
        type: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewX: this.#view.x,
        viewY: this.#view.y,
      };
      this.#viewport.setPointerCapture(event.pointerId);
      this.dataset.interaction = "pan";
    }
  };

  #onPointerMove = (event) => {
    if (!this.#interaction || event.pointerId !== this.#interaction.pointerId) return;
    if (this.#interaction.type === "pan") {
      this.setView({
        x: this.#interaction.viewX + event.clientX - this.#interaction.startX,
        y: this.#interaction.viewY + event.clientY - this.#interaction.startY,
      });
    } else if (this.#interaction.type === "node") {
      let x = this.#interaction.nodeX
        + (event.clientX - this.#interaction.startX) / this.#view.zoom;
      let y = this.#interaction.nodeY
        + (event.clientY - this.#interaction.startY) / this.#view.zoom;
      if (this.snapSize) {
        x = Math.round(x / this.snapSize) * this.snapSize;
        y = Math.round(y / this.snapSize) * this.snapSize;
      }
      this.#graph.moveNode(this.#interaction.nodeId, x, y);
      const element = this.#nodeElements.get(this.#interaction.nodeId);
      element.style.transform = `translate(${x}px, ${y}px)`;
      this.#scheduleConnections();
    } else if (this.#interaction.type === "link") {
      this.#interaction.current = this.#clientToWorld(event.clientX, event.clientY);
      this.#renderConnections();
    }
  };

  #onPointerUp = (event) => {
    if (!this.#interaction || event.pointerId !== this.#interaction.pointerId) return;
    const interaction = this.#interaction;
    if (this.#viewport.hasPointerCapture(event.pointerId)) {
      this.#viewport.releasePointerCapture(event.pointerId);
    }
    delete this.dataset.interaction;

    if (interaction.type === "node") {
      const element = this.#nodeElements.get(interaction.nodeId);
      delete element?.dataset.dragging;
      const node = this.#graph.getNode(interaction.nodeId);
      dispatch(this, "gui:node-move", { node });
      this.#graphChanged("node-move", { node });
    } else if (interaction.type === "link") {
      const target = this.shadowRoot
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest(".port");
      if (target && target.dataset.portId !== interaction.portId) {
        try {
          this.connect(interaction.portId, target.dataset.portId);
        } catch {
          // The public gui:node-error event carries validation details.
        }
      }
    }

    this.#interaction = null;
    this.#renderConnections();
  };

  #onWheel = (event) => {
    event.preventDefault();
    const bounds = this.#viewport.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.0012);
    this.#zoomAt(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      this.#view.zoom * factor,
    );
  };

  #onDoubleClick = (event) => {
    if (this.readOnly || event.target.closest(".node, .toolbar, .link-hit")) return;
    dispatch(this, "gui:node-create-request", {
      position: this.#clientToWorld(event.clientX, event.clientY),
    });
  };

  #onKeyDown = (event) => {
    if (event.key === "Escape") {
      this.clearSelection();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      this.#selectedNodes = new Set(this.#graph.nodes.map((node) => node.id));
      this.#selectedLink = null;
      this.#syncSelection();
      dispatch(this, "gui:node-select", { nodes: this.selectedNodes, link: null });
      return;
    }
    if (this.readOnly) return;
    if (["Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      if (this.#selectedLink) this.disconnect(this.#selectedLink);
      for (const nodeId of [...this.#selectedNodes]) this.removeNode(nodeId);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (!this.#selectedNodes.size) return;
    event.preventDefault();
    const amount = (this.snapSize || 1) * (event.shiftKey ? 10 : 1);
    const delta = {
      ArrowLeft: [-amount, 0],
      ArrowRight: [amount, 0],
      ArrowUp: [0, -amount],
      ArrowDown: [0, amount],
    }[event.key];
    for (const nodeId of this.#selectedNodes) {
      const node = this.#graph.getNode(nodeId);
      const position = this.#graph.moveNode(nodeId, node.x + delta[0], node.y + delta[1]);
      this.#nodeElements.get(nodeId).style.transform =
        `translate(${position.x}px, ${position.y}px)`;
    }
    this.#scheduleConnections();
    this.#graphChanged("node-move", { nodes: this.selectedNodes });
  };

  #graphChanged(operation, detail = {}) {
    dispatch(this, "gui:graph-change", {
      operation,
      graph: this.getGraph(),
      ...detail,
    });
  }
}

export const nodeEditorModule = Object.freeze({
  id: "node-editor",
  version: "0.1.0",
  description: "Interactive node graph editor with pan, zoom, links, and serialization.",
  dependencies: ["core"],
  components: ["gui-node-editor"],
  setup() {
    if (hasDOM && !customElements.get("gui-node-editor")) {
      customElements.define("gui-node-editor", GuiNodeEditor);
    }
    return { GuiNodeEditor, GuiNodeGraph };
  },
});

const NODE_EDITOR_STYLES = `
  :host {
    --node-grid: color-mix(in srgb, var(--gui-border, #dfe2ea) 68%, transparent);
    --node-color: var(--gui-accent, #5b5ce2);
    display: block;
    min-width: 0;
    min-height: 30rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: var(--gui-radius-lg, 1rem);
    overflow: hidden;
    background: var(--gui-bg, #f6f7fb);
    color: var(--gui-text, #17181c);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .04);
  }

  *, *::before, *::after { box-sizing: border-box; }

  .viewport {
    --grid-size: 24px;
    --grid-x: 0px;
    --grid-y: 0px;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: inherit;
    overflow: hidden;
    outline: none;
    touch-action: none;
    background-color: var(--gui-bg, #f6f7fb);
    background-image:
      radial-gradient(circle, var(--node-grid) 1px, transparent 1.15px);
    background-position: var(--grid-x) var(--grid-y);
    background-size: var(--grid-size) var(--grid-size);
    cursor: grab;
  }

  :host([data-interaction="pan"]) .viewport { cursor: grabbing; }
  .viewport:focus-visible {
    box-shadow: inset 0 0 0 3px var(--gui-focus, rgb(91 92 226 / .35));
  }

  .world {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
    will-change: transform;
  }

  .links, .nodes {
    position: absolute;
    inset: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
  }

  .links { pointer-events: none; }
  .nodes { pointer-events: none; }

  .link {
    fill: none;
    stroke: var(--gui-accent, #5b5ce2);
    stroke-linecap: round;
    stroke-width: 3;
    opacity: .72;
    pointer-events: none;
    transition: opacity 160ms, stroke-width 160ms;
  }

  .link[data-selected="true"] {
    stroke-width: 5;
    opacity: 1;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--gui-accent, #5b5ce2) 45%, transparent));
  }

  .link--preview {
    stroke-dasharray: 8 7;
    animation: node-link-flow .55s linear infinite;
  }

  .link-hit {
    fill: none;
    stroke: transparent;
    stroke-width: 16;
    pointer-events: stroke;
    cursor: pointer;
  }

  .node {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: auto;
    border: 1px solid color-mix(in srgb, var(--gui-border, #dfe2ea), var(--node-color) 12%);
    border-radius: .85rem;
    overflow: visible;
    background: color-mix(in srgb, var(--gui-surface, white) 94%, transparent);
    box-shadow: 0 10px 30px rgb(18 23 38 / .12);
    transform-origin: 0 0;
    transition: border-color 160ms, box-shadow 220ms, filter 160ms;
    animation: node-arrive 300ms cubic-bezier(.22, 1, .36, 1);
  }

  .node:hover {
    border-color: color-mix(in srgb, var(--node-color) 48%, var(--gui-border, #dfe2ea));
    box-shadow: 0 16px 38px rgb(18 23 38 / .16);
  }

  .node[data-selected="true"] {
    border-color: var(--node-color);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--node-color) 24%, transparent),
      0 18px 42px rgb(18 23 38 / .2);
  }

  .node[data-dragging="true"] {
    filter: brightness(1.03);
    cursor: grabbing;
  }

  .node-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
    min-height: 2.75rem;
    padding: .65rem .8rem;
    border-bottom: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .8rem .8rem 0 0;
    background:
      linear-gradient(110deg, color-mix(in srgb, var(--node-color) 16%, transparent), transparent 60%),
      var(--gui-surface-raised, white);
    cursor: grab;
    user-select: none;
  }

  .node-header strong {
    overflow: hidden;
    font: 750 .86rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-header span {
    padding: .16rem .38rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--node-color) 13%, transparent);
    color: var(--node-color);
    font: 750 .62rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .node-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: .65rem;
    min-height: 3rem;
    padding: .65rem 0;
  }

  .port-list {
    display: grid;
    align-content: start;
    gap: .2rem;
  }

  .port-row { min-width: 0; }
  .port-row--output { text-align: right; }

  .port {
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    gap: .45rem;
    padding: .28rem .55rem;
    border: 0;
    background: transparent;
    color: var(--gui-text-muted, #666b78);
    cursor: crosshair;
    font: 600 .72rem/1.25 var(--gui-font, ui-sans-serif, system-ui);
  }

  .port--input { margin-left: -.75rem; }
  .port--output { margin-right: -.75rem; }
  .port span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .port i {
    width: .78rem;
    height: .78rem;
    flex: 0 0 .78rem;
    border: 2px solid var(--node-color);
    border-radius: 50%;
    background: var(--gui-surface, white);
    box-shadow: 0 0 0 2px var(--gui-surface, white);
    transition: background 140ms, transform 180ms cubic-bezier(.22, 1, .36, 1);
  }

  .port:hover i, .port:focus-visible i {
    background: var(--node-color);
    transform: scale(1.3);
  }

  .port:focus-visible {
    border-radius: .35rem;
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 0;
  }

  .node-description {
    grid-column: 1 / -1;
    margin: .25rem .8rem 0;
    color: var(--gui-text-muted, #666b78);
    font: .7rem/1.4 var(--gui-font, ui-sans-serif, system-ui);
  }

  .toolbar {
    position: absolute;
    top: .75rem;
    right: .75rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: .25rem;
    padding: .28rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .7rem;
    background: color-mix(in srgb, var(--gui-surface-raised, white) 92%, transparent);
    box-shadow: var(--gui-shadow-sm, 0 1px 2px rgb(18 23 38 / .08));
    backdrop-filter: blur(12px);
  }

  .toolbar button {
    display: grid;
    width: 1.9rem;
    height: 1.9rem;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: .45rem;
    background: transparent;
    color: var(--gui-text, #17181c);
    cursor: pointer;
    font: 700 1rem/1 var(--gui-font, ui-sans-serif, system-ui);
  }

  .toolbar button:hover { background: var(--gui-accent-soft, #ededff); }
  .zoom-label {
    min-width: 2.7rem;
    color: var(--gui-text-muted, #666b78);
    font: 650 .68rem/1 var(--gui-font, ui-sans-serif, system-ui);
    text-align: center;
  }

  .help {
    position: absolute;
    right: .8rem;
    bottom: .65rem;
    color: var(--gui-text-muted, #666b78);
    font: 550 .67rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
    opacity: .72;
    pointer-events: none;
  }

  @keyframes node-arrive {
    from { opacity: 0; scale: .96; }
    to { opacity: 1; scale: 1; }
  }

  @keyframes node-link-flow {
    to { stroke-dashoffset: -15; }
  }

  @media (max-width: 36rem) {
    .help { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      transition-duration: .01ms !important;
    }
  }
`;

if (hasDOM && !customElements.get("gui-node-editor")) {
  customElements.define("gui-node-editor", GuiNodeEditor);
}
