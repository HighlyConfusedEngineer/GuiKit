# Wizard

`<gui-wizard>` provides accessible, validated multi-step workflows for
onboarding, installers, imports, checkout-like flows, and guided configuration.
Step content remains ordinary application HTML. The wizard owns navigation and
state, while the application owns domain data and final side effects.

## Quick start

```html
<gui-wizard id="setup" linear label="Project setup">
  <section
    data-wizard-step="project"
    data-title="Project"
    data-description="Choose a name and destination.">
    <label>
      Name
      <input name="name" required>
    </label>
  </section>

  <section
    data-wizard-step="integration"
    data-title="Integration"
    data-description="Connect optional services."
    data-optional>
    <!-- application controls -->
  </section>

  <section
    data-wizard-step="review"
    data-title="Review"
    data-description="Confirm the configuration.">
    <!-- application summary -->
  </section>
</gui-wizard>
```

Each direct child with `data-wizard-step` becomes one step.

| Step attribute | Meaning |
| --- | --- |
| `data-wizard-step` | Required id, unique within the wizard |
| `data-title` | Step title shown in the rail and content header |
| `data-description` | Supporting text |
| `data-optional` | Shows Skip and permits skipped state |
| `data-disabled` | Removes the step from navigation |
| `data-validate="false"` | Bypasses native and custom validation |

Call `refresh()` after changing step metadata dynamically. Direct step
additions and removals are detected automatically.

## Attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `active` | first enabled step | Current step id |
| `linear` | absent | Require prior steps to complete before later steps unlock |
| `label` | `Setup progress` | Accessible progress-navigation label |
| `back-label` | `Back` | Back button text |
| `next-label` | `Continue` | Forward button text |
| `finish-label` | `Finish` | Final button text |
| `skip-label` | `Skip` | Optional-step button text |
| `busy` | managed | Reflected while an asynchronous validator runs |

Default labels are configurable instead of importing application translations.

## Validation

Native constraint validation runs before forward navigation and completion.
Required fields, email and URL formats, numeric limits, and custom validity
messages work without additional code. The first invalid control receives
focus.

Use `setValidator()` for domain validation or asynchronous checks:

```js
const wizard = document.querySelector("#setup");

wizard.setValidator("project", async ({ step, state }) => {
  const name = document.querySelector("[name=name]").value.trim();
  const available = await backend.projectNameAvailable(name);
  return available
    ? true
    : { valid: false, message: "That project name is already in use." };
});
```

A validator may return:

- `true`, `undefined`, or `{ valid: true }`;
- `false`;
- an error-message string;
- `{ valid: false, message }`;
- a Promise resolving to any of the above.

Thrown errors emit `gui:wizard-error`. Validation failures are announced in an
alert region and emit `gui:wizard-validation-error`.

## Methods

- `goTo(id, options?)` moves to a reachable step.
- `next(options?)` validates and advances, or finishes on the last step.
- `back(options?)` returns without validating.
- `skip()` skips the current optional step.
- `finish(data?)` validates and requests completion.
- `reset({ active?, focus? }?)` clears progress.
- `setValidator(id, validator?)` installs or removes a validator.
- `setStepState(id, patch)` updates complete, skipped, visited, or disabled.
- `getState()` returns serializable progress.
- `restoreState(state)` restores serializable progress.
- `refresh()` rereads declarative steps.

Navigation methods return booleans or `Promise<boolean>` so host code can
determine whether validation, linear rules, or an event veto blocked the
operation.

## State and persistence

```js
const state = wizard.getState();
localStorage.setItem("setup-progress", JSON.stringify(state));

wizard.restoreState(
  JSON.parse(localStorage.getItem("setup-progress")),
);
```

State contains:

```js
{
  active: "integration",
  completed: ["project"],
  skipped: [],
  visited: ["project", "integration"],
  finished: false,
}
```

The state deliberately excludes form values. Persist domain data separately
and apply the appropriate privacy and security policy.

`GuiWizardModel` provides the same state rules without a DOM:

```js
import { GuiWizardModel } from "@gui-template/core/wizard";

const model = new GuiWizardModel(
  [{ id: "one" }, { id: "two", optional: true }],
  { linear: true },
);
model.setStepState("one", { complete: true });
model.activate("two");
```

## Events

| Event | Cancelable | Detail |
| --- | --- | --- |
| `gui:wizard-step-change-request` | yes | `{ from, to, direction, reason, state }` |
| `gui:wizard-step-change` | no | `{ active, previous, direction, reason, state }` |
| `gui:wizard-validation-error` | no | `{ step, message, source, state }` |
| `gui:wizard-skip-request` | yes | `{ step, state }` |
| `gui:wizard-skip` | no | `{ step, state }` |
| `gui:wizard-finish-request` | yes | `{ step, data, state }` |
| `gui:wizard-finish` | no | `{ step, data, state }` |
| `gui:wizard-reset-request` | yes | `{ state }` |
| `gui:wizard-reset` | no | `{ state }` |
| `gui:wizard-state-change` | no | `{ operation, state, ... }` |
| `gui:wizard-error` | no | `{ operation, step, error }` |

Cancel request events to enforce application policy before state changes.

## Keyboard and accessibility

- The active step uses `aria-current="step"`.
- Locked and disabled indicators expose `aria-disabled`.
- Arrow keys move focus between step indicators; Home and End jump to the
  first and last indicators.
- Forward navigation focuses the new step heading.
- Invalid native controls receive focus.
- Busy validators expose `aria-busy`.
- Validation messages use an alert region.
- Narrow layouts use a horizontally scrollable step rail.
- Reduced-motion preferences remove step and progress animation.

## Performance boundary

The wizard renders one active light-DOM step and a small indicator for every
declared step. It is intended for guided workflows with a small number of
meaningful stages. Very large dynamic questionnaires should use page
virtualization or a dedicated form engine.
