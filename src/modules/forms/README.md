# Schema-driven forms

`GuiFormModel` owns serializable field values, dependencies, dirty state, and
synchronous or asynchronous validation. `<gui-form>` renders that model as an
accessible form, settings page, or compact property inspector.

```js
form.schema = {
  id: "device",
  title: "Device settings",
  fields: [
    { id: "name", label: "Name", required: true },
    { id: "mode", type: "select", options: ["automatic", "manual"] },
    {
      id: "gain",
      type: "range",
      min: 0,
      max: 10,
      visibleWhen: { field: "mode", equals: "manual" },
    },
  ],
};
```

Use `formEditors.register(type, factory)` for application-specific editors.
Request events are cancelable, validation focuses the first invalid control,
and values can be serialized directly to Python or C#.
