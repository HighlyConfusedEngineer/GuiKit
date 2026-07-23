using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;

namespace GuiKitHost;

public partial class MainWindow : Window
{
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        await Browser.EnsureCoreWebView2Async();
        Browser.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

        // Point this at the repository root in a real project.
        var guiRoot = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        Browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "gui.local",
            guiRoot,
            Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.DenyCors);
        Browser.Source = new Uri("https://gui.local/index.html");
    }

    private async void OnWebMessageReceived(
        object? sender,
        Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        var request = JsonSerializer.Deserialize<BridgeRequest>(
            e.WebMessageAsJson,
            JsonOptions);
        if (request is null || request.Channel != "gui-template") return;

        try
        {
            var result = await Dispatch(request.Method, request.Params);
            Reply(request.Id, result, null);
        }
        catch (Exception error)
        {
            Reply(request.Id, null, new { message = error.Message });
        }
    }

    private static Task<object> Dispatch(
        string method,
        Dictionary<string, JsonElement>? parameters)
    {
        object result = method switch
        {
            "app.info" => new
            {
                host = ".NET / WebView2",
                platform = Environment.OSVersion.ToString(),
                runtime = Environment.Version.ToString()
            },
            "app.echo" => parameters ?? new(),
            _ => throw new InvalidOperationException($"Unknown host method: {method}")
        };
        return Task.FromResult(result);
    }

    private void Reply(string id, object? result, object? error)
    {
        Browser.CoreWebView2.PostWebMessageAsJson(
            JsonSerializer.Serialize(new
            {
                channel = "gui-template",
                type = "response",
                id,
                result,
                error
            }, JsonOptions));
    }

    private sealed record BridgeRequest(
        string Channel,
        string Type,
        string Id,
        string Method,
        Dictionary<string, JsonElement>? Params);
}
