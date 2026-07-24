# Statusbar

`<gui-statusbar>` provides a lightweight application status surface for
browsers and native webviews. It can be placed at the top or bottom, remain
sticky in its scroll container, or be pinned to the viewport with `fixed`.

## Quick start

```html
<gui-statusbar
  id="app-status"
  position="bottom"
  label="Application status">
</gui-statusbar>
```

```js
const statusbar = document.querySelector("#app-status");
statusbar.setItems([
  {
    id: "backend",
    type: "status",
    variant: "success",
    label: "Backend",
    value: "Online",
  },
  {
    id: "sync",
    type: "progress",
    align: "center",
    label: "Sync",
    progress: 64,
    value: "64%",
  },
  {
    id: "notifications",
    type: "action",
    align: "end",
    icon: "â—‡",
    label: "Notifications",
    value: "3",
    compact: true,
  },
]);
```

## Placement

`position="bottom"` is the default. Use `position="top"` for a top statusbar.
The component is sticky by default, so place it before the main content for a
top bar or after the content for a bottom bar.

Add `fixed` to pin it directly to the viewport:

```html
<gui-statusbar position="top" fixed></gui-statusbar>
```

Fixed bars overlay application content. Reserve matching padding using the
`--statusbar-height` token when the content must never sit underneath them.
Use `--statusbar-offset` when another sticky or fixed surface already occupies
the selected edge.

## Item configuration

Every item requires a stable `id`.

| Property | Values | Purpose |
| --- | --- | --- |
| `type` | `text`, `status`, `progress`, `action`, `separator` | Rendering and interaction |
| `align` | `start`, `center`, `end` | Statusbar group |
| `variant` | `neutral`, `info`, `success`, `warning`, `danger` | Semantic color |
| `priority` | `low`, `normal`, `high` | Responsive visibility |
| `label` | string | Human-readable name |
| `value` | string or number | Current value |
| `icon` | string | Compact text or symbol icon |
| `tooltip` | string | Hover description |
| `progress` | `0` to `100` | Native progress value |
| `order` | number | Order inside the selected group |
| `disabled` | boolean | Disable action items |
| `hidden` | boolean | Remove the item from layout |
| `compact` | boolean | Hide its label on very narrow screens |
| `data` | structured value | Application metadata |

Low-priority items disappear below `48rem`. At very narrow widths the center
group is hidden and items marked `compact` retain their icon and value while
hiding the label. Horizontal overflow remains scrollable as a final fallback.

## Live updates

Updates are keyed by item id:

```js
statusbar.setItemValue("jobs", 14);
statusbar.updateItem("backend", {
  variant: "warning",
  value: "Reconnecting",
});
statusbar.upsertItem({
  id: "clock",
  align: "end",
  value: new Date().toLocaleTimeString(),
});
```

Updates announce their label and value through an isolated live region. Set
`live="off"`, `live="polite"` (default), or `live="assertive"`. Suppress one
announcement with `{ announce: false }`:

```js
statusbar.setItemValue("clock", "12:30", { announce: false });
```

## Custom content

Named slots allow arbitrary framework or application controls alongside
configured items:

```html
<gui-statusbar>
  <span slot="start">Workspace: Main</span>
  <button slot="end" type="button">Open command palette</button>
</gui-statusbar>
```

Available slots are `start`, `center`, and `end`.

## API

- `setItems(items)` atomically replaces all configured items.
- `getItem(id)` and the `items` property return detached snapshots.
- `addItem(item)` adds a new id.
- `upsertItem(item)` adds or updates.
- `updateItem(id, patch, options?)` updates an existing item.
- `setItemValue(id, value, options?)` is the fast value-update convenience API.
- `removeItem(id)` and `clear()` remove items.
- `position`, `fixed`, `compact`, and `live` are reflected properties.

## Events

| Event | Cancelable | Detail |
| --- | --- | --- |
| `gui:statusbar-change` | no | `{ operation, item?, items, previous? }` |
| `gui:statusbar-action` | yes | `{ id, item, sourceEvent }` |
| `gui:statusbar-position-change` | no | `{ position, previous }` |

Action items deliberately emit events instead of storing callbacks in the
configuration. This keeps item snapshots serializable across C#, Python, and
other webview bridges.

```js
statusbar.addEventListener("gui:statusbar-action", (event) => {
  if (event.detail.id === "notifications") openNotifications();
});
```

## Accessibility

The bar exposes a labeled region, action items use native buttons, progress
items use native `<progress>`, separators have explicit orientation, and live
updates use a separate atomic announcement region. Motion follows the user's
reduced-motion preference.
