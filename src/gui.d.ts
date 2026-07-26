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
  axis?: "left" | "right";
  visible?: boolean;
  type?: "line" | "area" | "step";
  lineWidth?: number;
  dash?: number[];
  unit?: string;
}

export interface GuiChartAnnotation { id?: string; x: number; label?: string; color?: string; }
export interface GuiChartThreshold { id?: string; value: number; label?: string; color?: string; axis?: "left" | "right"; dash?: number[]; }
export interface GuiChartView { xMin: number; xMax: number; }
export interface GuiChartStatistics { count: number; min: number | null; max: number | null; mean: number | null; standardDeviation: number | null; delta: number | null; rate: number | null; }

export function analyzeChartSignal(points: GuiDataBuffer | Iterable<GuiChartPoint>): GuiChartStatistics;
export function deriveChartSignal(points: Iterable<GuiChartPoint>, options?: {
  operation?: "moving-average" | "derivative" | "integral" | "difference" | string;
  window?: number; compare?: Iterable<GuiChartPoint>;
}): Array<{ x: number; y: number }>;

export class GuiLiveChart extends HTMLElement {
  readonly maxPoints: number;
  readonly windowPoints: number;
  readonly pointCount: number;
  readonly view: GuiChartView | null;
  readonly cursor: { x: number | null; pinned: boolean; rangeStart: number | null; rangeEnd: number | null };
  readonly annotations: GuiChartAnnotation[];
  readonly thresholds: GuiChartThreshold[];
  readonly resourceMode: "normal" | "balanced" | "constrained";
  setSeries(series: GuiChartSeries[]): void;
  addSeries(series?: GuiChartSeries, paletteIndex?: number): string;
  getSeries(id: string): (GuiChartSeries & { statistics: GuiChartStatistics }) | undefined;
  append(seriesId: string, value: GuiChartPoint, x?: number): boolean;
  append(value: GuiChartPoint): boolean;
  appendBatch(seriesId: string, points: Iterable<GuiChartPoint>): number;
  appendBatch(points: Iterable<GuiChartPoint>): number;
  clear(seriesId?: string): void;
  removeSeries(id: string): boolean;
  setResourceMode(mode: "normal" | "balanced" | "constrained"): void;
  setSeriesVisible(id: string, visible: boolean): boolean;
  toggleSeries(id: string): boolean;
  setView(view: GuiChartView | null): void;
  resetView(): void;
  setCursor(cursor?: Partial<{ x: number; pinned: boolean; rangeStart: number; rangeEnd: number }>): void;
  setAnnotations(annotations: GuiChartAnnotation[]): void;
  addAnnotation(annotation: GuiChartAnnotation): string;
  removeAnnotation(id: string): boolean;
  setThresholds(thresholds: GuiChartThreshold[]): void;
  addDerivedSeries(configuration: GuiChartSeries & {
    source?: string; compare?: string; sources?: string[];
    operation?: "moving-average" | "derivative" | "integral" | "difference" | string; window?: number;
  }): string;
  analyzeAsync(seriesId: string, options?: { signal?: AbortSignal }): Promise<GuiChartStatistics>;
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
  commands: import("./modules/commands/index.js").GuiCommandRegistry;
  history: import("./modules/commands/index.js").GuiHistory;
  persistence: import("./modules/runtime/index.js").GuiPersistenceStore;
  router: import("./modules/runtime/index.js").GuiRouter;
  tasks: import("./modules/runtime/index.js").GuiTaskManager;
  clipboard: import("./modules/runtime/index.js").GuiClipboard;
  capabilities: import("./modules/runtime/index.js").GuiCapabilityRegistry;
  diagnostics: import("./modules/runtime/index.js").GuiDiagnostics;
  dragDrop: import("./modules/runtime/index.js").GuiDragDrop;
  frameScheduler: import("./modules/performance/index.js").GuiFrameScheduler;
  performanceBudget: import("./modules/performance/index.js").GuiPerformanceBudget;
  lazyModules: import("./modules/performance/index.js").GuiLazyModuleLoader;
  resourceGovernor: import("./modules/performance/index.js").GuiResourceGovernor;
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
  GuiNodeConnectionRoute,
  GuiNodeDefinition,
  GuiNodeEditor,
  GuiNodeFlowDirection,
  GuiNodeGraph,
  GuiNodeGraphData,
  GuiNodeLink,
  GuiNodeParameter,
  GuiNodeParameterOption,
  GuiNodeParameterType,
  GuiNodePort,
  GuiNodePortDirection,
  GuiNodeRoutingObstacle,
  GuiNodeRoutingOptions,
  GuiNodeRoutingPoint,
  GuiNodeWireType,
  GuiNodeWireTypeDefinition,
  nodeEditorModule,
  routeNodeConnection,
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
  GuiStatusbar,
  GuiStatusbarItem,
  GuiStatusbarItemAlignment,
  GuiStatusbarItemPriority,
  GuiStatusbarItemType,
  GuiStatusbarItemVariant,
  GuiStatusbarLive,
  GuiStatusbarPosition,
  GuiStatusbarUpdateOptions,
  statusbarModule,
} from "./modules/statusbar/index.js";

export {
  GuiWizard,
  GuiWizardModel,
  GuiWizardNavigationOptions,
  GuiWizardState,
  GuiWizardStep,
  GuiWizardStepDefinition,
  GuiWizardStepStatePatch,
  GuiWizardValidationContext,
  GuiWizardValidationResult,
  GuiWizardValidator,
  wizardModule,
} from "./modules/wizard/index.js";

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

export * from "./modules/commands/index.js";
export * from "./modules/overlays/index.js";
export * from "./modules/runtime/index.js";
export * from "./modules/forms/index.js";
export * from "./modules/data-views/index.js";
export * from "./modules/workspace/index.js";
export * from "./modules/devtools/index.js";
export * from "./modules/performance/index.js";
export * from "./modules/editors/index.js";

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
      commands: import("./modules/commands/index.js").GuiCommandRegistry;
      history: import("./modules/commands/index.js").GuiHistory;
      persistence: import("./modules/runtime/index.js").GuiPersistenceStore;
      router: import("./modules/runtime/index.js").GuiRouter;
      tasks: import("./modules/runtime/index.js").GuiTaskManager;
      clipboard: import("./modules/runtime/index.js").GuiClipboard;
      capabilities: import("./modules/runtime/index.js").GuiCapabilityRegistry;
      diagnostics: import("./modules/runtime/index.js").GuiDiagnostics;
      dragDrop: import("./modules/runtime/index.js").GuiDragDrop;
      frameScheduler: import("./modules/performance/index.js").GuiFrameScheduler;
      performanceBudget: import("./modules/performance/index.js").GuiPerformanceBudget;
      lazyModules: import("./modules/performance/index.js").GuiLazyModuleLoader;
      resourceGovernor: import("./modules/performance/index.js").GuiResourceGovernor;
      overlayController: import("./modules/overlays/index.js").GuiOverlayController;
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
    "gui-command-palette": import("./modules/commands/index.js").GuiCommandPalette;
    "gui-dialog": import("./modules/overlays/index.js").GuiDialog;
    "gui-popover": import("./modules/overlays/index.js").GuiPopover;
    "gui-context-menu": import("./modules/overlays/index.js").GuiContextMenu;
    "gui-menu": import("./modules/overlays/index.js").GuiMenu;
    "gui-tooltip": import("./modules/overlays/index.js").GuiTooltip;
    "gui-task-center": import("./modules/runtime/index.js").GuiTaskCenter;
    "gui-form": import("./modules/forms/index.js").GuiForm;
    "gui-virtual-list": import("./modules/data-views/index.js").GuiVirtualList;
    "gui-data-grid": import("./modules/data-views/index.js").GuiDataGrid;
    "gui-tree-view": import("./modules/data-views/index.js").GuiTreeView;
    "gui-workspace": import("./modules/workspace/index.js").GuiWorkspace;
    "gui-component-playground": import("./modules/devtools/index.js").GuiComponentPlayground;
    "gui-diagnostics-panel": import("./modules/devtools/index.js").GuiDiagnosticsPanel;
  }
}
