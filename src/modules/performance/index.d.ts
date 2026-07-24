export interface GuiPerformanceSample { name: string; duration: number; budget?: number; exceeded: boolean; detail?: unknown; }
export class GuiFrameScheduler {
  readonly pending: number;
  schedule(key: string, task: () => void): () => boolean;
  flush(): number;
}
export class GuiPerformanceBudget extends EventTarget {
  constructor(options?: { maxSamples?: number; budgets?: Record<string, number> });
  maxSamples: number;
  budgets: Map<string, number>;
  setBudget(name: string, milliseconds: number): this;
  record(name: string, milliseconds: number, detail?: unknown): GuiPerformanceSample;
  measure<T>(name: string, callback: () => T, detail?: unknown): T;
  snapshot(name?: string): Record<string, unknown>;
}
export class GuiLazyModuleLoader extends EventTarget {
  register(id: string, loader: () => Promise<unknown> | unknown): this;
  has(id: string): boolean;
  loaded(id: string): boolean;
  load<T = unknown>(id: string): Promise<T>;
}
export class GuiSignalStore<State extends Record<string, unknown> = Record<string, unknown>> extends EventTarget {
  constructor(initialState?: State);
  getState(): State;
  setState(patch: Partial<State> | ((state: State) => State)): State;
  select<Value>(selector: (state: State) => Value, listener: (value: Value, previous: Value | undefined) => void, options?: { equal?: (a: Value, b: Value) => boolean; immediate?: boolean }): () => boolean;
}
export class GuiResourceGovernor extends EventTarget {
  readonly mode: "normal" | "balanced" | "constrained";
  register(id: string, apply: (mode: "normal" | "balanced" | "constrained", previous?: string, id?: string) => void): () => boolean;
  setMode(mode: "normal" | "balanced" | "constrained"): boolean;
}
export const frameScheduler: GuiFrameScheduler;
export const performanceBudget: GuiPerformanceBudget;
export const lazyModules: GuiLazyModuleLoader;
export const resourceGovernor: GuiResourceGovernor;
export const performanceModule: Readonly<{ id: "performance"; version: "0.1.0"; description: string; dependencies: readonly ["core"]; setup(context?: unknown): Record<string, unknown> }>;
