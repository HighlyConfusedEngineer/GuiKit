/**
 * gui-template
 * A dependency-free UI foundation built on Web Components and web standards.
 */

import {
  GuiModuleRegistry,
  defineGuiModule,
  guiModules,
} from "./core/module-registry.js";
import {
  GuiNodeEditor,
  GuiNodeGraph,
  nodeEditorModule,
  routeNodeConnection,
} from "./modules/node-editor/index.js";
import {
  GuiMediaAdapterRegistry,
  GuiMediaPlayer,
  mediaAdapters,
  mediaPlayerModule,
} from "./modules/media-player/index.js";
import {
  GuiStatusbar,
  statusbarModule,
} from "./modules/statusbar/index.js";
import {
  GuiWizard,
  GuiWizardModel,
  wizardModule,
} from "./modules/wizard/index.js";
import {
  GUI_LOG_LEVELS,
  GUI_LOG_SCHEMA,
  GuiBatchSink,
  GuiBridgeLogSink,
  GuiConsoleSink,
  GuiHttpLogSink,
  GuiLogger,
  GuiLogManager,
  GuiLogSpan,
  GuiLogViewer,
  GuiMemorySink,
  logger,
  loggingModule,
  logs,
} from "./modules/logging/index.js";
import {
  GuiCommandPalette,
  GuiCommandRegistry,
  GuiHistory,
  commands,
  commandsModule,
  history,
  installDefaultCommands,
} from "./modules/commands/index.js";
import {
  GuiDialog,
  GuiContextMenu,
  GuiMenu,
  GuiOverlayController,
  GuiPopover,
  GuiTooltip,
  overlayController,
  overlaysModule,
} from "./modules/overlays/index.js";
import {
  GuiCapabilityRegistry,
  GuiClipboard,
  GuiDiagnostics,
  GuiDragDrop,
  GuiMemoryStorage,
  GuiPersistenceStore,
  GuiRouter,
  GuiTaskCenter,
  GuiTaskManager,
  capabilities,
  clipboard,
  diagnostics,
  dragDrop,
  persistence,
  router,
  runtimeModule,
  tasks,
} from "./modules/runtime/index.js";
import {
  GuiForm,
  GuiFormEditorRegistry,
  GuiFormModel,
  formEditors,
  formsModule,
} from "./modules/forms/index.js";
import {
  GuiDataCollection,
  GuiDataGrid,
  GuiPagedDataSource,
  GuiTreeModel,
  GuiTreeView,
  GuiVirtualList,
  dataViewsModule,
} from "./modules/data-views/index.js";
import {
  GuiWorkspace,
  GuiWorkspaceModel,
  workspaceModule,
} from "./modules/workspace/index.js";
import {
  GuiComponentPlayground,
  GuiDiagnosticsPanel,
  auditAccessibility,
  devtoolsModule,
} from "./modules/devtools/index.js";

export {
  GUI_LOG_LEVELS,
  GUI_LOG_SCHEMA,
  GuiBatchSink,
  GuiBridgeLogSink,
  GuiCapabilityRegistry,
  GuiClipboard,
  GuiCommandPalette,
  GuiCommandRegistry,
  GuiComponentPlayground,
  GuiConsoleSink,
  GuiDataCollection,
  GuiDataGrid,
  GuiPagedDataSource,
  GuiDiagnostics,
  GuiDiagnosticsPanel,
  GuiDragDrop,
  GuiDialog,
  GuiContextMenu,
  GuiForm,
  GuiFormEditorRegistry,
  GuiFormModel,
  GuiHistory,
  GuiHttpLogSink,
  GuiLogger,
  GuiLogManager,
  GuiLogSpan,
  GuiLogViewer,
  GuiModuleRegistry,
  GuiMediaAdapterRegistry,
  GuiMediaPlayer,
  GuiMemorySink,
  GuiMemoryStorage,
  GuiMenu,
  GuiNodeEditor,
  GuiNodeGraph,
  GuiOverlayController,
  GuiPersistenceStore,
  GuiPopover,
  GuiRouter,
  GuiStatusbar,
  GuiTaskCenter,
  GuiTaskManager,
  GuiTooltip,
  GuiTreeModel,
  GuiTreeView,
  GuiVirtualList,
  GuiWizard,
  GuiWizardModel,
  GuiWorkspace,
  GuiWorkspaceModel,
  auditAccessibility,
  capabilities,
  clipboard,
  commands,
  commandsModule,
  dataViewsModule,
  defineGuiModule,
  devtoolsModule,
  diagnostics,
  dragDrop,
  formEditors,
  formsModule,
  guiModules,
  history,
  installDefaultCommands,
  logger,
  loggingModule,
  logs,
  mediaAdapters,
  mediaPlayerModule,
  nodeEditorModule,
  overlayController,
  overlaysModule,
  persistence,
  routeNodeConnection,
  router,
  runtimeModule,
  statusbarModule,
  tasks,
  wizardModule,
  workspaceModule,
};

const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};
let guiInitialized = false;
const GuiEventTarget = typeof EventTarget !== "undefined"
  ? EventTarget
  : class {
      #listeners = new Map();

      addEventListener(name, listener) {
        const listeners = this.#listeners.get(name) ?? new Set();
        listeners.add(listener);
        this.#listeners.set(name, listeners);
      }

      removeEventListener(name, listener) {
        this.#listeners.get(name)?.delete(listener);
      }

      dispatchEvent(event) {
        this.#listeners.get(event.type)?.forEach((listener) => listener.call(this, event));
        return true;
      }
    };

function createEvent(name, detail = {}) {
  if (typeof CustomEvent !== "undefined") {
    return new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail,
    });
  }
  if (typeof Event !== "undefined") {
    const event = new Event(name, { cancelable: true });
    Object.defineProperty(event, "detail", { value: detail });
    return event;
  }
  return { type: name, detail };
}

function emit(target, name, detail = {}) {
  target.dispatchEvent(createEvent(name, detail));
}

function readPath(source, path) {
  return String(path)
    .split(".")
    .reduce((value, key) => value?.[key], source);
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Some embedded webviews disable persistent storage. The UI still works.
  }
}

export class GuiI18n extends GuiEventTarget {
  #catalogs = new Map();
  #locale = "en";
  #fallbackLocale = "en";

  constructor(options = {}) {
    super();
    this.#locale = options.locale ?? "en";
    this.#fallbackLocale = options.fallbackLocale ?? "en";
  }

  get locale() {
    return this.#locale;
  }

  get fallbackLocale() {
    return this.#fallbackLocale;
  }

  set fallbackLocale(locale) {
    this.#fallbackLocale = locale;
  }

  register(locale, messages) {
    this.#catalogs.set(locale, messages);
    return this;
  }

  async load(locale, url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load locale "${locale}" from ${url}.`);
    }
    this.register(locale, await response.json());
    return this;
  }

  setLocale(locale, root = hasDOM ? document : null) {
    const previousLocale = this.#locale;
    this.#locale = locale;

    if (hasDOM) {
      document.documentElement.lang = locale;
    }
    if (root) {
      this.translate(root);
    }

    const detail = { locale, previousLocale };
    this.dispatchEvent(createEvent("change", detail));
    if (hasDOM) {
      window.dispatchEvent(createEvent("gui:locale-changed", detail));
    }
  }

  t(key, variables = {}, locale = this.#locale) {
    const active = readPath(this.#catalogs.get(locale), key);
    const fallback = readPath(this.#catalogs.get(this.#fallbackLocale), key);
    const template = active ?? fallback ?? key;

    return String(template).replace(/\{(\w+)\}/g, (_, name) => {
      return variables[name] ?? `{${name}}`;
    });
  }

  translate(root = document) {
    if (!root?.querySelectorAll) return;

    const translateAttribute = (selector, sourceAttribute, targetAttribute) => {
      root.querySelectorAll(selector).forEach((element) => {
        const key = element.getAttribute(sourceAttribute);
        const value = this.t(key);
        if (targetAttribute === "textContent") {
          element.textContent = value;
        } else {
          element.setAttribute(targetAttribute, value);
        }
      });
    };

    translateAttribute("[data-i18n]", "data-i18n", "textContent");
    translateAttribute("[data-i18n-placeholder]", "data-i18n-placeholder", "placeholder");
    translateAttribute("[data-i18n-title]", "data-i18n-title", "title");
    translateAttribute("[data-i18n-aria-label]", "data-i18n-aria-label", "aria-label");
    translateAttribute("[data-i18n-expanded-label]", "data-i18n-expanded-label", "data-expanded-label");
    translateAttribute("[data-i18n-collapsed-label]", "data-i18n-collapsed-label", "data-collapsed-label");
  }
}

export class GuiBridge extends GuiEventTarget {
  #pending = new Map();
  #sequence = 0;
  #defaultTimeout = 15_000;

  constructor() {
    super();
    if (hasDOM) {
      window.guiBridgeReceive = (message) => this.receive(message);
      window.chrome?.webview?.addEventListener?.("message", (event) => {
        this.receive(event.data);
      });
    }
  }

  get hostKind() {
    if (!hasDOM) return "none";
    if (window.chrome?.webview) return "webview2";
    if (window.webkit?.messageHandlers?.guiBridge) return "webkit";
    if (window.pywebview?.api) return "pywebview";
    return "browser";
  }

  async invoke(method, params = {}, options = {}) {
    const id = `gui-${Date.now()}-${++this.#sequence}`;
    const request = { channel: "gui-template", type: "request", id, method, params };

    if (hasDOM && window.pywebview?.api?.invoke) {
      return window.pywebview.api.invoke(method, params);
    }

    if (this.hostKind === "browser") {
      return new Promise((resolve, reject) => {
        const event = createEvent("gui:host-request", { request, resolve, reject });
        window.dispatchEvent(event);
        if (!event.defaultPrevented) {
          reject(new Error(`No native host is connected for "${method}".`));
        }
      });
    }

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`Host request "${method}" timed out.`));
      }, options.timeout ?? this.#defaultTimeout);

      this.#pending.set(id, { resolve, reject, timeout });
      this.#post(request);
    });
  }

  receive(rawMessage) {
    let message = rawMessage;
    if (typeof rawMessage === "string") {
      try {
        message = JSON.parse(rawMessage);
      } catch {
        return false;
      }
    }

    if (message?.channel !== "gui-template") return false;

    if (message.type === "response") {
      const pending = this.#pending.get(message.id);
      if (!pending) return false;

      window.clearTimeout(pending.timeout);
      this.#pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? String(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return true;
    }

    if (message.type === "event") {
      this.dispatchEvent(createEvent(message.name, message.data));
      if (hasDOM) emit(window, `gui:host:${message.name}`, message.data);
      return true;
    }

    return false;
  }

  #post(message) {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(message);
      return;
    }
    if (window.webkit?.messageHandlers?.guiBridge) {
      window.webkit.messageHandlers.guiBridge.postMessage(message);
      return;
    }
    throw new Error("No supported native host bridge was found.");
  }
}

/**
 * Fixed-capacity typed-array ring buffer used by live charts.
 * Appending stays O(1), even after the capacity is reached.
 */
export class GuiDataBuffer {
  #capacity;
  #x;
  #y;
  #start = 0;
  #length = 0;

  constructor(capacity = 10_000) {
    this.#capacity = Math.max(2, Math.floor(Number(capacity) || 10_000));
    this.#x = new Float64Array(this.#capacity);
    this.#y = new Float64Array(this.#capacity);
  }

  get capacity() {
    return this.#capacity;
  }

  get length() {
    return this.#length;
  }

  append(x, y) {
    const numericX = Number(x);
    const numericY = Number(y);
    if (!Number.isFinite(numericX) || !Number.isFinite(numericY)) return false;

    const index = (this.#start + this.#length) % this.#capacity;
    this.#x[index] = numericX;
    this.#y[index] = numericY;

    if (this.#length < this.#capacity) {
      this.#length += 1;
    } else {
      this.#start = (this.#start + 1) % this.#capacity;
    }
    return true;
  }

  appendBatch(points) {
    let appended = 0;
    let nextX = this.#length ? this.xAt(this.#length - 1) + 1 : Date.now();
    for (const point of points) {
      const normalized = normalizePoint(point, nextX);
      if (normalized && this.append(normalized.x, normalized.y)) {
        appended += 1;
        nextX = normalized.x + 1;
      }
    }
    return appended;
  }

  xAt(index) {
    if (index < 0 || index >= this.#length) return undefined;
    return this.#x[(this.#start + index) % this.#capacity];
  }

  yAt(index) {
    if (index < 0 || index >= this.#length) return undefined;
    return this.#y[(this.#start + index) % this.#capacity];
  }

  clear() {
    this.#start = 0;
    this.#length = 0;
  }

  resize(capacity) {
    const nextCapacity = Math.max(2, Math.floor(Number(capacity) || this.#capacity));
    if (nextCapacity === this.#capacity) return;

    const keep = Math.min(this.#length, nextCapacity);
    const offset = this.#length - keep;
    const nextX = new Float64Array(nextCapacity);
    const nextY = new Float64Array(nextCapacity);
    for (let index = 0; index < keep; index += 1) {
      nextX[index] = this.xAt(index + offset);
      nextY[index] = this.yAt(index + offset);
    }

    this.#capacity = nextCapacity;
    this.#x = nextX;
    this.#y = nextY;
    this.#start = 0;
    this.#length = keep;
  }
}

function normalizePoint(point, fallbackX = Date.now()) {
  if (typeof point === "number") {
    return { x: fallbackX, y: point };
  }
  if (Array.isArray(point)) {
    return { x: Number(point[0]), y: Number(point[1]) };
  }
  if (point && typeof point === "object") {
    return { x: Number(point.x ?? fallbackX), y: Number(point.y) };
  }
  return null;
}

/**
 * Returns chronological buffer indices using min/max bucket downsampling.
 * Peaks remain visible while render work stays proportional to canvas width.
 */
export function decimateMinMax(buffer, start = 0, end = buffer.length, targetBuckets = 800) {
  const from = Math.max(0, Math.floor(start));
  const to = Math.min(buffer.length, Math.ceil(end));
  const count = Math.max(0, to - from);
  const buckets = Math.max(2, Math.floor(targetBuckets));

  if (count <= buckets * 2) {
    return Array.from({ length: count }, (_, index) => from + index);
  }

  const indices = [from];
  const bucketSize = count / buckets;
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const bucketStart = Math.max(from, Math.floor(from + bucket * bucketSize));
    const bucketEnd = Math.min(to, Math.ceil(from + (bucket + 1) * bucketSize));
    let minIndex = bucketStart;
    let maxIndex = bucketStart;
    let minValue = Infinity;
    let maxValue = -Infinity;

    for (let index = bucketStart; index < bucketEnd; index += 1) {
      const value = buffer.yAt(index);
      if (value < minValue) {
        minValue = value;
        minIndex = index;
      }
      if (value > maxValue) {
        maxValue = value;
        maxIndex = index;
      }
    }

    const first = Math.min(minIndex, maxIndex);
    const second = Math.max(minIndex, maxIndex);
    if (indices.at(-1) !== first) indices.push(first);
    if (indices.at(-1) !== second) indices.push(second);
  }
  if (indices.at(-1) !== to - 1) indices.push(to - 1);
  return indices;
}

export class GuiLiveChart extends GuiElement {
  static observedAttributes = ["max-points", "window-points", "min", "max"];
  #canvas;
  #context;
  #legend;
  #series = new Map();
  #resizeObserver;
  #frame;
  #numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

  connectedCallback() {
    if (!this.shadowRoot) this.#createView();
    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver(() => this.requestRender());
      this.#resizeObserver.observe(this);
    } else {
      window.addEventListener("resize", this.#onResize);
    }
    window.addEventListener("gui:theme-changed", this.#onThemeChanged);
    this.requestRender();
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    window.removeEventListener("resize", this.#onResize);
    window.removeEventListener("gui:theme-changed", this.#onThemeChanged);
    cancelAnimationFrame(this.#frame);
  }

  attributeChangedCallback(name) {
    if (name === "max-points") {
      this.#series.forEach((series) => series.buffer.resize(this.maxPoints));
    }
    if (this.isConnected) this.requestRender();
  }

  get maxPoints() {
    return Math.max(2, Number(this.getAttribute("max-points")) || 10_000);
  }

  get windowPoints() {
    return Math.max(2, Number(this.getAttribute("window-points")) || this.maxPoints);
  }

  get pointCount() {
    let count = 0;
    this.#series.forEach((series) => { count += series.buffer.length; });
    return count;
  }

  setSeries(seriesConfigurations) {
    this.#series.clear();
    seriesConfigurations.forEach((configuration, index) => {
      this.addSeries(configuration, index);
    });
    this.requestRender();
  }

  addSeries(configuration = {}, paletteIndex = this.#series.size) {
    const id = String(configuration.id ?? `series-${paletteIndex + 1}`);
    const buffer = new GuiDataBuffer(this.maxPoints);
    if (configuration.data) buffer.appendBatch(configuration.data);
    this.#series.set(id, {
      id,
      label: configuration.label ?? id,
      color: configuration.color ?? null,
      paletteIndex,
      buffer,
    });
    this.requestRender();
    return id;
  }

  append(seriesId, value, x = Date.now()) {
    if (arguments.length === 1) {
      value = seriesId;
      seriesId = "default";
    }
    const id = String(seriesId);
    if (!this.#series.has(id)) this.addSeries({ id, label: id });
    const point = normalizePoint(value, x);
    if (!point || !this.#series.get(id).buffer.append(point.x, point.y)) return false;
    this.requestRender();
    return true;
  }

  appendBatch(seriesId, points) {
    if (arguments.length === 1) {
      points = seriesId;
      seriesId = "default";
    }
    const id = String(seriesId);
    if (!this.#series.has(id)) this.addSeries({ id, label: id });
    const appended = this.#series.get(id).buffer.appendBatch(points);
    if (appended) this.requestRender();
    return appended;
  }

  clear(seriesId) {
    if (seriesId === undefined) {
      this.#series.forEach((series) => series.buffer.clear());
    } else {
      this.#series.get(String(seriesId))?.buffer.clear();
    }
    this.requestRender();
  }

  requestRender() {
    if (!this.isConnected || this.#frame || this.getClientRects().length === 0) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = undefined;
      this.#render();
    });
  }

  #createView() {
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; min-width: 0; }
      .chart { position: relative; min-height: inherit; }
      canvas { display: block; width: 100%; height: 100%; min-height: 16rem; }
      .legend {
        position: absolute; inset: .65rem .8rem auto auto; display: flex;
        flex-wrap: wrap; justify-content: flex-end; gap: .45rem .8rem;
        max-width: calc(100% - 4rem); pointer-events: none;
        color: var(--gui-text-muted); font: 600 .75rem/1.2 var(--gui-font);
      }
      .legend span { display: inline-flex; align-items: center; gap: .35rem; }
      .legend i { width: .55rem; height: .55rem; border-radius: 50%; background: var(--series-color); }
      .legend strong { color: var(--gui-text); font-variant-numeric: tabular-nums; }
    `;
    const wrapper = document.createElement("div");
    wrapper.className = "chart";
    this.#canvas = document.createElement("canvas");
    this.#canvas.setAttribute("role", "img");
    this.#canvas.setAttribute("aria-label", this.getAttribute("label") ?? "Live data chart");
    this.#legend = document.createElement("div");
    this.#legend.className = "legend";
    this.#legend.setAttribute("aria-hidden", "true");
    wrapper.append(this.#canvas, this.#legend);
    root.append(style, wrapper);
    this.#context = this.#canvas.getContext("2d");
  }

  #onThemeChanged = () => this.requestRender();
  #onResize = () => this.requestRender();

  #seriesColor(series, styles) {
    if (series.color) return series.color;
    const paletteSlot = (series.paletteIndex % 5) + 1;
    return styles.getPropertyValue(`--gui-chart-${paletteSlot}`).trim()
      || styles.getPropertyValue("--gui-accent").trim()
      || "#5b5ce2";
  }

  #render() {
    const bounds = this.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(180, Math.round(bounds.height || 280));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.#canvas.width = Math.round(width * pixelRatio);
    this.#canvas.height = Math.round(height * pixelRatio);
    this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.#context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(this);
    const muted = styles.getPropertyValue("--gui-text-muted").trim() || "#666b78";
    const border = styles.getPropertyValue("--gui-border").trim() || "#e4e6ec";
    const padding = { top: 28, right: 14, bottom: 28, left: 50 };
    const plotWidth = Math.max(1, width - padding.left - padding.right);
    const plotHeight = Math.max(1, height - padding.top - padding.bottom);
    const visibleSeries = [...this.#series.values()].filter((series) => series.buffer.length);

    this.#renderLegend(visibleSeries, styles);
    if (!visibleSeries.length) {
      this.#context.fillStyle = muted;
      this.#context.font = `13px ${styles.getPropertyValue("--gui-font")}`;
      this.#context.textAlign = "center";
      this.#context.fillText("No data", width / 2, height / 2);
      return;
    }

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    const windows = new Map();
    visibleSeries.forEach((series) => {
      const start = Math.max(0, series.buffer.length - this.windowPoints);
      const end = series.buffer.length;
      windows.set(series.id, { start, end });
      for (let index = start; index < end; index += 1) {
        xMin = Math.min(xMin, series.buffer.xAt(index));
        xMax = Math.max(xMax, series.buffer.xAt(index));
        yMin = Math.min(yMin, series.buffer.yAt(index));
        yMax = Math.max(yMax, series.buffer.yAt(index));
      }
    });

    const fixedMin = Number(this.getAttribute("min"));
    const fixedMax = Number(this.getAttribute("max"));
    if (this.hasAttribute("min") && Number.isFinite(fixedMin)) yMin = fixedMin;
    if (this.hasAttribute("max") && Number.isFinite(fixedMax)) yMax = fixedMax;
    if (xMin === xMax) xMax = xMin + 1;
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    } else if (!this.hasAttribute("min") && !this.hasAttribute("max")) {
      const paddingY = (yMax - yMin) * 0.08;
      yMin -= paddingY;
      yMax += paddingY;
    }

    this.#drawGrid({ width, height, padding, plotWidth, plotHeight, yMin, yMax, muted, border });
    const mapX = (value) => padding.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const mapY = (value) => padding.top + (1 - ((value - yMin) / (yMax - yMin))) * plotHeight;

    visibleSeries.forEach((series) => {
      const { start, end } = windows.get(series.id);
      const indices = decimateMinMax(series.buffer, start, end, Math.ceil(plotWidth));
      this.#context.beginPath();
      indices.forEach((index, pointIndex) => {
        const x = mapX(series.buffer.xAt(index));
        const y = mapY(series.buffer.yAt(index));
        if (pointIndex === 0) this.#context.moveTo(x, y);
        else this.#context.lineTo(x, y);
      });
      this.#context.strokeStyle = this.#seriesColor(series, styles);
      this.#context.lineWidth = 1.75;
      this.#context.lineJoin = "round";
      this.#context.lineCap = "round";
      this.#context.stroke();
    });

    emit(this, "gui:chart-render", {
      points: this.pointCount,
      visiblePoints: [...windows.values()].reduce((sum, range) => sum + range.end - range.start, 0),
    });
  }

  #drawGrid({ height, padding, plotWidth, plotHeight, yMin, yMax, muted, border }) {
    this.#context.font = "11px ui-sans-serif, system-ui, sans-serif";
    this.#context.textAlign = "right";
    this.#context.textBaseline = "middle";
    for (let line = 0; line <= 4; line += 1) {
      const ratio = line / 4;
      const y = padding.top + ratio * plotHeight;
      const value = yMax - ratio * (yMax - yMin);
      this.#context.beginPath();
      this.#context.moveTo(padding.left, y);
      this.#context.lineTo(padding.left + plotWidth, y);
      this.#context.strokeStyle = border;
      this.#context.lineWidth = 1;
      this.#context.stroke();
      this.#context.fillStyle = muted;
      this.#context.fillText(this.#numberFormat.format(value), padding.left - 8, y);
    }
    this.#context.textAlign = "left";
    this.#context.textBaseline = "alphabetic";
    this.#context.fillStyle = muted;
    this.#context.fillText(`${this.windowPoints.toLocaleString()} point window`, padding.left, height - 7);
  }

  #renderLegend(seriesList, styles) {
    this.#legend.replaceChildren();
    seriesList.forEach((series) => {
      const item = document.createElement("span");
      const marker = document.createElement("i");
      marker.style.setProperty("--series-color", this.#seriesColor(series, styles));
      const label = document.createTextNode(`${series.label} `);
      const value = document.createElement("strong");
      value.textContent = this.#numberFormat.format(series.buffer.yAt(series.buffer.length - 1));
      item.append(marker, label, value);
      this.#legend.append(item);
    });
  }
}

export class GuiToastStack extends GuiElement {
  #timers = new Map();

  connectedCallback() {
    this.setAttribute("aria-live", "polite");
    this.setAttribute("aria-relevant", "additions");
    this.addEventListener("pointerenter", this.#pauseFromEvent, true);
    this.addEventListener("pointerleave", this.#resumeFromEvent, true);
    this.addEventListener("focusin", this.#pauseFromEvent);
    this.addEventListener("focusout", this.#resumeFromEvent);
  }

  disconnectedCallback() {
    this.#timers.forEach((timer) => clearTimeout(timer.handle));
    this.#timers.clear();
  }

  push(notification) {
    const item = document.createElement("article");
    item.className = `gui-toast gui-toast--${notification.variant}`;
    item.dataset.toastId = notification.id;
    item.setAttribute("role", ["error", "warning"].includes(notification.variant) ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "gui-toast__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = { success: "✓", warning: "!", error: "×", info: "i" }[notification.variant] ?? "i";

    const content = document.createElement("div");
    content.className = "gui-toast__content";
    if (notification.title) {
      const title = document.createElement("strong");
      title.textContent = notification.title;
      content.append(title);
    }
    const message = document.createElement("span");
    message.textContent = notification.message;
    content.append(message);

    item.append(icon, content);
    if (notification.action?.label) {
      const action = document.createElement("button");
      action.className = "gui-toast__action";
      action.type = "button";
      action.textContent = notification.action.label;
      action.addEventListener("click", () => {
        notification.action.onClick?.();
        emit(this, "gui:toast-action", { id: notification.id });
        if (!notification.action.keepOpen) this.dismiss(notification.id, "action");
      });
      item.append(action);
    }

    if (notification.dismissible !== false) {
      const close = document.createElement("button");
      close.className = "gui-toast__close";
      close.type = "button";
      close.setAttribute("aria-label", notification.closeLabel ?? "Dismiss notification");
      close.textContent = "×";
      close.addEventListener("click", () => this.dismiss(notification.id, "manual"));
      item.append(close);
    }

    this.append(item);
    requestAnimationFrame(() => item.dataset.visible = "true");
    if (notification.duration > 0) {
      this.#startTimer(notification.id, notification.duration);
    }
    emit(this, "gui:toast-show", { id: notification.id, variant: notification.variant });
  }

  dismiss(id, reason = "programmatic") {
    const item = [...this.children].find((child) => child.dataset.toastId === id);
    if (!item) return false;
    const timer = this.#timers.get(id);
    if (timer) clearTimeout(timer.handle);
    this.#timers.delete(id);
    item.dataset.visible = "false";
    item.addEventListener("transitionend", () => item.remove(), { once: true });
    setTimeout(() => item.remove(), 350);
    emit(this, "gui:toast-dismiss", { id, reason });
    return true;
  }

  #startTimer(id, duration) {
    const timer = {
      remaining: duration,
      started: performance.now(),
      paused: false,
      handle: setTimeout(() => this.dismiss(id, "timeout"), duration),
    };
    this.#timers.set(id, timer);
  }

  #pause(id) {
    const timer = this.#timers.get(id);
    if (!timer || timer.paused) return;
    clearTimeout(timer.handle);
    timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.started));
    timer.paused = true;
  }

  #resume(id) {
    const timer = this.#timers.get(id);
    if (!timer || !timer.paused || timer.remaining <= 0) return;
    timer.paused = false;
    timer.started = performance.now();
    timer.handle = setTimeout(() => this.dismiss(id, "timeout"), timer.remaining);
  }

  #pauseFromEvent = (event) => {
    const item = event.target.closest?.("[data-toast-id]");
    if (item) this.#pause(item.dataset.toastId);
  };

  #resumeFromEvent = (event) => {
    const item = event.target.closest?.("[data-toast-id]");
    if (!item || item.contains(event.relatedTarget)) return;
    this.#resume(item.dataset.toastId);
  };
}

export class GuiToastManager {
  #stack;
  #sequence = 0;

  show(message, options = {}) {
    const id = options.id ?? `gui-toast-${Date.now()}-${++this.#sequence}`;
    let cancelled = false;
    const notification = {
      id,
      message: String(message),
      title: options.title,
      variant: options.variant ?? "info",
      duration: options.duration ?? 4_500,
      dismissible: options.dismissible,
      closeLabel: options.closeLabel,
      action: options.action,
    };

    if (hasDOM) {
      const mount = () => {
        if (!cancelled) this.#ensureStack().push(notification);
      };
      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount, { once: true });
    }

    return {
      id,
      dismiss: () => {
        cancelled = true;
        return this.#stack?.dismiss(id) ?? false;
      },
    };
  }

  success(message, options = {}) {
    return this.show(message, { ...options, variant: "success" });
  }

  info(message, options = {}) {
    return this.show(message, { ...options, variant: "info" });
  }

  warning(message, options = {}) {
    return this.show(message, { duration: 6_000, ...options, variant: "warning" });
  }

  error(message, options = {}) {
    return this.show(message, { duration: 7_000, ...options, variant: "error" });
  }

  dismiss(id) {
    return this.#stack?.dismiss(id) ?? false;
  }

  #ensureStack() {
    this.#stack ??= document.querySelector("gui-toast-stack");
    if (!this.#stack) {
      this.#stack = document.createElement("gui-toast-stack");
      document.body.append(this.#stack);
    }
    return this.#stack;
  }
}

export class GuiTabs extends GuiElement {
  static observedAttributes = ["active"];
  static #nextId = 0;
  #transitionToken = 0;

  connectedCallback() {
    this.id ||= `gui-tabs-${++GuiTabs.#nextId}`;
    this.setAttribute("role", "region");
    this.#prepare();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
  }

  attributeChangedCallback(_name, previous, current) {
    if (this.isConnected) this.#render(current, previous);
  }

  get active() {
    return this.getAttribute("active");
  }

  set active(value) {
    if (value) this.setAttribute("active", value);
  }

  select(name, focus = false) {
    if (!this.#tabs().some((tab) => tab.dataset.tab === name)) return;
    const previous = this.active;
    this.active = name;
    if (focus) this.#tabs().find((tab) => tab.dataset.tab === name)?.focus();
    if (previous !== name) emit(this, "gui:tab-change", { active: name, previous });
  }

  #tabs() {
    return [...this.querySelectorAll(":scope > [role='tablist'] > [data-tab]")];
  }

  #panels() {
    return [...this.querySelectorAll(":scope > [data-tab-panel]")];
  }

  #prepare() {
    const tabs = this.#tabs();
    tabs.forEach((tab, index) => {
      const name = tab.dataset.tab;
      tab.setAttribute("role", "tab");
      tab.id ||= `${this.id}-tab-${name}`;
      tab.setAttribute("aria-controls", `${this.id}-panel-${name}`);
      if (!this.active && index === 0) this.setAttribute("active", name);
    });

    this.#panels().forEach((panel) => {
      const name = panel.dataset.tabPanel;
      panel.setAttribute("role", "tabpanel");
      panel.id ||= `${this.id}-panel-${name}`;
      panel.setAttribute("aria-labelledby", `${this.id}-tab-${name}`);
    });
    this.#render(this.active, null, false);
  }

  #render(active = this.active, previous = null, animate = true) {
    this.#tabs().forEach((tab) => {
      const selected = tab.dataset.tab === active;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    const panels = this.#panels();
    const incoming = panels.find((panel) => panel.dataset.tabPanel === active);
    const token = ++this.#transitionToken;
    panels.forEach((panel) => {
      panel.getAnimations?.().forEach((animation) => animation.cancel());
      panel.hidden = panel !== incoming;
      panel.inert = panel !== incoming;
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!incoming || !animate || !previous || reducedMotion || !incoming.animate) return;

    const animation = incoming.animate([
      { opacity: 0, transform: "translateY(0.75rem) scale(0.992)", filter: "blur(3px)" },
      { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" },
    ], {
      duration: 280,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
    animation.finished.catch(() => {}).finally(() => {
      if (token === this.#transitionToken) animation.cancel();
    });
  }

  #onClick = (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab?.closest("gui-tabs") === this) this.select(tab.dataset.tab);
  };

  #onKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    if (event.target.closest("gui-tabs") !== this) return;
    const tabs = this.#tabs();
    const currentIndex = tabs.indexOf(event.target.closest("[data-tab]"));
    if (currentIndex < 0) return;
    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    this.select(tabs[nextIndex].dataset.tab, true);
  };
}

export class GuiSidebar extends GuiElement {
  static observedAttributes = ["open", "collapsed", "collapsible"];
  #mobileQuery;

  connectedCallback() {
    this.setAttribute("role", "navigation");
    const persistKey = this.getAttribute("persist-key");
    if (this.collapsible && persistKey) {
      const storedState = readStorage(`gui-sidebar:${persistKey}:collapsed`);
      if (storedState !== null) this.collapsed = storedState === "true";
    }
    this.#mobileQuery = window.matchMedia("(max-width: 52rem)");
    if (this.#mobileQuery.addEventListener) {
      this.#mobileQuery.addEventListener("change", this.#syncAccessibility);
    } else {
      this.#mobileQuery.addListener?.(this.#syncAccessibility);
    }
    window.addEventListener("gui:locale-changed", this.#syncAccessibility);
    this.#syncAccessibility();
  }

  disconnectedCallback() {
    if (this.#mobileQuery?.removeEventListener) {
      this.#mobileQuery.removeEventListener("change", this.#syncAccessibility);
    } else {
      this.#mobileQuery?.removeListener?.(this.#syncAccessibility);
    }
    window.removeEventListener("gui:locale-changed", this.#syncAccessibility);
  }

  attributeChangedCallback(name) {
    if (this.isConnected) {
      if (name === "collapsible" && !this.collapsible && this.collapsed) {
        this.removeAttribute("collapsed");
      }
      this.#syncAccessibility();
      if (name === "collapsed") {
        const persistKey = this.getAttribute("persist-key");
        if (persistKey) {
          writeStorage(`gui-sidebar:${persistKey}:collapsed`, String(this.collapsed));
        }
        emit(this, "gui:sidebar-collapse", { collapsed: this.collapsed });
      } else if (name === "open") {
        emit(this, "gui:sidebar-change", { open: this.open });
      }
    }
  }

  get open() {
    return this.hasAttribute("open");
  }

  set open(value) {
    this.toggleAttribute("open", Boolean(value));
  }

  toggle(force) {
    this.open = force ?? !this.open;
  }

  get collapsible() {
    return this.hasAttribute("collapsible");
  }

  set collapsible(value) {
    this.toggleAttribute("collapsible", Boolean(value));
  }

  get collapsed() {
    return this.hasAttribute("collapsed");
  }

  set collapsed(value) {
    this.toggleAttribute("collapsed", Boolean(value) && this.collapsible);
  }

  toggleCollapse(force) {
    if (!this.collapsible) return false;
    this.collapsed = force ?? !this.collapsed;
    return this.collapsed;
  }

  #syncAccessibility = () => {
    const hidden = Boolean(this.#mobileQuery?.matches && !this.open);
    this.setAttribute("aria-hidden", String(hidden));
    this.inert = hidden;
    this.closest(".gui-app")?.toggleAttribute("data-sidebar-collapsed", this.collapsed);
    document.querySelectorAll("[data-gui-sidebar-collapse]").forEach((button) => {
      if (button.dataset.guiSidebarCollapse !== this.id) return;
      button.setAttribute("aria-expanded", String(!this.collapsed));
      button.dataset.collapsed = String(this.collapsed);
      button.setAttribute(
        "aria-label",
        this.collapsed
          ? button.dataset.collapsedLabel ?? "Expand sidebar"
          : button.dataset.expandedLabel ?? "Collapse sidebar",
      );
    });
  };
}

export class GuiPages extends GuiElement {
  static observedAttributes = ["active"];
  #history = [];
  #transitionToken = 0;
  #nativeTransition = false;
  #nativeTransitionToken = 0;

  connectedCallback() {
    this.#prepare();
  }

  disconnectedCallback() {
    this.#transitionToken += 1;
    this.#pages().forEach((page) => {
      page.getAnimations?.().forEach((animation) => animation.cancel());
    });
  }

  attributeChangedCallback(name, previous, current) {
    if (name === "active" && this.isConnected) this.#show(current, previous);
  }

  get active() {
    return this.getAttribute("active");
  }

  set active(value) {
    if (value) this.setAttribute("active", value);
  }

  open(name, options = {}) {
    const exists = [...this.querySelectorAll(":scope > [data-page]")]
      .some((page) => page.dataset.page === name);
    if (!exists) return;
    const previous = this.active;
    if (previous === name) return;
    if (options.history !== false && previous) this.#history.push(previous);
    this.dataset.direction = options.direction ?? "forward";
    const requestToken = ++this.#nativeTransitionToken;
    const change = () => {
      if (requestToken === this.#nativeTransitionToken) this.active = name;
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (
      this.hasAttribute("view-transitions")
      && !reducedMotion
      && typeof document.startViewTransition === "function"
      && !document.activeViewTransition
    ) {
      this.#nativeTransition = true;
      const transition = document.startViewTransition(change);
      transition.finished
        .catch(() => {})
        .finally(() => { this.#nativeTransition = false; });
    } else change();
    emit(this, "gui:page-change", { active: name, previous });
  }

  back() {
    const name = this.#history.pop();
    if (name) this.open(name, { history: false, direction: "back" });
  }

  #prepare() {
    const pages = this.#pages();
    if (!this.active && pages[0]) this.setAttribute("active", pages[0].dataset.page);
    pages.forEach((page) => {
      page.setAttribute("role", "region");
      page.toggleAttribute("hidden", page.dataset.page !== this.active);
      page.inert = page.dataset.page !== this.active;
    });
  }

  #pages() {
    return [...this.querySelectorAll(":scope > [data-page]")];
  }

  async #show(current, previous) {
    const pages = this.#pages();
    const incoming = pages.find((page) => page.dataset.page === current);
    const outgoing = pages.find((page) => page.dataset.page === previous);
    if (!incoming) return;

    const token = ++this.#transitionToken;
    pages.forEach((page) => {
      page.getAnimations?.().forEach((animation) => animation.cancel());
      delete page.dataset.pageState;
      page.hidden = page !== incoming && page !== outgoing;
      page.inert = page !== incoming;
    });
    incoming.hidden = false;
    incoming.dataset.pageState = "incoming";
    if (outgoing) outgoing.dataset.pageState = "outgoing";

    if (this.#nativeTransition) {
      pages.forEach((page) => {
        page.hidden = page !== incoming;
        delete page.dataset.pageState;
      });
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!outgoing || reducedMotion || !incoming.animate) {
      pages.forEach((page) => {
        page.hidden = page !== incoming;
        delete page.dataset.pageState;
      });
      return;
    }

    const backwards = this.dataset.direction === "back";
    const offset = backwards ? -32 : 32;
    const timing = {
      duration: 380,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both",
    };
    const incomingAnimation = incoming.animate([
      { opacity: 0, transform: `translateX(${offset}px) scale(0.985)`, filter: "blur(4px)" },
      { opacity: 1, transform: "translateX(0) scale(1)", filter: "blur(0)" },
    ], timing);
    const outgoingAnimation = outgoing.animate([
      { opacity: 1, transform: "translateX(0) scale(1)", filter: "blur(0)" },
      { opacity: 0, transform: `translateX(${-offset * 0.65}px) scale(0.99)`, filter: "blur(3px)" },
    ], { ...timing, duration: 260 });

    await Promise.allSettled([incomingAnimation.finished, outgoingAnimation.finished]);
    if (token !== this.#transitionToken) return;
    pages.forEach((page) => {
      page.hidden = page !== incoming;
      delete page.dataset.pageState;
      page.getAnimations?.().forEach((animation) => animation.cancel());
    });
  }
}

function registerElement(name, constructor) {
  if (hasDOM && !customElements.get(name)) customElements.define(name, constructor);
}

export const i18n = new GuiI18n();
export const bridge = new GuiBridge();
export const toast = new GuiToastManager();

export function setTheme(theme) {
  if (!hasDOM) return;
  const value = ["light", "dark"].includes(theme) ? theme : "system";
  document.documentElement.dataset.theme = value;
  writeStorage("gui-theme", value);
  emit(window, "gui:theme-changed", { theme: value });
}

export function initializeGui(options = {}) {
  if (!hasDOM) {
    return {
      i18n,
      bridge,
      toast,
      logs,
      logger,
      modules: guiModules,
      mediaAdapters,
      commands,
      history,
      persistence,
      router,
      tasks,
      clipboard,
      capabilities,
      diagnostics,
      dragDrop,
      ready: guiModules.initializeAll({
        i18n, bridge, toast, logs, logger, mediaAdapters, commands, history,
        persistence, router, tasks, clipboard, dragDrop, capabilities, diagnostics,
      }),
    };
  }

  const storedTheme = readStorage("gui-theme");
  setTheme(options.theme ?? storedTheme ?? "system");
  if (options.fallbackLocale) i18n.fallbackLocale = options.fallbackLocale;
  if (options.locale) i18n.setLocale(options.locale);

  if (!guiInitialized) {
    guiInitialized = true;
    document.addEventListener("click", (event) => {
      const sidebarToggle = event.target.closest("[data-gui-sidebar-toggle]");
      if (sidebarToggle) {
        document.getElementById(sidebarToggle.dataset.guiSidebarToggle)?.toggle();
      }

      const sidebarClose = event.target.closest("[data-gui-sidebar-close]");
      if (sidebarClose) {
        sidebarClose.closest("gui-sidebar")?.toggle(false);
      }

      const sidebarCollapse = event.target.closest("[data-gui-sidebar-collapse]");
      if (sidebarCollapse) {
        document.getElementById(sidebarCollapse.dataset.guiSidebarCollapse)
          ?.toggleCollapse();
      }

      const pageOpen = event.target.closest("[data-gui-page-open]");
      if (pageOpen) {
        document.querySelector(pageOpen.dataset.guiPages ?? "gui-pages")
          ?.open(pageOpen.dataset.guiPageOpen);
      }

      const pageBack = event.target.closest("[data-gui-page-back]");
      if (pageBack) {
        document.querySelector(pageBack.dataset.guiPages ?? "gui-pages")?.back();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.querySelectorAll("gui-sidebar[open]").forEach((sidebar) => {
          sidebar.toggle(false);
        });
      }
    });
  }

  i18n.translate(document);
  return {
    i18n,
    bridge,
    toast,
    logs,
    logger,
    modules: guiModules,
    mediaAdapters,
    commands,
    history,
    persistence,
    router,
    tasks,
    clipboard,
    capabilities,
    diagnostics,
    dragDrop,
    ready: guiModules.initializeAll({
      i18n, bridge, toast, logs, logger, mediaAdapters, commands, history,
      persistence, router, tasks, clipboard, dragDrop, capabilities, diagnostics,
    }),
  };
}

registerElement("gui-tabs", GuiTabs);
registerElement("gui-sidebar", GuiSidebar);
registerElement("gui-pages", GuiPages);
registerElement("gui-live-chart", GuiLiveChart);
registerElement("gui-toast-stack", GuiToastStack);

[
  {
    id: "core",
    version: "0.1.0",
    description: "Initialization, themes, localization, and native host bridge.",
  },
  {
    id: "navigation",
    version: "0.1.0",
    description: "Tabs, responsive sidebars, and sliding page navigation.",
    dependencies: ["core"],
    components: ["gui-tabs", "gui-sidebar", "gui-pages"],
  },
  {
    id: "live-chart",
    version: "0.1.0",
    description: "Responsive canvas charts with bounded live data buffers.",
    dependencies: ["core"],
    components: ["gui-live-chart"],
  },
  {
    id: "toasts",
    version: "0.1.0",
    description: "Accessible queued toast notifications.",
    dependencies: ["core"],
    components: ["gui-toast-stack"],
  },
  nodeEditorModule,
  mediaPlayerModule,
  statusbarModule,
  wizardModule,
  loggingModule,
  commandsModule,
  overlaysModule,
  runtimeModule,
  formsModule,
  dataViewsModule,
  workspaceModule,
  devtoolsModule,
].forEach((module) => {
  if (!guiModules.has(module.id)) defineGuiModule(module);
});

if (hasDOM) {
  window.GuiTemplate = {
    bridge,
    i18n,
    modules: guiModules,
    mediaAdapters,
    logs,
    logger,
    toast,
    commands,
    history,
    persistence,
    router,
    tasks,
    clipboard,
    capabilities,
    diagnostics,
    dragDrop,
    overlayController,
    initialize: initializeGui,
    setTheme,
  };
}
