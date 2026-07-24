# GuiKit modules

Each subdirectory is a self-contained feature with implementation, public
types, focused documentation, and tests.

Start with [the module authoring guide](../../docs/MODULES.md), or generate a
new module:

```powershell
npm run create:module -- my-feature
```

Current reference module:

- [`node-editor`](node-editor/) demonstrates a DOM-independent model, custom
  element, cancelable request events, shadow-DOM styling, serialization,
  accessibility, and package subpath export.
- [`media-player`](media-player/) demonstrates browser capability detection,
  live object properties, async resource cleanup, adapter registration,
  responsive controls, and media accessibility.
- [`statusbar`](statusbar/) demonstrates keyed live updates, responsive item
  priority, named slots, action events, and configurable viewport placement.
