/**
 * GuiKit module registry.
 *
 * Modules are plain manifests. They may depend on other modules and optionally
 * expose a setup function. Initialization is deterministic, dependency-aware,
 * and safe to call more than once.
 */
export class GuiModuleRegistry {
  #modules = new Map();
  #states = new Map();
  #results = new Map();
  #promises = new Map();

  register(manifest) {
    validateManifest(manifest);
    if (this.#modules.has(manifest.id)) {
      throw new Error(`GuiKit module "${manifest.id}" is already registered.`);
    }

    const normalized = Object.freeze({
      description: "",
      dependencies: [],
      components: [],
      ...manifest,
      dependencies: Object.freeze([...(manifest.dependencies ?? [])]),
      components: Object.freeze([...(manifest.components ?? [])]),
      setup: manifest.setup ?? (() => undefined),
    });
    this.#modules.set(normalized.id, normalized);
    this.#states.set(normalized.id, "registered");
    return normalized;
  }

  has(id) {
    return this.#modules.has(id);
  }

  get(id) {
    return this.#modules.get(id);
  }

  state(id) {
    return this.#states.get(id) ?? "missing";
  }

  list() {
    return [...this.#modules.values()];
  }

  async initialize(id, context = {}) {
    return this.#initialize(id, context, []);
  }

  async initializeAll(context = {}) {
    const results = new Map();
    for (const module of this.#modules.values()) {
      results.set(module.id, await this.#initialize(module.id, context, []));
    }
    return results;
  }

  resetForTests() {
    this.#modules.clear();
    this.#states.clear();
    this.#results.clear();
    this.#promises.clear();
  }

  async #initialize(id, context, path) {
    const manifest = this.#modules.get(id);
    if (!manifest) {
      const owner = path.at(-1);
      throw new Error(
        owner
          ? `GuiKit module "${owner}" depends on missing module "${id}".`
          : `GuiKit module "${id}" is not registered.`,
      );
    }

    const state = this.#states.get(id);
    if (state === "initialized") return this.#results.get(id);
    if (state === "initializing") {
      if (path.includes(id)) {
        throw new Error(`Circular GuiKit module dependency: ${[...path, id].join(" -> ")}`);
      }
      return this.#promises.get(id);
    }

    this.#states.set(id, "initializing");
    const initialization = (async () => {
      try {
        const dependencies = new Map();
        for (const dependencyId of manifest.dependencies) {
          dependencies.set(
            dependencyId,
            await this.#initialize(dependencyId, context, [...path, id]),
          );
        }

        const result = await manifest.setup({
          ...context,
          module: manifest,
          modules: this,
          dependencies,
        });
        this.#results.set(id, result);
        this.#states.set(id, "initialized");
        return result;
      } catch (error) {
        this.#states.set(id, "failed");
        throw error;
      }
    })();
    this.#promises.set(id, initialization);
    return initialization;
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new TypeError("A GuiKit module manifest must be an object.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.id ?? "")) {
    throw new TypeError(
      'A GuiKit module id must use lowercase letters, numbers, and hyphens.',
    );
  }
  if (typeof manifest.version !== "string" || !manifest.version.trim()) {
    throw new TypeError(`GuiKit module "${manifest.id}" requires a version.`);
  }
  if (manifest.setup !== undefined && typeof manifest.setup !== "function") {
    throw new TypeError(`GuiKit module "${manifest.id}" setup must be a function.`);
  }
  if (manifest.dependencies !== undefined && !Array.isArray(manifest.dependencies)) {
    throw new TypeError(`GuiKit module "${manifest.id}" dependencies must be an array.`);
  }
  if (manifest.components !== undefined && !Array.isArray(manifest.components)) {
    throw new TypeError(`GuiKit module "${manifest.id}" components must be an array.`);
  }
}

export const guiModules = new GuiModuleRegistry();

export function defineGuiModule(manifest, registry = guiModules) {
  return registry.register(manifest);
}
