# Native bridge protocol

The bridge transports allowlisted method calls between the shared web UI and a
native process.

## Request

```json
{
  "channel": "gui-template",
  "type": "request",
  "id": "gui-1720000000000-1",
  "method": "settings.save",
  "params": {
    "theme": "dark"
  }
}
```

`id` is opaque and must be copied into the response.

## Success response

```json
{
  "channel": "gui-template",
  "type": "response",
  "id": "gui-1720000000000-1",
  "result": {
    "saved": true
  },
  "error": null
}
```

## Error response

```json
{
  "channel": "gui-template",
  "type": "response",
  "id": "gui-1720000000000-1",
  "result": null,
  "error": {
    "message": "Theme is not allowed"
  }
}
```

## Native event

Hosts can publish application events:

```json
{
  "channel": "gui-template",
  "type": "event",
  "name": "download-progress",
  "data": {
    "percent": 62
  }
}
```

JavaScript can subscribe on the bridge instance or to the bubbled
`gui:host:download-progress` window event.

## Transport adapters

- WebView2 uses `window.chrome.webview.postMessage` and
  `CoreWebView2.PostWebMessageAsJson`.
- WKWebView uses the `guiBridge` script message handler and calls
  `window.guiBridgeReceive(...)` for responses.
- pywebview calls `window.pywebview.api.invoke(method, params)` directly.
- Browser development uses the cancelable `gui:host-request` event.

## Host requirements

The native host must:

1. verify `channel` and `type`;
2. allowlist method names;
3. validate parameters before use;
4. return JSON-serializable values;
5. avoid leaking exception stack traces or local paths;
6. apply its own authorization and user-consent policy.
