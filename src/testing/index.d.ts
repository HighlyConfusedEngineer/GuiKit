export function createBridgeMock(handlers?: Record<string, (payload: unknown) => unknown | Promise<unknown>>): { calls: Array<{ method: string; payload: unknown }>; invoke(method: string, payload: unknown): Promise<unknown>; };
export function createGuiTestHost(): { target: EventTarget; events: Array<{ type: string; detail: unknown }>; emit(type: string, detail?: unknown): Event; };
export function waitForGuiEvent(target: EventTarget, type: string, options?: { signal?: AbortSignal; timeout?: number }): Promise<Event>;
export function waitForTransition(target: EventTarget, options?: { timeout?: number }): Promise<void>;
