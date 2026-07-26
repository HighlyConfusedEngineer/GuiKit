# GuiKit .NET package

`GuiKit.WebView` is a NuGet package for WPF, WinUI, Avalonia, MAUI, or any .NET
host that renders a webview. It copies the GuiKit static assets to
`AppContext.BaseDirectory/GuiKit` and provides a JSON bridge helper without
taking a dependency on a specific webview control.

```xml
<PackageReference Include="GuiKit.WebView" Version="0.1.0" />
```

For WebView2, map `GuiKitAssets.RequireRoot()` to a virtual host and pass
incoming messages to `GuiKitBridge.HandleAsync`. The existing C# example shows
the corresponding WebView2 event wiring.
