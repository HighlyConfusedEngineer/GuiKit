# Node editor

`<gui-node-editor>` is a dependency-free visual graph editor inspired by Dear
PyGui's node-editor workflow. It separates graph validation from browser
interaction through the `GuiNodeGraph` model.

## Quick start

```html
<gui-node-editor
  id="pipeline"
  snap="16"
  grid-size="24"
  label="Image processing pipeline">
</gui-node-editor>
```

```js
import { GuiNodeGraph } from "@gui-template/core/node-editor";

const editor = document.querySelector("#pipeline");
editor.setGraph({
  nodes: [
    {
      id: "source",
      title: "Source",
      x: 0,
      y: 80,
      outputs: [{ id: "source:image", label: "Image", type: "image" }],
    },
    {
      id: "preview",
      title: "Preview",
      x: 320,
      y: 80,
      inputs: [{ id: "preview:image", label: "Image", type: "image" }],
    },
  ],
  links: [
    { id: "preview-link", from: "source:image", to: "preview:image" },
  ],
});
```

## Graph schema

Nodes require a globally unique `id`. Ports also use globally unique ids.

```js
{
  id: "filter",
  title: "Edge filter",
  type: "process",
  description: "Detects high-contrast edges.",
  color: "#8b5cf6",
  x: 320,
  y: 120,
  width: 220,
  inputs: [
    { id: "filter:image", label: "Image", type: "image", maxLinks: 1 },
  ],
  outputs: [
    { id: "filter:result", label: "Result", type: "image" },
  ],
  data: { strength: 0.8 },
}
```

Port types must match unless either side uses `type: "any"`. Inputs accept one
link by default; connecting a new output replaces the old input link. Set
`maxLinks` to change the limit.

Links are directed from an output to an input:

```js
{ id: "edge-result", from: "filter:result", to: "preview:image" }
```

Node `data` and link `data` should remain structured-clone-compatible so
`getGraph()` can be serialized and sent through the native bridge.

## Component API

Attributes:

| Attribute | Default | Meaning |
| --- | --- | --- |
| `label` | `Node editor` | Accessible editor name |
| `readonly` | absent | Prevent graph mutations while retaining navigation |
| `grid-size` | `24` | Visual grid size in graph units |
| `snap` | absent | Enable node snapping; empty uses the grid size |
| `min-zoom` | `0.25` | Minimum viewport zoom |
| `max-zoom` | `2.5` | Maximum viewport zoom |

Important methods:

- `setGraph(graph)` replaces the graph.
- `getGraph()` returns a serializable snapshot.
- `addNode(node)`, `updateNode(id, patch)`, and `removeNode(id)`.
- `connect(from, to, options)` and `disconnect(id)`.
- `selectNode(id, additive?)`, `selectLink(id)`, and `clearSelection()`.
- `setView({ x, y, zoom })` and `zoomToFit(padding?)`.
- `clear()` removes all nodes and links.

## Events

| Event | Cancelable | Detail |
| --- | --- | --- |
| `gui:node-connect-request` | yes | `{ from, to, options }` |
| `gui:node-connect` | no | `{ link }` |
| `gui:node-disconnect` | no | `{ link }` |
| `gui:node-move` | no | `{ node }` |
| `gui:node-select` | no | `{ nodes, link }` |
| `gui:node-create-request` | no | `{ position }` |
| `gui:node-error` | no | `{ operation, error }` |
| `gui:graph-change` | no | `{ operation, graph, ... }` |

Applications can veto a connection:

```js
editor.addEventListener("gui:node-connect-request", (event) => {
  if (!userCanEdit()) event.preventDefault();
});
```

Double-clicking empty space emits a creation request rather than inventing a
domain-specific node. The application decides which node type to add.

## Interaction

- Drag empty space to pan.
- Use the mouse wheel or toolbar to zoom.
- Drag a node header to move it.
- Drag one port to a compatible opposite-direction port to connect.
- Click a node or link to select it.
- Ctrl/Cmd-click nodes for additive selection.
- Delete or Backspace removes the selection.
- Arrow keys move selected nodes; Shift moves by ten increments.
- Ctrl/Cmd+A selects all nodes.
- Escape clears selection.
- Double-click empty space requests node creation.

## Graph model

`GuiNodeGraph` contains all structural invariants without touching the DOM:

```js
const graph = new GuiNodeGraph();
graph.addNode(source);
graph.addNode(preview);
graph.connect("source:image", "preview:image");

const snapshot = graph.toJSON();
```

Use the model in host-side tests, import pipelines, undo/redo commands, or
alternate renderers.

## Performance boundary

The editor rerenders node markup for structural changes and updates only
transforms and link paths while dragging. It is intended for interactive
workflows with tens to hundreds of visible nodes. For very large graphs,
partition the workflow into subgraphs or add viewport virtualization as a
separate module.
