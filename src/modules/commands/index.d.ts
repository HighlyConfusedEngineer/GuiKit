export interface GuiCommandContext {
  source?: string;
  signal?: AbortSignal;
  [key: string]: unknown;
}

export interface GuiCommandDefinition {
  id: string;
  label?: string;
  description?: string;
  category?: string;
  icon?: string;
  shortcut?: string;
  keywords?: string[];
  allowConcurrent?: boolean;
  enabled?: boolean | ((context?: GuiCommandContext) => boolean);
  checked?: boolean | ((context?: GuiCommandContext) => boolean);
  run(context: GuiCommandContext): unknown | Promise<unknown>;
}

export interface GuiCommandSnapshot {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: string;
  shortcut: string;
  keywords: string[];
  enabled: boolean;
  checked: boolean;
}

export class GuiCommandRegistry extends EventTarget {
  register(definition: GuiCommandDefinition): () => boolean;
  unregister(id: string): boolean;
  get(id: string): GuiCommandSnapshot | undefined;
  list(options?: { query?: string; category?: string }): GuiCommandSnapshot[];
  bind(id: string, shortcut: string): string;
  unbind(shortcut: string): boolean;
  execute<T = unknown>(id: string, context?: GuiCommandContext): Promise<{
    status: "completed" | "disabled" | "canceled";
    id: string;
    value?: T;
  }>;
  cancel(id: string): boolean;
  attach(target?: EventTarget): void;
  detach(): void;
  toJSON(): { commands: GuiCommandSnapshot[]; bindings: Record<string, string> };
}

export interface GuiHistoryEntry {
  label?: string;
  data?: unknown;
  redo(): unknown | Promise<unknown>;
  undo(): unknown | Promise<unknown>;
}

export class GuiHistory extends EventTarget {
  constructor(options?: { limit?: number });
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly size: number;
  perform<T = unknown>(entry: GuiHistoryEntry): Promise<T>;
  record(entry: GuiHistoryEntry): GuiHistoryEntry;
  begin(label?: string): void;
  commit(): boolean;
  rollback(): Promise<boolean>;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
  clear(): void;
  snapshot(): {
    undo: Array<{ label: string; data?: unknown }>;
    redo: Array<{ label: string; data?: unknown }>;
  };
}

export class GuiCommandPalette extends HTMLElement {
  registry: GuiCommandRegistry;
  readonly open: boolean;
  show(query?: string): void;
  close(reason?: string): void;
  toggle(force?: boolean): void;
  execute(id: string): Promise<unknown>;
}

export const commands: GuiCommandRegistry;
export const history: GuiHistory;
export function installDefaultCommands(
  registry?: GuiCommandRegistry,
  history?: GuiHistory,
): () => void;
export const commandsModule: Readonly<{
  id: "commands";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly ["gui-command-palette"];
  setup(context?: Record<string, unknown>): {
    commands: GuiCommandRegistry;
    history: GuiHistory;
  };
}>;
