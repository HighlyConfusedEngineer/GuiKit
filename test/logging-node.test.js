import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GuiLogManager } from "../src/modules/logging/index.js";
import { GuiNodeFileSink } from "../src/modules/logging/node.js";

test("Node file sink writes ordered JSONL and rotates bounded files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "guikit-logging-"));
  try {
    const file = join(directory, "application.jsonl");
    const sink = new GuiNodeFileSink(file, { maxBytes: 1_024, maxFiles: 2 });
    const manager = new GuiLogManager();
    manager.addSink(sink);
    const log = manager.createLogger("backend");

    for (let index = 0; index < 18; index += 1) {
      log.info(`record-${index}`, { payload: "x".repeat(80) });
    }
    await manager.flush();

    const files = await readdir(directory);
    assert.equal(files.includes("application.jsonl"), true);
    assert.equal(files.includes("application.jsonl.1"), true);
    assert.equal(files.includes("application.jsonl.3"), false);
    const lines = (await readFile(file, "utf8")).trim().split("\n");
    assert.equal(lines.every((line) => JSON.parse(line).schema === "guikit.log/v1"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
