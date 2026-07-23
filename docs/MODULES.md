# Building GuiKit modules

This document is the contributor contract for adding a feature without having
to understand the entire codebase.

## Generate the module

```powershell
npm run create:module -- command-palette
```

To choose a different custom-element name:

```powershell
npm run create:module -- command-palette --component gui-command-menu
```

The generator creates implementation, declaration, documentation, and test
files and adds a package subpath export. It refuses to overwrite an existing
module.

## Directory contract

```text
src/modules/<module-id>/
  index.js       implementation and module manifest
  index.d.ts     complete public TypeScript contract
  README.md      focused usage and maintenance notes
test/
  <module-id>.test.js
```

Large modules may add private files inside their directory:

```text
src/modules/data-grid/
  index.js
  index.d.ts
  model.js
  render.js
  styles.js
  README.md
```

Only `index.js` is public. Private files may change without a versioned API
commitment.

## Module manifest

Every feature exports one manifest:

```js
export const commandPaletteModule = {
  id: "command-palette",
  version: "0.1.0",
  description: "Keyboard-first command discovery and execution.",
  dependencies: ["core"],
  components: ["gui-command-menu"],
  setup({ dependencies }) {
    // Register elements, event adapters, or services.
    return { CommandService };
  },
};
```

Rules:

- `id` is lowercase kebab-case and globally unique.
- `version` follows semantic versioning for that module's public API.
- `description` states one responsibility.
- `dependencies` contains module ids, never filesystem paths.
- `components` lists every custom element owned by the module.
- `setup` is idempotent and returns the module's runtime service, if any.

The registry initializes dependencies before dependents, detects cycles, and
caches setup results.

```js
import { defineGuiModule, guiModules } from "@gui-template/core/modules";
import { commandPaletteModule } from "./command-palette/index.js";

defineGuiModule(commandPaletteModule);
await guiModules.initialize("command-palette", applicationContext);
```

## Component API rules

Use the same shape across features:

- attributes for serializable, declarative configuration;
- properties for live objects or frequently changed state;
- methods for explicit commands;
- `gui:` DOM events for observable results;
- cancelable `*-request` events before user-controlled mutations;
- `textContent` for untrusted strings;
- CSS variables for visual customization;
- native elements and ARIA patterns before custom interaction code.

Public events must bubble and cross shadow boundaries:

```js
this.dispatchEvent(new CustomEvent("gui:item-change", {
  bubbles: true,
  composed: true,
  detail: { value },
}));
```

Use a cancelable request event when the application must be able to veto an
operation:

```js
const allowed = this.dispatchEvent(new CustomEvent("gui:item-remove-request", {
  bubbles: true,
  cancelable: true,
  composed: true,
  detail: { id },
}));
if (!allowed) return;
```

## Model and view separation

If a feature has meaningful data rules, put them in a DOM-independent model.
The node editor's `GuiNodeGraph` is the reference implementation. This makes:

- validation testable with `node --test`;
- serialization independent of rendering;
- Python and C# hosts able to share the same schema;
- alternate renderers possible later.

The component owns gestures and presentation. The model owns invariants.

## Styling

Consume semantic GuiKit tokens instead of hardcoded application colors:

```css
:host {
  color: var(--gui-text);
  background: var(--gui-surface);
  border-color: var(--gui-border);
}
```

Module-specific tokens should start with `--gui-<module-id>-`. Shadow DOM is
appropriate for implementation-only markup. Use light DOM when applications
must compose or style child content.

Always include reduced-motion behavior for animation.

## Localization

Reusable modules do not import application locale files. Visible default text
must be configurable through attributes or properties. The showcase can add
module examples to `locales/*.json`.

## Required documentation

Before merging, document:

1. responsibility and non-goals;
2. public attributes, properties, methods, and events;
3. data schema and serialization;
4. keyboard and accessibility behavior;
5. performance limits;
6. one minimal usage example;
7. migration notes for breaking changes.

## Required checks

```powershell
npm run check
```

Additionally verify interactive components at narrow and wide sizes, with
keyboard-only input, dark mode, and reduced motion. Update `CHANGELOG.md` and
the root API documentation when a module is included in the default bundle.

## Completion checklist

- [ ] Generated module directory retained its standard layout
- [ ] DOM-independent rules have unit tests
- [ ] Public types match runtime behavior
- [ ] No unbounded queues, timers, or retained event listeners
- [ ] All user-controlled strings use safe DOM assignment
- [ ] Keyboard and focus behavior documented
- [ ] Reduced motion supported
- [ ] Package export present
- [ ] Changelog entry added
