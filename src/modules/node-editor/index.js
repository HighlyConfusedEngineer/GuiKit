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

const PARAMETER_TYPES = new Set([
  "text",
  "number",
  "range",
  "select",
  "boolean",
  "readonly",
]);

function normalizeParameterOption(option) {
  if (option && typeof option === "object") {
    const value = String(option.value ?? option.label ?? "");
    return {
      ...clone(option),
      value,
      label: String(option.label ?? value),
      disabled: Boolean(option.disabled),
    };
  }
  const value = String(option ?? "");
  return { value, label: value, disabled: false };
}

function normalizeBoolean(value) {
  if (typeof value === "string") {
    return !["", "0", "false", "no", "off"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

function normalizeParameterValue(parameter, value) {
  if (parameter.type === "boolean") return normalizeBoolean(value);
  if (parameter.type === "number" || parameter.type === "range") {
    const fallback = finite(parameter.value, finite(parameter.min, 0));
    return Math.min(
      parameter.max ?? Infinity,
      Math.max(parameter.min ?? -Infinity, finite(value, fallback)),
    );
  }
  if (parameter.type === "select") {
    const selected = String(value ?? "");
    if (!parameter.options.length) return selected;
    return parameter.options.some((option) => option.value === selected)
      ? selected
      : parameter.options.find((option) => !option.disabled)?.value ?? selected;
  }
  if (parameter.type === "readonly") return clone(value);
  return String(value ?? "");
}

function normalizeParameter(parameter, nodeId, index) {
  if (!parameter || typeof parameter !== "object") {
    throw new TypeError(`Parameter ${index + 1} on node "${nodeId}" must be an object.`);
  }
  if (!parameter.id) {
    throw new TypeError(`A parameter on node "${nodeId}" requires a non-empty id.`);
  }
  const type = PARAMETER_TYPES.has(parameter.type) ? parameter.type : "text";
  const range = type === "range";
  const min = parameter.min === undefined ? (range ? 0 : undefined) : finite(parameter.min);
  const max = parameter.max === undefined ? (range ? 100 : undefined) : finite(parameter.max);
  const normalized = {
    ...clone(parameter),
    id: String(parameter.id),
    label: String(parameter.label ?? parameter.id),
    type,
    inline: Boolean(parameter.inline),
    disabled: Boolean(parameter.disabled),
  };
  if (parameter.unit !== undefined) normalized.unit = String(parameter.unit);
  if (parameter.placeholder !== undefined) {
    normalized.placeholder = String(parameter.placeholder);
  }
  if (type === "number" || type === "range") {
    if (min !== undefined) normalized.min = min;
    if (max !== undefined) normalized.max = Math.max(min ?? -Infinity, max);
    if (parameter.step !== undefined || range) {
      normalized.step = Math.max(
        Number.EPSILON,
        finite(parameter.step, range ? 1 : 1),
      );
    }
  }
  if (type === "select") {
    normalized.options = (parameter.options ?? []).map(normalizeParameterOption);
  }
  normalized.value = normalizeParameterValue(normalized, parameter.value);
  return normalized;
}

function normalizeNode(node) {
  if (!node?.id) throw new TypeError("A node requires a non-empty id.");
  const id = String(node.id);
  const allowMultipleConnections = node.allowMultipleConnections !== false;
  const requestedMaxConnections = Number(node.maxConnections);
  const maxConnections = node.maxConnections === undefined
    || node.maxConnections === null
    || node.maxConnections === ""
    || requestedMaxConnections === Infinity
    || !Number.isFinite(requestedMaxConnections)
    ? undefined
    : Math.max(0, Math.floor(requestedMaxConnections));
  const parameters = (node.parameters ?? [])
    .map((parameter, index) => normalizeParameter(parameter, id, index));
  const parameterIds = new Set();
  for (const parameter of parameters) {
    if (parameterIds.has(parameter.id)) {
      throw new Error(`Parameter "${parameter.id}" already exists on node "${id}".`);
    }
    parameterIds.add(parameter.id);
  }
  return {
    ...clone(node),
    id,
    title: String(node.title ?? id),
    type: String(node.type ?? "default"),
    x: finite(node.x),
    y: finite(node.y),
    width: Math.max(160, finite(node.width, 220)),
    allowMultipleConnections,
    maxConnections,
    inputs: (node.inputs ?? [])
      .map((port, index) => normalizePort(port, "input", id, index)),
    outputs: (node.outputs ?? [])
      .map((port, index) => normalizePort(port, "output", id, index)),
    parameters,
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
    const outputNode = this.#nodes.get(output.nodeId);
    const inputNode = this.#nodes.get(input.nodeId);
    const outputLimit = outputNode?.allowMultipleConnections === false
      ? Math.min(1, output.maxLinks)
      : output.maxLinks;
    const inputLimit = inputNode?.allowMultipleConnections === false
      ? Math.min(1, input.maxLinks)
      : input.maxLinks;
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

    const existingLinks = [...this.#links.values()];
    const inputLinks = existingLinks.filter((link) => link.to === input.id);
    const removedLinkIds = new Set();
    if (inputLinks.length >= inputLimit) {
      if (options.replaceInput === false || inputLimit === 0) {
        throw new Error(`Input "${input.id}" reached its link limit.`);
      }
      const removeCount = inputLinks.length - inputLimit + 1;
      inputLinks.slice(0, removeCount).forEach((link) => removedLinkIds.add(link.id));
    }

    const remainingLinks = existingLinks.filter((link) => !removedLinkIds.has(link.id));
    const outputLinks = remainingLinks.filter((link) => link.from === output.id);
    if (outputLinks.length >= outputLimit) {
      throw new Error(`Output "${output.id}" reached its link limit.`);
    }

    const endpointNodeIds = new Set([output.nodeId, input.nodeId]);
    for (const nodeId of endpointNodeIds) {
      const node = this.#nodes.get(nodeId);
      if (node?.maxConnections === undefined) continue;
      const connectionCount = remainingLinks.filter((link) => {
        const fromNodeId = this.#ports.get(link.from)?.nodeId;
        const toNodeId = this.#ports.get(link.to)?.nodeId;
        return fromNodeId === nodeId || toNodeId === nodeId;
      }).length;
      if (connectionCount >= node.maxConnections) {
        throw new Error(`Node "${nodeId}" reached its connection limit.`);
      }
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
      type: output.type === "any" ? input.type : output.type,
    };
    delete link.replaceInput;
    removedLinkIds.forEach((linkId) => this.#links.delete(linkId));
    this.#links.set(id, link);
    return clone(link);
  }

  removeLink(id) {
    return this.#links.delete(String(id));
  }

  setLinkPoints(id, points = []) {
    const link = this.#links.get(String(id));
    if (!link) throw new Error(`Unknown link "${id}".`);
    link.points = points.map((point) => ({
      x: finite(point?.x),
      y: finite(point?.y),
    }));
    return clone(link);
  }

  groupNodes(ids, groupId) {
    const selected = new Set([...ids].map(String));
    const group = groupId == null || groupId === "" ? undefined : String(groupId);
    for (const id of selected) {
      const node = this.#nodes.get(id);
      if (!node) throw new Error(`Unknown node "${id}".`);
      node.groupId = group;
    }
    return this.nodes.filter((node) => selected.has(node.id));
  }

  setSubgraph(id, graph) {
    const node = this.#nodes.get(String(id));
    if (!node) throw new Error(`Unknown node "${id}".`);
    node.subgraph = graph == null ? undefined : new GuiNodeGraph(graph).toJSON();
    return clone(node.subgraph);
  }

  getSubgraph(id) {
    const node = this.#nodes.get(String(id));
    if (!node) return undefined;
    return clone(node.subgraph);
  }

  extract(ids) {
    const selected = new Set([...ids].map(String));
    return {
      nodes: this.nodes.filter((node) => selected.has(node.id)),
      links: this.links.filter((link) => {
        const from = this.#ports.get(link.from)?.nodeId;
        const to = this.#ports.get(link.to)?.nodeId;
        return selected.has(from) && selected.has(to);
      }),
    };
  }

  duplicate(ids, options = {}) {
    const source = this.extract(ids);
    const offset = {
      x: finite(options.x, 32),
      y: finite(options.y, 32),
    };
    const nodeIds = new Map();
    const portIds = new Map();
    const unique = (requested, exists) => {
      let candidate = requested;
      let sequence = 2;
      while (exists(candidate)) candidate = `${requested}-${sequence++}`;
      return candidate;
    };
    const nodes = source.nodes.map((node) => {
      const id = unique(`${node.id}-copy`, (candidate) => (
        this.#nodes.has(candidate) || [...nodeIds.values()].includes(candidate)
      ));
      nodeIds.set(node.id, id);
      const remapPorts = (ports) => ports.map((port) => {
        const portId = unique(`${id}:${port.id.split(":").at(-1)}`, (candidate) => (
          this.#ports.has(candidate) || [...portIds.values()].includes(candidate)
        ));
        portIds.set(port.id, portId);
        return { ...port, id: portId };
      });
      return {
        ...node,
        id,
        title: options.keepTitles ? node.title : `${node.title} copy`,
        x: node.x + offset.x,
        y: node.y + offset.y,
        inputs: remapPorts(node.inputs),
        outputs: remapPorts(node.outputs),
      };
    });
    nodes.forEach((node) => this.addNode(node));
    const links = source.links.map((link) => this.connect(
      portIds.get(link.from),
      portIds.get(link.to),
      {
        ...link,
        id: undefined,
        points: link.points?.map((point) => ({
          x: point.x + offset.x,
          y: point.y + offset.y,
        })),
      },
    ));
    return { nodes: nodes.map((node) => this.getNode(node.id)), links };
  }

  autoLayout(options = {}) {
    const direction = normalizeFlowDirection(options.direction);
    const layerGap = Math.max(80, finite(options.layerGap, 160));
    const nodeGap = Math.max(24, finite(options.nodeGap, 56));
    const nodes = [...this.#nodes.values()];
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, []]));
    for (const link of this.#links.values()) {
      const from = this.#ports.get(link.from)?.nodeId;
      const to = this.#ports.get(link.to)?.nodeId;
      if (!from || !to || from === to) continue;
      outgoing.get(from).push(to);
      incoming.set(to, incoming.get(to) + 1);
    }
    const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
    const layerById = new Map(queue.map((id) => [id, 0]));
    const visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      visited.add(id);
      for (const next of outgoing.get(id)) {
        layerById.set(next, Math.max(layerById.get(next) ?? 0, (layerById.get(id) ?? 0) + 1));
        incoming.set(next, incoming.get(next) - 1);
        if (incoming.get(next) === 0) queue.push(next);
      }
    }
    for (const node of nodes) {
      if (!visited.has(node.id)) layerById.set(node.id, layerById.get(node.id) ?? 0);
    }
    const layers = new Map();
    for (const node of nodes) {
      const layer = layerById.get(node.id) ?? 0;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(node);
    }
    for (const [layer, entries] of [...layers].sort(([a], [b]) => a - b)) {
      entries.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
      entries.forEach((node, index) => {
        if (node.pinned) return;
        const primary = layer * (Math.max(...nodes.map((candidate) => candidate.width), 220) + layerGap);
        const secondary = index * (160 + nodeGap);
        node.x = direction === "vertical" ? secondary : primary;
        node.y = direction === "vertical" ? primary : secondary;
      });
    }
    return this.nodes;
  }

  validate(options = {}) {
    const errors = [];
    const warnings = [];
    const incoming = new Map(this.nodes.map((node) => [node.id, 0]));
    const adjacency = new Map(this.nodes.map((node) => [node.id, []]));
    for (const link of this.#links.values()) {
      const from = this.#ports.get(link.from);
      const to = this.#ports.get(link.to);
      if (!from || !to) {
        errors.push({ code: "dangling-link", linkId: link.id, message: `Link "${link.id}" has a missing endpoint.` });
        continue;
      }
      adjacency.get(from.nodeId).push(to.nodeId);
      incoming.set(to.nodeId, incoming.get(to.nodeId) + 1);
    }
    for (const node of this.#nodes.values()) {
      const missing = node.inputs.filter((port) => (
        port.required && ![...this.#links.values()].some((link) => link.to === port.id)
      ));
      missing.forEach((port) => errors.push({
        code: "required-input",
        nodeId: node.id,
        portId: port.id,
        message: `${node.title}: required input "${port.label}" is not connected.`,
      }));
      if (!node.inputs.length && !node.outputs.length && node.type !== "comment") {
        warnings.push({ code: "isolated-node", nodeId: node.id, message: `${node.title} has no ports.` });
      }
      if (node.subgraph) {
        const nested = new GuiNodeGraph(node.subgraph).validate(options);
        nested.errors.forEach((error) => errors.push({
          ...error,
          code: `subgraph:${error.code}`,
          path: [node.id, ...(error.path ?? [])],
          message: `${node.title}: ${error.message}`,
        }));
        nested.warnings.forEach((warning) => warnings.push({
          ...warning,
          code: `subgraph:${warning.code}`,
          path: [node.id, ...(warning.path ?? [])],
          message: `${node.title}: ${warning.message}`,
        }));
      }
    }
    const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      for (const next of adjacency.get(id)) {
        incoming.set(next, incoming.get(next) - 1);
        if (incoming.get(next) === 0) queue.push(next);
      }
    }
    if (order.length !== this.#nodes.size && options.allowCycles !== true) {
      const nodes = [...incoming].filter(([, count]) => count > 0).map(([id]) => id);
      errors.push({ code: "cycle", nodeIds: nodes, message: `Graph contains a cycle involving ${nodes.join(", ")}.` });
    }
    return { valid: errors.length === 0, errors, warnings, order };
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

function normalizeFlowDirection(value) {
  return String(value ?? "").toLowerCase() === "vertical"
    ? "vertical"
    : "horizontal";
}

function normalizeRoutingPoint(point) {
  return {
    x: finite(point?.x),
    y: finite(point?.y),
  };
}

function normalizeRoutingObstacle(obstacle, clearance) {
  const left = finite(obstacle?.left, finite(obstacle?.x));
  const top = finite(obstacle?.top, finite(obstacle?.y));
  const right = finite(
    obstacle?.right,
    left + Math.max(0, finite(obstacle?.width)),
  );
  const bottom = finite(
    obstacle?.bottom,
    top + Math.max(0, finite(obstacle?.height)),
  );
  return {
    left: Math.min(left, right) - clearance,
    top: Math.min(top, bottom) - clearance,
    right: Math.max(left, right) + clearance,
    bottom: Math.max(top, bottom) + clearance,
  };
}

function pointInsideObstacle(point, obstacle) {
  const epsilon = 0.001;
  return point.x > obstacle.left + epsilon
    && point.x < obstacle.right - epsilon
    && point.y > obstacle.top + epsilon
    && point.y < obstacle.bottom - epsilon;
}

function segmentCrossesObstacle(first, second, obstacle) {
  const epsilon = 0.001;
  if (Math.abs(first.y - second.y) < epsilon) {
    const left = Math.min(first.x, second.x);
    const right = Math.max(first.x, second.x);
    return first.y > obstacle.top + epsilon
      && first.y < obstacle.bottom - epsilon
      && right > obstacle.left + epsilon
      && left < obstacle.right - epsilon;
  }
  if (Math.abs(first.x - second.x) < epsilon) {
    const top = Math.min(first.y, second.y);
    const bottom = Math.max(first.y, second.y);
    return first.x > obstacle.left + epsilon
      && first.x < obstacle.right - epsilon
      && bottom > obstacle.top + epsilon
      && top < obstacle.bottom - epsilon;
  }
  return true;
}

function segmentIsClear(first, second, obstacles) {
  return !obstacles.some((obstacle) => (
    segmentCrossesObstacle(first, second, obstacle)
  ));
}

function coordinateKey(value) {
  return Number(value.toFixed(4));
}

function pointKey(x, y) {
  return `${coordinateKey(x)}:${coordinateKey(y)}`;
}

function connectRoutingNeighbors(adjacency, first, second, points, obstacles) {
  if (!segmentIsClear(points[first], points[second], obstacles)) return;
  const distance = Math.abs(points[first].x - points[second].x)
    + Math.abs(points[first].y - points[second].y);
  if (!distance) return;
  adjacency[first].push({ index: second, distance });
  adjacency[second].push({ index: first, distance });
}

function findOrthogonalRoute(start, end, obstacles) {
  const xValues = new Set([coordinateKey(start.x), coordinateKey(end.x)]);
  const yValues = new Set([coordinateKey(start.y), coordinateKey(end.y)]);
  obstacles.forEach((obstacle) => {
    xValues.add(coordinateKey(obstacle.left));
    xValues.add(coordinateKey(obstacle.right));
    yValues.add(coordinateKey(obstacle.top));
    yValues.add(coordinateKey(obstacle.bottom));
  });
  const xs = [...xValues].sort((a, b) => a - b);
  const ys = [...yValues].sort((a, b) => a - b);
  const points = [];
  const pointIndexes = new Map();

  ys.forEach((y) => {
    xs.forEach((x) => {
      const point = { x, y };
      if (obstacles.some((obstacle) => pointInsideObstacle(point, obstacle))) return;
      pointIndexes.set(pointKey(x, y), points.length);
      points.push(point);
    });
  });

  const startIndex = pointIndexes.get(pointKey(start.x, start.y));
  const endIndex = pointIndexes.get(pointKey(end.x, end.y));
  if (startIndex === undefined || endIndex === undefined) return null;

  const adjacency = points.map(() => []);
  ys.forEach((y) => {
    const row = xs
      .map((x) => pointIndexes.get(pointKey(x, y)))
      .filter((index) => index !== undefined);
    for (let index = 1; index < row.length; index += 1) {
      connectRoutingNeighbors(
        adjacency,
        row[index - 1],
        row[index],
        points,
        obstacles,
      );
    }
  });
  xs.forEach((x) => {
    const column = ys
      .map((y) => pointIndexes.get(pointKey(x, y)))
      .filter((index) => index !== undefined);
    for (let index = 1; index < column.length; index += 1) {
      connectRoutingNeighbors(
        adjacency,
        column[index - 1],
        column[index],
        points,
        obstacles,
      );
    }
  });

  const states = new Map();
  const queue = [];
  const push = (state) => {
    queue.push(state);
    let index = queue.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (queue[parent].cost <= state.cost) break;
      queue[index] = queue[parent];
      index = parent;
    }
    queue[index] = state;
  };
  const pop = () => {
    const first = queue[0];
    const last = queue.pop();
    if (queue.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= queue.length) break;
        const child = right < queue.length && queue[right].cost < queue[left].cost
          ? right
          : left;
        if (queue[child].cost >= last.cost) break;
        queue[index] = queue[child];
        index = child;
      }
      queue[index] = last;
    }
    return first;
  };

  const initialKey = `${startIndex}:none`;
  states.set(initialKey, { cost: 0, previous: null, index: startIndex, axis: "none" });
  push({ key: initialKey, cost: 0 });
  let finishedKey = null;

  while (queue.length) {
    const currentQueue = pop();
    const current = states.get(currentQueue.key);
    if (!current || current.cost !== currentQueue.cost) continue;
    if (current.index === endIndex) {
      finishedKey = currentQueue.key;
      break;
    }
    for (const neighbor of adjacency[current.index]) {
      const first = points[current.index];
      const second = points[neighbor.index];
      const axis = Math.abs(first.x - second.x) > 0.001 ? "horizontal" : "vertical";
      const turnCost = current.axis !== "none" && current.axis !== axis ? 14 : 0;
      const cost = current.cost + neighbor.distance + turnCost;
      const key = `${neighbor.index}:${axis}`;
      if (cost >= (states.get(key)?.cost ?? Infinity)) continue;
      states.set(key, {
        cost,
        previous: currentQueue.key,
        index: neighbor.index,
        axis,
      });
      push({ key, cost });
    }
  }

  if (!finishedKey) return null;
  const route = [];
  for (let key = finishedKey; key; key = states.get(key).previous) {
    route.push(points[states.get(key).index]);
  }
  return route.reverse();
}

function simplifyOrthogonalPoints(points) {
  const unique = points.filter((point, index) => (
    index === 0
    || Math.abs(point.x - points[index - 1].x) > 0.001
    || Math.abs(point.y - points[index - 1].y) > 0.001
  ));
  return unique.filter((point, index) => {
    if (index === 0 || index === unique.length - 1) return true;
    const previous = unique[index - 1];
    const next = unique[index + 1];
    return !(
      (Math.abs(previous.x - point.x) < 0.001
        && Math.abs(point.x - next.x) < 0.001)
      || (Math.abs(previous.y - point.y) < 0.001
        && Math.abs(point.y - next.y) < 0.001)
    );
  });
}

function routingPath(points, cornerRadius) {
  if (points.length < 2) return "";
  const direction = (difference) => (
    Math.abs(difference) < 0.001 ? 0 : Math.sign(difference)
  );
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incoming = Math.abs(current.x - previous.x)
      + Math.abs(current.y - previous.y);
    const outgoing = Math.abs(next.x - current.x)
      + Math.abs(next.y - current.y);
    const radius = Math.min(cornerRadius, incoming / 2, outgoing / 2);
    const before = {
      x: current.x + direction(previous.x - current.x) * radius,
      y: current.y + direction(previous.y - current.y) * radius,
    };
    const after = {
      x: current.x + direction(next.x - current.x) * radius,
      y: current.y + direction(next.y - current.y) * radius,
    };
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  const last = points.at(-1);
  return `${path} L ${last.x} ${last.y}`;
}

/**
 * Produces a rounded orthogonal SVG route while keeping the link outside the
 * supplied node rectangles. It is DOM-independent for alternate renderers and
 * geometry tests.
 */
export function routeNodeConnection(from, to, options = {}) {
  const direction = normalizeFlowDirection(options.flowDirection);
  const clearance = Math.max(0, finite(options.clearance, 18));
  const stub = Math.max(0, finite(options.stub, 26));
  const cornerRadius = Math.max(0, finite(options.cornerRadius, 8));
  const start = normalizeRoutingPoint(from);
  const end = normalizeRoutingPoint(to);
  const startExit = direction === "vertical"
    ? { x: start.x, y: start.y + stub }
    : { x: start.x + stub, y: start.y };
  const endExit = direction === "vertical"
    ? { x: end.x, y: end.y - stub }
    : { x: end.x - stub, y: end.y };
  const obstacles = (options.obstacles ?? [])
    .map((obstacle) => normalizeRoutingObstacle(obstacle, clearance));
  const middle = findOrthogonalRoute(startExit, endExit, obstacles);
  const fallback = direction === "vertical"
    ? [
        startExit,
        { x: startExit.x, y: (startExit.y + endExit.y) / 2 },
        { x: endExit.x, y: (startExit.y + endExit.y) / 2 },
        endExit,
      ]
    : [
        startExit,
        { x: (startExit.x + endExit.x) / 2, y: startExit.y },
        { x: (startExit.x + endExit.x) / 2, y: endExit.y },
        endExit,
      ];
  const points = simplifyOrthogonalPoints([
    start,
    ...(middle ?? fallback),
    end,
  ]);
  return {
    direction,
    points: points.map((point) => ({ ...point })),
    path: routingPath(points, cornerRadius),
    routed: Boolean(middle),
  };
}

function normalizeWireType(type, definition = {}) {
  const id = String(type ?? definition.id ?? "any");
  const dash = Array.isArray(definition.dash)
    ? definition.dash.map((value) => Math.max(0, finite(value))).join(" ")
    : String(definition.dash ?? "").trim();
  return {
    id,
    label: String(definition.label ?? id),
    color: String(definition.color ?? "var(--gui-accent, #5b5ce2)"),
    width: Math.min(12, Math.max(1, finite(definition.width, 3))),
    opacity: Math.min(1, Math.max(0.15, finite(definition.opacity, 0.82))),
    dash,
  };
}

function wireTypeEntries(definitions) {
  if (Array.isArray(definitions)) {
    return definitions.map((definition) => [
      String(definition?.id ?? definition?.type ?? "any"),
      definition,
    ]);
  }
  return Object.entries(definitions ?? {});
}

export class GuiNodeEditor extends GuiElement {
  static observedAttributes = ["readonly", "label", "flow-direction"];

  #graph = new GuiNodeGraph();
  #viewport;
  #world;
  #linkLayer;
  #nodeLayer;
  #zoomLabel;
  #nodeElements = new Map();
  #portElements = new Map();
  #parameterElements = new Map();
  #selectedNodes = new Set();
  #selectedLink = null;
  #view = { x: 64, y: 48, zoom: 1 };
  #interaction = null;
  #connectionFrame;
  #resizeObserver;
  #settingsDialog;
  #settingsForm;
  #settingsFields;
  #settingsError;
  #settingsNodeId = null;
  #settingsTrigger = null;
  #wireTypes = new Map();
  #history = null;
  #clipboard = null;
  #restoringHistory = false;
  #execution = new Map();
  #breakpoints = new Set();
  #minimap;
  #searchInput;
  #selectionBox;
  #graphStack = [];
  #subgraphButton;
  #guideX;
  #guideY;

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
    if (name === "readonly") {
      this.#syncSettingsReadOnly();
      this.#syncParameterReadOnly();
    }
    if (name === "flow-direction") {
      requestAnimationFrame(this.#scheduleConnections);
    }
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

  get flowDirection() {
    return normalizeFlowDirection(this.getAttribute("flow-direction"));
  }

  set flowDirection(value) {
    const direction = normalizeFlowDirection(value);
    if (direction === "vertical") this.setAttribute("flow-direction", direction);
    else this.removeAttribute("flow-direction");
  }

  get graph() {
    return this.#graph;
  }

  get wireTypes() {
    return [...this.#wireTypes.values()].map((wireType) => clone(wireType));
  }

  setWireTypes(definitions = {}) {
    this.#wireTypes.clear();
    wireTypeEntries(definitions).forEach(([type, definition]) => {
      const wireType = normalizeWireType(type, definition);
      this.#wireTypes.set(wireType.id, wireType);
    });
    this.#syncWireTypes();
    return this.wireTypes;
  }

  registerWireType(type, definition = {}) {
    const wireType = normalizeWireType(type, definition);
    this.#wireTypes.set(wireType.id, wireType);
    this.#syncWireTypes();
    return clone(wireType);
  }

  getWireType(type) {
    const id = String(type ?? "any");
    return clone(
      this.#wireTypes.get(id)
      ?? normalizeWireType(id),
    );
  }

  get selectedNodes() {
    return [...this.#selectedNodes];
  }

  get selectedLink() {
    return this.#selectedLink;
  }

  get graphPath() {
    return this.#graphStack.map((entry) => entry.nodeId);
  }

  set history(value) {
    this.#history = value;
  }

  get history() {
    return this.#history;
  }

  set clipboard(value) {
    this.#clipboard = value;
    if (value?.registerType && !value.__guiNodeGraphRegistered) {
      value.registerType("application/x-guikit-node-graph", {
        validate: (payload) => Array.isArray(payload?.nodes) && Array.isArray(payload?.links),
      });
      Object.defineProperty(value, "__guiNodeGraphRegistered", {
        configurable: true,
        value: true,
      });
    }
  }

  get clipboard() {
    return this.#clipboard;
  }

  setGraph(graph, options = {}) {
    this.#hideNodeSettings("graph-change");
    if (!options.preservePath) this.#graphStack = [];
    this.#graph = graph instanceof GuiNodeGraph
      ? new GuiNodeGraph(graph.toJSON())
      : new GuiNodeGraph(graph);
    this.#selectedNodes.clear();
    this.#selectedLink = null;
    this.#render();
    this.#graphChanged("load");
  }

  setNodeSubgraph(id, graph) {
    const before = this.getGraph();
    const subgraph = this.#graph.setSubgraph(id, graph);
    this.#render();
    this.#graphChanged("subgraph-change", { id: String(id), subgraph });
    this.#recordHistory("Update subgraph", before);
    return subgraph;
  }

  enterSubgraph(id) {
    const node = this.#graph.getNode(id);
    if (!node?.subgraph) return false;
    const detail = { node, path: [...this.graphPath, node.id] };
    if (!dispatch(this, "gui:subgraph-enter-request", detail, true)) return false;
    this.#graphStack.push({
      nodeId: node.id,
      title: node.title,
      graph: this.getGraph(),
      view: clone(this.#view),
    });
    this.setGraph(node.subgraph, { preservePath: true });
    this.setView({ x: 64, y: 48, zoom: 1 });
    dispatch(this, "gui:subgraph-enter", detail);
    return true;
  }

  exitSubgraph(options = {}) {
    const entry = this.#graphStack.pop();
    if (!entry) return false;
    const nested = this.getGraph();
    const parent = new GuiNodeGraph(entry.graph);
    if (options.save !== false) parent.setSubgraph(entry.nodeId, nested);
    this.setGraph(parent, { preservePath: true });
    this.setView(entry.view);
    dispatch(this, "gui:subgraph-exit", {
      nodeId: entry.nodeId,
      saved: options.save !== false,
      path: this.graphPath,
    });
    return true;
  }

  getGraph() {
    return this.#graph.toJSON();
  }

  addNode(node) {
    const before = this.getGraph();
    const created = this.#graph.addNode(node);
    this.#render();
    this.#graphChanged("node-add", { node: created });
    this.#recordHistory(`Add ${created.title}`, before);
    return created;
  }

  updateNode(id, patch) {
    const before = this.getGraph();
    const updated = this.#graph.updateNode(id, patch);
    this.#render();
    this.#graphChanged("node-update", { node: updated });
    this.#recordHistory(`Update ${updated.title}`, before);
    return updated;
  }

  getNodeParameter(nodeId, parameterId) {
    const node = this.#graph.getNode(nodeId);
    const parameter = node?.parameters?.find(
      (candidate) => candidate.id === String(parameterId),
    );
    return parameter ? clone(parameter) : undefined;
  }

  setNodeParameter(nodeId, parameterId, value) {
    const node = this.#graph.getNode(nodeId);
    if (!node) throw new Error(`Unknown node "${nodeId}".`);
    const id = String(parameterId);
    const parameter = node.parameters.find((candidate) => candidate.id === id);
    if (!parameter) {
      throw new Error(`Unknown parameter "${id}" on node "${node.id}".`);
    }
    const nextValue = normalizeParameterValue(parameter, value);
    if (Object.is(nextValue, parameter.value)) {
      this.#syncParameterElement(node.id, parameter);
      return clone(parameter);
    }
    const allowed = dispatch(this, "gui:node-parameter-change-request", {
      node,
      parameter,
      value: nextValue,
      previousValue: clone(parameter.value),
    }, true);
    if (!allowed) {
      this.#syncParameterElement(node.id, parameter);
      return null;
    }

    const before = this.getGraph();
    const parameters = node.parameters.map((candidate) => (
      candidate.id === id ? { ...candidate, value: nextValue } : candidate
    ));
    const updatedNode = this.#graph.updateNode(node.id, { parameters });
    const updated = updatedNode.parameters.find((candidate) => candidate.id === id);
    this.#syncParameterElement(node.id, updated);
    dispatch(this, "gui:node-parameter-change", {
      node: updatedNode,
      parameter: updated,
      value: clone(updated.value),
      previousValue: clone(parameter.value),
    });
    this.#graphChanged("parameter-change", {
      node: updatedNode,
      parameter: updated,
    });
    this.#recordHistory(`Change ${parameter.label}`, before);
    return clone(updated);
  }

  removeNode(id) {
    const before = this.getGraph();
    const node = this.#graph.getNode(id);
    if (String(id) === this.#settingsNodeId) this.#hideNodeSettings("node-remove");
    const removed = this.#graph.removeNode(id);
    if (!removed) return false;
    this.#selectedNodes.delete(String(id));
    this.#render();
    this.#graphChanged("node-remove", { id: String(id) });
    this.#recordHistory(`Delete ${node?.title ?? id}`, before);
    return true;
  }

  connect(from, to, options = {}) {
    const allowed = dispatch(this, "gui:node-connect-request", { from, to, options }, true);
    if (!allowed) return null;
    try {
      const historyBefore = this.getGraph();
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
      this.#recordHistory("Connect nodes", historyBefore);
      return link;
    } catch (error) {
      dispatch(this, "gui:node-error", { operation: "connect", error });
      throw error;
    }
  }

  disconnect(id, options = {}) {
    const link = this.#graph.getLink(id);
    if (!link) return false;
    const reason = String(options.reason ?? "api");
    if (!dispatch(
      this,
      "gui:node-disconnect-request",
      { link, reason },
      true,
    )) return false;
    const before = this.getGraph();
    if (!this.#graph.removeLink(id)) return false;
    if (this.#selectedLink === String(id)) this.#selectedLink = null;
    this.#renderConnections();
    dispatch(this, "gui:node-disconnect", { link, reason });
    this.#graphChanged("link-remove", { link, reason });
    this.#recordHistory("Disconnect nodes", before);
    return true;
  }

  clear() {
    const before = this.getGraph();
    this.#hideNodeSettings("clear");
    this.#graph.clear();
    this.#selectedNodes.clear();
    this.#selectedLink = null;
    this.#render();
    this.#graphChanged("clear");
    this.#recordHistory("Clear graph", before);
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

  openNodeSettings(id) {
    return this.#showNodeSettings(String(id), this.shadowRoot?.activeElement);
  }

  closeNodeSettings() {
    return this.#hideNodeSettings("cancel");
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

  zoomToSelection(padding = 96) {
    const nodes = this.#graph.nodes.filter((node) => this.#selectedNodes.has(node.id));
    if (!nodes.length) return this.zoomToFit(padding);
    const bounds = this.#viewport?.getBoundingClientRect();
    if (!bounds?.width || !bounds?.height) return;
    const boxes = nodes.map((node) => {
      const element = this.#nodeElements.get(node.id);
      return {
        left: node.x,
        top: node.y,
        right: node.x + (element?.offsetWidth ?? node.width),
        bottom: node.y + (element?.offsetHeight ?? 160),
      };
    });
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const zoom = Math.min(
      this.maxZoom,
      Math.max(this.minZoom, Math.min(
        (bounds.width - padding * 2) / width,
        (bounds.height - padding * 2) / height,
      )),
    );
    this.setView({
      zoom,
      x: (bounds.width - width * zoom) / 2 - left * zoom,
      y: (bounds.height - height * zoom) / 2 - top * zoom,
    });
  }

  findNodes(query, options = {}) {
    const needle = String(query ?? "").trim().toLocaleLowerCase();
    const matches = this.#graph.nodes.filter((node) => {
      if (!needle) return true;
      return [
        node.id,
        node.title,
        node.type,
        node.description,
        ...node.parameters.map((parameter) => `${parameter.label} ${parameter.value}`),
      ].join(" ").toLocaleLowerCase().includes(needle);
    });
    if (options.select && matches.length) {
      this.#selectedNodes = new Set(matches.map((node) => node.id));
      this.#selectedLink = null;
      this.#syncSelection();
      if (options.focus !== false) this.zoomToSelection();
      dispatch(this, "gui:node-select", { nodes: this.selectedNodes, link: null });
    }
    return matches;
  }

  autoLayout(options = {}) {
    const before = this.getGraph();
    const nodes = this.#graph.autoLayout({
      direction: options.direction ?? this.flowDirection,
      ...options,
    });
    this.#render();
    this.#graphChanged("auto-layout", { nodes });
    this.#recordHistory("Auto-layout graph", before);
    if (options.fit !== false) requestAnimationFrame(() => this.zoomToFit());
    return nodes;
  }

  alignSelection(alignment = "left") {
    const nodes = this.#graph.nodes.filter((node) => this.#selectedNodes.has(node.id));
    if (nodes.length < 2) return false;
    const before = this.getGraph();
    const horizontal = ["left", "center", "right"].includes(alignment);
    const values = nodes.map((node) => {
      if (alignment === "right") return node.x + node.width;
      if (alignment === "center") return node.x + node.width / 2;
      if (alignment === "bottom") return node.y + (this.#nodeElements.get(node.id)?.offsetHeight ?? 160);
      if (alignment === "middle") return node.y + (this.#nodeElements.get(node.id)?.offsetHeight ?? 160) / 2;
      return horizontal ? node.x : node.y;
    });
    const target = Math.min(...values);
    nodes.forEach((node, index) => {
      const x = horizontal ? node.x + target - values[index] : node.x;
      const y = horizontal ? node.y : node.y + target - values[index];
      this.#graph.moveNode(node.id, x, y);
    });
    this.#render();
    this.#graphChanged("node-align", { nodes: this.selectedNodes, alignment });
    this.#recordHistory(`Align nodes ${alignment}`, before);
    return true;
  }

  distributeSelection(axis = "horizontal") {
    const nodes = this.#graph.nodes
      .filter((node) => this.#selectedNodes.has(node.id))
      .sort((a, b) => axis === "vertical" ? a.y - b.y : a.x - b.x);
    if (nodes.length < 3) return false;
    const before = this.getGraph();
    const start = axis === "vertical" ? nodes[0].y : nodes[0].x;
    const end = axis === "vertical" ? nodes.at(-1).y : nodes.at(-1).x;
    const gap = (end - start) / (nodes.length - 1);
    nodes.forEach((node, index) => this.#graph.moveNode(
      node.id,
      axis === "vertical" ? node.x : start + gap * index,
      axis === "vertical" ? start + gap * index : node.y,
    ));
    this.#render();
    this.#graphChanged("node-distribute", { nodes: this.selectedNodes, axis });
    this.#recordHistory(`Distribute nodes ${axis}`, before);
    return true;
  }

  groupSelection(groupId = `group-${Date.now().toString(36)}`) {
    if (!this.#selectedNodes.size) return null;
    const before = this.getGraph();
    const nodes = this.#graph.groupNodes(this.#selectedNodes, groupId);
    this.#render();
    this.#graphChanged("node-group", { groupId, nodes: this.selectedNodes });
    this.#recordHistory("Group nodes", before);
    return { id: groupId, nodes };
  }

  ungroupSelection() {
    if (!this.#selectedNodes.size) return false;
    const before = this.getGraph();
    this.#graph.groupNodes(this.#selectedNodes, null);
    this.#render();
    this.#graphChanged("node-ungroup", { nodes: this.selectedNodes });
    this.#recordHistory("Ungroup nodes", before);
    return true;
  }

  addComment(comment = {}) {
    const id = comment.id ?? `comment-${Date.now().toString(36)}`;
    return this.addNode({
      id,
      title: comment.title ?? "Comment",
      type: "comment",
      description: comment.text ?? comment.description ?? "",
      color: comment.color ?? "#f59e0b",
      width: comment.width ?? 240,
      x: comment.x ?? 0,
      y: comment.y ?? 0,
      inputs: [],
      outputs: [],
      data: comment.data ?? {},
    });
  }

  setNodeCollapsed(id, collapsed = true) {
    const node = this.#graph.getNode(id);
    if (!node) return false;
    this.updateNode(id, { collapsed: Boolean(collapsed) });
    dispatch(this, "gui:node-collapse", { id: node.id, collapsed: Boolean(collapsed) });
    return true;
  }

  toggleBreakpoint(id, force) {
    if (!this.#graph.getNode(id)) return false;
    const enabled = force ?? !this.#breakpoints.has(String(id));
    if (enabled) this.#breakpoints.add(String(id));
    else this.#breakpoints.delete(String(id));
    this.#syncExecution();
    dispatch(this, "gui:node-breakpoint", { id: String(id), enabled });
    return enabled;
  }

  setExecutionState(id, state = "idle", detail = {}) {
    if (!this.#graph.getNode(id)) return false;
    const normalized = ["idle", "queued", "running", "success", "error", "paused"].includes(state)
      ? state
      : "idle";
    if (normalized === "idle") this.#execution.delete(String(id));
    else this.#execution.set(String(id), { state: normalized, detail: clone(detail), updatedAt: Date.now() });
    this.#syncExecution();
    dispatch(this, "gui:node-execution", {
      id: String(id),
      state: normalized,
      detail: clone(detail),
    });
    return true;
  }

  setLinkPoints(id, points = []) {
    const before = this.getGraph();
    const link = this.#graph.setLinkPoints(id, points);
    this.#renderConnections();
    this.#graphChanged("link-route", { link });
    this.#recordHistory("Route connection", before);
    return link;
  }

  validateGraph(options = {}) {
    const result = this.#graph.validate(options);
    dispatch(this, "gui:graph-validation", result);
    return result;
  }

  async copySelection(options = {}) {
    const graph = this.#graph.extract(this.#selectedNodes);
    if (!graph.nodes.length || !this.#clipboard) return false;
    await this.#clipboard.write("application/x-guikit-node-graph", graph, options);
    dispatch(this, "gui:node-copy", { nodes: graph.nodes.map((node) => node.id) });
    return true;
  }

  async cutSelection(options = {}) {
    if (!await this.copySelection(options)) return false;
    const before = this.getGraph();
    for (const id of [...this.#selectedNodes]) this.#graph.removeNode(id);
    this.#selectedNodes.clear();
    this.#render();
    this.#graphChanged("node-cut");
    this.#recordHistory("Cut nodes", before);
    return true;
  }

  async paste(options = {}) {
    if (!this.#clipboard) return null;
    const payload = await this.#clipboard.read("application/x-guikit-node-graph", options);
    if (!payload) return null;
    const temporary = new GuiNodeGraph(payload);
    const before = this.getGraph();
    const inserted = [];
    const portIds = new Map();
    for (const node of temporary.nodes) {
      let id = `${node.id}-copy`;
      let sequence = 2;
      while (this.#graph.getNode(id)) id = `${node.id}-copy-${sequence++}`;
      const remap = (ports) => ports.map((port) => {
        const next = `${id}:${port.id.split(":").at(-1)}`;
        portIds.set(port.id, next);
        return { ...port, id: next };
      });
      inserted.push(this.#graph.addNode({
        ...node,
        id,
        title: options.keepTitles ? node.title : `${node.title} copy`,
        x: node.x + finite(options.x, 32),
        y: node.y + finite(options.y, 32),
        inputs: remap(node.inputs),
        outputs: remap(node.outputs),
      }));
    }
    for (const link of temporary.links) {
      this.#graph.connect(portIds.get(link.from), portIds.get(link.to), {
        ...link,
        id: undefined,
      });
    }
    this.#selectedNodes = new Set(inserted.map((node) => node.id));
    this.#render();
    this.#graphChanged("node-paste", { nodes: this.selectedNodes });
    this.#recordHistory("Paste nodes", before);
    return inserted;
  }

  duplicateSelection(options = {}) {
    if (!this.#selectedNodes.size) return null;
    const before = this.getGraph();
    const result = this.#graph.duplicate(this.#selectedNodes, options);
    this.#selectedNodes = new Set(result.nodes.map((node) => node.id));
    this.#render();
    this.#graphChanged("node-duplicate", { nodes: this.selectedNodes });
    this.#recordHistory("Duplicate nodes", before);
    return result;
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
    this.#subgraphButton = this.#toolbarButton("←", "Exit subgraph", () => this.exitSubgraph());
    this.#subgraphButton.hidden = true;
    toolbar.append(
      this.#subgraphButton,
      this.#toolbarButton("−", "Zoom out", () => this.#zoomAroundCenter(0.85)),
      this.#toolbarButton("+", "Zoom in", () => this.#zoomAroundCenter(1.18)),
      this.#toolbarButton("⌗", "Fit nodes", () => this.zoomToFit()),
      this.#toolbarButton("⇢", "Auto-layout nodes", () => this.autoLayout()),
      this.#toolbarButton("✓", "Validate graph", () => this.validateGraph()),
    );
    this.#searchInput = document.createElement("input");
    this.#searchInput.className = "node-search";
    this.#searchInput.type = "search";
    this.#searchInput.placeholder = "Find nodes";
    this.#searchInput.setAttribute("aria-label", "Find nodes");
    this.#searchInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.#searchInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") this.findNodes(this.#searchInput.value, { select: true });
      if (event.key === "Escape") {
        this.#searchInput.value = "";
        this.#viewport.focus();
      }
    });
    toolbar.append(this.#searchInput);
    this.#zoomLabel = document.createElement("span");
    this.#zoomLabel.className = "zoom-label";
    toolbar.append(this.#zoomLabel);

    const help = document.createElement("div");
    help.className = "help";
    help.textContent =
      "Drag to pan · Shift-drag to select · Wheel to zoom · Double-click empty space to create or a wire to delete";

    this.#minimap = document.createElement("canvas");
    this.#minimap.className = "minimap";
    this.#minimap.width = 180;
    this.#minimap.height = 110;
    this.#minimap.setAttribute("aria-label", "Node graph minimap");
    this.#minimap.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      const rect = this.#minimap.getBoundingClientRect();
      this.#centerFromMinimap(
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      );
    });
    this.#selectionBox = document.createElement("div");
    this.#selectionBox.className = "selection-box";
    this.#selectionBox.hidden = true;
    this.#guideX = document.createElement("div");
    this.#guideX.className = "alignment-guide alignment-guide--x";
    this.#guideX.hidden = true;
    this.#guideY = document.createElement("div");
    this.#guideY.className = "alignment-guide alignment-guide--y";
    this.#guideY.hidden = true;

    this.#viewport.append(
      this.#world,
      this.#selectionBox,
      this.#guideX,
      this.#guideY,
      toolbar,
      this.#minimap,
      help,
    );
    this.#settingsDialog = this.#createSettingsDialog();
    root.append(style, this.#viewport, this.#settingsDialog);

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

  #createSettingsDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "node-settings-dialog";
    dialog.setAttribute("aria-labelledby", "node-settings-title");

    this.#settingsForm = document.createElement("form");
    this.#settingsForm.className = "node-settings-form";
    this.#settingsForm.noValidate = true;

    const header = document.createElement("header");
    header.className = "node-settings-header";
    const heading = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "node-settings-eyebrow";
    eyebrow.textContent = "Node configuration";
    const title = document.createElement("h2");
    title.id = "node-settings-title";
    title.textContent = "Node settings";
    const nodeId = document.createElement("code");
    nodeId.className = "node-settings-id";
    heading.append(eyebrow, title, nodeId);

    const close = this.#settingsIconButton(
      "Close node settings",
      "M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6",
    );
    close.classList.add("node-settings-close");
    close.addEventListener("click", () => this.#hideNodeSettings("cancel"));
    header.append(heading, close);

    const body = document.createElement("div");
    body.className = "node-settings-body";
    const name = document.createElement("input");
    name.type = "text";
    name.required = true;
    name.autocomplete = "off";
    const type = document.createElement("input");
    type.type = "text";
    type.required = true;
    type.autocomplete = "off";
    const description = document.createElement("textarea");
    description.rows = 3;
    const color = document.createElement("input");
    color.type = "color";
    color.value = "#5b5ce2";
    const useTheme = document.createElement("input");
    useTheme.type = "checkbox";
    const allowMultipleConnections = document.createElement("input");
    allowMultipleConnections.type = "checkbox";
    const maxConnections = document.createElement("input");
    maxConnections.type = "number";
    maxConnections.min = "0";
    maxConnections.step = "1";
    maxConnections.placeholder = "Unlimited";
    const data = document.createElement("textarea");
    data.rows = 7;
    data.spellcheck = false;
    data.className = "node-settings-json";

    const identity = document.createElement("div");
    identity.className = "node-settings-grid";
    identity.append(
      this.#settingsField("Name", name),
      this.#settingsField("Type", type),
    );

    const colorField = document.createElement("div");
    colorField.className = "node-settings-color";
    colorField.append(color);
    const useThemeLabel = document.createElement("label");
    useThemeLabel.className = "node-settings-check";
    useThemeLabel.append(useTheme, document.createTextNode("Use theme accent"));
    colorField.append(useThemeLabel);

    const connectionPolicy = document.createElement("div");
    connectionPolicy.className = "node-settings-connection-policy";
    const allowMultipleLabel = document.createElement("label");
    allowMultipleLabel.className = "node-settings-check";
    allowMultipleLabel.append(
      allowMultipleConnections,
      document.createTextNode("Allow multiple links per port"),
    );
    const maxConnectionsLabel = document.createElement("label");
    maxConnectionsLabel.className = "node-settings-connection-limit";
    const maxConnectionsText = document.createElement("span");
    maxConnectionsText.textContent = "Maximum total links";
    maxConnectionsLabel.append(maxConnectionsText, maxConnections);
    connectionPolicy.append(allowMultipleLabel, maxConnectionsLabel);

    this.#settingsError = document.createElement("p");
    this.#settingsError.className = "node-settings-error";
    this.#settingsError.setAttribute("role", "alert");
    this.#settingsError.hidden = true;

    body.append(
      identity,
      this.#settingsField("Description", description),
      this.#settingsField("Accent", colorField),
      this.#settingsField("Connections", connectionPolicy),
      this.#settingsField("Node data (JSON)", data),
      this.#settingsError,
    );

    const footer = document.createElement("footer");
    footer.className = "node-settings-footer";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "node-settings-button node-settings-button--secondary";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.#hideNodeSettings("cancel"));
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "node-settings-button node-settings-button--primary";
    save.textContent = "Save changes";
    footer.append(cancel, save);

    this.#settingsFields = {
      name,
      type,
      description,
      color,
      useTheme,
      allowMultipleConnections,
      maxConnections,
      data,
      nodeId,
      save,
    };
    useTheme.addEventListener("change", () => {
      color.disabled = useTheme.checked || this.readOnly;
    });
    this.#settingsForm.addEventListener("submit", this.#saveNodeSettings);
    this.#settingsForm.append(header, body, footer);
    dialog.append(this.#settingsForm);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.#hideNodeSettings("cancel");
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) this.#hideNodeSettings("backdrop");
    });
    return dialog;
  }

  #settingsField(labelText, control) {
    const label = document.createElement(control.tagName === "DIV" ? "div" : "label");
    label.className = "node-settings-field";
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(text, control);
    return label;
  }

  #settingsIconButton(label, pathData) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    icon.append(path);
    button.append(icon);
    return button;
  }

  #showNodeSettings(nodeId, trigger) {
    const node = this.#graph.getNode(nodeId);
    if (!node || !this.#settingsDialog) return false;
    if (!dispatch(this, "gui:node-settings-request", { node }, true)) return false;

    this.#settingsNodeId = node.id;
    this.#settingsTrigger = trigger ?? null;
    this.#settingsFields.name.value = node.title;
    this.#settingsFields.type.value = node.type;
    this.#settingsFields.description.value = node.description ?? "";
    this.#settingsFields.useTheme.checked = !node.color;
    this.#settingsFields.color.value = this.#normalizeSettingsColor(node.color);
    this.#settingsFields.allowMultipleConnections.checked =
      node.allowMultipleConnections;
    this.#settingsFields.maxConnections.value =
      node.maxConnections === undefined ? "" : String(node.maxConnections);
    this.#settingsFields.data.value = node.data === undefined
      ? "{}"
      : JSON.stringify(node.data, null, 2);
    this.#settingsFields.nodeId.textContent = node.id;
    this.#settingsError.hidden = true;
    this.#settingsError.textContent = "";
    this.#syncSettingsReadOnly();

    if (!this.#settingsDialog.open) {
      if (typeof this.#settingsDialog.showModal === "function") {
        this.#settingsDialog.showModal();
      } else {
        this.#settingsDialog.setAttribute("open", "");
      }
    }
    requestAnimationFrame(() => {
      (this.readOnly
        ? this.#settingsDialog.querySelector(".node-settings-close")
        : this.#settingsFields.name)?.focus();
    });
    dispatch(this, "gui:node-settings-open", { node });
    return true;
  }

  #hideNodeSettings(reason) {
    if (!this.#settingsDialog?.open && !this.#settingsDialog?.hasAttribute("open")) {
      return false;
    }
    const nodeId = this.#settingsNodeId;
    const node = nodeId ? this.#graph.getNode(nodeId) : undefined;
    if (typeof this.#settingsDialog.close === "function") this.#settingsDialog.close();
    else this.#settingsDialog.removeAttribute("open");
    this.#settingsNodeId = null;
    dispatch(this, "gui:node-settings-close", { node, reason });

    requestAnimationFrame(() => {
      if (this.#settingsTrigger?.isConnected) this.#settingsTrigger.focus();
      else if (nodeId) {
        this.#nodeElements.get(nodeId)
          ?.querySelector(".node-settings-trigger")
          ?.focus();
      }
      this.#settingsTrigger = null;
    });
    return true;
  }

  #syncSettingsReadOnly() {
    if (!this.#settingsFields) return;
    const disabled = this.readOnly;
    const {
      name,
      type,
      description,
      color,
      useTheme,
      allowMultipleConnections,
      maxConnections,
      data,
      save,
    } =
      this.#settingsFields;
    name.disabled = disabled;
    type.disabled = disabled;
    description.disabled = disabled;
    useTheme.disabled = disabled;
    color.disabled = disabled || useTheme.checked;
    allowMultipleConnections.disabled = disabled;
    maxConnections.disabled = disabled;
    data.disabled = disabled;
    save.disabled = disabled;
    save.hidden = disabled;
  }

  #normalizeSettingsColor(value) {
    const color = String(value ?? "").trim();
    if (/^#[\da-f]{6}$/i.test(color)) return color;
    if (/^#[\da-f]{3}$/i.test(color)) {
      return `#${[...color.slice(1)].map((part) => `${part}${part}`).join("")}`;
    }
    return "#5b5ce2";
  }

  #saveNodeSettings = (event) => {
    event.preventDefault();
    if (this.readOnly || !this.#settingsNodeId) return;
    if (!this.#settingsForm.reportValidity()) return;

    let data;
    try {
      data = JSON.parse(this.#settingsFields.data.value || "null");
    } catch (error) {
      this.#settingsError.textContent = `Node data must be valid JSON: ${error.message}`;
      this.#settingsError.hidden = false;
      this.#settingsFields.data.focus();
      return;
    }

    const previous = this.#graph.getNode(this.#settingsNodeId);
    if (!previous) {
      this.#hideNodeSettings("missing");
      return;
    }
    const patch = {
      title: this.#settingsFields.name.value.trim(),
      type: this.#settingsFields.type.value.trim(),
      description: this.#settingsFields.description.value.trim(),
      color: this.#settingsFields.useTheme.checked
        ? undefined
        : this.#settingsFields.color.value,
      allowMultipleConnections:
        this.#settingsFields.allowMultipleConnections.checked,
      maxConnections: this.#settingsFields.maxConnections.value === ""
        ? undefined
        : Math.max(0, Math.floor(finite(
            this.#settingsFields.maxConnections.value,
          ))),
      data,
    };
    if (!dispatch(
      this,
      "gui:node-settings-save-request",
      { node: previous, patch },
      true,
    )) return;

    const updated = this.updateNode(previous.id, patch);
    dispatch(this, "gui:node-settings-save", { node: updated, previous, patch });
    this.#hideNodeSettings("save");
  };

  #render() {
    if (!this.#nodeLayer) return;
    this.#nodeElements.clear();
    this.#portElements.clear();
    this.#parameterElements.clear();
    this.#nodeLayer.replaceChildren();
    if (this.#subgraphButton) {
      this.#subgraphButton.hidden = this.#graphStack.length === 0;
      this.#subgraphButton.title = this.#graphStack.length
        ? `Exit ${this.#graphStack.at(-1).title}`
        : "";
    }
    this.#renderGroups();
    for (const node of this.#graph.nodes) {
      const element = this.#createNodeElement(node);
      this.#nodeElements.set(node.id, element);
      this.#nodeLayer.append(element);
    }
    this.#applyView();
    this.#syncSelection();
    this.#syncParameterReadOnly();
    this.#syncExecution();
    this.#scheduleConnections();
    this.#renderMinimap();
  }

  #createNodeElement(node) {
    const element = document.createElement("article");
    element.className = "node";
    element.dataset.nodeId = node.id;
    element.dataset.nodeType = node.type;
    element.dataset.collapsed = String(Boolean(node.collapsed));
    element.dataset.execution = this.#execution.get(node.id)?.state ?? "idle";
    element.dataset.breakpoint = String(this.#breakpoints.has(node.id));
    element.dataset.subgraph = String(Boolean(node.subgraph));
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
    type.className = "node-type";
    type.textContent = node.type;
    const settings = this.#settingsIconButton(
      `Settings for ${node.title}`,
      "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M10 14v6",
    );
    settings.className = "node-settings-trigger";
    settings.addEventListener("pointerdown", (event) => event.stopPropagation());
    settings.addEventListener("click", (event) => {
      event.stopPropagation();
      this.selectNode(node.id);
      this.#showNodeSettings(node.id, settings);
    });
    const collapse = this.#settingsIconButton(
      node.collapsed ? `Expand ${node.title}` : `Collapse ${node.title}`,
      node.collapsed ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6",
    );
    collapse.className = "node-collapse-trigger";
    collapse.addEventListener("pointerdown", (event) => event.stopPropagation());
    collapse.addEventListener("click", (event) => {
      event.stopPropagation();
      this.setNodeCollapsed(node.id, !node.collapsed);
    });
    const actions = document.createElement("div");
    actions.className = "node-header-actions";
    actions.append(type);
    if (node.subgraph) {
      const nested = document.createElement("span");
      nested.className = "node-subgraph-indicator";
      nested.title = "Double-click to open subgraph";
      nested.textContent = "↳";
      actions.append(nested);
    }
    actions.append(collapse, settings);
    header.append(title, actions);

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
    const inlineParameters = node.parameters.filter((parameter) => parameter.inline);
    if (inlineParameters.length) {
      const parameters = document.createElement("section");
      parameters.className = "node-parameters";
      parameters.setAttribute("aria-label", `${node.title} parameters`);
      inlineParameters.forEach((parameter) => {
        parameters.append(this.#createParameterElement(parameter, node.id));
      });
      body.append(parameters);
    }
    element.append(header, body);
    element.addEventListener("focus", () => this.selectNode(node.id));
    element.addEventListener("animationend", this.#scheduleConnections, { once: true });
    return element;
  }

  #renderGroups() {
    const groups = new Map();
    for (const node of this.#graph.nodes) {
      if (!node.groupId) continue;
      const entries = groups.get(node.groupId) ?? [];
      entries.push(node);
      groups.set(node.groupId, entries);
    }
    for (const [id, nodes] of groups) {
      const frame = document.createElement("section");
      frame.className = "node-group";
      frame.dataset.groupId = id;
      const padding = 28;
      const left = Math.min(...nodes.map((node) => node.x)) - padding;
      const top = Math.min(...nodes.map((node) => node.y)) - padding - 22;
      const right = Math.max(...nodes.map((node) => node.x + node.width)) + padding;
      const bottom = Math.max(...nodes.map((node) => {
        const element = this.#nodeElements.get(node.id);
        return node.y + (element?.offsetHeight ?? 180);
      })) + padding;
      frame.style.transform = `translate(${left}px, ${top}px)`;
      frame.style.width = `${right - left}px`;
      frame.style.height = `${bottom - top}px`;
      const label = document.createElement("strong");
      label.textContent = id;
      frame.append(label);
      this.#nodeLayer.append(frame);
    }
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
    this.#applyPortWireType(button, port.type);
    this.#portElements.set(port.id, button);
    return row;
  }

  #applyPortWireType(element, type) {
    const wireType = this.getWireType(type);
    element.dataset.wireType = wireType.id;
    element.style.setProperty("--port-color", wireType.color);
  }

  #applyWireType(element, type) {
    const wireType = this.getWireType(type);
    element.dataset.wireType = wireType.id;
    element.style.setProperty("--wire-color", wireType.color);
    element.style.setProperty("--wire-width", `${wireType.width}px`);
    element.style.setProperty("--wire-opacity", String(wireType.opacity));
    element.style.strokeDasharray = wireType.dash;
  }

  #syncWireTypes() {
    this.#portElements.forEach((element, portId) => {
      this.#applyPortWireType(element, this.#graph.getPort(portId)?.type);
    });
    this.#renderConnections();
  }

  #createParameterElement(parameter, nodeId) {
    const row = document.createElement(parameter.type === "readonly" ? "div" : "label");
    row.className = `node-parameter node-parameter--${parameter.type}`;
    row.dataset.parameterId = parameter.id;
    const label = document.createElement("span");
    label.className = "node-parameter-label";
    label.textContent = parameter.label;
    if (parameter.description) row.title = String(parameter.description);

    let control;
    let output;
    if (parameter.type === "boolean") {
      control = document.createElement("input");
      control.type = "checkbox";
      control.checked = parameter.value;
      row.append(control, label);
    } else if (parameter.type === "select") {
      control = document.createElement("select");
      parameter.options.forEach((option) => {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        element.disabled = option.disabled;
        control.append(element);
      });
      control.value = parameter.value;
      row.append(label, control);
    } else if (parameter.type === "readonly") {
      output = document.createElement("strong");
      output.className = "node-parameter-value";
      output.textContent = this.#formatParameterValue(parameter);
      row.append(label, output);
    } else {
      control = document.createElement("input");
      control.type = parameter.type === "range" ? "range" : parameter.type;
      control.value = parameter.value;
      if (parameter.min !== undefined) control.min = String(parameter.min);
      if (parameter.max !== undefined) control.max = String(parameter.max);
      if (parameter.step !== undefined) control.step = String(parameter.step);
      if (parameter.placeholder) control.placeholder = parameter.placeholder;
      row.append(label);
      if (parameter.type === "range") {
        const field = document.createElement("span");
        field.className = "node-parameter-range";
        output = document.createElement("output");
        output.className = "node-parameter-value";
        output.textContent = this.#formatParameterValue(parameter);
        field.append(control, output);
        row.append(field);
        control.addEventListener("input", () => {
          output.textContent = this.#formatParameterValue({
            ...parameter,
            value: control.value,
          });
        });
      } else {
        if (parameter.unit) {
          const field = document.createElement("span");
          field.className = "node-parameter-input";
          const unit = document.createElement("span");
          unit.textContent = parameter.unit;
          field.append(control, unit);
          row.append(field);
        } else {
          row.append(control);
        }
      }
    }

    if (control) {
      control.disabled = this.readOnly || parameter.disabled;
      control.addEventListener("pointerdown", (event) => event.stopPropagation());
      control.addEventListener("keydown", (event) => event.stopPropagation());
      control.addEventListener("change", () => {
        const value = parameter.type === "boolean" ? control.checked : control.value;
        this.setNodeParameter(nodeId, parameter.id, value);
      });
    }
    this.#parameterElements.set(this.#parameterKey(nodeId, parameter.id), {
      control,
      output,
    });
    return row;
  }

  #parameterKey(nodeId, parameterId) {
    return `${nodeId}\u0000${parameterId}`;
  }

  #formatParameterValue(parameter) {
    const value = parameter.value;
    let formatted;
    try {
      formatted = value && typeof value === "object"
        ? JSON.stringify(value)
        : String(value ?? "");
    } catch {
      formatted = String(value ?? "");
    }
    return `${formatted}${parameter.unit ? ` ${parameter.unit}` : ""}`;
  }

  #syncParameterElement(nodeId, parameter) {
    const entry = this.#parameterElements.get(this.#parameterKey(nodeId, parameter.id));
    if (!entry) return;
    if (entry.control) {
      if (parameter.type === "boolean") entry.control.checked = parameter.value;
      else entry.control.value = parameter.value;
      entry.control.disabled = this.readOnly || parameter.disabled;
    }
    if (entry.output) {
      entry.output.textContent = this.#formatParameterValue(parameter);
    }
  }

  #syncParameterReadOnly() {
    this.#graph.nodes.forEach((node) => {
      node.parameters.forEach((parameter) => {
        this.#syncParameterElement(node.id, parameter);
      });
    });
  }

  #renderConnections() {
    if (!this.#linkLayer) return;
    this.#linkLayer.replaceChildren();
    for (const link of this.#graph.links) {
      const from = this.#portCenter(link.from);
      const to = this.#portCenter(link.to);
      if (!from || !to) continue;
      const pathData = link.points?.length
        ? routingPath([from, ...link.points.map(normalizeRoutingPoint), to], 10)
        : this.#connectionPath(from, to, link.from, link.to);
      const visible = document.createElementNS("http://www.w3.org/2000/svg", "path");
      visible.classList.add("link");
      visible.dataset.linkId = link.id;
      visible.setAttribute("d", pathData);
      visible.dataset.selected = String(link.id === this.#selectedLink);
      this.#applyWireType(visible, link.type);
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hit.classList.add("link-hit");
      hit.dataset.linkId = link.id;
      hit.dataset.wireType = visible.dataset.wireType;
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
        preview.setAttribute(
          "d",
          this.#connectionPath(
            from,
            to,
            port.direction === "output" ? port.id : null,
            port.direction === "input" ? port.id : null,
          ),
        );
        this.#applyWireType(preview, port.type);
        this.#linkLayer.append(preview);
      }
    }
    this.#renderMinimap();
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

  #connectionPath(from, to, fromPortId = null, toPortId = null) {
    const clearance = 18;
    const stub = 26;
    const direction = this.flowDirection;
    const fromNodeId = fromPortId
      ? this.#graph.getPort(fromPortId)?.nodeId
      : null;
    const toNodeId = toPortId
      ? this.#graph.getPort(toPortId)?.nodeId
      : null;
    const fromExit = direction === "vertical"
      ? { x: from.x, y: from.y + stub }
      : { x: from.x + stub, y: from.y };
    const toExit = direction === "vertical"
      ? { x: to.x, y: to.y - stub }
      : { x: to.x - stub, y: to.y };
    const routingMargin = 180;
    const corridor = {
      left: Math.min(from.x, to.x) - routingMargin,
      top: Math.min(from.y, to.y) - routingMargin,
      right: Math.max(from.x, to.x) + routingMargin,
      bottom: Math.max(from.y, to.y) + routingMargin,
    };
    const obstacles = this.#graph.nodes
      .map((node) => {
        const element = this.#nodeElements.get(node.id);
        return {
          nodeId: node.id,
          left: node.x,
          top: node.y,
          right: node.x + (element?.offsetWidth ?? node.width),
          bottom: node.y + (element?.offsetHeight ?? 160),
        };
      })
      .filter((obstacle) => {
        const exits = [];
        if (obstacle.nodeId === fromNodeId) exits.push(fromExit);
        if (obstacle.nodeId === toNodeId) exits.push(toExit);
        if (!exits.length) return true;
        return exits.every((point) => (
          point.x <= obstacle.left - clearance
          || point.x >= obstacle.right + clearance
          || point.y <= obstacle.top - clearance
          || point.y >= obstacle.bottom + clearance
        ));
      })
      .filter((obstacle) => (
        obstacle.right >= corridor.left
        && obstacle.left <= corridor.right
        && obstacle.bottom >= corridor.top
        && obstacle.top <= corridor.bottom
      ));
    return routeNodeConnection(from, to, {
      flowDirection: direction,
      obstacles,
      clearance,
      stub,
    }).path;
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
    this.#renderMinimap();
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
          historyBefore: this.getGraph(),
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
      if (event.shiftKey && event.button === 0) {
        if (!event.ctrlKey && !event.metaKey) this.clearSelection();
        const bounds = this.#viewport.getBoundingClientRect();
        this.#interaction = {
          type: "box",
          pointerId: event.pointerId,
          startX: event.clientX - bounds.left,
          startY: event.clientY - bounds.top,
          currentX: event.clientX - bounds.left,
          currentY: event.clientY - bounds.top,
          additive: event.ctrlKey || event.metaKey,
          initial: new Set(this.#selectedNodes),
        };
        this.#selectionBox.hidden = false;
        this.#viewport.setPointerCapture(event.pointerId);
        this.dataset.interaction = "box";
        this.#updateSelectionBox();
        return;
      }
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
      ({ x, y } = this.#applyAlignmentGuides(this.#interaction.nodeId, x, y));
      this.#graph.moveNode(this.#interaction.nodeId, x, y);
      const element = this.#nodeElements.get(this.#interaction.nodeId);
      element.style.transform = `translate(${x}px, ${y}px)`;
      this.#scheduleConnections();
    } else if (this.#interaction.type === "box") {
      const bounds = this.#viewport.getBoundingClientRect();
      this.#interaction.currentX = event.clientX - bounds.left;
      this.#interaction.currentY = event.clientY - bounds.top;
      this.#updateSelectionBox();
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
    this.#hideAlignmentGuides();

    if (interaction.type === "node") {
      const element = this.#nodeElements.get(interaction.nodeId);
      delete element?.dataset.dragging;
      const node = this.#graph.getNode(interaction.nodeId);
      dispatch(this, "gui:node-move", { node });
      this.#graphChanged("node-move", { node });
      this.#recordHistory(`Move ${node.title}`, interaction.historyBefore);
    } else if (interaction.type === "box") {
      this.#selectionBox.hidden = true;
      dispatch(this, "gui:node-select", { nodes: this.selectedNodes, link: null });
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
    const link = event.target.closest(".link-hit");
    if (link) {
      event.preventDefault();
      event.stopPropagation();
      if (!this.readOnly) {
        this.disconnect(link.dataset.linkId, { reason: "double-click" });
      }
      return;
    }
    const nodeElement = event.target.closest(".node");
    if (nodeElement && this.#graph.getSubgraph(nodeElement.dataset.nodeId)) {
      event.preventDefault();
      this.enterSubgraph(nodeElement.dataset.nodeId);
      return;
    }
    if (this.readOnly || event.target.closest(".node, .toolbar")) return;
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void this.copySelection();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x" && !this.readOnly) {
      event.preventDefault();
      void this.cutSelection();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && !this.readOnly) {
      event.preventDefault();
      void this.paste();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && !this.readOnly) {
      event.preventDefault();
      this.duplicateSelection();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g" && !this.readOnly) {
      event.preventDefault();
      if (event.shiftKey) this.ungroupSelection();
      else this.groupSelection();
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.#searchInput?.focus();
      return;
    }
    if (event.key === "F9" && this.#selectedNodes.size === 1) {
      event.preventDefault();
      this.toggleBreakpoint(this.selectedNodes[0]);
      return;
    }
    if (this.readOnly) return;
    if (["Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      if (this.#selectedLink) {
        this.disconnect(this.#selectedLink, { reason: "keyboard" });
      }
      for (const nodeId of [...this.#selectedNodes]) this.removeNode(nodeId);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (!this.#selectedNodes.size) return;
    event.preventDefault();
    const historyBefore = this.getGraph();
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
    this.#recordHistory("Move nodes", historyBefore);
  };

  #updateSelectionBox() {
    const interaction = this.#interaction;
    if (!interaction || interaction.type !== "box" || !this.#selectionBox) return;
    const left = Math.min(interaction.startX, interaction.currentX);
    const top = Math.min(interaction.startY, interaction.currentY);
    const right = Math.max(interaction.startX, interaction.currentX);
    const bottom = Math.max(interaction.startY, interaction.currentY);
    this.#selectionBox.style.left = `${left}px`;
    this.#selectionBox.style.top = `${top}px`;
    this.#selectionBox.style.width = `${right - left}px`;
    this.#selectionBox.style.height = `${bottom - top}px`;
    const viewport = this.#viewport.getBoundingClientRect();
    const selected = interaction.additive ? new Set(interaction.initial) : new Set();
    this.#nodeElements.forEach((element, id) => {
      const rect = element.getBoundingClientRect();
      const local = {
        left: rect.left - viewport.left,
        top: rect.top - viewport.top,
        right: rect.right - viewport.left,
        bottom: rect.bottom - viewport.top,
      };
      if (local.right >= left && local.left <= right && local.bottom >= top && local.top <= bottom) {
        selected.add(id);
      }
    });
    this.#selectedNodes = selected;
    this.#selectedLink = null;
    this.#syncSelection();
  }

  #applyAlignmentGuides(nodeId, x, y) {
    const threshold = 6 / this.#view.zoom;
    let alignedX = x;
    let alignedY = y;
    let guideX = null;
    let guideY = null;
    for (const node of this.#graph.nodes) {
      if (node.id === nodeId) continue;
      if (guideX == null && Math.abs(node.x - x) <= threshold) {
        alignedX = node.x;
        guideX = node.x;
      }
      if (guideY == null && Math.abs(node.y - y) <= threshold) {
        alignedY = node.y;
        guideY = node.y;
      }
    }
    if (this.#guideX) {
      this.#guideX.hidden = guideX == null;
      if (guideX != null) this.#guideX.style.left = `${this.#view.x + guideX * this.#view.zoom}px`;
    }
    if (this.#guideY) {
      this.#guideY.hidden = guideY == null;
      if (guideY != null) this.#guideY.style.top = `${this.#view.y + guideY * this.#view.zoom}px`;
    }
    return { x: alignedX, y: alignedY };
  }

  #hideAlignmentGuides() {
    if (this.#guideX) this.#guideX.hidden = true;
    if (this.#guideY) this.#guideY.hidden = true;
  }

  #syncExecution() {
    this.#nodeElements.forEach((element, id) => {
      element.dataset.execution = this.#execution.get(id)?.state ?? "idle";
      element.dataset.breakpoint = String(this.#breakpoints.has(id));
    });
  }

  #renderMinimap() {
    if (!this.#minimap) return;
    const context = this.#minimap.getContext("2d");
    if (!context) return;
    const width = this.#minimap.width;
    const height = this.#minimap.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = getComputedStyle(this).getPropertyValue("--gui-surface").trim() || "#111827";
    context.fillRect(0, 0, width, height);
    const nodes = this.#graph.nodes;
    if (!nodes.length) return;
    const padding = 8;
    const left = Math.min(...nodes.map((node) => node.x));
    const top = Math.min(...nodes.map((node) => node.y));
    const right = Math.max(...nodes.map((node) => node.x + node.width));
    const bottom = Math.max(...nodes.map((node) => (
      node.y + (this.#nodeElements.get(node.id)?.offsetHeight ?? 160)
    )));
    const graphWidth = Math.max(1, right - left);
    const graphHeight = Math.max(1, bottom - top);
    const scale = Math.min((width - padding * 2) / graphWidth, (height - padding * 2) / graphHeight);
    this.#minimap.dataset.left = String(left);
    this.#minimap.dataset.top = String(top);
    this.#minimap.dataset.width = String(graphWidth);
    this.#minimap.dataset.height = String(graphHeight);
    nodes.forEach((node) => {
      const execution = this.#execution.get(node.id)?.state;
      context.fillStyle = execution === "error"
        ? "#ef4444"
        : execution === "running"
          ? "#22c55e"
          : (node.color || "#64748b");
      context.fillRect(
        padding + (node.x - left) * scale,
        padding + (node.y - top) * scale,
        Math.max(3, node.width * scale),
        Math.max(3, (this.#nodeElements.get(node.id)?.offsetHeight ?? 160) * scale),
      );
    });
    const viewport = this.#viewport.getBoundingClientRect();
    const viewLeft = -this.#view.x / this.#view.zoom;
    const viewTop = -this.#view.y / this.#view.zoom;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.strokeRect(
      padding + (viewLeft - left) * scale,
      padding + (viewTop - top) * scale,
      viewport.width / this.#view.zoom * scale,
      viewport.height / this.#view.zoom * scale,
    );
  }

  #centerFromMinimap(relativeX, relativeY) {
    const left = Number(this.#minimap.dataset.left);
    const top = Number(this.#minimap.dataset.top);
    const width = Number(this.#minimap.dataset.width);
    const height = Number(this.#minimap.dataset.height);
    if (![left, top, width, height].every(Number.isFinite)) return;
    const viewport = this.#viewport.getBoundingClientRect();
    const worldX = left + relativeX * width;
    const worldY = top + relativeY * height;
    this.setView({
      x: viewport.width / 2 - worldX * this.#view.zoom,
      y: viewport.height / 2 - worldY * this.#view.zoom,
    });
  }

  #recordHistory(label, before) {
    if (!this.#history?.record || this.#restoringHistory) return;
    const after = this.getGraph();
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    const restore = (snapshot) => {
      this.#restoringHistory = true;
      try {
        this.setGraph(snapshot);
      } finally {
        this.#restoringHistory = false;
      }
    };
    this.#history.record({
      label,
      data: { before, after },
      undo: () => restore(before),
      redo: () => restore(after),
    });
  }

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
  version: "0.4.0",
  description: "Typed visual graph editor with routing, editing tools, validation, and execution state.",
  dependencies: ["core"],
  components: ["gui-node-editor"],
  setup() {
    if (hasDOM && !customElements.get("gui-node-editor")) {
      customElements.define("gui-node-editor", GuiNodeEditor);
    }
    return { GuiNodeEditor, GuiNodeGraph, routeNodeConnection };
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

  .links {
    z-index: 2;
    pointer-events: none;
  }

  .nodes {
    z-index: 1;
    pointer-events: none;
  }

  .link {
    fill: none;
    stroke: var(--wire-color, var(--gui-accent, #5b5ce2));
    stroke-linecap: round;
    stroke-width: var(--wire-width, 3px);
    opacity: var(--wire-opacity, .82);
    pointer-events: none;
    transition: opacity 160ms, stroke-width 160ms;
  }

  .link[data-selected="true"] {
    stroke-width: calc(var(--wire-width, 3px) + 2px);
    opacity: 1;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--wire-color, var(--gui-accent, #5b5ce2)) 45%, transparent));
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

  .node-header-actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: .3rem;
  }

  .node-header .node-type {
    padding: .16rem .38rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--node-color) 13%, transparent);
    color: var(--node-color);
    font: 750 .62rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .node-subgraph-indicator {
    color: var(--node-color);
    font-weight: 800;
  }

  .node-settings-trigger,
  .node-collapse-trigger {
    display: grid;
    width: 1.7rem;
    height: 1.7rem;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: .45rem;
    background: transparent;
    color: var(--gui-text-muted, #666b78);
    cursor: pointer;
    opacity: .68;
    transition: background 160ms, color 160ms, opacity 160ms, transform 160ms;
  }

  .node-settings-trigger:hover,
  .node-settings-trigger:focus-visible,
  .node-collapse-trigger:hover,
  .node-collapse-trigger:focus-visible {
    background: color-mix(in srgb, var(--node-color) 14%, transparent);
    color: var(--node-color);
    opacity: 1;
  }

  .node-settings-trigger:active,
  .node-collapse-trigger:active { transform: scale(.92); }
  .node-settings-trigger:focus-visible,
  .node-collapse-trigger:focus-visible {
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 1px;
  }

  .node-settings-trigger svg,
  .node-collapse-trigger svg,
  .node-settings-close svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
  }

  .node-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: .65rem;
    min-height: 3rem;
    padding: .65rem 0;
  }

  .node[data-collapsed="true"] .node-body { display: none; }
  .node[data-collapsed="true"] .node-header { border-bottom: 0; border-radius: .8rem; }
  .node[data-node-type="comment"] {
    --node-color: #f59e0b;
    min-height: 6rem;
    background: color-mix(in srgb, #f59e0b 12%, var(--gui-surface, white));
  }
  .node[data-node-type="comment"] .port-list { display: none; }
  .node[data-execution="running"] {
    box-shadow: 0 0 0 3px color-mix(in srgb, #22c55e 40%, transparent), 0 18px 42px rgb(18 23 38 / .2);
  }
  .node[data-execution="error"] { border-color: #ef4444; }
  .node[data-execution="paused"] { border-color: #f59e0b; }
  .node[data-breakpoint="true"]::before {
    content: "";
    position: absolute;
    z-index: 2;
    top: -.35rem;
    left: -.35rem;
    width: .7rem;
    height: .7rem;
    border: 2px solid var(--gui-surface, white);
    border-radius: 50%;
    background: #ef4444;
  }

  .node-group {
    position: absolute;
    z-index: -1;
    pointer-events: none;
    border: 1px dashed color-mix(in srgb, var(--gui-accent, #5b5ce2) 55%, transparent);
    border-radius: 1rem;
    background: color-mix(in srgb, var(--gui-accent, #5b5ce2) 5%, transparent);
  }
  .node-group strong {
    display: block;
    padding: .35rem .6rem;
    color: var(--gui-text-muted, #666b78);
    font: 700 .72rem/1 var(--gui-font, ui-sans-serif, system-ui);
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
    border: 2px solid var(--port-color, var(--node-color));
    border-radius: 50%;
    background: var(--gui-surface, white);
    box-shadow: 0 0 0 2px var(--gui-surface, white);
    transition: background 140ms, transform 180ms cubic-bezier(.22, 1, .36, 1);
  }

  .port:hover i, .port:focus-visible i {
    background: var(--port-color, var(--node-color));
    transform: scale(1.3);
  }

  .port:focus-visible {
    border-radius: .35rem;
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 0;
  }

  :host([flow-direction="vertical"]) .node-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "inputs"
      "description"
      "parameters"
      "outputs";
    gap: .4rem;
    padding: 0;
  }

  :host([flow-direction="vertical"]) .port-list {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    justify-content: center;
    gap: .25rem .55rem;
  }

  :host([flow-direction="vertical"]) .port-list--inputs {
    grid-area: inputs;
    align-items: flex-start;
  }

  :host([flow-direction="vertical"]) .port-list--outputs {
    grid-area: outputs;
    align-items: flex-end;
  }

  :host([flow-direction="vertical"]) .port-row,
  :host([flow-direction="vertical"]) .port-row--output {
    min-width: 0;
    text-align: center;
  }

  :host([flow-direction="vertical"]) .port {
    flex-direction: column;
    gap: .28rem;
    padding: .35rem .45rem;
  }

  :host([flow-direction="vertical"]) .port--input {
    margin: 0;
  }

  :host([flow-direction="vertical"]) .port--input i {
    position: absolute;
    top: -.39rem;
  }

  :host([flow-direction="vertical"]) .port--output {
    margin: 0 0 -.75rem;
  }

  :host([flow-direction="vertical"]) .node-description {
    grid-area: description;
    margin: .2rem .8rem;
    text-align: center;
  }

  :host([flow-direction="vertical"]) .node-parameters {
    grid-area: parameters;
    margin-top: 0;
    padding-bottom: .55rem;
  }

  .node-description {
    grid-column: 1 / -1;
    margin: .25rem .8rem 0;
    color: var(--gui-text-muted, #666b78);
    font: .7rem/1.4 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-parameters {
    display: grid;
    grid-column: 1 / -1;
    gap: .48rem;
    margin-top: .1rem;
    padding: .65rem .8rem .15rem;
    border-top: 1px solid var(--gui-border, #dfe2ea);
  }

  .node-parameter {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(4.5rem, .9fr);
    align-items: center;
    gap: .55rem;
    min-width: 0;
    color: var(--gui-text-muted, #666b78);
    font: 620 .68rem/1.25 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-parameter-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-parameter input[type="text"],
  .node-parameter input[type="number"],
  .node-parameter select {
    width: 100%;
    min-width: 0;
    height: 1.75rem;
    padding: .25rem .42rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .42rem;
    outline: none;
    background: var(--gui-surface, white);
    color: var(--gui-text, #17181c);
    font: 600 .68rem/1.1 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-parameter select {
    padding-right: .2rem;
  }

  .node-parameter input:focus,
  .node-parameter select:focus {
    border-color: var(--node-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--node-color) 22%, transparent);
  }

  .node-parameter--boolean {
    display: flex;
    justify-content: space-between;
  }

  .node-parameter--boolean input {
    order: 2;
    width: 1.8rem;
    height: 1rem;
    margin: 0;
    accent-color: var(--node-color);
  }

  .node-parameter-range {
    display: grid;
    grid-template-columns: minmax(3.4rem, 1fr) auto;
    align-items: center;
    gap: .35rem;
    min-width: 0;
  }

  .node-parameter input[type="range"] {
    width: 100%;
    min-width: 0;
    margin: 0;
    accent-color: var(--node-color);
  }

  .node-parameter-input {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: .3rem;
  }

  .node-parameter-input > span {
    color: var(--gui-text-muted, #666b78);
    font-size: .62rem;
  }

  .node-parameter-value {
    overflow: hidden;
    color: var(--gui-text, #17181c);
    font: 720 .66rem/1.2 var(--gui-font-mono, ui-monospace, monospace);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-parameter :disabled {
    cursor: not-allowed;
    opacity: .55;
  }

  .node-settings-dialog {
    width: min(34rem, calc(100vw - 2rem));
    max-height: min(46rem, calc(100vh - 2rem));
    margin: auto;
    padding: 0;
    overflow: auto;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: 1rem;
    background: var(--gui-surface-raised, white);
    color: var(--gui-text, #17181c);
    box-shadow: 0 28px 90px rgb(18 23 38 / .32);
    animation: node-settings-arrive 220ms cubic-bezier(.22, 1, .36, 1);
  }

  .node-settings-dialog::backdrop {
    background: rgb(18 23 38 / .48);
    backdrop-filter: blur(5px);
    animation: node-settings-backdrop 180ms ease-out;
  }

  .node-settings-form { min-width: 0; }

  .node-settings-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid var(--gui-border, #dfe2ea);
    background:
      linear-gradient(135deg, var(--gui-accent-soft, #ededff), transparent 60%),
      var(--gui-surface-raised, white);
  }

  .node-settings-eyebrow {
    display: block;
    margin-bottom: .3rem;
    color: var(--gui-accent, #5b5ce2);
    font: 750 .66rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .node-settings-header h2 {
    margin: 0;
    font: 760 1.3rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-settings-id {
    display: block;
    margin-top: .38rem;
    color: var(--gui-text-muted, #666b78);
    font: 550 .72rem/1.2 var(--gui-font-mono, ui-monospace, monospace);
  }

  .node-settings-close {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: .55rem;
    background: transparent;
    color: var(--gui-text-muted, #666b78);
    cursor: pointer;
  }

  .node-settings-close:hover { background: var(--gui-accent-soft, #ededff); }
  .node-settings-close:focus-visible {
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 2px;
  }

  .node-settings-body {
    display: grid;
    gap: 1rem;
    padding: 1.2rem 1.25rem;
  }

  .node-settings-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: .8rem;
  }

  .node-settings-field {
    display: grid;
    gap: .42rem;
    min-width: 0;
  }

  .node-settings-field > span {
    color: var(--gui-text-muted, #666b78);
    font: 680 .72rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-settings-field input[type="text"],
  .node-settings-field input[type="number"],
  .node-settings-field textarea {
    width: 100%;
    min-width: 0;
    padding: .7rem .75rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .65rem;
    outline: none;
    background: var(--gui-surface, white);
    color: var(--gui-text, #17181c);
    font: 500 .82rem/1.45 var(--gui-font, ui-sans-serif, system-ui);
    transition: border-color 150ms, box-shadow 150ms;
  }

  .node-settings-field textarea { resize: vertical; }
  .node-settings-field input:focus,
  .node-settings-field textarea:focus {
    border-color: var(--gui-accent, #5b5ce2);
    box-shadow: 0 0 0 3px var(--gui-focus, rgb(91 92 226 / .22));
  }

  .node-settings-json {
    font-family: var(--gui-font-mono, ui-monospace, monospace) !important;
    font-size: .76rem !important;
  }

  .node-settings-color {
    display: flex;
    align-items: center;
    gap: .75rem;
    min-height: 2.6rem;
  }

  .node-settings-color > input[type="color"] {
    width: 3.2rem;
    height: 2.35rem;
    padding: .18rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .58rem;
    background: var(--gui-surface, white);
    cursor: pointer;
  }

  .node-settings-check {
    display: inline-flex;
    align-items: center;
    gap: .45rem;
    color: var(--gui-text, #17181c);
    font: 550 .78rem/1.3 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-settings-check input { accent-color: var(--gui-accent, #5b5ce2); }

  .node-settings-connection-policy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(9rem, .7fr);
    align-items: end;
    gap: .75rem;
  }

  .node-settings-connection-limit {
    display: grid;
    gap: .35rem;
    color: var(--gui-text-muted, #666b78);
    font: 600 .7rem/1.2 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-settings-connection-limit input {
    width: 100%;
  }

  .node-settings-field :disabled {
    cursor: not-allowed;
    opacity: .58;
  }

  .node-settings-error {
    margin: 0;
    padding: .65rem .75rem;
    border-radius: .6rem;
    background: color-mix(in srgb, var(--gui-danger, #dc3545) 12%, transparent);
    color: var(--gui-danger, #b42332);
    font: 600 .75rem/1.4 var(--gui-font, ui-sans-serif, system-ui);
  }
  .node-settings-error[hidden] { display: none; }

  .node-settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: .65rem;
    padding: 1rem 1.25rem 1.2rem;
    border-top: 1px solid var(--gui-border, #dfe2ea);
  }

  .node-settings-button {
    min-height: 2.35rem;
    padding: .55rem .85rem;
    border: 1px solid transparent;
    border-radius: .65rem;
    cursor: pointer;
    font: 680 .78rem/1 var(--gui-font, ui-sans-serif, system-ui);
  }

  .node-settings-button--secondary {
    border-color: var(--gui-border, #dfe2ea);
    background: var(--gui-surface, white);
    color: var(--gui-text, #17181c);
  }

  .node-settings-button--primary {
    background: var(--gui-accent, #5b5ce2);
    color: white;
    box-shadow: 0 8px 20px color-mix(in srgb, var(--gui-accent, #5b5ce2) 28%, transparent);
  }

  .node-settings-button:hover { filter: brightness(.98); }
  .node-settings-button:focus-visible {
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 2px;
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
  .toolbar button[hidden] { display: none; }
  .node-search {
    width: clamp(7rem, 16vw, 12rem);
    height: 1.9rem;
    margin-inline-start: .2rem;
    padding: 0 .55rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .45rem;
    background: var(--gui-surface, white);
    color: var(--gui-text, #17181c);
    font: 600 .72rem/1 var(--gui-font, ui-sans-serif, system-ui);
  }
  .node-search:focus {
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 1px;
  }
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

  .minimap {
    position: absolute;
    z-index: 9;
    left: .75rem;
    bottom: .75rem;
    width: 11.25rem;
    height: 6.875rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .55rem;
    background: var(--gui-surface, white);
    box-shadow: var(--gui-shadow-sm, 0 1px 2px rgb(18 23 38 / .08));
    cursor: crosshair;
    opacity: .9;
  }

  .selection-box {
    position: absolute;
    z-index: 8;
    border: 1px solid var(--gui-accent, #5b5ce2);
    background: color-mix(in srgb, var(--gui-accent, #5b5ce2) 14%, transparent);
    pointer-events: none;
  }
  .selection-box[hidden] { display: none; }

  .alignment-guide {
    position: absolute;
    z-index: 8;
    pointer-events: none;
    background: color-mix(in srgb, var(--gui-accent, #5b5ce2) 78%, white);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--gui-accent, #5b5ce2) 20%, transparent);
  }
  .alignment-guide--x {
    inset-block: 0;
    width: 1px;
  }
  .alignment-guide--y {
    inset-inline: 0;
    height: 1px;
  }
  .alignment-guide[hidden] { display: none; }

  @keyframes node-arrive {
    from { opacity: 0; scale: .96; }
    to { opacity: 1; scale: 1; }
  }

  @keyframes node-link-flow {
    to { stroke-dashoffset: -15; }
  }

  @keyframes node-settings-arrive {
    from { opacity: 0; transform: translateY(.7rem) scale(.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes node-settings-backdrop {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (max-width: 36rem) {
    .help { display: none; }
    .node-settings-grid { grid-template-columns: 1fr; }
    .node-settings-connection-policy { grid-template-columns: 1fr; }
    .node-settings-dialog {
      width: calc(100vw - 1rem);
      max-height: calc(100vh - 1rem);
    }
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
