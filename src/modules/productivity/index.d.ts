export interface GuiComboboxOption { value: string; label?: string; description?: string; disabled?: boolean; keywords?: string[]; }
export class GuiComboboxModel extends EventTarget {
  constructor(options?: { multiple?: boolean; options?: Array<GuiComboboxOption | string>; value?: string | string[] | null; loader?: (query: string, context: { signal?: AbortSignal }) => Promise<Array<GuiComboboxOption | string>> | Array<GuiComboboxOption | string> });
  readonly multiple: boolean; readonly options: GuiComboboxOption[]; readonly value: string | string[] | null;
  setOptions(options: Array<GuiComboboxOption | string>): void; setLoader(loader?: (query: string, context: { signal?: AbortSignal }) => Promise<Array<GuiComboboxOption | string>> | Array<GuiComboboxOption | string>): void;
  query(query?: string, options?: { remote?: boolean; signal?: AbortSignal }): Promise<GuiComboboxOption[]>;
  setValue(value: string | string[] | null, options?: { source?: string }): boolean; toggle(value: string, options?: { source?: string }): boolean;
}
export class GuiScheduleModel extends EventTarget {
  constructor(options?: { range?: { start?: string; end?: string; timeZone?: string }; events?: GuiScheduleEvent[] });
  readonly range: { start: string; end: string; timeZone: string }; readonly events: GuiScheduleEvent[];
  setRange(range: { start?: string; end?: string; timeZone?: string }): void; setEvents(events: GuiScheduleEvent[]): void;
  upsert(event: GuiScheduleEvent, options?: { silent?: boolean }): boolean; remove(id: string): boolean; between(start?: string, end?: string): GuiScheduleEvent[];
}
export interface GuiScheduleEvent { id: string; title?: string; start: string | Date; end?: string | Date; allDay?: boolean; data?: unknown; }
export function analysisHistogram(values: Array<number | { y?: number }>, bins?: number): Array<{ x0: number; x1: number; count: number }>;
export function heatmap(values: Array<number | { row?: number; column?: number; value?: number; y?: number }>, options?: { rows?: number; columns?: number }): Array<{ row: number; column: number; value: number; count: number }>;
export class GuiAnalysisSeries extends EventTarget { set(id: string, samples: Array<number | { x?: number; y?: number; value?: number }>, options?: { label?: string; color?: string }): void; get(id: string): { id: string; label: string; color: string; samples: Array<{ x: number; y: number }> } | undefined; list(): Array<{ id: string; label: string; color: string; samples: Array<{ x: number; y: number }> }>; remove(id: string): boolean; }
export class GuiPropertyGridModel extends EventTarget { constructor(value?: Record<string, unknown>, schema?: Array<{ path: string; label?: string; type?: string; value?: unknown; readonly?: boolean; min?: number; max?: number; options?: Array<string | { value: string; label?: string }> }>); readonly value: Record<string, unknown>; readonly schema: Array<Record<string, unknown>>; set(value: Record<string, unknown>, schema?: Array<Record<string, unknown>>): void; update(path: string, value: unknown, options?: { source?: string }): boolean; }
export class GuiUploadQueue extends EventTarget { constructor(options?: { accept?: string[]; maxFiles?: number; maxSize?: number }); readonly items: Array<{ id: string; name: string; size: number; type: string; progress: number; status: string; offset: number; error: string | null }>; add(files: Iterable<File>): unknown[]; remove(id: string): boolean; upload(adapter: { upload(file: File, context: { id: string; offset: number; signal?: AbortSignal; onProgress(loaded: number): void }): Promise<unknown> }, options?: { ids?: string[]; signal?: AbortSignal }): Promise<unknown[]>; }
export class GuiNotificationCenter extends EventTarget { constructor(items?: Array<Record<string, unknown>>); readonly items: Array<Record<string, unknown>>; readonly unread: number; push(item: Record<string, unknown>): string; markRead(ids?: Iterable<string>): void; remove(id: string): boolean; clear(options?: { unreadOnly?: boolean }): void; toJSON(): { items: Array<Record<string, unknown>> }; }
export class GuiShortcutProfiles extends EventTarget { constructor(profiles?: Record<string, Record<string, string>>); readonly active: string; list(): string[]; bindings(id?: string): Record<string, string>; save(id: string, bindings: Record<string, string>): void; activate(id: string, registry?: { bind(command: string, shortcut: string): string }): void; apply(registry: { bind(command: string, shortcut: string): string }): Record<string, string>; toJSON(): { active: string; profiles: Record<string, Record<string, string>> }; }
export class GuiCombobox extends HTMLElement { model: GuiComboboxModel; value: string | string[] | null; options: GuiComboboxOption[]; }
export class GuiDateRangePicker extends HTMLElement { model: GuiScheduleModel; value: { start: string; end: string; timeZone: string }; }
export class GuiScheduler extends HTMLElement { model: GuiScheduleModel; }
export class GuiAnalysisChart extends HTMLElement { series: GuiAnalysisSeries; setData(id: string, samples: Array<number | { x?: number; y?: number }>, options?: { label?: string; color?: string }): void; }
export class GuiPropertyGrid extends HTMLElement { model: GuiPropertyGridModel; value: Record<string, unknown>; }
export class GuiFileDrop extends HTMLElement { queue: GuiUploadQueue; readonly files: GuiUploadQueue["items"]; }
export class GuiNotificationCenterElement extends HTMLElement { center: GuiNotificationCenter; }
export class GuiShortcutEditor extends HTMLElement { profiles: GuiShortcutProfiles; registry?: unknown; }
export const productivityModule: Readonly<{ id: "productivity"; version: "0.2.0"; description: string; dependencies: readonly ["commands"]; components: readonly string[]; setup(): Record<string, unknown> }>;
