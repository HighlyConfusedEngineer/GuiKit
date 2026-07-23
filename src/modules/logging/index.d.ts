export type GuiLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface GuiLogTrace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface GuiLogRecord {
  readonly schema: "guikit.log/v1";
  readonly timestamp: string;
  readonly sequence: number;
  readonly level: GuiLogLevel;
  readonly levelValue: number;
  readonly logger: string;
  readonly message: string;
  readonly context: Record<string, unknown>;
  readonly data?: unknown;
  readonly error?: unknown;
  readonly trace?: GuiLogTrace;
  readonly transport?: { droppedBefore: number };
}

export interface GuiLogSink {
  minLevel?: GuiLogLevel;
  write(record: GuiLogRecord): void | Promise<void>;
  writeBatch?(records: GuiLogRecord[]): void | Promise<void>;
  flush?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

export interface GuiLogManagerOptions {
  level?: GuiLogLevel | "silent";
  context?: Record<string, unknown>;
  redactKeys?: Array<string | RegExp>;
  maxDepth?: number;
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  clock?: () => Date | string | number;
  idFactory?: () => string;
  onSinkError?: (error: unknown, sinkOrListener: unknown) => void;
}

export class GuiLogManager {
  constructor(options?: GuiLogManagerOptions);
  level: GuiLogLevel | "silent";
  context: Record<string, unknown>;
  createLogger(name?: string, context?: Record<string, unknown>): GuiLogger;
  setLevel(level: GuiLogLevel | "silent"): this;
  shouldLog(level: GuiLogLevel): boolean;
  addSink(sink: GuiLogSink): () => boolean;
  removeSink(sink: GuiLogSink): boolean;
  subscribe(listener: (record: GuiLogRecord) => void): () => boolean;
  write(input: {
    level: GuiLogLevel;
    logger?: string;
    message: string;
    context?: Record<string, unknown>;
    data?: unknown;
    error?: unknown;
    trace?: GuiLogTrace;
  }): GuiLogRecord | null;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}

export class GuiLogger {
  readonly manager: GuiLogManager;
  readonly name: string;
  readonly context: Record<string, unknown>;
  readonly trace: GuiLogTrace | null;
  child(name: string, context?: Record<string, unknown>): GuiLogger;
  child(context: Record<string, unknown>): GuiLogger;
  withContext(context: Record<string, unknown>): GuiLogger;
  log(level: GuiLogLevel, message: string, data?: unknown, error?: unknown): GuiLogRecord | null;
  trace(message: string, data?: unknown): GuiLogRecord | null;
  debug(message: string, data?: unknown): GuiLogRecord | null;
  info(message: string, data?: unknown): GuiLogRecord | null;
  warn(message: string, data?: unknown): GuiLogRecord | null;
  error(message: string, error?: unknown, data?: unknown): GuiLogRecord | null;
  fatal(message: string, error?: unknown, data?: unknown): GuiLogRecord | null;
  capture(error: unknown, message?: string, data?: unknown): GuiLogRecord | null;
  startSpan(name: string, data?: unknown): GuiLogSpan;
  time(label: string, data?: Record<string, unknown>): {
    end(result?: Record<string, unknown>): GuiLogRecord | null;
  };
}

export class GuiLogSpan {
  readonly name: string;
  readonly trace: GuiLogTrace;
  readonly logger: GuiLogger;
  readonly ended: boolean;
  end(data?: Record<string, unknown>, status?: string): GuiLogRecord | null;
  fail(error: unknown, data?: Record<string, unknown>): GuiLogRecord | null;
  startSpan(name: string, data?: unknown): GuiLogSpan;
}

export class GuiConsoleSink implements GuiLogSink {
  constructor(options?: {
    minLevel?: GuiLogLevel;
    console?: Console;
    structured?: boolean;
  });
  minLevel: GuiLogLevel;
  write(record: GuiLogRecord): void;
}

export class GuiMemorySink implements GuiLogSink {
  constructor(options?: { minLevel?: GuiLogLevel; limit?: number });
  minLevel: GuiLogLevel;
  limit: number;
  records: GuiLogRecord[];
  write(record: GuiLogRecord): void;
  clear(): void;
  query(options?: {
    minLevel?: GuiLogLevel;
    logger?: string;
    search?: string;
    since?: Date | string | number;
    limit?: number;
  }): GuiLogRecord[];
  toJSONLines(records?: GuiLogRecord[]): string;
}

export class GuiBatchSink implements GuiLogSink {
  constructor(sink: GuiLogSink, options?: {
    minLevel?: GuiLogLevel;
    batchSize?: number;
    maxQueue?: number;
    interval?: number;
  });
  minLevel: GuiLogLevel;
  batchSize: number;
  maxQueue: number;
  interval: number;
  dropped: number;
  write(record: GuiLogRecord): void | Promise<void>;
  setErrorHandler(handler: (error: unknown) => void): void;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}

export class GuiBridgeLogSink implements GuiLogSink {
  constructor(bridge: {
    invoke(method: string, params?: unknown, options?: { timeout?: number }): Promise<unknown>;
  }, options?: { method?: string; timeout?: number; minLevel?: GuiLogLevel });
  minLevel: GuiLogLevel;
  write(record: GuiLogRecord): Promise<unknown>;
  writeBatch(records: GuiLogRecord[]): Promise<unknown>;
}

export class GuiHttpLogSink implements GuiLogSink {
  constructor(endpoint: string | URL, options?: {
    fetch?: typeof fetch;
    headers?: Record<string, string>;
    minLevel?: GuiLogLevel;
    keepalive?: boolean;
  });
  minLevel: GuiLogLevel;
  write(record: GuiLogRecord): Promise<void>;
  writeBatch(records: GuiLogRecord[]): Promise<void>;
}

export class GuiLogViewer extends HTMLElement {
  limit: number;
  paused: boolean;
  labels: Record<"minimumLevel" | "filter" | "pause" | "resume" | "clear" | "export" | "empty" | "count", string>;
  connect(manager: GuiLogManager): this;
  setLabels(labels: Partial<GuiLogViewer["labels"]>): this;
  append(record: GuiLogRecord): void;
  clear(): void;
  export(): string;
}

export const GUI_LOG_SCHEMA: "guikit.log/v1";
export const GUI_LOG_LEVELS: Readonly<Record<GuiLogLevel | "silent", number>>;
export const logs: GuiLogManager;
export const logger: GuiLogger;
export const loggingModule: Readonly<{
  id: "logging";
  version: string;
  description: string;
  dependencies: readonly ["core"];
  components: readonly ["gui-log-viewer"];
  setup(context: {
    logs?: GuiLogManager;
    logger?: GuiLogger;
    i18n?: { t(key: string): string };
  }): { logs: GuiLogManager; logger: GuiLogger };
}>;

declare global {
  interface HTMLElementTagNameMap {
    "gui-log-viewer": GuiLogViewer;
  }
}
