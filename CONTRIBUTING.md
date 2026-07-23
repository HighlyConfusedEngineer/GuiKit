# Contributing to GuiKit

Thank you for helping improve GuiKit. Changes should preserve the core goals:
small runtime cost, standards-based APIs, accessibility, and host-language
independence.

## Development

GuiKit has no runtime dependencies. Use Node.js to run the development server
and tests:

```powershell
npm run dev
npm run check
```

Python's standard server is also sufficient for the showcase:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

## Adding a feature module

Start with the generator:

```powershell
npm run create:module -- my-feature
```

Follow [the module authoring contract](docs/MODULES.md). It explains directory
ownership, manifests, dependency initialization, public events, model/view
separation, types, documentation, accessibility, and completion criteria.

## Pull requests

1. Create a focused branch from `main`.
2. Add tests for behavior that can be exercised without a browser.
3. Test interactive and responsive changes in a current Chromium browser and,
   where possible, a native webview.
4. Update TypeScript declarations and API documentation with public changes.
5. Add a concise entry under `Unreleased` in `CHANGELOG.md`.
6. Keep new self-contained features under `src/modules/<module-id>/`.

Avoid adding a runtime dependency unless the same result cannot reasonably be
implemented with a web platform primitive. Discuss large dependencies or
breaking public APIs before implementing them.

## Code conventions

- Use two-space indentation in HTML, CSS, and JavaScript.
- Prefer semantic HTML and native accessibility behavior.
- Keep custom-element attributes declarative and JavaScript methods explicit.
- Dispatch public events with the `gui:` prefix.
- Do not use `innerHTML` with application-controlled values.
- Respect reduced motion and keyboard-only use.

## Commit messages

Use short, imperative subjects such as:

```text
Add peak-preserving chart downsampling
Fix drawer focus state on desktop
Document WebView2 bridge errors
```
