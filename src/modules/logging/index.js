/**
 * Structured, runtime-neutral logging for GuiKit applications and modules.
 * Records are plain JSON values so the same schema can cross a webview bridge.
 */

const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};
const REDACTED = "[REDACTED]";
const DEFAULT_REDACT_PATTERN =
  /(?:pass(?:word)?|secret|token|authorization|cookie|api[-_]?key|session[-_]?id|private[-_]?key)/i;

export const GUI_LOG_SCHEMA = "guikit.log/v1";
export const GUI_LOG_LEVELS = Object.freeze({
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
});

function levelName(value, fallback = "info") {
  const normalized = String(value ?? fallback).toLowerCase();
  if (!(normalized in GUI_LOG_LEVELS)) {
    throw new TypeError(`Unknown log level "${value}".`);
  }
  return normalized;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function truncate(value, limit) {
  return value.length > limit
    ? `${value.slice(0, Math.max(0, limit - 1))}…`
    : value;
}

function isRedactedKey(key, options) {
  if (options.redactKeys?.some((entry) => {
    if (typeof entry === "string") return entry.toLowerCase() === key.toLowerCase();
    entry.lastIndex = 0;
    return entry.test(key);
  })) {
    return true;
  }
  return DEFAULT_REDACT_PATTERN.test(key);
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const item of Object.values(value)) deepFreeze(item, seen);
  return Object.freeze(value);
}

function toSafeValue(value, options, seen = new WeakSet(), depth = 0, key = "") {
  if (key && isRedactedKey(key, options)) return REDACTED;
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return truncate(value, options.maxStringLength);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol") return value.description ? `[Symbol ${value.description}]` : "[Symbol]";
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (depth >= options.maxDepth) return "[Max depth]";
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? "Invalid Date" : value.toISOString();
  if (typeof URL !== "undefined" && value instanceof URL) return value.toString();
  if (typeof Element !== "undefined" && value instanceof Element) {
    return `<${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ""}>`;
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (value instanceof Error) {
    const result = {
      name: value.name,
      message: truncate(value.message, options.maxStringLength),
    };
    if (value.stack) result.stack = truncate(value.stack, options.maxStringLength * 4);
    if (value.cause !== undefined) {
      result.cause = toSafeValue(value.cause, options, seen, depth + 1, "cause");
    }
    for (const property of Object.keys(value).slice(0, options.maxObjectKeys)) {
      result[property] = toSafeValue(value[property], options, seen, depth + 1, property);
    }
    return result;
  }

  if (Array.isArray(value)) {
    const result = value.slice(0, options.maxArrayLength)
      .map((item) => toSafeValue(item, options, seen, depth + 1));
    if (value.length > options.maxArrayLength) {
      result.push(`[${value.length - options.maxArrayLength} more items]`);
    }
    return result;
  }

  const result = {};
  const entries = Object.entries(value);
  for (const [property, item] of entries.slice(0, options.maxObjectKeys)) {
    result[property] = toSafeValue(item, options, seen, depth + 1, property);
  }
  if (entries.length > options.maxObjectKeys) {
    result.__truncatedKeys = entries.length - options.maxObjectKeys;
  }
  return result;
}

function elapsed(start) {
  const now = globalThis.performance?.now?.() ?? Date.now();
  return Math.max(0, now - start);
}

export class GuiLogManager {
  #sequence = 0;
  #sinks = new Set();
  #subscribers = new Set();

  constructor(options = {}) {
    this.level = levelName(options.level, "trace");
    this.context = options.context ?? {};
    this.onSinkError = options.onSinkError ?? (() => {});
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? createId;
    this.serialization = {
      redactKeys: options.redactKeys ?? [],
      maxDepth: options.maxDepth ?? 8,
      maxStringLength: options.maxStringLength ?? 4_000,
      maxArrayLength: options.maxArrayLength ?? 100,
      maxObjectKeys: options.maxObjectKeys ?? 100,
    };
  }

  #reportError(error, target) {
    try {
      this.onSinkError(error, target);
    } catch {
      // Diagnostics must never become a new application failure.
    }
  }

  createLogger(name = "app", context = {}) {
    return new GuiLogger(this, name, context);
  }

  setLevel(level) {
    this.level = levelName(level);
    return this;
  }

  shouldLog(level) {
    return GUI_LOG_LEVELS[levelName(level)] >= GUI_LOG_LEVELS[this.level];
  }

  addSink(sink) {
    if (!sink || typeof sink.write !== "function") {
      throw new TypeError("A log sink must implement write(record).");
    }
    levelName(sink.minLevel, "trace");
    this.#sinks.add(sink);
    sink.setErrorHandler?.((error) => this.#reportError(error, sink));
    return () => this.removeSink(sink);
  }

  removeSink(sink) {
    return this.#sinks.delete(sink);
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("A subscriber must be a function.");
    this.#subscribers.add(listener);
    return () => this.#subscribers.delete(listener);
  }

  write(input) {
    const level = levelName(input.level);
    if (!this.shouldLog(level)) return null;
    const timestamp = this.clock();
    const record = deepFreeze({
      schema: GUI_LOG_SCHEMA,
      timestamp: timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString(),
      sequence: ++this.#sequence,
      level,
      levelValue: GUI_LOG_LEVELS[level],
      logger: String(input.logger || "app"),
      message: truncate(String(input.message ?? ""), this.serialization.maxStringLength),
      context: toSafeValue({ ...this.context, ...input.context }, this.serialization),
      ...(input.data === undefined ? {} : {
        data: toSafeValue(input.data, this.serialization),
      }),
      ...(input.error === undefined ? {} : {
        error: toSafeValue(input.error, this.serialization),
      }),
      ...(input.trace ? { trace: toSafeValue(input.trace, this.serialization) } : {}),
    });

    for (const listener of this.#subscribers) {
      try {
        listener(record);
      } catch (error) {
        this.#reportError(error, listener);
      }
    }
    for (const sink of this.#sinks) {
      try {
        if (GUI_LOG_LEVELS[level] < GUI_LOG_LEVELS[levelName(sink.minLevel, "trace")]) continue;
        Promise.resolve(sink.write(record)).catch((error) => this.#reportError(error, sink));
      } catch (error) {
        this.#reportError(error, sink);
      }
    }
    return record;
  }

  async flush() {
    await Promise.allSettled([...this.#sinks].map(async (sink) => {
      try {
        await sink.flush?.();
      } catch (error) {
        this.#reportError(error, sink);
      }
    }));
  }

  async dispose() {
    await this.flush();
    await Promise.allSettled([...this.#sinks].map((sink) => sink.dispose?.()));
    this.#sinks.clear();
    this.#subscribers.clear();
  }
}

export class GuiLogger {
  constructor(manager, name, context = {}, trace = null) {
    this.manager = manager;
    this.name = String(name || "app");
    this.context = context;
    this.trace = trace;
  }

  child(nameOrContext, context = {}) {
    if (typeof nameOrContext === "string") {
      return new GuiLogger(
        this.manager,
        `${this.name}.${nameOrContext}`,
        { ...this.context, ...context },
        this.trace,
      );
    }
    return new GuiLogger(this.manager, this.name, { ...this.context, ...nameOrContext }, this.trace);
  }

  withContext(context) {
    return this.child(context);
  }

  log(level, message, data, error) {
    if (data instanceof Error && error === undefined) {
      error = data;
      data = undefined;
    }
    return this.manager.write({
      level,
      logger: this.name,
      message,
      context: this.context,
      trace: this.trace,
      data,
      error,
    });
  }

  trace(message, data) { return this.log("trace", message, data); }
  debug(message, data) { return this.log("debug", message, data); }
  info(message, data) { return this.log("info", message, data); }
  warn(message, data) { return this.log("warn", message, data); }
  error(message, error, data) { return this.log("error", message, data, error); }
  fatal(message, error, data) { return this.log("fatal", message, data, error); }

  capture(error, message = error?.message || "Unhandled error", data) {
    return this.error(message, error, data);
  }

  startSpan(name, data) {
    return new GuiLogSpan(this, name, data);
  }

  time(label, data) {
    const start = globalThis.performance?.now?.() ?? Date.now();
    let ended = false;
    return {
      end: (result) => {
        if (ended) return null;
        ended = true;
        return this.info(label, { ...data, ...result, durationMs: elapsed(start) });
      },
    };
  }
}

export class GuiLogSpan {
  constructor(parent, name, data) {
    this.name = String(name);
    this.parent = parent;
    this.startedAt = globalThis.performance?.now?.() ?? Date.now();
    this.ended = false;
    const parentTrace = parent.trace ?? {};
    this.trace = {
      traceId: parentTrace.traceId ?? parent.manager.idFactory(),
      spanId: parent.manager.idFactory(),
      ...(parentTrace.spanId ? { parentSpanId: parentTrace.spanId } : {}),
    };
    this.logger = new GuiLogger(parent.manager, parent.name, parent.context, this.trace);
    this.logger.debug(`${this.name} started`, data);
  }

  end(data, status = "ok") {
    if (this.ended) return null;
    this.ended = true;
    return this.logger.info(`${this.name} completed`, {
      ...data,
      status,
      durationMs: elapsed(this.startedAt),
    });
  }

  fail(error, data) {
    if (this.ended) return null;
    this.ended = true;
    return this.logger.error(`${this.name} failed`, error, {
      ...data,
      status: "error",
      durationMs: elapsed(this.startedAt),
    });
  }

  startSpan(name, data) {
    return this.logger.startSpan(name, data);
  }
}

export class GuiConsoleSink {
  constructor(options = {}) {
    this.minLevel = levelName(options.minLevel, "info");
    this.console = options.console ?? globalThis.console;
    this.structured = options.structured ?? false;
  }

  write(record) {
    if (!this.console) return;
    const method = record.level === "trace" ? "debug"
      : record.level === "fatal" ? "error"
        : record.level;
    const output = this.console[method] ?? this.console.log;
    if (this.structured) {
      output.call(this.console, record);
      return;
    }
    const details = { ...record };
    delete details.schema;
    delete details.timestamp;
    delete details.level;
    delete details.levelValue;
    delete details.logger;
    delete details.message;
    output.call(
      this.console,
      `${record.timestamp} ${record.level.toUpperCase()} [${record.logger}] ${record.message}`,
      details,
    );
  }
}

export class GuiMemorySink {
  constructor(options = {}) {
    this.minLevel = levelName(options.minLevel, "trace");
    this.limit = Math.max(1, options.limit ?? 1_000);
    this.records = [];
  }

  write(record) {
    this.records.push(record);
    if (this.records.length > this.limit) {
      this.records.splice(0, this.records.length - this.limit);
    }
  }

  clear() {
    this.records.length = 0;
  }

  query(options = {}) {
    const threshold = GUI_LOG_LEVELS[levelName(options.minLevel, "trace")];
    const search = String(options.search ?? "").toLowerCase();
    const since = options.since ? new Date(options.since).valueOf() : Number.NEGATIVE_INFINITY;
    const result = this.records.filter((record) =>
      record.levelValue >= threshold
      && new Date(record.timestamp).valueOf() >= since
      && (!options.logger || record.logger.startsWith(options.logger))
      && (!search || JSON.stringify(record).toLowerCase().includes(search)));
    return options.limit ? result.slice(-options.limit) : result;
  }

  toJSONLines(records = this.records) {
    return records.map((record) => JSON.stringify(record)).join("\n");
  }
}

export class GuiBatchSink {
  #queue = [];
  #timer = null;
  #flushing = null;
  #disposed = false;
  #errorHandler = null;

  constructor(sink, options = {}) {
    if (!sink || typeof sink.write !== "function") {
      throw new TypeError("GuiBatchSink requires a destination sink.");
    }
    this.sink = sink;
    this.minLevel = levelName(options.minLevel ?? sink.minLevel, "trace");
    this.batchSize = Math.max(1, options.batchSize ?? 50);
    this.maxQueue = Math.max(this.batchSize, options.maxQueue ?? 5_000);
    this.interval = Math.max(0, options.interval ?? 1_000);
    this.dropped = 0;
  }

  setErrorHandler(handler) {
    this.#errorHandler = handler;
  }

  write(record) {
    if (this.#disposed) return;
    if (this.#queue.length >= this.maxQueue) {
      this.#queue.shift();
      this.dropped += 1;
    }
    this.#queue.push(record);
    if (this.#queue.length >= this.batchSize) return this.flush();
    else this.#schedule();
  }

  #schedule() {
    if (this.#timer || this.interval === 0 || this.#disposed) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.flush().catch((error) => this.#errorHandler?.(error));
    }, this.interval);
  }

  async flush() {
    if (this.#flushing) {
      await this.#flushing;
      if (this.#queue.length) return this.flush();
      return;
    }
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    const batch = this.#queue.splice(0, this.batchSize);
    if (!batch.length) return this.sink.flush?.();
    const droppedBefore = this.dropped;
    this.dropped = 0;
    const records = droppedBefore
      ? batch.map((record, index) => index === 0
        ? { ...record, transport: { droppedBefore } }
        : record)
      : batch;
    this.#flushing = Promise.resolve(
      this.sink.writeBatch
        ? this.sink.writeBatch(records)
        : Promise.all(records.map((record) => this.sink.write(record))),
    );
    try {
      await this.#flushing;
    } finally {
      this.#flushing = null;
    }
    if (this.#queue.length) return this.flush();
    return this.sink.flush?.();
  }

  async dispose() {
    this.#disposed = true;
    await this.flush();
    await this.sink.dispose?.();
  }
}

export class GuiBridgeLogSink {
  constructor(bridge, options = {}) {
    if (!bridge?.invoke) throw new TypeError("GuiBridgeLogSink requires a GuiBridge.");
    this.bridge = bridge;
    this.method = options.method ?? "logging.write";
    this.timeout = options.timeout ?? 5_000;
    this.minLevel = levelName(options.minLevel, "trace");
  }

  write(record) {
    return this.writeBatch([record]);
  }

  writeBatch(records) {
    return this.bridge.invoke(this.method, { records }, { timeout: this.timeout });
  }
}

export class GuiHttpLogSink {
  constructor(endpoint, options = {}) {
    if (!endpoint) throw new TypeError("GuiHttpLogSink requires an endpoint.");
    this.endpoint = endpoint;
    this.fetch = options.fetch ?? globalThis.fetch;
    if (!this.fetch) throw new TypeError("No fetch implementation is available.");
    this.headers = options.headers ?? {};
    this.minLevel = levelName(options.minLevel, "trace");
    this.keepalive = options.keepalive ?? true;
  }

  write(record) {
    return this.writeBatch([record]);
  }

  async writeBatch(records) {
    const response = await this.fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers },
      body: JSON.stringify({ records }),
      keepalive: this.keepalive,
    });
    if (!response.ok) throw new Error(`Log endpoint returned HTTP ${response.status}.`);
  }
}

export const logs = new GuiLogManager();
export const logger = logs.createLogger("app");
logs.addSink(new GuiConsoleSink({ minLevel: "info" }));

export class GuiLogViewer extends GuiElement {
  #manager = null;
  #unsubscribe = null;
  #records = [];
  #renderPending = false;
  #wired = false;

  constructor() {
    super();
    this.labels = {
      minimumLevel: "Minimum log level",
      filter: "Filter logs",
      pause: "Pause",
      resume: "Resume",
      clear: "Clear",
      export: "Export JSONL",
      empty: "No matching log records.",
      count: "{shown} shown · {buffered} buffered",
    };
    if (!hasDOM) return;
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;min-height:18rem;color:var(--gui-text,#eef1f8);
          background:var(--gui-surface,#171b25);border:1px solid var(--gui-border,#303747);
          border-radius:var(--gui-radius-md,.8rem);overflow:hidden}
        *{box-sizing:border-box}.toolbar{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;
          padding:.65rem;border-bottom:1px solid var(--gui-border,#303747);
          background:color-mix(in srgb,var(--gui-surface,#171b25) 88%,var(--gui-accent,#6c8cff))}
        select,input,button{font:inherit;color:inherit;background:var(--gui-surface-raised,#212735);
          border:1px solid var(--gui-border,#303747);border-radius:.45rem;padding:.42rem .58rem}
        input{flex:1;min-width:10rem}button{cursor:pointer}button:hover{border-color:var(--gui-accent,#6c8cff)}
        .count{margin-left:auto;color:var(--gui-text-muted,#9ba5b7);font-size:.8rem}
        .list{height:24rem;overflow:auto;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}
        .empty{padding:2.5rem;text-align:center;color:var(--gui-text-muted,#9ba5b7)}
        details{border-bottom:1px solid color-mix(in srgb,var(--gui-border,#303747) 55%,transparent)}
        summary{display:grid;grid-template-columns:6.5rem 3.8rem minmax(6rem,10rem) 1fr;
          gap:.6rem;padding:.44rem .7rem;cursor:pointer;list-style:none;align-items:baseline}
        summary:hover{background:color-mix(in srgb,var(--gui-accent,#6c8cff) 8%,transparent)}
        time,.name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gui-text-muted,#9ba5b7)}
        .level{font-weight:800}.trace,.debug{color:#9ba5b7}.info{color:#64a7ff}
        .warn{color:#f5bd4f}.error,.fatal{color:#ff6b7a}.message{overflow-wrap:anywhere}
        pre{margin:0;padding:.7rem 1rem 1rem 2rem;overflow:auto;color:var(--gui-text-muted,#9ba5b7)}
        @media(max-width:38rem){summary{grid-template-columns:4.6rem 3.5rem 1fr}.name{display:none}.count{margin-left:0}}
      </style>
      <div class="toolbar">
        <select aria-label="Minimum log level">
          <option value="trace">Trace+</option><option value="debug">Debug+</option>
          <option value="info" selected>Info+</option><option value="warn">Warn+</option>
          <option value="error">Error+</option>
        </select>
        <input type="search" aria-label="Search logs" placeholder="Filter logs">
        <button type="button" data-action="pause">Pause</button>
        <button type="button" data-action="clear">Clear</button>
        <button type="button" data-action="export">Export JSONL</button>
        <span class="count" aria-live="polite"></span>
      </div>
      <div class="list" role="log" aria-live="off"></div>`;
  }

  connectedCallback() {
    if (!hasDOM) return;
    this.limit = Math.max(1, Number(this.getAttribute("limit")) || 500);
    this.paused = false;
    if (!this.#wired) {
      this.#wired = true;
      this.shadowRoot.querySelector("select").addEventListener("change", () => this.#render());
      this.shadowRoot.querySelector("input").addEventListener("input", () => this.#render());
      this.shadowRoot.querySelector('[data-action="pause"]').addEventListener("click", (event) => {
        this.paused = !this.paused;
        event.currentTarget.textContent = this.paused ? this.labels.resume : this.labels.pause;
      });
      this.shadowRoot.querySelector('[data-action="clear"]').addEventListener("click", () => {
        this.#records.length = 0;
        this.#render();
      });
      this.shadowRoot.querySelector('[data-action="export"]').addEventListener("click", () => this.export());
    }
    this.connect(this.#manager ?? logs);
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  connect(manager) {
    this.#unsubscribe?.();
    this.#manager = manager;
    this.#unsubscribe = manager?.subscribe((record) => {
      if (this.paused) return;
      this.#records.push(record);
      if (this.#records.length > this.limit) {
        this.#records.splice(0, this.#records.length - this.limit);
      }
      this.#scheduleRender();
    }) ?? null;
    return this;
  }

  setLabels(labels = {}) {
    Object.assign(this.labels, labels);
    if (!hasDOM || !this.shadowRoot) return this;
    this.shadowRoot.querySelector("select").ariaLabel = this.labels.minimumLevel;
    this.shadowRoot.querySelector("input").ariaLabel = this.labels.filter;
    this.shadowRoot.querySelector("input").placeholder = this.labels.filter;
    this.shadowRoot.querySelector('[data-action="pause"]').textContent =
      this.paused ? this.labels.resume : this.labels.pause;
    this.shadowRoot.querySelector('[data-action="clear"]').textContent = this.labels.clear;
    this.shadowRoot.querySelector('[data-action="export"]').textContent = this.labels.export;
    this.#render();
    return this;
  }

  append(record) {
    this.#records.push(record);
    if (this.#records.length > this.limit) this.#records.shift();
    this.#scheduleRender();
  }

  clear() {
    this.#records.length = 0;
    this.#render();
  }

  export() {
    if (!hasDOM) return "";
    const output = this.#filtered().map((record) => JSON.stringify(record)).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([output], { type: "application/x-ndjson" }));
    link.download = `guikit-logs-${new Date().toISOString().replaceAll(":", "-")}.jsonl`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    return output;
  }

  #filtered() {
    const minimum = GUI_LOG_LEVELS[this.shadowRoot.querySelector("select").value];
    const search = this.shadowRoot.querySelector("input").value.trim().toLowerCase();
    return this.#records.filter((record) =>
      record.levelValue >= minimum
      && (!search || JSON.stringify(record).toLowerCase().includes(search)));
  }

  #scheduleRender() {
    if (this.#renderPending) return;
    this.#renderPending = true;
    (globalThis.requestAnimationFrame ?? queueMicrotask)(() => {
      this.#renderPending = false;
      this.#render();
    });
  }

  #render() {
    const list = this.shadowRoot.querySelector(".list");
    const records = this.#filtered();
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    list.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = this.labels.empty;
      list.append(empty);
    } else {
      const fragment = document.createDocumentFragment();
      for (const record of records) {
        const row = document.createElement("details");
        const summary = document.createElement("summary");
        const time = document.createElement("time");
        time.dateTime = record.timestamp;
        time.textContent = new Date(record.timestamp).toLocaleTimeString();
        const level = document.createElement("span");
        level.className = `level ${record.level}`;
        level.textContent = record.level.toUpperCase();
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = record.logger;
        const message = document.createElement("span");
        message.className = "message";
        message.textContent = record.message;
        const details = document.createElement("pre");
        details.textContent = JSON.stringify({
          context: record.context,
          data: record.data,
          error: record.error,
          trace: record.trace,
        }, null, 2);
        summary.append(time, level, name, message);
        row.append(summary, details);
        fragment.append(row);
      }
      list.append(fragment);
    }
    this.shadowRoot.querySelector(".count").textContent = this.labels.count
      .replace("{shown}", records.length)
      .replace("{buffered}", this.#records.length);
    if (atBottom) list.scrollTop = list.scrollHeight;
  }
}

if (hasDOM && !customElements.get("gui-log-viewer")) {
  customElements.define("gui-log-viewer", GuiLogViewer);
}

export const loggingModule = Object.freeze({
  id: "logging",
  version: "0.1.0",
  description: "Structured frontend and backend logging with safe transports and a live viewer.",
  dependencies: ["core"],
  components: ["gui-log-viewer"],
  setup(context) {
    if (hasDOM && context.i18n?.t) {
      const updateLabels = () => {
        const t = (name) => context.i18n.t(`logging.viewer.${name}`);
        document.querySelectorAll("gui-log-viewer").forEach((viewer) => viewer.setLabels({
          minimumLevel: t("minimumLevel"),
          filter: t("filter"),
          pause: t("pause"),
          resume: t("resume"),
          clear: t("clear"),
          export: t("export"),
          empty: t("empty"),
          count: t("count"),
        }));
      };
      updateLabels();
      window.addEventListener("gui:locale-changed", updateLabels);
    }
    return {
      logs: context.logs ?? logs,
      logger: context.logger ?? logger,
    };
  },
});
