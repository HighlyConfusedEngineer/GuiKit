# Python and .NET host packages

GuiKit ships language-neutral web assets, but the repository also builds two
native-host packages from every CI/release run.

## Python wheel

The `guikit-webview` wheel embeds the landing page, full demo, `src`, and
locales. It offers a loopback-only `GuiKitServer`, a `GuiKitApi` bridge, and an
optional pywebview launcher.

```bash
python -m pip install guikit-webview[native]
```

For a local wheel, install the PEP 517 builder once and run:

```bash
python -m pip install build
npm run package:python
```

The wheel is created in `release/python/`.

## .NET / NuGet

`GuiKit.WebView` targets .NET 8, contains no webview-control dependency, and
copies bundled assets to `AppContext.BaseDirectory/GuiKit` by a transitive MSBuild
target. It exposes `GuiKitAssets.RequireRoot()` and
`GuiKitBridge.HandleAsync()` for WebView2, Avalonia, WinUI, MAUI, or another
webview host.

```bash
npm run package:dotnet
```

The NuGet package is created in `release/dotnet/`. The release workflow attaches
both host packages, the npm archive, and one checksum manifest to every GitHub
Release. Publishing to PyPI or nuget.org remains an explicit registry decision;
release assets can be installed from a GitHub Release immediately.
