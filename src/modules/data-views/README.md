# Data views

The data-views module contains a bounded virtual list, sortable/filterable data
grid, and keyboard-navigable tree.

`GuiDataCollection` owns row invariants and selection without requiring a DOM.
Only the visible grid or list window is rendered, so memory use stays bounded
as the collection grows. `GuiTreeModel` flattens expanded branches on demand
and exposes the ARIA level, set size, and position metadata used by
`<gui-tree-view>`.

```js
grid.columns = [
  { field: "time", label: "Timestamp", width: 180 },
  { field: "level", label: "Level", width: 100 },
  { field: "message", label: "Message", width: "minmax(20rem, 1fr)" },
];
grid.rows = records;
grid.model.setFilter("message", "connection");
```

Grid editing and selection emit cancelable request events. Applications can
register cell renderers without putting functions into the serializable column
schema. Columns can be pinned at the start edge, and the collection exports
JSON or RFC-style CSV.

Use `GuiPagedDataSource` when the full result does not belong in browser
memory. It loads and caches bounded pages, forwards sort/filter metadata and an
abort signal, and reports a total that may represent millions of backend rows.
