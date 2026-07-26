# GuiKit Python host

`guikit-webview` bundles GuiKit's static assets and supplies a small local
server plus a pywebview launcher. It keeps native dependencies optional:

```bash
pip install guikit-webview[native]
```

```python
from guikit_webview import GuiKitWindow

GuiKitWindow(title="My application").run()
```

Use `GuiKitServer` when another Python webview host is preferred. Extend
`GuiKitApi.invoke()` for application-specific bridge methods. The wheel
contains `index.html`, `src/`, `locales/`, and the full demo under its asset
directory; no network download is needed at runtime.
