# Architecture

GuiKit is split into four layers that deliberately know as little as possible
about one another.

```text
Application
    │
    ├── domain state, routing policy, persistence, permissions
    │
GuiKit components
    │
    ├── tabs, sidebars, pages, charts, toasts
    │
GuiKit services
    │
    ├── localization, theming, host bridge
    │
Web platform
    └── custom elements, canvas, CSS, DOM events, postMessage
```

## Web Components

Components use standard custom elements so a page can consume them without a
framework. React, Vue, Svelte, Blazor, or server-rendered HTML can treat them as
ordinary DOM nodes and call their explicit methods when necessary.

Most layout components use the light DOM. This lets applications style and
compose their own content. The live chart uses a shadow root because its canvas
and legend are implementation details; design tokens still cross that boundary.

## Design tokens

CSS custom properties form the public visual API. Component rules consume
semantic tokens such as `--gui-surface`, `--gui-text-muted`, and
`--gui-accent`. Applications can replace tokens without forking component CSS.

## State and events

GuiKit owns only presentation state:

- which tab or page is active;
- whether a mobile drawer is open;
- buffered chart points;
- active toast lifetimes;
- current locale and theme.

Application state stays outside the library. Public events use the `gui:`
prefix and bubble when they originate from DOM components.

## Native hosts

Host languages are transport adapters, not UI implementations. The front end
sends a small JSON envelope and the native host dispatches an allowlisted
method. Python and C# examples implement the same contract.

## Compatibility

The target is current evergreen browser engines and the webviews based on them:
Chromium/WebView2, WebKit/WKWebView, and pywebview backends. The library uses no
browser-specific styling API. A resize-event fallback is provided when
`ResizeObserver` is unavailable.
