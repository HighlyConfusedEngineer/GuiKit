const GuiElement = globalThis.HTMLElement ?? class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

function emit(target, type, detail, options = {}) {
  if (typeof target?.dispatchEvent !== "function" || typeof CustomEvent === "undefined") {
    return true;
  }
  return target.dispatchEvent(new CustomEvent(type, {
    bubbles: options.bubbles ?? false,
    cancelable: options.cancelable ?? false,
    composed: options.composed ?? true,
    detail,
  }));
}

function normalizeShortcut(shortcut = "") {
  const aliases = new Map([
    ["control", "Ctrl"],
    ["ctrl", "Ctrl"],
    ["meta", "Meta"],
    ["cmd", "Meta"],
    ["command", "Meta"],
    ["alt", "Alt"],
    ["option", "Alt"],
    ["shift", "Shift"],
    [" ", "Space"],
  ]);
  const parts = String(shortcut)
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = [];
  let key = "";
  for (const part of parts) {
    const normalized = aliases.get(part.toLowerCase());
    if (normalized && normalized !== "Space") modifiers.push(normalized);
    else key = normalized ?? (part.length === 1 ? part.toUpperCase() : part);
  }
  return [
    modifiers.includes("Ctrl") ? "Ctrl" : null,
    modifiers.includes("Meta") ? "Meta" : null,
    modifiers.includes("Alt") ? "Alt" : null,
    modifiers.includes("Shift") ? "Shift" : null,
    key,
  ].filter(Boolean).join("+");
}

function eventShortcut(event) {
  const key = event.key === " " ? "Space" : (
    event.key.length === 1 ? event.key.toUpperCase() : event.key
  );
  return [
    event.ctrlKey ? "Ctrl" : null,
    event.metaKey ? "Meta" : null,
    event.altKey ? "Alt" : null,
    event.shiftKey ? "Shift" : null,
    key,
  ].filter(Boolean).join("+");
}

function commandSnapshot(command) {
  return {
    id: command.id,
    label: command.label,
    description: command.description,
    category: command.category,
    icon: command.icon,
    shortcut: command.shortcut,
    keywords: [...command.keywords],
    enabled: Boolean(command.enabled()),
    checked: Boolean(command.checked()),
  };
}

export class GuiCommandRegistry extends GuiEventTarget {
  #commands = new Map();
  #bindings = new Map();
  #running = new Map();
  #keyTarget = null;
  #keyListener = null;

  register(definition) {
    if (!definition || !/^[a-z][a-z0-9._:-]*$/i.test(definition.id ?? "")) {
      throw new TypeError("A command requires a stable id.");
    }
    if (this.#commands.has(definition.id)) {
      throw new Error(`Command "${definition.id}" is already registered.`);
    }
    if (typeof definition.run !== "function") {
      throw new TypeError(`Command "${definition.id}" requires a run function.`);
    }
    const command = {
      id: definition.id,
      label: definition.label ?? definition.id,
      description: definition.description ?? "",
      category: definition.category ?? "General",
      icon: definition.icon ?? "",
      shortcut: definition.shortcut ? normalizeShortcut(definition.shortcut) : "",
      keywords: [...(definition.keywords ?? [])].map(String),
      allowConcurrent: Boolean(definition.allowConcurrent),
      enabled: typeof definition.enabled === "function"
        ? definition.enabled
        : () => definition.enabled !== false,
      checked: typeof definition.checked === "function"
        ? definition.checked
        : () => Boolean(definition.checked),
      run: definition.run,
    };
    this.#commands.set(command.id, command);
    if (command.shortcut) this.bind(command.id, command.shortcut);
    emit(this, "gui:commands-change", { operation: "register", command: commandSnapshot(command) });
    return () => this.unregister(command.id);
  }

  unregister(id) {
    const command = this.#commands.get(id);
    if (!command) return false;
    this.#commands.delete(id);
    for (const [shortcut, commandId] of this.#bindings) {
      if (commandId === id) this.#bindings.delete(shortcut);
    }
    emit(this, "gui:commands-change", { operation: "unregister", id });
    return true;
  }

  get(id) {
    const command = this.#commands.get(id);
    return command ? commandSnapshot(command) : undefined;
  }

  list(options = {}) {
    const query = String(options.query ?? "").trim().toLocaleLowerCase();
    const category = options.category;
    return [...this.#commands.values()]
      .filter((command) => !category || command.category === category)
      .map(commandSnapshot)
      .filter((command) => {
        if (!query) return true;
        return [
          command.label,
          command.description,
          command.category,
          command.id,
          ...command.keywords,
        ].join(" ").toLocaleLowerCase().includes(query);
      })
      .sort((a, b) => Number(b.enabled) - Number(a.enabled)
        || a.category.localeCompare(b.category)
        || a.label.localeCompare(b.label));
  }

  bind(id, shortcut) {
    if (!this.#commands.has(id)) throw new Error(`Unknown command "${id}".`);
    const normalized = normalizeShortcut(shortcut);
    if (!normalized) throw new TypeError("A shortcut cannot be empty.");
    this.#bindings.set(normalized, id);
    const command = this.#commands.get(id);
    command.shortcut = normalized;
    emit(this, "gui:commands-change", { operation: "bind", id, shortcut: normalized });
    return normalized;
  }

  unbind(shortcut) {
    return this.#bindings.delete(normalizeShortcut(shortcut));
  }

  async execute(id, context = {}) {
    const command = this.#commands.get(id);
    if (!command) throw new Error(`Unknown command "${id}".`);
    if (!command.enabled(context)) return { status: "disabled", id };
    if (!command.allowConcurrent && this.#running.has(id)) return this.#running.get(id);
    const controller = new AbortController();
    const detail = { id, context, signal: controller.signal };
    if (!emit(this, "gui:command-request", detail, { cancelable: true })) {
      return { status: "canceled", id };
    }
    const execution = Promise.resolve()
      .then(() => command.run({ ...context, command: commandSnapshot(command), signal: controller.signal }))
      .then((value) => {
        emit(this, "gui:command-complete", { id, value });
        return { status: "completed", id, value };
      })
      .catch((error) => {
        emit(this, "gui:command-error", { id, error });
        throw error;
      })
      .finally(() => this.#running.delete(id));
    execution.cancel = () => controller.abort();
    this.#running.set(id, execution);
    return execution;
  }

  cancel(id) {
    const running = this.#running.get(id);
    if (!running?.cancel) return false;
    running.cancel();
    return true;
  }

  attach(target = globalThis.document) {
    this.detach();
    if (!target?.addEventListener) return;
    this.#keyTarget = target;
    this.#keyListener = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      const id = this.#bindings.get(eventShortcut(event));
      if (!id) return;
      const element = event.target;
      const editing = element?.matches?.("input, textarea, select, [contenteditable=true]");
      if (editing && !event.ctrlKey && !event.metaKey && !event.altKey) return;
      event.preventDefault();
      void this.execute(id, { source: "shortcut", originalEvent: event });
    };
    target.addEventListener("keydown", this.#keyListener);
  }

  detach() {
    this.#keyTarget?.removeEventListener?.("keydown", this.#keyListener);
    this.#keyTarget = null;
    this.#keyListener = null;
  }

  toJSON() {
    return {
      commands: this.list(),
      bindings: Object.fromEntries(this.#bindings),
    };
  }
}

export class GuiHistory extends GuiEventTarget {
  #undo = [];
  #redo = [];
  #limit;
  #transaction = null;

  constructor(options = {}) {
    super();
    this.#limit = Math.max(1, Number(options.limit) || 100);
  }

  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }
  get size() { return this.#undo.length; }

  async perform(entry) {
    if (!entry || typeof entry.redo !== "function" || typeof entry.undo !== "function") {
      throw new TypeError("A history entry requires redo and undo functions.");
    }
    const normalized = {
      label: entry.label ?? "Change",
      redo: entry.redo,
      undo: entry.undo,
      data: entry.data == null ? undefined : structuredClone(entry.data),
    };
    const value = await normalized.redo();
    if (this.#transaction) this.#transaction.entries.push(normalized);
    else this.#push(normalized);
    return value;
  }

  record(entry) {
    if (!entry || typeof entry.redo !== "function" || typeof entry.undo !== "function") {
      throw new TypeError("A history entry requires redo and undo functions.");
    }
    const normalized = {
      label: entry.label ?? "Change",
      redo: entry.redo,
      undo: entry.undo,
      data: entry.data == null ? undefined : structuredClone(entry.data),
    };
    if (this.#transaction) this.#transaction.entries.push(normalized);
    else this.#push(normalized);
    return normalized;
  }

  begin(label = "Transaction") {
    if (this.#transaction) throw new Error("A history transaction is already active.");
    this.#transaction = { label, entries: [] };
  }

  commit() {
    const transaction = this.#transaction;
    if (!transaction) return false;
    this.#transaction = null;
    if (!transaction.entries.length) return false;
    this.#push({
      label: transaction.label,
      data: transaction.entries.map((entry) => entry.data),
      redo: async () => {
        for (const entry of transaction.entries) await entry.redo();
      },
      undo: async () => {
        for (const entry of [...transaction.entries].reverse()) await entry.undo();
      },
    });
    return true;
  }

  async rollback() {
    const transaction = this.#transaction;
    if (!transaction) return false;
    this.#transaction = null;
    for (const entry of [...transaction.entries].reverse()) await entry.undo();
    this.#notify("rollback", transaction.label);
    return true;
  }

  async undo() {
    if (this.#transaction) throw new Error("Commit or roll back the active transaction first.");
    const entry = this.#undo.pop();
    if (!entry) return false;
    await entry.undo();
    this.#redo.push(entry);
    this.#notify("undo", entry.label);
    return true;
  }

  async redo() {
    if (this.#transaction) throw new Error("Commit or roll back the active transaction first.");
    const entry = this.#redo.pop();
    if (!entry) return false;
    await entry.redo();
    this.#undo.push(entry);
    this.#notify("redo", entry.label);
    return true;
  }

  clear() {
    this.#undo = [];
    this.#redo = [];
    this.#transaction = null;
    this.#notify("clear", "");
  }

  snapshot() {
    return {
      undo: this.#undo.map(({ label, data }) => ({ label, data })),
      redo: this.#redo.map(({ label, data }) => ({ label, data })),
    };
  }

  #push(entry) {
    this.#undo.push(entry);
    if (this.#undo.length > this.#limit) this.#undo.shift();
    this.#redo = [];
    this.#notify("perform", entry.label);
  }

  #notify(operation, label) {
    emit(this, "gui:history-change", {
      operation,
      label,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoLabel: this.#undo.at(-1)?.label ?? null,
      redoLabel: this.#redo.at(-1)?.label ?? null,
    });
  }
}

const COMMAND_PALETTE_STYLES = `
  :host { position: fixed; inset: 0; z-index: 10000; display: none; place-items: start center;
    padding-block-start: min(16vh, 8rem); background: color-mix(in srgb, #020617 42%, transparent); }
  :host([open]) { display: grid; }
  .panel { width: min(42rem, calc(100vw - 2rem)); max-height: min(68vh, 38rem); overflow: hidden;
    color: var(--gui-text, #e5e7eb); background: var(--gui-surface, #111827);
    border: 1px solid var(--gui-border, #334155); border-radius: .9rem;
    box-shadow: 0 24px 80px #0008; }
  input { box-sizing: border-box; width: 100%; padding: 1rem; color: inherit; background: transparent;
    border: 0; border-bottom: 1px solid var(--gui-border, #334155); font: inherit; outline: none; }
  [role=listbox] { max-height: min(54vh, 31rem); overflow: auto; padding: .4rem; }
  button { display: grid; grid-template-columns: 1fr auto; width: 100%; gap: .4rem 1rem; padding: .65rem .75rem;
    color: inherit; background: transparent; border: 0; border-radius: .5rem; text-align: start; font: inherit; }
  button[aria-selected=true] { background: color-mix(in srgb, var(--gui-accent, #60a5fa) 18%, transparent); }
  button:disabled { opacity: .45; }
  small { color: var(--gui-text-muted, #94a3b8); }
  kbd { grid-row: 1 / span 2; grid-column: 2; align-self: center; color: var(--gui-text-muted, #94a3b8); }
  .empty { padding: 1.2rem; color: var(--gui-text-muted, #94a3b8); text-align: center; }
  @media (prefers-reduced-motion: no-preference) {
    :host([open]) .panel { animation: gui-command-in 130ms ease-out; }
    @keyframes gui-command-in { from { opacity: 0; transform: translateY(-.5rem) scale(.98); } }
  }
`;

export class GuiCommandPalette extends GuiElement {
  #registry = null;
  #input;
  #list;
  #selected = 0;
  #commands = [];
  #previousFocus = null;
  #registryListener = () => this.#render();

  constructor() {
    super();
    if (!this.attachShadow) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${COMMAND_PALETTE_STYLES}</style>
      <section class="panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <input type="search" autocomplete="off" placeholder="Type a command…" aria-label="Search commands">
        <div role="listbox"></div>
      </section>`;
    this.#input = root.querySelector("input");
    this.#list = root.querySelector("[role=listbox]");
    this.#input.addEventListener("input", () => {
      this.#selected = 0;
      this.#render();
    });
    this.addEventListener("keydown", (event) => this.#onKeydown(event));
    this.addEventListener("pointerdown", (event) => {
      if (event.target === this) this.close("outside");
    });
    this.#list.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-command]");
      if (button) void this.execute(button.dataset.command);
    });
  }

  set registry(value) {
    this.#registry?.removeEventListener?.("gui:commands-change", this.#registryListener);
    this.#registry = value;
    this.#registry?.addEventListener?.("gui:commands-change", this.#registryListener);
    this.#render();
  }
  get registry() { return this.#registry; }
  get open() { return this.hasAttribute?.("open") ?? false; }

  connectedCallback() {
    if (!this.#registry) this.registry = commands;
  }

  disconnectedCallback() {
    this.#registry?.removeEventListener?.("gui:commands-change", this.#registryListener);
  }

  show(query = "") {
    if (!this.#input) return;
    this.#previousFocus = document.activeElement;
    this.setAttribute("open", "");
    this.#input.value = query;
    this.#selected = 0;
    this.#render();
    queueMicrotask(() => this.#input.focus());
    emit(this, "gui:command-palette-open", {});
  }

  close(reason = "programmatic") {
    if (!this.open) return;
    this.removeAttribute("open");
    this.#previousFocus?.focus?.();
    emit(this, "gui:command-palette-close", { reason });
  }

  toggle(force) {
    const next = force ?? !this.open;
    if (next) this.show();
    else this.close();
  }

  async execute(id) {
    if (!this.#registry) return;
    const result = await this.#registry.execute(id, { source: "palette", palette: this });
    if (result.status === "completed") this.close("execute");
    return result;
  }

  #render() {
    if (!this.#list || !this.#registry) return;
    this.#commands = this.#registry.list({ query: this.#input?.value });
    this.#selected = Math.min(this.#selected, Math.max(0, this.#commands.length - 1));
    this.#list.replaceChildren();
    if (!this.#commands.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No matching commands";
      this.#list.append(empty);
      return;
    }
    this.#commands.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.command = command.id;
      button.role = "option";
      button.disabled = !command.enabled;
      button.setAttribute("aria-selected", String(index === this.#selected));
      const label = document.createElement("span");
      label.textContent = command.label;
      const description = document.createElement("small");
      description.textContent = command.description || command.category;
      button.append(label, description);
      if (command.shortcut) {
        const shortcut = document.createElement("kbd");
        shortcut.textContent = command.shortcut;
        button.append(shortcut);
      }
      this.#list.append(button);
    });
  }

  #onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close("escape");
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      this.#selected = (this.#selected + delta + this.#commands.length) % this.#commands.length;
      this.#render();
      this.#list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = this.#commands[this.#selected];
      if (command?.enabled) void this.execute(command.id);
    } else if (event.key === "Tab") {
      event.preventDefault();
      this.#input.focus();
    }
  }
}

export const commands = new GuiCommandRegistry();
export const history = new GuiHistory();

export function installDefaultCommands(registry = commands, targetHistory = history) {
  const disposers = [
    registry.register({
      id: "gui.undo",
      label: "Undo",
      description: "Undo the last change",
      shortcut: "Ctrl+Z",
      enabled: () => targetHistory.canUndo,
      run: () => targetHistory.undo(),
    }),
    registry.register({
      id: "gui.redo",
      label: "Redo",
      description: "Redo the last undone change",
      shortcut: "Ctrl+Shift+Z",
      enabled: () => targetHistory.canRedo,
      run: () => targetHistory.redo(),
    }),
    registry.register({
      id: "gui.command-palette",
      label: "Show command palette",
      description: "Search all application commands",
      shortcut: "Ctrl+K",
      run: () => document.querySelector("gui-command-palette")?.show(),
    }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}

export const commandsModule = Object.freeze({
  id: "commands",
  version: "0.1.0",
  description: "Command discovery, keyboard shortcuts, cancellation, and undo history.",
  dependencies: [],
  components: ["gui-command-palette"],
  setup(context = {}) {
    if (hasDOM && !customElements.get("gui-command-palette")) {
      customElements.define("gui-command-palette", GuiCommandPalette);
    }
    const registry = context.commands ?? commands;
    if (!registry.get("gui.undo")) installDefaultCommands(registry, context.history ?? history);
    registry.attach?.(context.commandTarget ?? globalThis.document);
    return { commands: registry, history: context.history ?? history };
  },
});

if (hasDOM && !customElements.get("gui-command-palette")) {
  customElements.define("gui-command-palette", GuiCommandPalette);
}
