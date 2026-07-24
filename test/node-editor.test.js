import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GuiNodeEditor,
  GuiNodeGraph,
  nodeEditorModule,
  routeNodeConnection,
} from "../src/modules/node-editor/index.js";
import { routeNodeConnection as bundledRouteNodeConnection } from "../src/gui.js";

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
  assert.equal(typeof GuiNodeEditor.prototype.getNodeParameter, "function");
  assert.equal(typeof GuiNodeEditor.prototype.setNodeParameter, "function");
  assert.equal(typeof routeNodeConnection, "function");
  assert.equal(bundledRouteNodeConnection, routeNodeConnection);
  assert.equal(nodeEditorModule.id, "node-editor");
  assert.equal(nodeEditorModule.version, "0.2.1");
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
  assert.equal(editor.flowDirection, "horizontal");

  editor.getAttribute = (name) => name === "flow-direction" ? "vertical" : null;
  assert.equal(editor.flowDirection, "vertical");
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
  assert.match(source, /static observedAttributes = \["readonly", "label", "flow-direction"\]/);
  assert.match(source, /\.links \{\s+z-index: 2;/);
  assert.match(source, /\.nodes \{\s+z-index: 1;/);
});

function segmentIntersectsRectangle(first, second, rectangle) {
  if (first.y === second.y) {
    return first.y > rectangle.top
      && first.y < rectangle.bottom
      && Math.max(first.x, second.x) > rectangle.left
      && Math.min(first.x, second.x) < rectangle.right;
  }
  return first.x > rectangle.left
    && first.x < rectangle.right
    && Math.max(first.y, second.y) > rectangle.top
    && Math.min(first.y, second.y) < rectangle.bottom;
}

function routeIntersectsRectangle(route, rectangle) {
  return route.points.slice(1).some((point, index) => (
    segmentIntersectsRectangle(route.points[index], point, rectangle)
  ));
}

test("horizontal routes leave to the right and avoid intervening nodes", () => {
  const obstacle = { left: 140, top: 0, right: 260, bottom: 180 };
  const route = routeNodeConnection(
    { x: 0.123456, y: 90.123456 },
    { x: 400.654321, y: 90.123456 },
    { obstacles: [obstacle] },
  );

  assert.equal(route.direction, "horizontal");
  assert.equal(route.routed, true);
  assert.equal(route.points[1].x > route.points[0].x, true);
  assert.equal(routeIntersectsRectangle(route, obstacle), false);
  assert.match(route.path, /^M /);
  assert.match(route.path, / Q /);
  const firstLine = /^M [-\d.]+ ([-\d.]+) L [-\d.]+ ([-\d.]+)/.exec(route.path);
  assert.ok(firstLine);
  assert.equal(Math.abs(Number(firstLine[1]) - Number(firstLine[2])) < 0.001, true);
});

test("vertical routes leave downward and avoid intervening nodes", () => {
  const obstacle = { x: 0, y: 140, width: 180, height: 120 };
  const rectangle = { left: 0, top: 140, right: 180, bottom: 260 };
  const route = routeNodeConnection(
    { x: 90, y: 0 },
    { x: 90, y: 400 },
    { flowDirection: "vertical", obstacles: [obstacle] },
  );

  assert.equal(route.direction, "vertical");
  assert.equal(route.routed, true);
  assert.equal(route.points[1].y > route.points[0].y, true);
  assert.equal(routeIntersectsRectangle(route, rectangle), false);
  assert.match(route.path, /^M /);
  assert.match(route.path, / Q /);
});

test("backward links route outside both endpoint node surfaces", () => {
  const source = { left: 0, top: 40, right: 220, bottom: 220 };
  const target = { left: 400, top: 300, right: 620, bottom: 460 };
  const route = routeNodeConnection(
    { x: 220, y: 140 },
    { x: 400, y: 380 },
    { obstacles: [source, target] },
  );

  assert.equal(route.routed, true);
  assert.equal(routeIntersectsRectangle(route, source), false);
  assert.equal(routeIntersectsRectangle(route, target), false);
  assert.equal(route.points.some((point) => point.x > source.right), true);
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

test("node parameters normalize typed values and enforce node-local ids", () => {
  const graph = new GuiNodeGraph({
    nodes: [{
      id: "processor",
      parameters: [
        {
          id: "gain",
          label: "Gain",
          type: "range",
          value: 12,
          min: 0,
          max: 10,
          step: 0.5,
          unit: "dB",
          inline: true,
        },
        {
          id: "mode",
          type: "select",
          value: "unknown",
          options: [
            { value: "safe", label: "Safe", disabled: true },
            { value: "fast", label: "Fast" },
          ],
        },
        { id: "enabled", type: "boolean", value: "off" },
        { id: "summary", type: "readonly", value: { state: "ready" }, inline: true },
      ],
    }],
  });
  const parameters = graph.getNode("processor").parameters;

  assert.equal(parameters[0].value, 10);
  assert.equal(parameters[0].unit, "dB");
  assert.equal(parameters[0].inline, true);
  assert.equal(parameters[1].value, "fast");
  assert.equal(parameters[1].inline, false);
  assert.equal(parameters[2].value, false);
  assert.deepEqual(parameters[3].value, { state: "ready" });

  assert.throws(
    () => graph.addNode({
      id: "duplicates",
      parameters: [{ id: "same" }, { id: "same" }],
    }),
    /Parameter "same" already exists/,
  );
});

test("editor reads and updates normalized node parameter values", () => {
  const editor = new GuiNodeEditor();
  editor.setGraph({
    nodes: [{
      id: "processor",
      parameters: [
        {
          id: "gain",
          type: "range",
          value: 2,
          min: 0,
          max: 10,
          inline: true,
        },
      ],
    }],
  });

  const detached = editor.getNodeParameter("processor", "gain");
  detached.value = 9;
  assert.equal(editor.getNodeParameter("processor", "gain").value, 2);

  const updated = editor.setNodeParameter("processor", "gain", 12);
  assert.equal(updated.value, 10);
  assert.equal(editor.getGraph().nodes[0].parameters[0].value, 10);
  assert.throws(
    () => editor.setNodeParameter("processor", "missing", 1),
    /Unknown parameter "missing"/,
  );
  assert.throws(
    () => editor.setNodeParameter("missing", "gain", 1),
    /Unknown node "missing"/,
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
