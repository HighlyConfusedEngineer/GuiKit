# Overlays

The overlays module provides a shared top-layer contract for dialogs, anchored
popovers, context menus, action menus, and tooltips.

```html
<button id="actions">Actions</button>
<gui-popover id="actions-popover" anchor="actions">
  <gui-menu>
    <button role="menuitem" data-command="project.save">Save</button>
  </gui-menu>
</gui-popover>

<gui-context-menu for="canvas">
  <gui-menu>...</gui-menu>
</gui-context-menu>

<gui-dialog id="confirm" label="Delete project?" light-dismiss>
  This cannot be undone.
</gui-dialog>
```

Open and close operations emit cancelable request events. Dialogs restore
focus, menus use roving tab stops and arrow navigation, tooltips are associated
with their target through `aria-describedby`, and all animation is disabled by
the user's reduced-motion setting.
