export function bindGuiEvents(
  element: EventTarget,
  handlers?: Record<string, EventListener>,
): () => void;

export function createReactComponent(
  React: Record<string, (...args: unknown[]) => unknown>,
  tagName: string,
  eventMap?: Record<string, string>,
): unknown;

export function createVuePlugin(options?: {
  prefix?: string;
  tags?: string[];
}): { install(app: { component(name: string, definition: unknown): void }): void };

export class GuiNativeController {
  constructor(bridge: import("../gui.js").GuiBridge);
  invoke<T = unknown>(command: string, payload?: unknown, options?: { timeout?: number }): Promise<T>;
  saveState(key: string, value: unknown, options?: { timeout?: number }): Promise<unknown>;
  loadState<T = unknown>(key: string, options?: { timeout?: number }): Promise<T>;
  runTask<T = unknown>(id: string, payload?: unknown, options?: { timeout?: number }): Promise<T>;
}

export function defineGuiKitElements(): Promise<typeof import("../gui.js")>;
