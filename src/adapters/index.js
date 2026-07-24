function assignSerializable(element, properties = {}) {
  for (const [name, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (name.startsWith("on") && typeof value === "function") continue;
    if (name in element && typeof value !== "function") element[name] = value;
    else if (typeof value === "boolean") element.toggleAttribute(name, value);
    else if (value == null) element.removeAttribute(name);
    else if (typeof value !== "object") element.setAttribute(name, String(value));
  }
}

export function bindGuiEvents(element, handlers = {}) {
  const listeners = [];
  for (const [eventName, handler] of Object.entries(handlers)) {
    if (typeof handler !== "function") continue;
    const name = eventName.startsWith("gui:")
      ? eventName
      : `gui:${eventName.replace(/^onGui/, "").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, "")}`;
    element.addEventListener(name, handler);
    listeners.push([name, handler]);
  }
  return () => listeners.forEach(([name, handler]) => element.removeEventListener(name, handler));
}

export function createReactComponent(React, tagName, eventMap = {}) {
  if (!React?.createElement || !React?.forwardRef) {
    throw new TypeError("createReactComponent requires a React-compatible runtime.");
  }
  return React.forwardRef(function GuiKitReactComponent(properties, forwardedRef) {
    const localRef = React.useRef(null);
    React.useImperativeHandle(forwardedRef, () => localRef.current);
    React.useLayoutEffect(() => {
      const element = localRef.current;
      if (!element) return undefined;
      assignSerializable(element, properties);
      return bindGuiEvents(element, Object.fromEntries(
        Object.entries(eventMap).map(([property, event]) => [event, properties[property]]),
      ));
    }, [properties]);
    const attributes = {};
    for (const [name, value] of Object.entries(properties)) {
      if (name === "children" || name in eventMap || typeof value === "object" || typeof value === "function") continue;
      attributes[name] = value;
    }
    return React.createElement(tagName, { ...attributes, ref: localRef }, properties.children);
  });
}

export function createVuePlugin(options = {}) {
  const prefix = options.prefix ?? "Gui";
  const tags = options.tags ?? [
    "gui-tabs", "gui-sidebar", "gui-pages", "gui-live-chart", "gui-node-editor",
    "gui-media-player", "gui-statusbar", "gui-wizard", "gui-form", "gui-data-grid",
    "gui-tree-view", "gui-workspace",
  ];
  return {
    install(app) {
      for (const tag of tags) {
        const name = `${prefix}${tag.slice(4).split("-").map((part) => (
          part[0].toUpperCase() + part.slice(1)
        )).join("")}`;
        app.component(name, {
          inheritAttrs: false,
          mounted() { assignSerializable(this.$el, this.$attrs); },
          updated() { assignSerializable(this.$el, this.$attrs); },
          render() {
            return globalThis.Vue?.h
              ? globalThis.Vue.h(tag, this.$attrs, this.$slots)
              : null;
          },
        });
      }
    },
  };
}

export class GuiNativeController {
  #bridge;
  constructor(bridge) {
    this.#bridge = bridge;
  }
  invoke(command, payload = {}, options) {
    return this.#bridge.invoke("guikit.command", { command, payload }, options);
  }
  saveState(key, value, options) {
    return this.#bridge.invoke("guikit.state.save", { key, value }, options);
  }
  loadState(key, options) {
    return this.#bridge.invoke("guikit.state.load", { key }, options);
  }
  runTask(id, payload = {}, options) {
    return this.#bridge.invoke("guikit.task.run", { id, payload }, options);
  }
}

export function defineGuiKitElements() {
  return import("../gui.js");
}
