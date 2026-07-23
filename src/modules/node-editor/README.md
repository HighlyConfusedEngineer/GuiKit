# Node editor module

`<gui-node-editor>` is an interactive, dependency-free graph editor inspired
by the node-editor workflow in Dear PyGui.

It supports:

- draggable and keyboard-movable nodes;
- typed input and output ports;
- validated Bézier links;
- click and keyboard selection;
- Delete/Backspace removal;
- pan, zoom, grid snapping, and fit-to-view;
- graph serialization;
- cancellable connection requests;
- read-only mode;
- light, dark, and reduced-motion integration.

Import the complete library:

```js
import { GuiNodeEditor, GuiNodeGraph } from "@gui-template/core";
```

Or import only this module:

```js
import {
  GuiNodeEditor,
  GuiNodeGraph,
} from "@gui-template/core/node-editor";
```

See [the node-editor API](../../../docs/NODE_EDITOR.md) for graph schemas,
events, and integration examples.
