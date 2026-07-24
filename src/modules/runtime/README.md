# Application runtime

This module contains the small, framework-neutral services needed by
desktop-class applications:

- versioned persistence and migrations;
- hash or history routing with asynchronous guards;
- cancellable background tasks and `<gui-task-center>`;
- typed clipboard payloads with an in-memory fallback;
- typed drag-and-drop payloads with reusable draggable/drop-target adapters;
- allowlisted, authorizable capabilities for backend integrations;
- bounded performance diagnostics.

All public snapshots are structured-cloneable and can cross the GuiKit native
bridge. Applications retain ownership of domain state.
