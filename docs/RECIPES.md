# Recipes

## Native-capable dashboard

Start with the browser template, use `GuiAppManifest` with `navigation: "dashboard"`, and combine `gui-analysis-chart`, `gui-statusbar`, and `gui-notification-center`. Add a bridge specification only for device or filesystem operations; keep chart transformations in the UI worker modules.

## Reviewable host integration

Define every host operation in `guikit.bridge.json`, generate the language contracts, and implement the generated interface in Python or C#. Browser tests can use the generated mock or `createBridgeMock`. This keeps UI and host changes reviewable in one small contract diff.

## TeX report pipeline

Use `GuiTexDocument` for editing and `GuiTexBridgeCompiler` for compilation. Register `tex.compile` in the host bridge and compile inside a sandboxed TeX runner. Return diagnostics and a PDF URL/blob only; never grant TeX direct access to arbitrary host filesystem paths.

## Design-system handoff

Store token source in `guikit.tokens.json`, generate the CSS file during development or CI, and import it before `@gui-template/core/styles`. Use semantic tokens for accents, surfaces, and states so themes can evolve without changing feature modules.

## Component regression tests

Build a small test host with `createGuiTestHost`, invoke a component operation, and await its public event with `waitForGuiEvent`. Keep behavior tests focused on public events, serialized state, and accessible DOM—not internal shadow DOM markup.
