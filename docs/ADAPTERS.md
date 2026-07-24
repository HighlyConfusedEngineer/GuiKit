# Framework and native adapters

GuiKit custom elements work without an adapter. The `adapters` package subpath
adds conveniences where a host framework needs explicit property or event
binding.

## React

```js
import { createReactComponent } from "@gui-template/core/adapters";

export const NodeEditor = createReactComponent(React, "gui-node-editor", {
  onGraphChange: "gui:graph-change",
});
```

Object-valued properties are assigned to the element rather than stringified
as HTML attributes. Event listeners are removed when the wrapper unmounts.

## Vue

```js
import { createVuePlugin } from "@gui-template/core/adapters";

app.use(createVuePlugin({ prefix: "Gui" }));
```

Vue can also use the custom-element tags directly by configuring
`compilerOptions.isCustomElement`.

## Blazor

Render GuiKit tags in Razor markup and pass structured values through JS
interop:

```razor
<gui-node-editor @ref="Editor"></gui-node-editor>
```

The browser-side model remains the source of presentation state. Send and
receive the serializable graph, form, workspace, command, and task schemas.

## Python and C#

`GuiNativeController` uses the same allowlisted bridge envelope as the existing
Python and C# examples. Native hosts implement only:

- `guikit.command`
- `guikit.state.save`
- `guikit.state.load`
- `guikit.task.run`

This keeps backend integrations independent of component implementation
details.
