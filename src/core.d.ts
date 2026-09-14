export { GuiModuleRegistry, defineGuiModule, guiModules } from "./core/module-registry.js";

export function registerGuiModules(
  registry: GuiModuleRegistry,
  modules: GuiModuleDefinition | GuiModuleDefinition[],
): unknown[];
