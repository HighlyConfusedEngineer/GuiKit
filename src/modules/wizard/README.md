# Wizard module

## Responsibility

`<gui-wizard>` owns reusable multi-step navigation, progress, validation,
focus, completion, skipping, and resumable state. Applications own the step
content, form values, persistence destination, and final side effects.

The DOM-independent `GuiWizardModel` exposes the same linear-flow and state
rules for backend tests, native hosts, alternate renderers, and undo/redo.

## Usage

```js
import {
  GuiWizard,
  GuiWizardModel,
} from "@gui-template/core/wizard";
```

```html
<gui-wizard linear label="Project setup">
  <section
    data-wizard-step="profile"
    data-title="Profile"
    data-description="Name this project.">
    <input required>
  </section>
  <section
    data-wizard-step="extras"
    data-title="Extras"
    data-optional>
    Optional content
  </section>
</gui-wizard>
```

## Maintenance

- Keep workflow state and structural rules in `GuiWizardModel`.
- Keep domain data outside the model.
- Add new application-policy hooks through cancelable request events.
- Preserve native form validity, focus behavior, and reduced-motion support.
- Run model tests and wide/narrow browser interaction checks after changes.

See [the complete wizard guide](../../../docs/WIZARD.md).
