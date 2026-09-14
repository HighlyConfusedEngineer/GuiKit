import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

let server;
let baseUrl;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = normalize(join(process.cwd(), request.url === "/" ? "test/browser/fixture.html" : request.url));
    if (!path.startsWith(process.cwd())) return response.writeHead(403).end();
    try {
      const body = await readFile(path);
      const type = extname(path) === ".js" ? "text/javascript" : "text/html";
      response.writeHead(200, { "content-type": type });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(() => new Promise((resolve) => server.close(resolve)));

test("grid preserves editing, keyboard selection, scrolling, and model listeners after reattach", async ({ page }) => {
  await page.goto(baseUrl);
  await page.evaluate(async () => {
    await import("/src/modules/data-views/index.js");
    const model = new window.GuiDataCollection?.() ?? null;
    const grid = document.createElement("gui-data-grid");
    grid.style.height = "160px";
    grid.columns = [{ field: "name", editable: true }, { field: "value" }];
    grid.rows = Array.from({ length: 200 }, (_, id) => ({ id, name: `row-${id}`, value: id }));
    document.body.append(grid);
  });
  const grid = page.locator("gui-data-grid");
  const viewport = grid.locator("css=>>> .viewport");
  await viewport.focus();
  await page.keyboard.press("ArrowDown");
  await expect(grid.locator("css=>>> .row[aria-selected=true]")).toHaveCount(1);
  await viewport.evaluate((element) => { element.scrollTop = 1_500; element.dispatchEvent(new Event("scroll")); });
  await expect(grid.locator("css=>>> .row")).toHaveCount(lessThan(30));
  const cell = grid.locator("css=>>> .row .cell[contenteditable=true]").first();
  await cell.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("edited");
  await page.keyboard.press("Tab");
  await expect(cell).toHaveText("edited");
  await grid.evaluate((element) => { const parent = element.parentElement; element.remove(); parent.append(element); });
  await grid.evaluate((element) => element.model.update(0, { name: "reattached" }));
  await expect(grid.locator("css=>>> .cell")).toContainText("reattached");
});

function lessThan(limit) {
  return { asymmetricMatch: (value) => value < limit, toString: () => `< ${limit}` };
}
