# TeX module

`@gui-template/core/tex` provides TeX source editing, template automation,
compiler adapters, diagnostics, and PDF preview. It intentionally does not
embed a TeX engine: compile untrusted documents in a sandboxed native host,
container, or approved remote service. Read [`docs/TEX.md`](../../../docs/TEX.md)
before enabling compilation.
