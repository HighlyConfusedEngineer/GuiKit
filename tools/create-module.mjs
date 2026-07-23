import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const componentOption = args.indexOf("--component");
const requestedTag = componentOption >= 0 ? args[componentOption + 1] : null;
const moduleId = args.find((argument, index) => {
  return !argument.startsWith("--") && args[index - 1] !== "--component";
});

if (!moduleId || !/^[a-z][a-z0-9-]*$/.test(moduleId)) {
  console.error(
    "Usage: npm run create:module -- <module-id> [--component gui-element-name]",
  );
  process.exitCode = 1;
} else {
  const tagName = requestedTag ?? `gui-${moduleId}`;
  if (!/^gui-[a-z][a-z0-9-]*$/.test(tagName)) {
    throw new Error('Component names must start with "gui-" and contain a hyphen.');
  }

  const className = tagName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const moduleDirectory = join(projectRoot, "src", "modules", moduleId);
  const testFile = join(projectRoot, "test", `${moduleId}.test.js`);
  if (existsSync(moduleDirectory) || existsSync(testFile)) {
    throw new Error(`Module "${moduleId}" already exists.`);
  }

  await mkdir(moduleDirectory, { recursive: true });
  await writeFile(join(moduleDirectory, "index.js"), javascriptTemplate({
    className,
    moduleId,
    tagName,
  }));
  await writeFile(join(moduleDirectory, "index.d.ts"), typeTemplate({
    className,
    moduleId,
    tagName,
  }));
  await writeFile(join(moduleDirectory, "README.md"), readmeTemplate({
    className,
    moduleId,
    tagName,
  }));
  await writeFile(testFile, testTemplate({ className, moduleId }));

  const packagePath = join(projectRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.exports[`./${moduleId}`] = {
    types: `./src/modules/${moduleId}/index.d.ts`,
    import: `./src/modules/${moduleId}/index.js`,
    default: `./src/modules/${moduleId}/index.js`,
  };
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log(`Created GuiKit module "${moduleId}"`);
  console.log(`  Component: <${tagName}>`);
  console.log(`  Source: src/modules/${moduleId}/index.js`);
  console.log(`  Types: src/modules/${moduleId}/index.d.ts`);
  console.log(`  Tests: test/${moduleId}.test.js`);
  console.log(`  Package export: @gui-template/core/${moduleId}`);
}

function javascriptTemplate({ className, moduleId, tagName }) {
  return `const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};

/**
 * ${className}
 *
 * Keep domain state outside the element. Expose declarative attributes for
 * simple configuration, explicit methods for commands, and gui: prefixed
 * events for observable changes.
 */
export class ${className} extends GuiElement {
  connectedCallback() {
    if (!this.shadowRoot) this.#createView();
  }

  #createView() {
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = \`
      :host { display: block; color: var(--gui-text); }
      .surface {
        padding: var(--gui-space-4);
        border: 1px solid var(--gui-border);
        border-radius: var(--gui-radius-md);
        background: var(--gui-surface);
      }
    \`;
    const surface = document.createElement("div");
    surface.className = "surface";
    surface.textContent = "${moduleId} module";
    root.append(style, surface);
  }
}

export const ${camelCase(moduleId)}Module = Object.freeze({
  id: "${moduleId}",
  version: "0.1.0",
  description: "Describe the module's single responsibility.",
  dependencies: ["core"],
  components: ["${tagName}"],
  setup() {
    if (hasDOM && !customElements.get("${tagName}")) {
      customElements.define("${tagName}", ${className});
    }
    return { ${className} };
  },
});

if (hasDOM && !customElements.get("${tagName}")) {
  customElements.define("${tagName}", ${className});
}
`;
}

function typeTemplate({ className, moduleId, tagName }) {
  return `export class ${className} extends HTMLElement {}

export const ${camelCase(moduleId)}Module: {
  readonly id: "${moduleId}";
  readonly version: string;
  readonly description: string;
  readonly dependencies: readonly ["core"];
  readonly components: readonly ["${tagName}"];
  setup(): { ${className}: typeof ${className} };
};

declare global {
  interface HTMLElementTagNameMap {
    "${tagName}": ${className};
  }
}
`;
}

function readmeTemplate({ className, moduleId, tagName }) {
  return `# ${moduleId}

## Responsibility

Describe what this module owns and, just as importantly, what it does not own.

## Usage

\`\`\`js
import { ${className} } from "@gui-template/core/${moduleId}";
\`\`\`

\`\`\`html
<${tagName}></${tagName}>
\`\`\`

## Public API

Document every attribute, property, method, and \`gui:\` event here.

## Accessibility

Document keyboard behavior, roles, labels, focus handling, and reduced motion.

## Testing

List pure behavior and browser interactions that must be verified.
`;
}

function testTemplate({ className, moduleId }) {
  return `import assert from "node:assert/strict";
import test from "node:test";

import {
  ${className},
  ${camelCase(moduleId)}Module,
} from "../src/modules/${moduleId}/index.js";

test("${moduleId} exposes a valid module manifest", () => {
  assert.equal(${camelCase(moduleId)}Module.id, "${moduleId}");
  assert.equal(typeof ${className}, "function");
});
`;
}

function camelCase(value) {
  return value.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase());
}
