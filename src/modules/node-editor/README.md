# Node editor module

`<gui-node-editor>` is an interactive, dependency-free graph editor inspired
by the node-editor workflow in Dear PyGui.

It supports:

- draggable and keyboard-movable nodes;
- typed input and output ports;
- horizontal or vertical flow with direction-aware port placement;
- foreground rounded orthogonal links routed around node surfaces;
- configurable typed wire colors, widths, opacity, and dash patterns;
- per-port and per-node connection limits;
- cancelable double-click wire deletion;
- click and keyboard selection;
- Delete/Backspace removal;
- pan, zoom, grid snapping, and fit-to-view;
- graph serialization;
- inline text, number, range, select, boolean, and read-only parameters;
- per-node settings dialog with extensible open and save events;
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
  routeNodeConnection,
} from "@gui-template/core/node-editor";
```

See [the node-editor API](../../../docs/NODE_EDITOR.md) for graph schemas,
direction settings, routing geometry, events, and integration examples.
