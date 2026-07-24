/**
 * Small, dependency-free scheduling and measurement primitives. They are safe
 * in browsers, WebViews, Node-based hosts, and test runners.
 */
const GuiEventTarget = globalThis.EventTarget ?? class {};

function emit(target, type, detail) {
  if (typeof CustomEvent !== "undefined") target.dispatchEvent(new CustomEvent(type, { detail }));
}

const now = () => globalThis.performance?.now?.() ?? Date.now();

/** Coalesces keyed visual work into a single animation frame. */
export class GuiFrameScheduler {
  #tasks = new Map();
  #handle = null;

  schedule(key, task) {
    if (typeof task !== "function") throw new TypeError("A render task must be a function.");
    const id = String(key);
    this.#tasks.set(id, task);
    if (this.#handle == null) {
      const request = globalThis.requestAnimationFrame ?? ((callback) => setTimeout(() => callback(now()), 16));
      this.#handle = request(() => this.flush());
    }
    return () => this.#tasks.delete(id);
  }

  flush() {
    const tasks = [...this.#tasks.values()];
    this.#tasks.clear();
    this.#handle = null;
    tasks.forEach((task) => task());
    return tasks.length;
  }

  get pending() { return this.#tasks.size; }
}

/** Records timing samples and reports budget breaches without retaining raw data. */
export class GuiPerformanceBudget extends GuiEventTarget {
  #samples = new Map();
  constructor(options = {}) {
    super();
    this.maxSamples = Math.max(1, Number(options.maxSamples) || 120);
    this.budgets = new Map(Object.entries(options.budgets ?? {}).map(([name, value]) => [name, Number(value)]));
  }

  setBudget(name, milliseconds) {
    this.budgets.set(String(name), Math.max(0, Number(milliseconds) || 0));
    return this;
  }

  record(name, milliseconds, detail = undefined) {
    const id = String(name);
    const duration = Math.max(0, Number(milliseconds) || 0);
    const values = this.#samples.get(id) ?? [];
    values.push(duration);
    if (values.length > this.maxSamples) values.splice(0, values.length - this.maxSamples);
    this.#samples.set(id, values);
    const budget = this.budgets.get(id);
    const sample = { name: id, duration, budget, detail, exceeded: Number.isFinite(budget) && duration > budget };
    emit(this, sample.exceeded ? "gui:performance-budget-exceeded" : "gui:performance-sample", sample);
    return sample;
  }

  measure(name, callback, detail = undefined) {
    const started = now();
    try {
      const result = callback();
      if (result?.then) return result.finally(() => this.record(name, now() - started, detail));
      this.record(name, now() - started, detail);
      return result;
    } catch (error) {
      this.record(name, now() - started, { ...detail, error: String(error?.message ?? error) });
      throw error;
    }
  }

  snapshot(name = undefined) {
    const summarize = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      const total = values.reduce((sum, value) => sum + value, 0);
      return { count: values.length, average: values.length ? total / values.length : 0, max: sorted.at(-1) ?? 0, p95: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0 };
    };
    if (name !== undefined) return summarize(this.#samples.get(String(name)) ?? []);
    return Object.fromEntries([...this.#samples].map(([id, values]) => [id, summarize(values)]));
  }
}

/** Dynamically imports optional feature modules only when an application needs them. */
export class GuiLazyModuleLoader extends GuiEventTarget {
  #loaders = new Map();
  #loaded = new Map();
  register(id, loader) {
    if (typeof loader !== "function") throw new TypeError("A lazy module loader must be a function.");
    const key = String(id);
    if (this.#loaders.has(key)) throw new Error(`Lazy module "${key}" is already registered.`);
    this.#loaders.set(key, loader);
    return this;
  }
  has(id) { return this.#loaders.has(String(id)); }
  loaded(id) { return this.#loaded.has(String(id)); }
  async load(id) {
    const key = String(id);
    if (this.#loaded.has(key)) return this.#loaded.get(key);
    const loader = this.#loaders.get(key);
    if (!loader) throw new Error(`Lazy module "${key}" is not registered.`);
    const promise = Promise.resolve(loader()).then((module) => {
      emit(this, "gui:lazy-module-loaded", { id: key });
      return module;
    });
    this.#loaded.set(key, promise);
    try { return await promise; } catch (error) { this.#loaded.delete(key); throw error; }
  }
}

/** Selector-based state updates keep unrelated application surfaces untouched. */
export class GuiSignalStore extends GuiEventTarget {
  #state;
  #subscriptions = new Set();
  constructor(initialState = {}) { super(); this.#state = structuredClone(initialState); }
  getState() { return structuredClone(this.#state); }
  setState(patch) {
    const next = typeof patch === "function" ? patch(this.getState()) : { ...this.#state, ...(patch ?? {}) };
    this.#state = structuredClone(next ?? {});
    this.#subscriptions.forEach((subscription) => {
      const value = subscription.selector(this.#state);
      if (subscription.equal(value, subscription.value)) return;
      const previous = subscription.value;
      subscription.value = structuredClone(value);
      subscription.listener(subscription.value, previous);
    });
    emit(this, "gui:state-change", this.getState());
    return this.getState();
  }
  select(selector, listener, options = {}) {
    if (typeof selector !== "function" || typeof listener !== "function") throw new TypeError("State selectors and listeners must be functions.");
    const subscription = { selector, listener, equal: options.equal ?? Object.is, value: structuredClone(selector(this.#state)) };
    this.#subscriptions.add(subscription);
    if (options.immediate) listener(subscription.value, undefined);
    return () => this.#subscriptions.delete(subscription);
  }
}

/** Coordinates memory-sensitive components through explicit normal/balanced/constrained profiles. */
export class GuiResourceGovernor extends GuiEventTarget {
  #clients = new Map();
  #mode = "normal";
  get mode() { return this.#mode; }
  register(id, apply) {
    if (typeof apply !== "function") throw new TypeError("A resource client must provide an apply function.");
    const key = String(id);
    this.#clients.set(key, apply);
    apply(this.#mode);
    return () => this.#clients.delete(key);
  }
  setMode(mode) {
    const next = ["normal", "balanced", "constrained"].includes(mode) ? mode : "normal";
    if (next === this.#mode) return false;
    const previous = this.#mode;
    this.#mode = next;
    this.#clients.forEach((apply, id) => apply(next, previous, id));
    emit(this, "gui:resource-mode-change", { mode: next, previous });
    return true;
  }
}

export const frameScheduler = new GuiFrameScheduler();
export const performanceBudget = new GuiPerformanceBudget({
  budgets: { "chart-render": 16, "data-render": 16, "node-layout": 32 },
});
export const lazyModules = new GuiLazyModuleLoader();
export const resourceGovernor = new GuiResourceGovernor();

export const performanceModule = Object.freeze({
  id: "performance",
  version: "0.1.0",
  description: "Frame batching, performance budgets, and lazy feature module loading.",
  dependencies: ["core"],
  setup(context = {}) {
    return {
      frameScheduler: context.frameScheduler ?? frameScheduler,
      performanceBudget: context.performanceBudget ?? performanceBudget,
      lazyModules: context.lazyModules ?? lazyModules,
      resourceGovernor: context.resourceGovernor ?? resourceGovernor,
    };
  },
});
