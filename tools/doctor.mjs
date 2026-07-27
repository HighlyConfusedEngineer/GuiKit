import { access, readFile } from "node:fs/promises";
import path from "node:path";

async function exists(location) {
  try { await access(location); return true; } catch { return false; }
}

export async function inspectGuiKitProject(root = process.cwd()) {
  const checks = [];
  const add = (id, ok, message, advice) => checks.push({ id, ok, message, advice: ok ? undefined : advice });
  const packageFile = path.join(root, "package.json");
  const packageExists = await exists(packageFile);
  add("package-json", packageExists, "package.json is present.", "Run this command from a JavaScript project root.");
  let packageJson = {};
  if (packageExists) {
    try { packageJson = JSON.parse(await readFile(packageFile, "utf8")); }
    catch { add("package-json-valid", false, "package.json is valid JSON.", "Fix the JSON syntax in package.json."); }
  }
  if (packageExists) {
    const declaredNode = packageJson.engines?.node;
    add("node-engine", !declaredNode || /(?:20|21|22|23|24)/.test(declaredNode),
      "Node 20 or later is declared when an engine is specified.", "Set engines.node to >=20.");
    const usesGuiKit = packageJson.name === "@gui-template/core" || Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })
      .some((name) => name === "@gui-template/core" || name === "guikit");
    add("guikit-dependency", usesGuiKit, "A GuiKit package dependency is declared.", "Install @gui-template/core before building the application.");
  }
  add("entry-page", await exists(path.join(root, "index.html")), "index.html is present.", "Add an application entry page or use create-guikit-app.");
  const manifestFile = path.join(root, "guikit.app.json");
  if (await exists(manifestFile)) {
    try {
      const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
      add("app-manifest", Array.isArray(manifest.pages) && manifest.pages.length > 0,
        "guikit.app.json declares at least one page.", "Add a non-empty pages array to guikit.app.json.");
    } catch {
      add("app-manifest", false, "guikit.app.json is valid JSON.", "Fix the JSON syntax in guikit.app.json.");
    }
  } else {
    checks.push({ id: "app-manifest", ok: true, optional: true, message: "No app manifest found (optional)." });
  }
  return { root, healthy: checks.every((check) => check.ok), checks };
}
