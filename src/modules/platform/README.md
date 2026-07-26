# Application platform module

This module supplies serializable, dependency-free application primitives and
optional Web Component surfaces. It deliberately delegates filesystem access,
real-time transport, CRDT conflict resolution, AI model access, plugin code
loading, signatures, and sandboxing to the embedding host.

Use `GuiMemoryFileAdapter`, `GuiMockHostBridge`, and `GuiInteractionRecorder`
for deterministic browser/demo/test flows. Use the matching production adapters
in the C#, Python, browser, or desktop-webview host.

The full integration guide is [docs/PLATFORM.md](../../../docs/PLATFORM.md).
