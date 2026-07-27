import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeProjectName } from "./dx-utils.mjs";

export async function createExtension(root, id) {
  if (!safeProjectName(id)) throw new TypeError("Extension id must be lowercase kebab-case.");
  const directory = path.join(root, "extensions", id);
  const manifest = { id, version: "0.1.0", displayName: id.replaceAll("-", " "), apiVersion: 1, entry: "./index.js", permissions: [] };
  const files = {
    "manifest.json": JSON.stringify(manifest, null, 2) + "\n",
    "index.js": `export default function activate(context) {\n  context.logger?.info?.("${id} activated");\n  return { dispose() {} };\n}\n`,
    "README.md": `# ${id}\n\nA GuiKit extension. Keep the public manifest stable and test activation without a DOM.\n`,
  };
  await mkdir(directory, { recursive: true });
  await Promise.all(Object.entries(files).map(([file, content]) => writeFile(path.join(directory, file), content, { flag: "wx" })));
  return directory;
}
