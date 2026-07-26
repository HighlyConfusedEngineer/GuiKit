# Editors module

The editors module provides dependency-free Web Components for rich text,
code, structured JSON, property inspection, images, queries, timelines,
diagrams, theme tokens, and translation catalogs.

All controls use explicit properties and `gui:` events, so host applications
can persist, validate, synchronize, or connect them to the shared command and
history services. The timeline and diagram models are DOM-independent and can
be serialized or used from backend-facing tests.

Import the complete set with `@gui-template/core/editors`, or use the root
GuiKit export. Optional language services, collaboration transports, image
codecs, and database execution remain application/host responsibilities.
