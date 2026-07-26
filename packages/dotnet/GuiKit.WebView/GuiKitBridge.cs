using System.Text.Json;

namespace GuiKit.WebView;

/// <summary>Framework-neutral handler for the GuiKit request/response envelope.</summary>
public static class GuiKitBridge
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task<string?> HandleAsync(
        string message,
        Func<string, JsonElement?, Task<object?>> dispatch)
    {
        using var document = JsonDocument.Parse(message);
        var root = document.RootElement;
        if (!root.TryGetProperty("channel", out var channel)
            || channel.GetString() != "gui-template"
            || !root.TryGetProperty("type", out var type)
            || type.GetString() != "request") return null;

        var id = root.TryGetProperty("id", out var idValue) ? idValue.GetString() : null;
        var method = root.TryGetProperty("method", out var methodValue) ? methodValue.GetString() : null;
        if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(method)) return null;
        JsonElement? parameters = root.TryGetProperty("params", out var parameterValue)
            ? parameterValue.Clone() : null;
        try
        {
            var result = await dispatch(method, parameters);
            return JsonSerializer.Serialize(new { channel = "gui-template", type = "response", id, result, error = (object?)null }, JsonOptions);
        }
        catch (Exception error)
        {
            return JsonSerializer.Serialize(new { channel = "gui-template", type = "response", id, result = (object?)null, error = new { message = error.Message } }, JsonOptions);
        }
    }
}
