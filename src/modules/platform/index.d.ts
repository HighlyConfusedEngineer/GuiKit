export interface GuiFileAdapter {
  list(): Promise<Array<{ path: string; name?: string }>>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<unknown>;
  remove(path: string): Promise<unknown>;
  rename?(from: string, to: string): Promise<unknown>;
}

export class GuiMemoryFileAdapter implements GuiFileAdapter {
  constructor(files?: Record<string, string>);
  list(): Promise<Array<{ path: string; name: string }>>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<{ path: string }>;
  remove(path: string): Promise<boolean>;
  rename(from: string, to: string): Promise<{ path: string }>;
}

export class GuiFileWorkspace extends EventTarget {
  constructor(options?: { adapter?: GuiFileAdapter });
  readonly activePath: string | null;
  readonly activeFile: { path: string; content: string; dirty: boolean } | null;
  readonly files: Array<{ path: string; content: string; dirty: boolean }>;
  refresh(): Promise<Array<{ path: string; name?: string }>>;
  open(path: string): Promise<{ path: string; content: string; dirty: boolean }>;
  create(path: string, content?: string): { path: string; content: string; dirty: boolean };
  update(path: string, content: string): { path: string; content: string; dirty: boolean };
  save(path?: string): Promise<{ path: string; content: string; dirty: boolean }>;
  rename(from: string, to: string): Promise<string>;
  remove(path: string): Promise<void>;
}

export class GuiCollaborationSession extends EventTarget {
  constructor(options?: { clientId?: string; state?: object });
  readonly online: boolean;
  readonly state: object;
  readonly peers: object[];
  readonly comments: object[];
  connect(adapter: { send?(operation: object): void; subscribe?(listener: (operation: object) => void): (() => void) | void }): void;
  disconnect(): void;
  apply(operation: { type?: string; path?: string; value?: unknown; [key: string]: unknown }): object;
  setPresence(presence: object): object;
  addComment(comment: object): object;
  receive(operation: object): void;
}

export function summarizeTable(rows: object[], columns?: string[] | null): Record<string, { count: number; missing: number; min: number | null; max: number | null; sum: number; mean: number | null }>;
export function pivotRows(rows: object[], options: { row: string; column: string; value: string; reduce?: "sum" | "average" }): object[];
export function histogram(values: unknown[], options?: { bins?: number }): Array<{ min: number; max: number; count: number }>;

export class GuiAutomationModel extends EventTarget {
  constructor(options?: { id?: string; name?: string; trigger?: object; steps?: object[] });
  id: string; name: string; trigger: object; steps: object[]; history: object[];
  addStep(step: object): object;
  run(context?: object, executor?: (step: object, context: object) => Promise<unknown>): Promise<object>;
  toJSON(): object;
}

export class GuiAiSession extends EventTarget {
  constructor(options?: { provider?: { stream?(messages: object[], options: object): AsyncIterable<string | { text?: string }>; complete?(messages: object[], options: object): Promise<string | { text?: string }> }; system?: string });
  provider: unknown; messages: Array<{ role: string; content: string }>;
  send(content: string, options?: object): Promise<{ role: string; content: string }>;
  requestTool(tool: object, input: object): boolean;
}

export class GuiPluginRegistry extends EventTarget {
  constructor(options?: { permissions?: string[] });
  permissions: Set<string>;
  list(): Array<object>;
  register(manifest: { id: string; name: string; permissions?: string[]; [key: string]: unknown }, loader?: (() => Promise<object>) | null): object;
  activate(id: string, context?: object): Promise<unknown>;
  deactivate(id: string): Promise<void>;
}

export function inspectAccessibility(root?: ParentNode | null): { focusable: Array<{ tag: string; label: string }>; missingLabels: string[]; headingOrder: number[] };
export class GuiInteractionRecorder extends EventTarget { entries: object[]; record(action: object): object; start(target: EventTarget): void; stop(target?: EventTarget | null): void; replay(resolve: (target: string, entry: object) => Element | Promise<Element>, delay?: number): Promise<void>; }
export class GuiMockHostBridge { constructor(handlers?: Record<string, (payload: unknown) => unknown>); calls: object[]; handle(name: string, handler: (payload: unknown) => unknown): this; invoke(name: string, payload?: unknown): Promise<unknown>; }
export class GuiDocumentModel extends EventTarget { constructor(options?: { title?: string; template?: string; page?: object }); title: string; template: string; page: object; render(data?: object): string; setTemplate(template: string): void; toPrintHtml(data?: object): string; toJSON(): object; }
export class GuiDesignSystem extends EventTarget { constructor(options?: { tokens?: object; components?: object }); tokens: object; components: object; setToken(path: string, value: unknown, type?: string): void; getToken(path: string): unknown; exportTokens(): object; importTokens(tokens: object): void; toFigmaVariables(): Array<{ name: string; type: string; value: unknown }>; }

export class GuiCollaborationPanel extends HTMLElement { session: GuiCollaborationSession; }
export class GuiFileExplorer extends HTMLElement { workspace: GuiFileWorkspace; }
export class GuiAnalysisPanel extends HTMLElement { rows: object[]; }
export class GuiAutomationDesigner extends HTMLElement { flow: GuiAutomationModel; }
export class GuiAiPanel extends HTMLElement { session: GuiAiSession; }
export class GuiPluginManager extends HTMLElement { registry: GuiPluginRegistry; }
export class GuiAccessibilityInspector extends HTMLElement {}
export class GuiTestRecorder extends HTMLElement { recorder: GuiInteractionRecorder; }
export class GuiDocumentEditor extends HTMLElement { documentModel: GuiDocumentModel; }
export class GuiDesignSystemEditor extends HTMLElement { designSystem: GuiDesignSystem; }
export const platformModule: { id: string; version: string; description: string; elements: string[] };
