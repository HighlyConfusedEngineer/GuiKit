namespace GuiKit.WebView;

/// <summary>Location of static GuiKit assets copied by the NuGet build target.</summary>
public static class GuiKitAssets
{
    public static string DefaultRoot => Path.Combine(AppContext.BaseDirectory, "GuiKit");
    public static string IndexPath => Path.Combine(DefaultRoot, "index.html");
    public static string FullDemoPath => Path.Combine(DefaultRoot, "examples", "full-demo", "index.html");

    public static string RequireRoot()
    {
        if (!File.Exists(IndexPath))
        {
            throw new DirectoryNotFoundException(
                "GuiKit assets were not copied to the application output. Ensure GuiKit.WebView.targets is imported.");
        }
        return DefaultRoot;
    }
}
