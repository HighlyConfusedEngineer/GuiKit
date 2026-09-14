import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  use: { browserName: "chromium", headless: true },
  workers: 1,
});
