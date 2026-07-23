export type GuiTheme = "system" | "light" | "dark";
export type TranslationCatalog = Record<string, string | TranslationCatalog>;
export type GuiChartPoint = number | [x: number, y: number] | { x?: number; y: number };
export type GuiToastVariant = "info" | "success" | "warning" | "error";

export class GuiI18n extends EventTarget {
  constructor(options?: { locale?: string; fallbackLocale?: string });
  readonly locale: string;
  fallbackLocale: string;
  register(locale: string, messages: TranslationCatalog): this;
  load(locale: string, url: string): Promise<this>;
  setLocale(locale: string, root?: ParentNode | null): void;
  t(key: string, variables?: Record<string, unknown>, locale?: string): string;
  translate(root?: ParentNode): void;
}

export class GuiBridge extends EventTarget {
  readonly hostKind: "none" | "browser" | "pywebview" | "webview2" | "webkit";
  invoke<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    options?: { timeout?: number },
  ): Promise<T>;
  receive(message: string | Record<string, unknown>): boolean;
}

export class GuiDataBuffer {
  constructor(capacity?: number);
  readonly capacity: number;
  readonly length: number;
  append(x: number, y: number): boolean;
  appendBatch(points: Iterable<GuiChartPoint>): number;
  xAt(index: number): number | undefined;
  yAt(index: number): number | undefined;
  clear(): void;
  resize(capacity: number): void;
}

export function decimateMinMax(
  buffer: GuiDataBuffer,
  start?: number,
  end?: number,
  targetBuckets?: number,
): number[];

export interface GuiChartSeries {
  id?: string;
  label?: string;
  color?: string;
  data?: Iterable<GuiChartPoint>;
}

export class GuiLiveChart extends HTMLElement {
  readonly maxPoints: number;
  readonly windowPoints: number;
  readonly pointCount: number;
  setSeries(series: GuiChartSeries[]): void;
  addSeries(series?: GuiChartSeries, paletteIndex?: number): string;
  append(seriesId: string, value: GuiChartPoint, x?: number): boolean;
  append(value: GuiChartPoint): boolean;
  appendBatch(seriesId: string, points: Iterable<GuiChartPoint>): number;
  appendBatch(points: Iterable<GuiChartPoint>): number;
  clear(seriesId?: string): void;
  requestRender(): void;
}

export interface GuiToastOptions {
  id?: string;
  title?: string;
  variant?: GuiToastVariant;
  duration?: number;
  dismissible?: boolean;
  closeLabel?: string;
  action?: {
    label: string;
    onClick?: () => void;
    keepOpen?: boolean;
  };
}

export interface GuiToastHandle {
  id: string;
  dismiss(): boolean;
}

export class GuiToastStack extends HTMLElement {
  push(notification: {
    id: string;
    message: string;
    title?: string;
    variant: GuiToastVariant;
    duration: number;
    dismissible?: boolean;
    closeLabel?: string;
    action?: GuiToastOptions["action"];
  }): void;
  dismiss(id: string, reason?: string): boolean;
}

export class GuiToastManager {
  show(message: string, options?: GuiToastOptions): GuiToastHandle;
  success(message: string, options?: GuiToastOptions): GuiToastHandle;
  info(message: string, options?: GuiToastOptions): GuiToastHandle;
  warning(message: string, options?: GuiToastOptions): GuiToastHandle;
  error(message: string, options?: GuiToastOptions): GuiToastHandle;
  dismiss(id: string): boolean;
}

export class GuiTabs extends HTMLElement {
  active: string | null;
  select(name: string, focus?: boolean): void;
}

export class GuiSidebar extends HTMLElement {
  open: boolean;
  collapsible: boolean;
  collapsed: boolean;
  toggle(force?: boolean): void;
  toggleCollapse(force?: boolean): boolean;
}

export class GuiPages extends HTMLElement {
  active: string | null;
  open(name: string, options?: {
    history?: boolean;
    direction?: "forward" | "back";
  }): void;
  back(): void;
}

export const i18n: GuiI18n;
export const bridge: GuiBridge;
export const toast: GuiToastManager;
export function setTheme(theme: GuiTheme): void;
export function initializeGui(options?: {
  locale?: string;
  fallbackLocale?: string;
  theme?: GuiTheme;
}): {
  i18n: GuiI18n;
  bridge: GuiBridge;
  toast: GuiToastManager;
  logs: import("./modules/logging/index.js").GuiLogManager;
  logger: import("./modules/logging/index.js").GuiLogger;
  modules: import("./core/module-registry.js").GuiModuleRegistry;
  mediaAdapters: import("./modules/media-player/index.js").GuiMediaAdapterRegistry;
  ready: Promise<Map<string, unknown>>;
};

export {
  GuiModuleContext,
  GuiModuleManifest,
  GuiModuleRegistry,
  defineGuiModule,
  guiModules,
} from "./core/module-registry.js";

export {
  GuiNodeDefinition,
  GuiNodeEditor,
  GuiNodeGraph,
  GuiNodeGraphData,
  GuiNodeLink,
  GuiNodePort,
  GuiNodePortDirection,
  nodeEditorModule,
} from "./modules/node-editor/index.js";

export {
  GuiMediaAdapter,
  GuiMediaAdapterRegistry,
  GuiMediaPlayer,
  GuiMediaSource,
  GuiMediaTrack,
  mediaAdapters,
  mediaPlayerModule,
} from "./modules/media-player/index.js";

export {
  GUI_LOG_LEVELS,
  GUI_LOG_SCHEMA,
  GuiBatchSink,
  GuiBridgeLogSink,
  GuiConsoleSink,
  GuiHttpLogSink,
  GuiLogger,
  GuiLogManager,
  GuiLogRecord,
  GuiLogSink,
  GuiLogSpan,
  GuiLogTrace,
  GuiLogViewer,
  GuiMemorySink,
  logger,
  loggingModule,
  logs,
} from "./modules/logging/index.js";

declare global {
  interface Window {
    GuiTemplate: {
      bridge: GuiBridge;
      i18n: GuiI18n;
      modules: import("./core/module-registry.js").GuiModuleRegistry;
      mediaAdapters: import("./modules/media-player/index.js").GuiMediaAdapterRegistry;
      logs: import("./modules/logging/index.js").GuiLogManager;
      logger: import("./modules/logging/index.js").GuiLogger;
      toast: GuiToastManager;
      initialize: typeof initializeGui;
      setTheme: typeof setTheme;
    };
    guiBridgeReceive(message: string | Record<string, unknown>): boolean;
  }

  interface HTMLElementTagNameMap {
    "gui-tabs": GuiTabs;
    "gui-sidebar": GuiSidebar;
    "gui-pages": GuiPages;
    "gui-live-chart": GuiLiveChart;
    "gui-toast-stack": GuiToastStack;
    "gui-log-viewer": import("./modules/logging/index.js").GuiLogViewer;
  }
}
