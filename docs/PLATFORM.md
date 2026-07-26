# Application platform

`@gui-template/core/platform` is a dependency-free application layer for GuiKit. It contains serializable models, small Web Component surfaces, and explicit adapter seams. It never imports a cloud SDK, filesystem SDK, AI vendor SDK, or CRDT library itself.

## Integration map

| Area | Core primitive | Host integration seam |
| --- | --- | --- |
| Collaboration | `GuiCollaborationSession` | `send(operation)` and `subscribe(listener)` transport adapter |
| Files and workspaces | `GuiFileWorkspace` | async `list`, `read`, `write`, `remove`, optional `rename` adapter |
| Analysis | `summarizeTable`, `pivotRows`, `histogram` | Feed output to `GuiLiveChart` or `GuiDocumentModel` |
| Automation | `GuiAutomationModel` | action executor supplied to `run()` |
| AI | `GuiAiSession` | `stream(messages)` or `complete(messages)` provider |
| Plugins | `GuiPluginRegistry` | host-approved loader, permissions, and contribution context |
| Testing | `GuiInteractionRecorder`, `GuiMockHostBridge` | app-specific target resolver and mock handlers |
| Documents | `GuiDocumentModel` | data source and print/PDF host flow |
| Tokens | `GuiDesignSystem` | DTCG token JSON / Figma Variables mapping |

## Files and host bridges

Use an adapter rather than coupling UI code to Node, .NET, Python, or the browser File System Access API:

```js
import { GuiFileWorkspace } from "@gui-template/core/platform";

const workspace = new GuiFileWorkspace({ adapter: {
  async list() { return host.files.list(); },
  async read(path) { return host.files.read(path); },
  async write(path, content) { return host.files.write(path, content); },
  async remove(path) { return host.files.remove(path); },
} });
await workspace.open("notes/today.md");
workspace.update("notes/today.md", "Updated locally");
await workspace.save();
```

`GuiMemoryFileAdapter` is included for tests, demos, and browser-only prototypes.

## Collaboration and AI safety

Collaboration operations are plain JSON and can be bridged to a CRDT implementation, WebSocket transport, or an offline operation log. The built-in session provides presence, comments, local queuing, and basic path updates; conflict resolution remains a transport/CRDT policy so applications retain control.

`GuiAiSession` only streams provider output. Sensitive tool calls should be intercepted through its cancelable `toolrequest` event, approved by application policy, and executed by the host—not by the component.

## Plugins and design tokens

Plugin manifests require `id` and `name`; requested permissions must be granted when constructing `GuiPluginRegistry`. Keep plugin URLs, signature verification, sandboxing, marketplace indexing, and upgrade policy in the host application.

`GuiDesignSystem` stores DTCG-shaped tokens (`$type`, `$value`) and can export a flattened Figma Variables-compatible list with `toFigmaVariables()`.

## Web Components

The package registers these optional presentation surfaces: `gui-collaboration-panel`, `gui-file-explorer`, `gui-analysis-panel`, `gui-automation-designer`, `gui-ai-panel`, `gui-plugin-manager`, `gui-accessibility-inspector`, `gui-test-recorder`, `gui-document-editor`, and `gui-design-system-editor`.

See the **Editors** station in the full demo for a working configuration of every surface.
