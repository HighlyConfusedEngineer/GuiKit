import assert from "node:assert/strict";
import test from "node:test";

import {
  GuiDataCollection,
  GuiPagedDataSource,
  GuiTreeModel,
  dataViewsModule,
} from "../src/modules/data-views/index.js";

test("data collection sorts, filters, edits, and selects detached rows", () => {
  const model = new GuiDataCollection([
    { id: "a", name: "Zulu", value: 2 },
    { id: "b", name: "Alpha", value: 1 },
  ]);
  model.setSort({ field: "name" });
  assert.equal(model.at(0).id, "b");
  model.setFilter("name", "zul");
  assert.equal(model.length, 1);
  model.select("a");
  assert.deepEqual(model.selectedKeys, ["a"]);
  model.update("a", { value: 9 });
  assert.equal(model.at(0).value, 9);
  assert.equal(model.groups("name")[0].rows.length, 1);
  assert.match(model.toCSV(["id", "name"]), /^id,name\r\n/);
});

test("paged data source caches async server pages", async () => {
  let calls = 0;
  const source = new GuiPagedDataSource(async ({ offset, pageSize }) => {
    calls += 1;
    return {
      total: 1_000_000,
      rows: Array.from({ length: pageSize }, (_, index) => ({
        id: offset + index,
      })),
    };
  }, { pageSize: 25 });
  assert.equal((await source.page(2)).rows[0].id, 50);
  await source.page(2);
  assert.equal(calls, 1);
  assert.equal(source.total, 1_000_000);
});

test("tree model flattens only expanded branches and rejects duplicate ids", () => {
  const tree = new GuiTreeModel([
    { id: "root", label: "Root", children: [{ id: "child", label: "Child" }] },
  ]);
  assert.equal(tree.flatten().length, 1);
  tree.toggle("root", true);
  assert.equal(tree.flatten().length, 2);
  assert.equal(tree.flatten()[1].level, 2);
  assert.throws(
    () => new GuiTreeModel([{ id: "same", children: [{ id: "same" }] }]),
    /duplicated/,
  );
});

test("data views module exposes all virtualized components", () => {
  assert.equal(dataViewsModule.id, "data-views");
  assert.deepEqual(dataViewsModule.components, [
    "gui-virtual-list",
    "gui-data-grid",
    "gui-tree-view",
  ]);
});
