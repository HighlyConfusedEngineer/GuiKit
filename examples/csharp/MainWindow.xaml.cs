using System;
using System.Collections.Generic;
using System.Diagnostics;
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
            "logging.write" => WriteLogs(parameters),
            _ => throw new InvalidOperationException($"Unknown host method: {method}")
        };
        return Task.FromResult(result);
    }

    private static object WriteLogs(Dictionary<string, JsonElement>? parameters)
    {
        if (parameters is null
            || !parameters.TryGetValue("records", out var records)
            || records.ValueKind != JsonValueKind.Array)
        {
            return new { accepted = 0 };
        }

        var accepted = 0;
        foreach (var record in records.EnumerateArray())
        {
            if (accepted >= 1000) break;
            if (!record.TryGetProperty("schema", out var schema)
                || schema.GetString() != "guikit.log/v1")
            {
                continue;
            }

            var level = record.TryGetProperty("level", out var levelValue)
                ? levelValue.GetString()?.ToUpperInvariant()
                : "INFO";
            var logger = record.TryGetProperty("logger", out var loggerValue)
                ? loggerValue.GetString()
                : "frontend";
            var message = record.TryGetProperty("message", out var messageValue)
                ? messageValue.GetString()
                : "";
            Trace.WriteLine($"{level} [{logger}] {message} | {record.GetRawText()}", "GuiKit");
            accepted += 1;
        }
        return new { accepted };
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
