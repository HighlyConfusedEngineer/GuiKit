export interface GuiStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class GuiMemoryStorage implements GuiStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export class GuiPersistenceStore extends EventTarget {
  constructor(options?: {
    storage?: GuiStorage;
    namespace?: string;
    version?: number;
    migrations?: Record<number, (value: unknown, context: unknown) => unknown>;
  });
  addMigration(version: number, migration: (value: unknown, context: unknown) => unknown): this;
  save<T>(key: string, value: T, options?: { schema?: string; version?: number }): {
    schema: string; version: number; savedAt: string; value: T;
  };
  load<T>(key: string, fallback?: T): T | undefined;
  remove(key: string): void;
}

export interface GuiRouteDefinition {
  id: string;
  path: string;
  title?: string;
  data?: Record<string, unknown>;
}

export interface GuiRouteMatch {
  id: string;
  path: string;
  title: string;
  params: Record<string, string>;
  query: Record<string, string>;
  data: Record<string, unknown>;
}

export class GuiRouter extends EventTarget {
  constructor(options?: { mode?: "hash" | "history"; routes?: GuiRouteDefinition[] });
  readonly current: GuiRouteMatch | null;
  add(route: GuiRouteDefinition): () => void;
  guard(callback: (change: { from: GuiRouteMatch | null; to: GuiRouteMatch }) =>
    boolean | Promise<boolean>): () => void;
  resolve(url: string): GuiRouteMatch | null;
  navigate(path: string, options?: { replace?: boolean; memoryOnly?: boolean }): Promise<boolean>;
  sync(): Promise<boolean>;
  start(): void;
  stop(): void;
}

export type GuiTaskStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export interface GuiTaskSnapshot {
  id: string;
  label: string;
  detail: string;
  status: GuiTaskStatus;
  progress: number | null;
  cancellable: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: { name: string; message: string } | null;
}

export class GuiTaskManager extends EventTarget {
  constructor(options?: { historyLimit?: number });
  list(options?: { status?: GuiTaskStatus }): GuiTaskSnapshot[];
  get(id: string): GuiTaskSnapshot | undefined;
  run<T>(definition: { id: string; label: string; detail?: string; cancellable?: boolean },
    runner: (context: {
      signal: AbortSignal;
      report(progress: number | null, detail?: string): void;
      task: GuiTaskSnapshot;
    }) => T | Promise<T>): {
      id: string;
      promise: Promise<T | undefined>;
      cancel(): boolean;
      report(progress: number | null, detail?: string): void;
    };
  cancel(id: string): boolean;
  dismiss(id: string): boolean;
  retry(id: string): ReturnType<GuiTaskManager["run"]> | null;
}

export class GuiClipboard extends EventTarget {
  registerType<T>(type: string, options?: {
    serialize?(value: T): string;
    deserialize?(value: string): T;
    validate?(value: unknown): value is T;
  }): () => boolean;
  write<T>(type: string, value: T, options?: { system?: boolean }): Promise<void>;
  read<T>(type: string, options?: { system?: boolean }): Promise<T | undefined>;
}

export class GuiDragDrop extends EventTarget {
  registerType<T>(type: string, options?: {
    serialize?(value: T): string;
    deserialize?(value: string): T;
    validate?(value: unknown): value is T;
  }): () => boolean;
  write<T>(dataTransfer: DataTransfer, type: string, value: T): void;
  read<T>(dataTransfer: DataTransfer, type: string): T | undefined;
  makeDraggable<T>(element: HTMLElement, options: {
    type: string;
    payload: T | ((event: DragEvent) => T);
    effect?: DataTransfer["effectAllowed"];
    disabled?: boolean;
  }): () => void;
  makeDropTarget(element: HTMLElement, options: {
    types: string[];
    effect?: DataTransfer["dropEffect"];
    onDrop?(value: unknown, context: unknown): unknown | Promise<unknown>;
  }): () => void;
}

export class GuiCapabilityRegistry extends EventTarget {
  register(id: string, handler: (params: unknown, context: unknown) => unknown, options?: {
    description?: string;
    parameters?: unknown;
    authorize?: (request: unknown) => boolean | Promise<boolean>;
  }): () => boolean;
  unregister(id: string): boolean;
  list(): Array<{ id: string; description: string; parameters: unknown }>;
  invoke<T = unknown>(id: string, params?: unknown, context?: unknown): Promise<T>;
}

export class GuiDiagnostics extends EventTarget {
  constructor(options?: { maxSamples?: number });
  record(name: string, value: number, tags?: Record<string, unknown>): unknown;
  start(name: string): string;
  end(token: string, tags?: Record<string, unknown>): unknown;
  summary(name: string): {
    count: number; min: number | null; max: number | null;
    average: number | null; latest: unknown;
  };
  snapshot(): Record<string, unknown>;
}

export class GuiTaskCenter extends HTMLElement {
  manager: GuiTaskManager;
}

export const persistence: GuiPersistenceStore;
export const router: GuiRouter;
export const tasks: GuiTaskManager;
export const clipboard: GuiClipboard;
export const dragDrop: GuiDragDrop;
export const capabilities: GuiCapabilityRegistry;
export const diagnostics: GuiDiagnostics;
export const runtimeModule: Readonly<{
  id: "runtime";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly ["gui-task-center"];
  setup(context?: Record<string, unknown>): Record<string, unknown>;
}>;
