const GuiElement = globalThis.HTMLElement ?? class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function dispatch(target, type, detail, cancelable = false) {
  if (typeof CustomEvent === "undefined") return true;
  return target.dispatchEvent(new CustomEvent(type, {
    bubbles: target instanceof (globalThis.HTMLElement ?? class {}),
    cancelable,
    composed: true,
    detail,
  }));
}

export class GuiMemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? new GuiMemoryStorage();
  } catch {
    return new GuiMemoryStorage();
  }
}

export class GuiPersistenceStore extends GuiEventTarget {
  #storage;
  #namespace;
  #version;
  #migrations = new Map();

  constructor(options = {}) {
    super();
    this.#storage = options.storage ?? defaultStorage();
    this.#namespace = options.namespace ?? "guikit";
    this.#version = Math.max(1, Number(options.version) || 1);
    for (const [version, migration] of Object.entries(options.migrations ?? {})) {
      this.addMigration(Number(version), migration);
    }
  }

  addMigration(targetVersion, migration) {
    if (!Number.isInteger(targetVersion) || targetVersion < 2) {
      throw new TypeError("A migration target version must be an integer greater than one.");
    }
    if (typeof migration !== "function") throw new TypeError("A migration must be a function.");
    this.#migrations.set(targetVersion, migration);
    return this;
  }

  save(key, value, options = {}) {
    const envelope = {
      schema: options.schema ?? key,
      version: options.version ?? this.#version,
      savedAt: new Date().toISOString(),
      value: clone(value),
    };
    this.#storage.setItem(this.#key(key), JSON.stringify(envelope));
    dispatch(this, "gui:persistence-change", { operation: "save", key, envelope: clone(envelope) });
    return envelope;
  }

  load(key, fallback = undefined) {
    const raw = this.#storage.getItem(this.#key(key));
    if (raw == null) return clone(fallback);
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      dispatch(this, "gui:persistence-error", { key, reason: "invalid-json" });
      return clone(fallback);
    }
    if (!envelope || typeof envelope !== "object" || !("value" in envelope)) {
      return clone(fallback);
    }
    while (envelope.version < this.#version) {
      const nextVersion = envelope.version + 1;
      const migration = this.#migrations.get(nextVersion);
      if (!migration) {
        dispatch(this, "gui:persistence-error", {
          key,
          reason: "missing-migration",
          from: envelope.version,
          to: nextVersion,
        });
        return clone(fallback);
      }
      envelope.value = migration(clone(envelope.value), {
        key,
        from: envelope.version,
        to: nextVersion,
      });
      envelope.version = nextVersion;
    }
    if (envelope.version > this.#version) {
      dispatch(this, "gui:persistence-error", {
        key,
        reason: "newer-version",
        stored: envelope.version,
        supported: this.#version,
      });
      return clone(fallback);
    }
    return clone(envelope.value);
  }

  remove(key) {
    this.#storage.removeItem(this.#key(key));
    dispatch(this, "gui:persistence-change", { operation: "remove", key });
  }

  #key(key) {
    if (!/^[a-z0-9._:-]+$/i.test(String(key))) throw new TypeError("Invalid persistence key.");
    return `${this.#namespace}:${key}`;
  }
}

function compileRoute(path) {
  const names = [];
  const escaped = path
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        names.push(part.slice(1));
        return "([^/]+)";
      }
      if (part === "*") {
        names.push("wildcard");
        return "(.*)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { pattern: new RegExp(`^${escaped}/?$`), names };
}

export class GuiRouter extends GuiEventTarget {
  #routes = [];
  #guards = [];
  #current = null;
  #mode;
  #listening = false;
  #listener = () => void this.sync();

  constructor(options = {}) {
    super();
    this.#mode = options.mode === "history" ? "history" : "hash";
    for (const route of options.routes ?? []) this.add(route);
  }

  get current() { return clone(this.#current); }

  add(route) {
    if (!route?.path || !route.id) throw new TypeError("A route requires id and path.");
    const compiled = compileRoute(route.path);
    this.#routes.push({ ...route, ...compiled });
    return () => {
      this.#routes = this.#routes.filter((candidate) => candidate !== route);
    };
  }

  guard(callback) {
    if (typeof callback !== "function") throw new TypeError("A route guard must be a function.");
    this.#guards.push(callback);
    return () => { this.#guards = this.#guards.filter((item) => item !== callback); };
  }

  resolve(url) {
    const parsed = new URL(url, globalThis.location?.href ?? "http://localhost/");
    const path = this.#mode === "hash"
      ? (parsed.hash.slice(1) || "/").split("?")[0]
      : parsed.pathname;
    for (const route of this.#routes) {
      const match = route.pattern.exec(path);
      if (!match) continue;
      return {
        id: route.id,
        path,
        title: route.title ?? route.id,
        params: Object.fromEntries(route.names.map((name, index) => [
          name,
          decodeURIComponent(match[index + 1]),
        ])),
        query: Object.fromEntries(new URLSearchParams(
          this.#mode === "hash" ? parsed.hash.split("?")[1] ?? "" : parsed.search,
        )),
        data: clone(route.data ?? {}),
      };
    }
    return null;
  }

  async navigate(path, options = {}) {
    const base = globalThis.location?.href ?? "http://localhost/";
    const targetUrl = this.#mode === "hash"
      ? new URL(`#${path}`, base)
      : new URL(path, base);
    const next = this.resolve(targetUrl.href);
    if (!next) throw new Error(`No route matches "${path}".`);
    const detail = { from: this.current, to: clone(next), replace: Boolean(options.replace) };
    if (!dispatch(this, "gui:navigation-request", detail, true)) return false;
    for (const guard of this.#guards) {
      if (await guard(detail) === false) {
        dispatch(this, "gui:navigation-cancel", detail);
        return false;
      }
    }
    if (globalThis.history && !options.memoryOnly) {
      const method = options.replace ? "replaceState" : "pushState";
      if (this.#mode === "hash") {
        history[method]({}, "", `#${path}`);
      } else {
        history[method]({}, "", path);
      }
    }
    this.#current = next;
    if (globalThis.document && next.title) document.title = next.title;
    dispatch(this, "gui:navigation", detail);
    return true;
  }

  async sync() {
    const next = this.resolve(globalThis.location?.href ?? "/");
    if (!next) return false;
    const from = this.current;
    this.#current = next;
    dispatch(this, "gui:navigation", { from, to: clone(next), pop: true });
    return true;
  }

  start() {
    if (this.#listening || !globalThis.addEventListener) return;
    this.#listening = true;
    globalThis.addEventListener(this.#mode === "hash" ? "hashchange" : "popstate", this.#listener);
    void this.sync();
  }

  stop() {
    if (!this.#listening) return;
    globalThis.removeEventListener(this.#mode === "hash" ? "hashchange" : "popstate", this.#listener);
    this.#listening = false;
  }
}

function taskSnapshot(task) {
  return {
    id: task.id,
    label: task.label,
    detail: task.detail,
    status: task.status,
    progress: task.progress,
    cancellable: task.cancellable,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    error: task.error ? {
      name: task.error.name,
      message: task.error.message,
    } : null,
  };
}

export class GuiTaskManager extends GuiEventTarget {
  #tasks = new Map();
  #historyLimit;

  constructor(options = {}) {
    super();
    this.#historyLimit = Math.max(0, Number(options.historyLimit) || 50);
  }

  list(options = {}) {
    return [...this.#tasks.values()]
      .filter((task) => !options.status || task.status === options.status)
      .map(taskSnapshot);
  }

  get(id) {
    const task = this.#tasks.get(id);
    return task ? taskSnapshot(task) : undefined;
  }

  run(definition, runner) {
    if (!definition?.id || !definition?.label) throw new TypeError("A task requires id and label.");
    if (this.#tasks.get(definition.id)?.status === "running") {
      throw new Error(`Task "${definition.id}" is already running.`);
    }
    const controller = new AbortController();
    const task = {
      id: definition.id,
      label: definition.label,
      detail: definition.detail ?? "",
      status: "queued",
      progress: null,
      cancellable: definition.cancellable !== false,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      error: null,
      controller,
      promise: null,
      definition: clone(definition),
      runner,
    };
    this.#tasks.set(task.id, task);
    this.#changed("queue", task);
    const report = (progress, detail = task.detail) => {
      task.progress = progress == null ? null : Math.max(0, Math.min(1, Number(progress)));
      task.detail = detail;
      this.#changed("progress", task);
    };
    task.promise = Promise.resolve().then(async () => {
      task.status = "running";
      task.startedAt = new Date().toISOString();
      this.#changed("start", task);
      try {
        const value = await runner({ signal: controller.signal, report, task: taskSnapshot(task) });
        task.status = controller.signal.aborted ? "canceled" : "completed";
        task.progress = task.status === "completed" ? 1 : task.progress;
        return value;
      } catch (error) {
        task.status = controller.signal.aborted ? "canceled" : "failed";
        task.error = error instanceof Error ? error : new Error(String(error));
        if (task.status === "failed") throw error;
        return undefined;
      } finally {
        task.finishedAt = new Date().toISOString();
        this.#changed("finish", task);
        this.#prune();
      }
    });
    return {
      id: task.id,
      promise: task.promise,
      cancel: () => this.cancel(task.id),
      report,
    };
  }

  cancel(id) {
    const task = this.#tasks.get(id);
    if (!task || !task.cancellable || !["queued", "running"].includes(task.status)) return false;
    task.controller.abort();
    task.status = "canceled";
    this.#changed("cancel", task);
    return true;
  }

  dismiss(id) {
    const task = this.#tasks.get(id);
    if (!task || ["queued", "running"].includes(task.status)) return false;
    this.#tasks.delete(id);
    this.#changed("dismiss", task);
    return true;
  }

  retry(id) {
    const task = this.#tasks.get(id);
    if (!task || !["failed", "canceled"].includes(task.status)) return null;
    const definition = clone(task.definition);
    const runner = task.runner;
    this.#tasks.delete(id);
    return this.run(definition, runner);
  }

  #changed(operation, task) {
    dispatch(this, "gui:tasks-change", { operation, task: taskSnapshot(task) });
  }

  #prune() {
    const finished = [...this.#tasks.values()]
      .filter((task) => !["queued", "running"].includes(task.status))
      .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
    while (finished.length > this.#historyLimit) {
      const task = finished.shift();
      this.#tasks.delete(task.id);
    }
  }
}

export class GuiClipboard extends GuiEventTarget {
  #types = new Map();
  #memory = new Map();

  registerType(type, options = {}) {
    if (!/^[a-z][a-z0-9.+/-]+$/i.test(type)) throw new TypeError("Invalid clipboard type.");
    this.#types.set(type, {
      serialize: options.serialize ?? ((value) => JSON.stringify(value)),
      deserialize: options.deserialize ?? JSON.parse,
      validate: options.validate ?? (() => true),
    });
    return () => this.#types.delete(type);
  }

  async write(type, value, options = {}) {
    const adapter = this.#types.get(type);
    if (!adapter) throw new Error(`Unknown clipboard type "${type}".`);
    if (!adapter.validate(value)) throw new TypeError(`Invalid "${type}" clipboard payload.`);
    const serialized = adapter.serialize(value);
    this.#memory.set(type, serialized);
    if (options.system !== false && globalThis.navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(JSON.stringify({ schema: "guikit.clipboard/v1", type, value: serialized }));
    }
    dispatch(this, "gui:clipboard-write", { type });
  }

  async read(type, options = {}) {
    const adapter = this.#types.get(type);
    if (!adapter) throw new Error(`Unknown clipboard type "${type}".`);
    let serialized = this.#memory.get(type);
    if (options.system !== false && globalThis.navigator?.clipboard?.readText) {
      try {
        const envelope = JSON.parse(await navigator.clipboard.readText());
        if (envelope?.schema === "guikit.clipboard/v1" && envelope.type === type) {
          serialized = envelope.value;
        }
      } catch {
        // The in-memory payload remains available when system clipboard access
        // is denied or contains unrelated content.
      }
    }
    if (serialized === undefined) return undefined;
    const value = adapter.deserialize(serialized);
    if (!adapter.validate(value)) throw new TypeError(`Invalid "${type}" clipboard payload.`);
    dispatch(this, "gui:clipboard-read", { type });
    return clone(value);
  }
}

export class GuiDragDrop extends GuiEventTarget {
  #types = new Map();

  registerType(type, options = {}) {
    if (!/^[a-z][a-z0-9.+/-]+$/i.test(type)) throw new TypeError("Invalid drag payload type.");
    this.#types.set(type, {
      serialize: options.serialize ?? ((value) => JSON.stringify(value)),
      deserialize: options.deserialize ?? JSON.parse,
      validate: options.validate ?? (() => true),
    });
    return () => this.#types.delete(type);
  }

  write(dataTransfer, type, value) {
    const adapter = this.#types.get(type);
    if (!adapter) throw new Error(`Unknown drag payload type "${type}".`);
    if (!adapter.validate(value)) throw new TypeError(`Invalid "${type}" drag payload.`);
    dataTransfer.setData(type, adapter.serialize(value));
    dispatch(this, "gui:drag-write", { type });
  }

  read(dataTransfer, type) {
    const adapter = this.#types.get(type);
    if (!adapter) throw new Error(`Unknown drag payload type "${type}".`);
    const serialized = dataTransfer.getData(type);
    if (!serialized) return undefined;
    const value = adapter.deserialize(serialized);
    if (!adapter.validate(value)) throw new TypeError(`Invalid "${type}" drag payload.`);
    return clone(value);
  }

  makeDraggable(element, options) {
    element.draggable = options.disabled !== true;
    const listener = (event) => {
      const payload = typeof options.payload === "function"
        ? options.payload(event)
        : options.payload;
      this.write(event.dataTransfer, options.type, payload);
      event.dataTransfer.effectAllowed = options.effect ?? "move";
      dispatch(this, "gui:drag-start", { type: options.type, payload: clone(payload) });
    };
    element.addEventListener("dragstart", listener);
    return () => element.removeEventListener("dragstart", listener);
  }

  makeDropTarget(element, options) {
    const types = [...(options.types ?? [])];
    const accepts = (event) => types.some((type) => [...event.dataTransfer.types].includes(type));
    const over = (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = options.effect ?? "move";
      element.toggleAttribute("data-gui-drag-over", true);
    };
    const leave = () => element.removeAttribute("data-gui-drag-over");
    const drop = async (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      leave();
      for (const type of types) {
        const value = this.read(event.dataTransfer, type);
        if (value === undefined) continue;
        const detail = { type, value, originalEvent: event };
        if (!dispatch(this, "gui:drop-request", detail, true)) return;
        await options.onDrop?.(clone(value), detail);
        dispatch(this, "gui:drop", { type, value: clone(value) });
        return;
      }
    };
    element.addEventListener("dragover", over);
    element.addEventListener("dragleave", leave);
    element.addEventListener("drop", drop);
    return () => {
      element.removeEventListener("dragover", over);
      element.removeEventListener("dragleave", leave);
      element.removeEventListener("drop", drop);
    };
  }
}

export class GuiCapabilityRegistry extends GuiEventTarget {
  #capabilities = new Map();

  register(id, handler, options = {}) {
    if (!/^[a-z][a-z0-9._:-]*$/i.test(id)) throw new TypeError("Invalid capability id.");
    if (typeof handler !== "function") throw new TypeError("A capability handler must be a function.");
    this.#capabilities.set(id, {
      handler,
      description: options.description ?? "",
      parameters: clone(options.parameters ?? null),
      authorize: options.authorize ?? (() => true),
    });
    dispatch(this, "gui:capabilities-change", { operation: "register", id });
    return () => this.unregister(id);
  }

  unregister(id) {
    const removed = this.#capabilities.delete(id);
    if (removed) dispatch(this, "gui:capabilities-change", { operation: "unregister", id });
    return removed;
  }

  list() {
    return [...this.#capabilities].map(([id, capability]) => ({
      id,
      description: capability.description,
      parameters: clone(capability.parameters),
    }));
  }

  async invoke(id, params = {}, context = {}) {
    const capability = this.#capabilities.get(id);
    if (!capability) throw new Error(`Capability "${id}" is not available.`);
    const request = { id, params: clone(params), context };
    if (!dispatch(this, "gui:capability-request", request, true)) {
      throw new DOMException("Capability request was canceled.", "AbortError");
    }
    if (!await capability.authorize(request)) {
      throw new DOMException(`Capability "${id}" is not authorized.`, "NotAllowedError");
    }
    const value = await capability.handler(clone(params), context);
    dispatch(this, "gui:capability-complete", { id });
    return value;
  }
}

export class GuiDiagnostics extends GuiEventTarget {
  #metrics = new Map();
  #marks = new Map();
  #maxSamples;

  constructor(options = {}) {
    super();
    this.#maxSamples = Math.max(10, Number(options.maxSamples) || 500);
  }

  record(name, value, tags = {}) {
    const sample = {
      time: Date.now(),
      value: Number(value),
      tags: clone(tags),
    };
    if (!Number.isFinite(sample.value)) throw new TypeError("A diagnostic value must be finite.");
    const samples = this.#metrics.get(name) ?? [];
    samples.push(sample);
    if (samples.length > this.#maxSamples) samples.splice(0, samples.length - this.#maxSamples);
    this.#metrics.set(name, samples);
    dispatch(this, "gui:diagnostic", { name, sample: clone(sample) });
    return sample;
  }

  start(name) {
    const token = `${name}:${globalThis.crypto?.randomUUID?.() ?? Math.random()}`;
    this.#marks.set(token, { name, start: performance.now() });
    return token;
  }

  end(token, tags = {}) {
    const mark = this.#marks.get(token);
    if (!mark) return undefined;
    this.#marks.delete(token);
    return this.record(mark.name, performance.now() - mark.start, tags);
  }

  summary(name) {
    const samples = this.#metrics.get(name) ?? [];
    if (!samples.length) return { count: 0, min: null, max: null, average: null, latest: null };
    const values = samples.map((sample) => sample.value);
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      latest: clone(samples.at(-1)),
    };
  }

  snapshot() {
    return Object.fromEntries([...this.#metrics.keys()].map((name) => [name, this.summary(name)]));
  }
}

const TASK_CENTER_STYLES = `
  :host { display: block; color: var(--gui-text, #e5e7eb); }
  .tasks { display: grid; gap: .55rem; }
  article { display: grid; grid-template-columns: 1fr auto; gap: .3rem 1rem; padding: .7rem;
    border: 1px solid var(--gui-border, #334155); border-radius: .6rem; background: var(--gui-surface, #111827); }
  strong, small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { color: var(--gui-text-muted, #94a3b8); }
  progress { grid-column: 1 / -1; width: 100%; accent-color: var(--gui-accent, #60a5fa); }
  button { grid-row: 1 / span 2; grid-column: 2; align-self: center; color: inherit; background: transparent;
    border: 1px solid var(--gui-border, #334155); border-radius: .4rem; padding: .35rem .55rem; }
  .empty { color: var(--gui-text-muted, #94a3b8); }
`;

export class GuiTaskCenter extends GuiElement {
  #manager;
  #root;
  #listener = () => this.#render();

  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${TASK_CENTER_STYLES}</style><div class="tasks" role="status" aria-live="polite"></div>`;
    this.#root.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-task]");
      if (!button) return;
      const task = this.#manager?.get(button.dataset.task);
      if (["queued", "running"].includes(task?.status)) this.#manager.cancel(task.id);
      else if (button.dataset.action === "retry") this.#manager.retry(task.id);
      else this.#manager.dismiss(task.id);
    });
  }

  set manager(value) {
    this.#manager?.removeEventListener?.("gui:tasks-change", this.#listener);
    this.#manager = value;
    this.#manager?.addEventListener?.("gui:tasks-change", this.#listener);
    this.#render();
  }
  get manager() { return this.#manager; }

  connectedCallback() {
    if (!this.#manager) this.manager = tasks;
  }

  disconnectedCallback() {
    this.#manager?.removeEventListener?.("gui:tasks-change", this.#listener);
  }

  #render() {
    const container = this.#root?.querySelector(".tasks");
    if (!container || !this.#manager) return;
    container.replaceChildren();
    const records = this.#manager.list().reverse();
    if (!records.length) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = this.getAttribute("empty-label") ?? "No background tasks";
      container.append(empty);
      return;
    }
    for (const task of records) {
      const article = document.createElement("article");
      const label = document.createElement("strong");
      label.textContent = task.label;
      const detail = document.createElement("small");
      detail.textContent = task.error?.message ?? task.detail ?? task.status;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.task = task.id;
      button.dataset.action = task.status === "failed" ? "retry" : (
        ["queued", "running"].includes(task.status) ? "cancel" : "dismiss"
      );
      button.textContent = task.status === "failed" ? "Retry" : (
        ["queued", "running"].includes(task.status) ? "Cancel" : "Dismiss"
      );
      button.disabled = task.status === "running" && !task.cancellable;
      article.append(label, detail, button);
      if (task.status === "running" || task.progress != null) {
        const progress = document.createElement("progress");
        if (task.progress != null) progress.value = task.progress;
        progress.max = 1;
        article.append(progress);
      }
      container.append(article);
    }
  }
}

export const persistence = new GuiPersistenceStore();
export const router = new GuiRouter();
export const tasks = new GuiTaskManager();
export const clipboard = new GuiClipboard();
export const dragDrop = new GuiDragDrop();
export const capabilities = new GuiCapabilityRegistry();
export const diagnostics = new GuiDiagnostics();

export const runtimeModule = Object.freeze({
  id: "runtime",
  version: "0.1.0",
  description: "Persistence, routing, background tasks, typed clipboard, capabilities, and diagnostics.",
  dependencies: [],
  components: ["gui-task-center"],
  setup(context = {}) {
    if (hasDOM && !customElements.get("gui-task-center")) {
      customElements.define("gui-task-center", GuiTaskCenter);
    }
    return {
      persistence: context.persistence ?? persistence,
      router: context.router ?? router,
      tasks: context.tasks ?? tasks,
      clipboard: context.clipboard ?? clipboard,
      dragDrop: context.dragDrop ?? dragDrop,
      capabilities: context.capabilities ?? capabilities,
      diagnostics: context.diagnostics ?? diagnostics,
    };
  },
});

if (hasDOM && !customElements.get("gui-task-center")) {
  customElements.define("gui-task-center", GuiTaskCenter);
}
