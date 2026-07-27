function guiEvent(type, detail) {
  if (typeof CustomEvent !== "undefined") return new CustomEvent(type, { detail });
  const event = new Event(type); Object.defineProperty(event, "detail", { value: detail }); return event;
}

export function createBridgeMock(handlers = {}) {
  const calls = [];
  return {
    calls,
    async invoke(method, payload) {
      calls.push({ method, payload });
      const handler = handlers[method];
      if (!handler) throw new Error(`No bridge mock handler for ${method}`);
      return handler(payload);
    },
  };
}

export function createGuiTestHost() {
  const target = new EventTarget();
  const events = [];
  const emit = (type, detail) => { const event = guiEvent(type, detail); events.push({ type, detail }); target.dispatchEvent(event); return event; };
  return { target, events, emit };
}

export function waitForGuiEvent(target, type, { signal, timeout = 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { target.removeEventListener(type, onEvent); signal?.removeEventListener("abort", onAbort); clearTimeout(timer); };
    const onEvent = (event) => { cleanup(); resolve(event); };
    const onAbort = () => { cleanup(); reject(signal.reason ?? new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for ${type}`)); }, timeout);
    target.addEventListener(type, onEvent, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForTransition(target, { timeout = 500 } = {}) {
  if (!target?.addEventListener) return;
  try { await waitForGuiEvent(target, "transitionend", { timeout }); } catch (error) { if (!/Timed out/.test(error.message)) throw error; }
}
