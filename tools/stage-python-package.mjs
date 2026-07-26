/** Stage a self-contained Python source distribution without committing copied web assets. */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const staging = resolve(root, "release", "python-src");
const source = resolve(root, "packages", "python");
const assets = resolve(staging, "src", "guikit_webview", "assets");

await rm(staging, { recursive: true, force: true });
await cp(source, staging, { recursive: true });
const packageVersion = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version;
const pyprojectPath = resolve(staging, "pyproject.toml");
const pyproject = await readFile(pyprojectPath, "utf8");
await writeFile(pyprojectPath, pyproject.replace(/^version = ".*"$/m, `version = "${packageVersion}"`));
await mkdir(assets, { recursive: true });
await Promise.all([
  cp(resolve(root, "index.html"), resolve(assets, "index.html")),
  cp(resolve(root, "src"), resolve(assets, "src"), { recursive: true }),
  cp(resolve(root, "locales"), resolve(assets, "locales"), { recursive: true }),
  cp(resolve(root, "examples", "full-demo"), resolve(assets, "examples", "full-demo"), { recursive: true }),
]);
console.log(staging);
