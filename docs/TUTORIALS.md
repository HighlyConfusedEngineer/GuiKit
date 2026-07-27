# Interactive tutorials

GuiKit tutorials teach a live application in place: they highlight an element, describe why it matters, and move through a short sequence with accessible controls.

```js
import { GuiTutorialModel } from "@gui-template/core/tutorials";

const tutorial = new GuiTutorialModel([
  { id: "filters", target: "#filter-panel", title: "Filter results", description: "Narrow the data shown in this view." },
  { id: "save", target: "#save", title: "Save changes", description: "Persist the current configuration.", advanceOn: { event: "click" } },
]);
document.querySelector("#tutorial").model = tutorial;
tutorial.start();
```

Each step requires a stable kebab-case `id`, `title`, and `description`; `target` is an optional CSS selector. A missing target shows a centered explanation, which is useful for conceptual onboarding. `placement` can be `auto`, `top`, or `bottom`.

The tour dialog supports Back, Next/Finish, Skip, and Escape. It uses a bounded, temporary `data-gui-tutorial-active` marker on the highlighted target and cleans it up on every step change, completion, or disconnect. Use the marker for application-specific visual refinement if needed.

`advanceOn: { event: "click" }` advances after a real action on the target. Keep confirmation, permissions, payments, and other security-critical actions independently protected; a tutorial is never an authorization mechanism.
