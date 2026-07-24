# Node editor

`<gui-node-editor>` is a dependency-free visual graph editor inspired by Dear
PyGui's node-editor workflow. It separates graph validation from browser
interaction through the `GuiNodeGraph` model.

## Quick start

```html
<gui-node-editor
  id="pipeline"
  flow-direction="horizontal"
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
  allowMultipleConnections: false,
  maxConnections: 3,
  inputs: [
    { id: "filter:image", label: "Image", type: "image", maxLinks: 1 },
  ],
  outputs: [
    { id: "filter:result", label: "Result", type: "image" },
  ],
  parameters: [
    {
      id: "strength",
      label: "Strength",
      type: "range",
      value: 0.8,
      min: 0,
      max: 1,
      step: 0.05,
      inline: true,
    },
    {
      id: "algorithm",
      label: "Algorithm",
      type: "select",
      value: "sobel",
      options: ["sobel", "canny"],
      inline: true,
    },
  ],
  data: { strength: 0.8 },
}
```

Port types must match unless either side uses `type: "any"`. Inputs accept one
link by default; connecting a new output replaces the old input link. Set
`maxLinks` to change the limit.

Set `allowMultipleConnections: false` on a node to cap each of its ports at one
link without rewriting the individual port definitions. Set `maxConnections`
to a non-negative number to limit all incoming and outgoing links on that node
in total. Both policies are checked transactionally before an existing input
link is replaced.

Links are directed from an output to an input. Their `type` is resolved from
the compatible endpoint ports:

```js
{
  id: "edge-result",
  from: "filter:result",
  to: "preview:image",
  type: "digital",
}
```

Node `data` and link `data` should remain structured-clone-compatible so
`getGraph()` can be serialized and sent through the native bridge.

### Inline parameters

Use a node's `parameters` array for values that belong to that node. Set
`inline: true` only on the parameters users should see directly on its surface;
the remaining parameters stay in the graph data for an inspector or backend.
Parameter ids need only be unique within their node.

| Type | Value and presentation |
| --- | --- |
| `text` | Single-line text input |
| `number` | Numeric input with optional `min`, `max`, `step`, and `unit` |
| `range` | Slider with a live value; defaults to 0–100 |
| `select` | Select using string/number values or `{ value, label, disabled }` options |
| `boolean` | Checkbox |
| `readonly` | Non-editable text or serialized structured value |

Set `disabled: true` to show an individual control without allowing edits.
`description` becomes its tooltip. Parameter changes are normalized before
they enter the graph: numeric values are bounded, booleans are coerced, and an
invalid select value falls back to the first enabled option.

## Component API

Attributes:

| Attribute | Default | Meaning |
| --- | --- | --- |
| `label` | `Node editor` | Accessible editor name |
| `readonly` | absent | Prevent graph mutations while retaining navigation |
| `flow-direction` | `horizontal` | Port placement and primary link direction: `horizontal` or `vertical` |
| `grid-size` | `24` | Visual grid size in graph units |
| `snap` | absent | Enable node snapping; empty uses the grid size |
| `min-zoom` | `0.25` | Minimum viewport zoom |
| `max-zoom` | `2.5` | Maximum viewport zoom |

Important methods:

- `setGraph(graph)` replaces the graph.
- `getGraph()` returns a serializable snapshot.
- `addNode(node)`, `updateNode(id, patch)`, and `removeNode(id)`.
- `getNodeParameter(nodeId, parameterId)` returns a detached parameter definition.
- `setNodeParameter(nodeId, parameterId, value)` validates and updates a value.
- `connect(from, to, options)` and `disconnect(id)`.
- `setWireTypes(definitions)`, `registerWireType(type, definition)`, and
  `getWireType(type)`.
- `selectNode(id, additive?)`, `selectLink(id)`, and `clearSelection()`.
- `openNodeSettings(id)` opens the built-in settings dialog.
- `closeNodeSettings()` closes the settings dialog.
- `setView({ x, y, zoom })` and `zoomToFit(padding?)`.
- `clear()` removes all nodes and links.

The `flowDirection` property reflects `flow-direction`, so applications can
switch direction without rebuilding the component:

```js
editor.flowDirection = "vertical";
```

Changing direction does not rewrite graph coordinates. This keeps persisted
layouts stable and lets the application decide whether to retain, transpose,
or auto-layout node positions.

## Link routing

Connections use rounded orthogonal routing. The editor measures every visible
node, expands its rectangle by a clearance margin, and finds the shortest
available horizontal/vertical channel. Endpoint cards participate once their
port stub reaches the exterior, which keeps backward and loop-like layouts from
crossing their own nodes.

The SVG connection layer is painted above node surfaces. Combined with obstacle
routing, this ensures a wire cannot disappear beneath a card while ports remain
clear connection anchors.

Horizontal flow places inputs on the left and outputs on the right. Vertical
flow places inputs at the top and outputs at the bottom. Drag previews use the
same router as committed links.

`routeNodeConnection()` exposes the DOM-independent geometry helper for custom
renderers and tests:

```js
import { routeNodeConnection } from "@gui-template/core/node-editor";

const route = routeNodeConnection(
  { x: 20, y: 80 },
  { x: 420, y: 80 },
  {
    flowDirection: "horizontal",
    obstacles: [{ x: 160, y: 20, width: 140, height: 120 }],
    clearance: 18,
  },
);

svgPath.setAttribute("d", route.path);
```

The result contains `direction`, simplified `points`, the SVG `path`, and a
`routed` flag. Router inputs use graph/world coordinates. Obstacles accept
either `{ x, y, width, height }` or `{ left, top, right, bottom }`.

## Typed wires

Port `type` controls compatibility and the resolved link type. A wire palette
controls presentation separately, so changing a color never weakens graph
validation:

```js
editor.setWireTypes({
  analog: {
    label: "Analog signal",
    color: "#ef4444",
    width: 3.5,
  },
  digital: {
    label: "Digital signal",
    color: "#3b82f6",
    width: 3,
    dash: [8, 4],
  },
});
```

An `analog` output connects only to an `analog` or `any` input; a `digital`
output connects only to a `digital` or `any` input. Wire definitions accept
`label`, CSS `color`, `width`, `opacity`, and a string or numeric-array `dash`.
Unknown types use the theme accent without requiring registration. Port anchors
use the same configured color as their wire.

## Events

| Event | Cancelable | Detail |
| --- | --- | --- |
| `gui:node-connect-request` | yes | `{ from, to, options }` |
| `gui:node-connect` | no | `{ link }` |
| `gui:node-disconnect-request` | yes | `{ link, reason }` |
| `gui:node-disconnect` | no | `{ link, reason }` |
| `gui:node-move` | no | `{ node }` |
| `gui:node-select` | no | `{ nodes, link }` |
| `gui:node-create-request` | no | `{ position }` |
| `gui:node-settings-request` | yes | `{ node }` |
| `gui:node-settings-open` | no | `{ node }` |
| `gui:node-settings-save-request` | yes | `{ node, patch }` |
| `gui:node-settings-save` | no | `{ node, previous, patch }` |
| `gui:node-settings-close` | no | `{ node, reason }` |
| `gui:node-parameter-change-request` | yes | `{ node, parameter, value, previousValue }` |
| `gui:node-parameter-change` | no | `{ node, parameter, value, previousValue }` |
| `gui:node-error` | no | `{ operation, error }` |
| `gui:graph-change` | no | `{ operation, graph, ... }` |

Applications can veto a connection:

```js
editor.addEventListener("gui:node-connect-request", (event) => {
  if (!userCanEdit()) event.preventDefault();
});
```

Wire removal can be protected in the same way:

```js
editor.addEventListener("gui:node-disconnect-request", (event) => {
  if (event.detail.link.data?.locked) event.preventDefault();
});
```

The reason is `double-click`, `keyboard`, or `api`.

Double-clicking empty space emits a creation request rather than inventing a
domain-specific node. The application decides which node type to add.

## Node settings

Every node header includes an accessible settings icon. The built-in modal
editor updates the node name, type, description, accent color, and serializable
`data` value. It also exposes the per-port multiple-link policy and optional
total connection limit. Saving uses `updateNode()`, preserves every link still
valid under the new policy, and emits the regular `gui:graph-change` event in
addition to the settings events above. In read-only mode the dialog remains
available for inspection while its fields and save action are disabled.

Applications can replace the built-in dialog with a domain-specific settings
surface by canceling `gui:node-settings-request`:

```js
editor.addEventListener("gui:node-settings-request", (event) => {
  if (!usesCustomInspector(event.detail.node.type)) return;
  event.preventDefault();
  inspector.open(event.detail.node);
});
```

Use `gui:node-settings-save-request` to veto a built-in edit during validation.

Parameter validation can use the same pattern:

```js
editor.addEventListener("gui:node-parameter-change-request", (event) => {
  if (!backendAccepts(event.detail.parameter.id, event.detail.value)) {
    event.preventDefault();
  }
});

editor.addEventListener("gui:node-parameter-change", (event) => {
  backend.configure(event.detail.node.id, {
    [event.detail.parameter.id]: event.detail.value,
  });
});
```

## Interaction

- Drag empty space to pan.
- Use the mouse wheel or toolbar to zoom.
- Drag a node header to move it.
- Edit the parameters exposed directly on a node without opening its dialog.
- Use the settings icon in a node header to inspect or edit its configuration.
- Drag one port to a compatible opposite-direction port to connect.
- Double-click a wire to remove it.
- Switch `flow-direction` when a workflow reads more naturally top-to-bottom.
- Click a node or link to select it.
- Ctrl/Cmd-click nodes for additive selection.
- Shift-drag empty space for box selection.
- Ctrl/Cmd+C, X, and V copy, cut, and paste through `GuiClipboard`.
- Ctrl/Cmd+D duplicates the selected subgraph.
- Ctrl/Cmd+G groups selected nodes; Ctrl/Cmd+Shift+G ungroups them.
- `/` focuses node search and F9 toggles a breakpoint on one selected node.
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

## Advanced editing

Assign the shared framework services once:

```js
editor.history = history;
editor.clipboard = clipboard;
```

Structural edits then create reversible history entries. `copySelection()`,
`cutSelection()`, `paste()`, and `duplicateSelection()` preserve links whose
endpoints are both selected. Other editing methods include:

- `alignSelection()` and `distributeSelection()`;
- `groupSelection()` and `ungroupSelection()`;
- `addComment()` and `setNodeCollapsed()`;
- `autoLayout()` and `zoomToSelection()`;
- `findNodes()` and `validateGraph()`;
- `setLinkPoints()` for persistent manual reroute points.
- `setNodeSubgraph()`, `enterSubgraph()`, and `exitSubgraph()` for nested
  workflows. Double-clicking a node with a subgraph enters it; the toolbar back
  action returns and saves the nested graph.

The built-in minimap shows graph extent, viewport, and execution errors or
active nodes.

## Execution and validation

`GuiNodeGraph.validate()` reports missing required inputs, cycles, isolated
nodes, and a topological execution order. Cycles can be permitted explicitly
for feedback or state-machine graphs.

`setExecutionState(nodeId, state, detail)` accepts `idle`, `queued`, `running`,
`success`, `error`, and `paused`. `toggleBreakpoint()` stores editor-local
breakpoint state. Both APIs emit serializable events so a Python or C# executor
can drive visualization without owning the component DOM.

## Performance boundary

The editor rerenders node markup for structural changes and updates only
transforms and link paths while dragging. Routing considers nodes in a bounded
corridor around each connection so distant nodes do not add work. The editor is
intended for interactive workflows with tens to hundreds of visible nodes. For
very large graphs, partition the workflow into subgraphs or add viewport
virtualization as a separate module.
