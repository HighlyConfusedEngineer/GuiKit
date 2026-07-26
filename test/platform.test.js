import assert from "node:assert/strict";
import test from "node:test";
import {
  GuiAiSession,
  GuiAutomationModel,
  GuiCollaborationSession,
  GuiDesignSystem,
  GuiDocumentModel,
  GuiFileWorkspace,
  GuiInteractionRecorder,
  GuiMemoryFileAdapter,
  GuiMockHostBridge,
  GuiPluginRegistry,
  histogram,
  pivotRows,
  platformModule,
  summarizeTable,
} from "../src/modules/platform/index.js";

test("platform module declares all application surfaces", () => {
  assert.equal(platformModule.id, "platform");
  assert.equal(platformModule.elements.length, 10);
});

test("file workspace preserves dirty state through an adapter", async () => {
  const workspace = new GuiFileWorkspace({ adapter: new GuiMemoryFileAdapter({ "a.txt": "before" }) });
  await workspace.open("a.txt");
  workspace.update("a.txt", "after");
  assert.equal(workspace.activeFile.dirty, true);
  await workspace.save();
  assert.equal(workspace.activeFile.dirty, false);
  await workspace.rename("a.txt", "b.txt");
  assert.equal(await workspace.open("b.txt").then((file) => file.content), "after");
});

test("collaboration queues offline operations and receives peers/comments", () => {
  const sent = [];
  const session = new GuiCollaborationSession({ clientId: "me", state: { title: "Old" } });
  session.apply({ path: "title", value: "New" });
  session.connect({ send: (operation) => sent.push(operation) });
  session.receive({ clientId: "you", type: "presence", presence: { clientId: "you", name: "Taylor" } });
  session.receive({ clientId: "you", type: "comment", comment: { id: "c1", text: "Looks good" } });
  assert.equal(session.state.title, "New");
  assert.equal(sent.length, 1);
  assert.equal(session.peers[0].name, "Taylor");
  assert.equal(session.comments[0].text, "Looks good");
});

test("analysis utilities summarize, pivot, and bucket numeric records", () => {
  const rows = [{ team: "A", day: "Mon", value: 2 }, { team: "A", day: "Tue", value: 4 }, { team: "B", day: "Mon", value: 3 }];
  assert.equal(summarizeTable(rows).value.mean, 3);
  assert.deepEqual(pivotRows(rows, { row: "team", column: "day", value: "value" }), [{ team: "A", Mon: 2, Tue: 4 }, { team: "B", Mon: 3 }]);
  assert.equal(histogram([1, 2, 3, 4], { bins: 2 }).reduce((sum, bin) => sum + bin.count, 0), 4);
});

test("automation retries and produces a serializable run result", async () => {
  let attempts = 0;
  const flow = new GuiAutomationModel({ steps: [{ id: "retry", retries: 1 }] });
  const result = await flow.run({}, async () => { attempts += 1; if (attempts === 1) throw new Error("temporary"); });
  assert.equal(result.status, "complete");
  assert.equal(result.steps[0].attempts, 2);
});

test("AI sessions accept streaming providers", async () => {
  const session = new GuiAiSession({ provider: { async *stream() { yield "hello "; yield { text: "world" }; } } });
  assert.equal((await session.send("hi")).content, "hello world");
});

test("plugin permissions and mock host calls remain host controlled", async () => {
  const registry = new GuiPluginRegistry({ permissions: ["storage"] });
  registry.register({ id: "ok", name: "OK", permissions: ["storage"] }, async () => ({ activate: () => undefined }));
  await registry.activate("ok");
  registry.register({ id: "blocked", name: "Blocked", permissions: ["network"] });
  await assert.rejects(() => registry.activate("blocked"), /permissions/);
  const bridge = new GuiMockHostBridge({ ping: ({ value }) => value + 1 });
  assert.equal(await bridge.invoke("ping", { value: 4 }), 5);
});

test("documents, tokens, and test recordings remain portable", async () => {
  const documentModel = new GuiDocumentModel({ template: "<h1>{{report.title}}</h1>" });
  assert.equal(documentModel.render({ report: { title: "Status" } }), "<h1>Status</h1>");
  const designSystem = new GuiDesignSystem();
  designSystem.setToken("color.accent", "#fff");
  assert.deepEqual(designSystem.toFigmaVariables(), [{ name: "color/accent", type: "color", value: "#fff" }]);
  const recorder = new GuiInteractionRecorder();
  recorder.record({ type: "click", target: "save" });
  let replayed = false;
  await recorder.replay(async () => ({ dispatchEvent: () => { replayed = true; } }));
  assert.equal(replayed, true);
});
