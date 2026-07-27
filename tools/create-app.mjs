#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArguments, safeProjectName } from "./dx-utils.mjs";

function browserFiles(name, modules) {
  const title = name.replaceAll("-", " ");
  return {
    "package.json": JSON.stringify({ name, private: true, type: "module", scripts: { dev: "vite", build: "vite build", check: "guikit doctor" }, dependencies: { "@gui-template/core": "^0.2.0" }, devDependencies: { vite: "^6.0.0" } }, null, 2) + "\n",
    "index.html": `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body><gui-app-shell id="app"></gui-app-shell><script type="module" src="/src/main.js"></script></body></html>\n`,
    "src/main.js": `import { initializeGui, GuiAppManifest } from "@gui-template/core";\nimport "@gui-template/core/styles";\n\nawait initializeGui({ modules: ${JSON.stringify(modules)} });\nconst manifest = new GuiAppManifest({\n  id: "${name}", title: "${title}",\n  pages: [{ id: "home", title: "Home", content: "Welcome to GuiKit." }],\n});\ndocument.querySelector("#app").manifest = manifest;\n`,
    "guikit.app.json": JSON.stringify({ id: name, title, modules, pages: [{ id: "home", title: "Home" }] }, null, 2) + "\n",
  };
}
function hostFiles(target) {
  if (target === "python") return { "host.py": "from guikit_webview import GuiKitHost\n\nGuiKitHost().run('index.html')\n" };
  if (target === "csharp") return { "Host.cs": "// Add GuiKit.WebView and load index.html in your chosen WebView host.\n" };
  return {};
}
export function createAppFiles({ name, target = "browser", modules = [] }) {
  if (!safeProjectName(name)) throw new TypeError("Project name must be lowercase kebab-case (up to 63 characters).");
  if (!new Set(["browser", "python", "csharp"]).has(target)) throw new TypeError("Target must be browser, python, or csharp.");
  const selected = [...new Set(["app-shell", "commands", ...modules])];
  return { ...browserFiles(name, selected), ...hostFiles(target), "README.md": `# ${name}\n\nCreated with GuiKit for the ${target} target.\n\nRun \`npm install\`, then \`npm run dev\`.\n` };
}
export async function createApp(targetDirectory, options) {
  const files = createAppFiles(options);
  await mkdir(targetDirectory, { recursive: true });
  await Promise.all(Object.entries(files).map(async ([relative, content]) => {
    const location = path.join(targetDirectory, relative);
    await mkdir(path.dirname(location), { recursive: true });
    await writeFile(location, content, { flag: "wx" });
  }));
  return Object.keys(files);
}
async function run() {
  const { positionals, options } = parseCliArguments(process.argv.slice(2));
  const name = positionals[0];
  if (!name || options.help) {
    console.log("Usage: create-guikit-app <name> [--target browser|python|csharp] [--modules commands,tex]");
    return;
  }
  const modules = String(options.modules ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const location = path.resolve(process.cwd(), String(options.dir ?? name));
  await createApp(location, { name, target: options.target, modules });
  console.log(`Created ${name} in ${location}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run().catch((error) => { console.error(error.message); process.exitCode = 1; });
