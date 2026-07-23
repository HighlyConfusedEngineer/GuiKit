# C# / WebView2 host

Create a WPF project, add the `Microsoft.Web.WebView2` NuGet package, and copy
`MainWindow.xaml` plus `MainWindow.xaml.cs` into it. Adjust `guiRoot` if the
executable is not four directories beneath this repository.

WebView2 handles the shared bridge through `WebMessageReceived` and
`PostWebMessageAsJson`. The UI remains ordinary static web content.
