# TeX documents and PDF creation

`@gui-template/core/tex` provides source editing, templates, diagnostics, PDF
preview, and a compiler-adapter contract. It intentionally does **not** embed
TeX Live, MiKTeX, or a WebAssembly TeX engine. This keeps GuiKit lightweight
and makes the security boundary explicit.

## Editor and preview

```html
<gui-tex-editor id="editor"></gui-tex-editor>
<gui-tex-pdf-preview id="preview"></gui-tex-pdf-preview>
```

```js
import { GuiTexBridgeCompiler, GuiTexDocument } from "@gui-template/core/tex";
import { bridge } from "@gui-template/core";

const editor = document.querySelector("#editor");
editor.documentModel = new GuiTexDocument("\\documentclass{article}\n\\begin{document}Hello\\end{document}");
editor.compiler = new GuiTexBridgeCompiler(bridge, { method: "tex.compile" });
editor.addEventListener("gui:tex-editor-compile", (event) => {
  document.querySelector("#preview").result = event.detail.result;
});
```

The compiler returns `{ status, pdfUrl | pdfBase64 | bytes, diagnostics, log,
duration }`. A native host may return a short-lived HTTPS URL, a local virtual
host URL, or PDF bytes. Do not expose an arbitrary local file path to the page.

## Automated documents

Use `GuiTexTemplate` for data substitution. `{{field}}` values are TeX-escaped
by default; only list a field in `raw` after application validation.

```js
const template = new GuiTexTemplate("\\section*{Invoice {{number}}} Total: {{total}}");
const result = await template.compile(
  { number: "A_42", total: "$120" },
  compiler,
  { engine: "xelatex", safeMode: true },
);
```

## Host compiler contract

For a bridge compiler, implement a narrow `tex.compile` method:

```json
{
  "source": "\\documentclass{article} ...",
  "engine": "pdflatex",
  "safeMode": true,
  "timeout": 30000,
  "packages": []
}
```

The host should run TeX in a disposable sandbox with a dedicated working
directory, CPU/memory/output limits, disabled shell escape, no network, and a
strict package/font allowlist. Never compile directly in the application
directory or run an engine with the desktop user's privileges. Enforce a
timeout, delete intermediate files, and return structured diagnostics rather
than raw host paths.

`safeMode` blocks shell escapes and filesystem input/output commands before a
request leaves the UI. It is defense in depth—not a substitute for sandboxing.
Hosts that permit included templates should validate each input against a
dedicated read-only template directory.
