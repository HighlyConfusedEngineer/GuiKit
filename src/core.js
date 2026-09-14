/**
 * Lightweight GuiKit entry point.
 *
 * It contains no optional UI modules. Import component subpaths (for example
 * `@gui-template/core/data-views`) and register the modules you need.
 */
export {
  GuiModuleRegistry,
  defineGuiModule,
  guiModules,
} from "./core/module-registry.js";

export function registerGuiModules(registry, modules) {
  const list = Array.isArray(modules) ? modules : [modules];
  return list.filter(Boolean).map((module) => registry.register(module));
}
