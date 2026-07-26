# Production hardening toolkit

`@gui-template/core/production` adds application-grade tooling without adding
runtime dependencies or assuming a particular backend.

## Included capabilities

- `GuiThemeStudio`: token presets, CSS output, and WCAG contrast audits.
- `GuiResponsiveLayout`: serializable breakpoint-aware grid placement.
- `GuiDataConnectorRegistry`: REST, WebSocket, MQTT, SQL-host, CSV, and replay
  adapters share one `load(context)` contract.
- `GuiCredentialVault`: reference-only access to the host's encrypted vault.
- `GuiObservabilityHub`: bounded metrics/traces plus alert rules.
- `GuiNodeLibrary` and `GuiFlowDebugger`: reusable node definitions,
  breakpoints, steps, and live port-value overlays for a node-editor host.
- `fftMagnitude`, `correlation`, CSV, and SVG exports for analysis screens.
- `normalizeAnalysisDataset`: scatter, heatmap, and candlestick data contracts.
- `GuiAccessibilityLab`: keyboard-flow, reduced-motion, and color-vision rules.
- `GuiOfflineSyncQueue`: persisted operation queues and versioned snapshots.
- `GuiCachePolicy` and `GuiServiceWorkerBridge`: cache strategy and host-safe
  service-worker registration/messaging.
- `GuiPluginPolicy`: API/permission/signature gates and iframe sandbox defaults.
- `GuiVisualRegressionSuite`: deterministic viewport/theme/locale matrices.
- `GuiProductionOptimizer`: size budgets and lazy custom-element registration.

## Security boundaries

GuiKit does not persist plaintext credentials, execute plugins, fetch network
data, validate plugin signatures, capture screenshots, or resolve CRDT
conflicts itself. Those actions remain in the application host. The primitives
here make the boundaries explicit, testable, and portable across browser,
Python, C#, and desktop-webview targets.

## CI example

```js
import { GuiProductionOptimizer, GuiVisualRegressionSuite } from "@gui-template/core/production";

const budgets = new GuiProductionOptimizer({ budgets: { "app.js": 180_000 } });
const result = budgets.evaluateAssets(await host.build.assetSizes());
if (result.some((asset) => !asset.passed)) throw new Error("Bundle budget exceeded");

const suite = new GuiVisualRegressionSuite({ locales: ["en", "de", "es"] });
for (const testCase of suite.matrix("settings")) {
  const image = await host.capture(testCase);
  await suite.compare(testCase.id, image, host.compareImages);
}
```

The full demo's **Production studio** shows theme, layout, connector,
observability, and regression surfaces. Use it with the application-platform
guide for offline sync, documents, plugins, and collaboration.
