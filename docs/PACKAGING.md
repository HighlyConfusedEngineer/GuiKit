# Packaging profiles

GuiKit is a static ES module and stylesheet. A production host serves the
package files and loads `src/gui.js`; no JavaScript build step is required.

## PWA

Add a web app manifest, service worker, icons, and HTTPS hosting. Cache a
versioned application shell and use network-first behavior for live data.
Do not cache native bridge responses.

## pywebview

Serve files from an application-owned directory or the built-in HTTP server.
Expose one allowlisted `guikit` API object and pass all payloads as JSON.
Package with PyInstaller after collecting the GuiKit `src`, `locales`, and
application assets.

## WebView2

Map a virtual host name to the packaged web assets, enable only required
permissions, and dispatch `window.chrome.webview` messages through `GuiBridge`.
The C# example contains the reference envelope.

## WKWebView

Bundle assets as application resources, install the `guikit` script message
handler, and load the local entry page with read access limited to the asset
directory.

## Avalonia

Use the platform WebView control and the same WebView2/WKWebView message
contract. Keep native window creation, filesystem access, and OS permissions
behind registered GuiKit capabilities.

## Release artifact

`npm pack` produces the framework package. GitHub releases attach that archive
through the existing release workflow. Run `npm run release:check` before
tagging.
