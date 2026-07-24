export interface GuiModuleContext {
  module: GuiModuleManifest;
  modules: GuiModuleRegistry;
  dependencies: Map<string, unknown>;
  [key: string]: unknown;
}

export interface GuiModuleManifest {
  id: string;
  version: string;
  description?: string;
  dependencies?: string[];
  components?: string[];
  setup?: (context: GuiModuleContext) => unknown | Promise<unknown>;
}

export class GuiModuleRegistry {
  register(manifest: GuiModuleManifest): Readonly<GuiModuleManifest>;
  registerLazy(id: string, loader: () => Promise<GuiModuleManifest | { default: GuiModuleManifest }> | GuiModuleManifest | { default: GuiModuleManifest }): string;
  load(id: string): Promise<GuiModuleManifest | undefined>;
  has(id: string): boolean;
  get(id: string): Readonly<GuiModuleManifest> | undefined;
  state(id: string): "missing" | "registered" | "initializing" | "initialized" | "failed";
  list(): Readonly<GuiModuleManifest>[];
  initialize(id: string, context?: Record<string, unknown>): Promise<unknown>;
  initializeAll(context?: Record<string, unknown>): Promise<Map<string, unknown>>;
  resetForTests(): void;
}

export const guiModules: GuiModuleRegistry;
export function defineGuiModule(
  manifest: GuiModuleManifest,
  registry?: GuiModuleRegistry,
): Readonly<GuiModuleManifest>;
