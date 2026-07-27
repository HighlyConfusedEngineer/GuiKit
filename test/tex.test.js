import assert from "node:assert/strict";
import test from "node:test";
import { GuiTexDocument, GuiTexTemplate, escapeTex, texModule, validateTex } from "../src/modules/tex/index.js";

test("TeX source escaping and safe-mode validation are deterministic", () => {
  assert.equal(escapeTex("A_B & C"), "A\\_B \\& C");
  assert.equal(validateTex("\\begin{document}ok\\end{document}").length, 0);
  assert.match(validateTex("\\write18{whoami}")[0].message, /Shell escape/);
});

test("TeX documents compile through an explicit adapter and preserve diagnostics", async () => {
  const documentModel = new GuiTexDocument("\\begin{document}Ready\\end{document}");
  const result = await documentModel.compile({ compile: async (source, options) => ({ status: "completed", pdfUrl: "https://example.test/report.pdf", log: `${options.engine}:${source.length}` }) });
  assert.equal(result.status, "completed");
  assert.equal(documentModel.result.pdfUrl, "https://example.test/report.pdf");
  const blocked = new GuiTexDocument("\\input{secret.tex}");
  assert.equal((await blocked.compile({ compile: async () => ({ status: "completed" }) })).status, "blocked");
});

test("TeX templates escape data by default and expose the module contract", async () => {
  const template = new GuiTexTemplate("\\begin{document}{{name}}\\end{document}");
  assert.equal(template.render({ name: "A_B" }), "\\begin{document}A\\_B\\end{document}");
  assert.equal((await template.compile({ name: "Ada" }, { compile: async () => ({ status: "completed" }) })).status, "completed");
  assert.deepEqual(texModule.components, ["gui-tex-editor", "gui-tex-pdf-preview"]);
});
