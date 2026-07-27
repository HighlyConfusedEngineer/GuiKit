# Developer experience

GuiKit applications can start small and grow into a native-hosted product without replacing their UI layer. The workflow is intentionally configuration-first and dependency-free at the framework boundary.

## Start an application

```sh
npx create-guikit-app telemetry-console --target browser --modules productivity,tex
cd telemetry-console
npm install
npm run dev
```

`--target python` and `--target csharp` also create a minimal host entry point. They keep the same web UI and bridge contract, so browser development remains fast.

## Validate the workspace

```sh
npx guikit doctor
```

The doctor checks the project manifest, entry page, Node declaration, and GuiKit dependency. It never changes project files.

## Use an app manifest

`guikit.app.json` is a portable declaration for title, locale, theme, navigation, and pages. Construct `GuiAppManifest` from it and assign it to `<gui-app-shell>`. The shell has `sidebar`, `tabs`, `swipe`, and `dashboard` navigation modes; page content remains under application control.

## Generate a typed bridge

Create `guikit.bridge.json`:

```json
{
  "namespace": "TelemetryBridge",
  "methods": [
    { "id": "device.read", "params": { "deviceId": "string" }, "result": "string" }
  ]
}
```

Run `npx guikit bridge guikit.bridge.json`. The generator writes TypeScript declarations, a browser mock, a Python protocol, and a C# interface to `generated/`. Treat the specification as the source of truth; generated files are safe to overwrite.

## Share design tokens

Place Design Tokens Community Group-style values in `guikit.tokens.json`, then run `npx guikit tokens guikit.tokens.json`. GuiKit emits a CSS custom-properties file and a Figma-variable interchange JSON file. Keep semantic names such as `color-accent` instead of component-specific names.

## Test UI integration

The `@gui-template/core/testing` entry point provides `createBridgeMock`, `createGuiTestHost`, `waitForGuiEvent`, and `waitForTransition`. These helpers work in Node tests and do not require a browser automation dependency.

## Extend safely

Run `npx guikit extension sample-tool` to scaffold an isolated extension manifest and activation entry. Use a stable manifest id, declare permissions explicitly, and keep activation disposable. For a first-party module inside GuiKit itself, use `npm run create:module -- my-feature` and follow [MODULES.md](MODULES.md).

## Inspect while developing

`GuiDevelopmentSession` records bounded module, bridge, diagnostics, and logging activity. Assign it to `<gui-developer-inspector>` in a development-only panel. It has no remote transport and should not be enabled in production telemetry by default.
