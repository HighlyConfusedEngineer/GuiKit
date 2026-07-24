# Developer tools

`<gui-component-playground>` provides a component preview, generated property
controls, a bounded event log, and a lightweight accessibility inspector.
`<gui-diagnostics-panel>` renders metrics collected by `GuiDiagnostics`.

The static audit catches common integration mistakes such as missing
accessible names, duplicate ids, broken ARIA references, missing image
alternatives, and positive tab indexes. It complements browser and
screen-reader testing; it is not presented as a complete WCAG conformance
checker.
