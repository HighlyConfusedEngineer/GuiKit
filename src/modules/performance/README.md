# Performance module

`GuiFrameScheduler` coalesces repeated render requests into one frame.
`GuiPerformanceBudget` captures bounded timing statistics and emits a budget
event when a configured threshold is exceeded. `GuiLazyModuleLoader` keeps
optional feature imports out of an application's initial bundle.

```js
lazyModules.register("analysis", () => import("./analysis.js"));
const analysis = await lazyModules.load("analysis");
performanceBudget.setBudget("large-layout", 32);
```
