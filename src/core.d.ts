import type { GuiModuleRegistry } from "./core/module-registry.js";

export { GuiModuleRegistry, defineGuiModule, guiModules } from "./core/module-registry.js";

export function registerGuiModules(
  registry: GuiModuleRegistry,
  modules: unknown | unknown[],
): unknown[];
