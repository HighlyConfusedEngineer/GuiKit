import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GuiNodeEditor,
  GuiNodeGraph,
  nodeEditorModule,
} from "../src/modules/node-editor/index.js";

function createGraph() {
  return new GuiNodeGraph({
    nodes: [
      {
        id: "source",
        outputs: [
          { id: "source:image", type: "image" },
          { id: "source:value", type: "number" },
        ],
      },
      {
        id: "filter",
        inputs: [{ id: "filter:image", type: "image" }],
        outputs: [{ id: "filter:image-out", type: "image" }],
      },
      {
        id: "preview",
        inputs: [{ id: "preview:image", type: "image" }],
      },
    ],
  });
}

test("node editor module exposes its model, component, and manifest", () => {
  assert.equal(typeof GuiNodeEditor, "function");
  assert.equal(typeof GuiNodeEditor.prototype.openNodeSettings, "function");
  assert.equal(typeof GuiNodeEditor.prototype.closeNodeSettings, "function");
  assert.equal(nodeEditorModule.id, "node-editor");
  assert.deepEqual(nodeEditorModule.components, ["gui-node-editor"]);
});

test("node editor uses documented view defaults when attributes are absent", () => {
  const editor = new GuiNodeEditor();
  editor.getAttribute = () => null;
  editor.hasAttribute = () => false;

  assert.equal(editor.minZoom, 0.25);
  assert.equal(editor.maxZoom, 2.5);
  assert.equal(editor.gridSize, 24);
  assert.equal(editor.snapSize, 0);
});

test("node editor registers only after its browser resources initialize", async () => {
  const source = await readFile(
    new URL("../src/modules/node-editor/index.js", import.meta.url),
    "utf8",
  );
  const styles = source.indexOf("const NODE_EDITOR_STYLES");
  const automaticRegistration = source.lastIndexOf(
    'customElements.define("gui-node-editor", GuiNodeEditor)',
  );

  assert.ok(styles >= 0);
  assert.ok(automaticRegistration > styles);
  assert.match(source, /if \(!this\.#viewport\) return;/);
});

test("graph connects compatible output and input ports", () => {
  const graph = createGraph();
  const link = graph.connect("source:image", "filter:image");

  assert.equal(link.from, "source:image");
  assert.equal(link.to, "filter:image");
  assert.equal(graph.links.length, 1);
});

test("graph rejects same-direction and incompatible links", () => {
  const graph = createGraph();
  assert.throws(
    () => graph.connect("source:image", "filter:image-out"),
    /one output to one input/,
  );
  assert.throws(
    () => graph.connect("source:value", "filter:image"),
    /Cannot connect number output/,
  );
});

test("node and port ids are unique", () => {
  const graph = new GuiNodeGraph();
  graph.addNode({ id: "first", outputs: ["shared"] });
  assert.throws(() => graph.addNode({ id: "first" }), /already exists/);
  assert.throws(
    () => graph.addNode({ id: "second", inputs: ["shared"] }),
    /Port "shared" already exists/,
  );
  assert.throws(
    () => graph.addNode({ id: "duplicates", inputs: ["same"], outputs: ["same"] }),
    /Port "same" already exists/,
  );
});

test("a new input link replaces the previous link by default", () => {
  const graph = createGraph();
  graph.connect("source:image", "preview:image", { id: "first" });
  graph.connect("filter:image-out", "preview:image", { id: "second" });

  assert.deepEqual(graph.links.map((link) => link.id), ["second"]);
});

test("input link limits keep the newest allowed links", () => {
  const graph = new GuiNodeGraph({
    nodes: [
      {
        id: "sources",
        outputs: ["one", "two", "three"],
      },
      {
        id: "target",
        inputs: [{ id: "target:values", maxLinks: 2 }],
      },
    ],
  });
  graph.connect("one", "target:values", { id: "first" });
  graph.connect("two", "target:values", { id: "second" });
  graph.connect("three", "target:values", { id: "third" });

  assert.deepEqual(graph.links.map((link) => link.id), ["second", "third"]);
});

test("removing a node also removes its links and ports", () => {
  const graph = createGraph();
  graph.connect("source:image", "filter:image");
  graph.connect("filter:image-out", "preview:image");
  graph.removeNode("filter");

  assert.equal(graph.links.length, 0);
  assert.equal(graph.getPort("filter:image"), undefined);
  assert.equal(graph.nodes.length, 2);
});

test("graph snapshots are detached and reloadable", () => {
  const graph = createGraph();
  graph.connect("source:image", "filter:image", { id: "connection" });
  const snapshot = graph.toJSON();
  snapshot.nodes[0].title = "Changed outside";

  assert.notEqual(graph.getNode("source").title, "Changed outside");
  assert.deepEqual(new GuiNodeGraph(graph.toJSON()).toJSON(), graph.toJSON());
  assert.equal(JSON.stringify(graph.toJSON()).includes('"maxLinks":null'), false);
});

test("moving and updating nodes preserve valid graph state", () => {
  const graph = createGraph();
  graph.connect("source:image", "filter:image", { id: "connection" });
  graph.moveNode("filter", 144, 288);
  graph.updateNode("filter", {
    title: "Updated filter",
    description: "Configured in the settings dialog.",
    color: "#8b5cf6",
    data: { strength: 0.8 },
  });

  assert.deepEqual(
    { x: graph.getNode("filter").x, y: graph.getNode("filter").y },
    { x: 144, y: 288 },
  );
  assert.equal(graph.getNode("filter").title, "Updated filter");
  assert.equal(graph.getNode("filter").description, "Configured in the settings dialog.");
  assert.equal(graph.getNode("filter").color, "#8b5cf6");
  assert.deepEqual(graph.getNode("filter").data, { strength: 0.8 });
  assert.equal(graph.getLink("connection").to, "filter:image");
});
