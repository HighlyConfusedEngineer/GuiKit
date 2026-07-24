# Commands

The commands module centralizes application actions, keyboard shortcuts,
command discovery, cancellation, and undo/redo history. A command is defined
once and can be invoked by a toolbar, menu, node editor, native host, or
`<gui-command-palette>`.

```js
import { commands, history } from "@gui-template/core/commands";

commands.register({
  id: "project.save",
  label: "Save project",
  shortcut: "Ctrl+S",
  run: ({ signal }) => saveProject({ signal }),
});

await history.perform({
  label: "Rename node",
  redo: () => renameNode("Filter"),
  undo: () => renameNode("Processor"),
});
```

Command ids and history metadata are serializable. Functions remain local to
the JavaScript host; Python and C# invoke commands by id through the bridge.
The palette traps focus, supports arrows/Enter/Escape, and restores the prior
focus target. Applications can cancel execution through
`gui:command-request`.
