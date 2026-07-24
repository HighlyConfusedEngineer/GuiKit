# Docking workspace

`GuiWorkspaceModel` stores a workspace as nested tab groups and horizontal or
vertical splits. `<gui-workspace>` renders that model with draggable tabs,
pointer and keyboard-resizable splitters, close requests, and named slots for
panel content.

```html
<gui-workspace id="workspace">
  <section slot="editor">Editor content</section>
  <section slot="logs">Log viewer</section>
</gui-workspace>
```

```js
workspace.value = {
  panels: [
    { id: "editor", title: "Editor", closable: false },
    { id: "logs", title: "Logs" },
  ],
  layout: {
    type: "split",
    direction: "vertical",
    sizes: [0.7, 0.3],
    children: [
      { type: "tabs", id: "main", panels: ["editor"], active: "editor" },
      { type: "tabs", id: "bottom", panels: ["logs"], active: "logs" },
    ],
  },
};
workspace.usePersistence(persistence, "main-layout");
```

Detaching emits a request event so browser, WebView2, WKWebView, Python, or C#
hosts can decide how a new window should be created.
