# App shell

`GuiAppManifest` gives applications a portable, serializable definition of pages, navigation, locale, and theme. Assign it to `<gui-app-shell>` or use `GuiAppShellModel` when a native host renders the navigation itself.

The shell supports `sidebar`, `tabs`, `swipe`, and `dashboard` navigation declarations. It deliberately owns only navigation and page selection; use existing GuiKit page, workspace, command, and localization modules for richer application content.
