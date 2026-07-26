# Page layouts

GuiKit provides three complementary navigation/page patterns:

- `<gui-tabs>` for immediately selectable peer panels.
- `<gui-pages>` for animated application navigation with history.
- `<gui-swipe-pages>` for touch/trackpad horizontal flows with keyboard support.
- `<gui-dashboard>` for responsive, configurable card overviews.

## Swipe pages

Use direct `data-swipe-page` children. The active child is exposed through the
`active` property; `next()`, `previous()`, and `select()` support programmatic
navigation. Horizontal gestures above 48px move one page, while vertical
gestures remain available to the page scroller. Arrow keys, Page Up/Down, Home,
and End work when the carousel has focus.

```html
<gui-swipe-pages active="brief" loop>
  <section data-swipe-page="brief">Brief</section>
  <section data-swipe-page="review">Review</section>
</gui-swipe-pages>
```

Listen for `gui:swipe-page-change`; inactive slides are marked inert and hidden
from assistive navigation.

## Dashboards

Dashboard children use `data-dashboard-card` and optional `data-span`. The
component uses a configurable 12-column grid by default. Cards can be
reordered by drag and serialized with `snapshot()`.

```js
const dashboard = document.querySelector("gui-dashboard");
dashboard.columns = 8;
dashboard.updateCard("telemetry", { span: 6 });
dashboard.savePreset("operations");
```

Use `restorePreset()` for session-local layouts. Persist `snapshot()` with the
runtime persistence service when a host/application needs durable preferences.
