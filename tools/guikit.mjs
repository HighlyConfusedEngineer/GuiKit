#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArguments } from "./dx-utils.mjs";
import { inspectGuiKitProject } from "./doctor.mjs";
import { generateBridgeFiles } from "./generate-bridge.mjs";
import { generateTokenFiles } from "./tokens.mjs";
import { createExtension } from "./create-extension.mjs";

export async function runGuiKitCommand(argumentsList, currentDirectory = process.cwd()) {
  const { positionals, options } = parseCliArguments(argumentsList);
  const [command, subject] = positionals;
  if (command === "doctor") {
    const report = await inspectGuiKitProject(path.resolve(currentDirectory, String(options.root ?? ".")));
    return { kind: "doctor", report, exitCode: report.healthy ? 0 : 1 };
  }
  if (command === "bridge" && subject) {
    return { kind: "bridge", files: await generateBridgeFiles(path.resolve(currentDirectory, subject), path.resolve(currentDirectory, String(options.out ?? "generated"))), exitCode: 0 };
  }
  if (command === "tokens" && subject) {
    return { kind: "tokens", files: await generateTokenFiles(path.resolve(currentDirectory, subject), path.resolve(currentDirectory, String(options.out ?? "generated"))), exitCode: 0 };
  }
  if (command === "extension" && subject) {
    return { kind: "extension", directory: await createExtension(currentDirectory, subject), exitCode: 0 };
  }
  return { kind: "help", exitCode: command ? 1 : 0, message: "Usage: guikit <doctor|bridge|tokens|extension> ..." };
}
async function run() {
  const result = await runGuiKitCommand(process.argv.slice(2));
  if (result.kind === "doctor") result.report.checks.forEach((check) => console.log(`${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.message}`));
  else console.log(result.message ?? JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
