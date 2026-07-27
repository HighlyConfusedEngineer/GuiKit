import path from "node:path";

export function parseCliArguments(argumentsList) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const token = argumentsList[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const [key, inlineValue] = token.slice(2).split("=", 2);
    const next = argumentsList[index + 1];
    const value = inlineValue ?? (next && !next.startsWith("--") ? argumentsList[++index] : true);
    options[key] = value;
  }
  return { positionals, options };
}

export function safeIdentifier(value, fallback = "GuiKit") {
  const words = String(value ?? "").match(/[A-Za-z0-9]+/g) ?? [];
  const identifier = words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
  return (/^[A-Za-z_]/.test(identifier) ? identifier : fallback) || fallback;
}

export function safeProjectName(value) {
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(value ?? "");
}

export function relativeImport(from, to) {
  const result = path.relative(path.dirname(from), to).replaceAll("\\", "/");
  return result.startsWith(".") ? result : `./${result}`;
}
