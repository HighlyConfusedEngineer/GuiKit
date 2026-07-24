export interface GuiWorkspacePanel {
  id: string;
  title?: string;
  icon?: string;
  closable?: boolean;
  detachable?: boolean;
  data?: Record<string, unknown>;
}

export type GuiWorkspaceLayout =
  | { type: "tabs"; id: string; panels: string[]; active: string | null }
  | {
      type: "split";
      id: string;
      direction: "horizontal" | "vertical";
      sizes: number[];
      children: GuiWorkspaceLayout[];
    };

export interface GuiWorkspaceData {
  schema?: "guikit.workspace/v1";
  panels?: GuiWorkspacePanel[];
  layout?: GuiWorkspaceLayout;
  presets?: Record<string, GuiWorkspaceLayout>;
}

export class GuiWorkspaceModel extends EventTarget {
  constructor(data?: GuiWorkspaceData);
  readonly panels: GuiWorkspacePanel[];
  readonly layout: GuiWorkspaceLayout;
  addPanel(panel: GuiWorkspacePanel, targetGroup?: string | null): boolean;
  removePanel(id: string): boolean;
  activate(id: string): boolean;
  movePanel(id: string, targetGroupId: string, index?: number): boolean;
  split(groupId: string, direction: "horizontal" | "vertical", options?: {
    panels?: string[]; id?: string; active?: string; splitId?: string;
    ratio?: number; before?: boolean;
  }): string;
  resize(splitId: string, sizes: number[]): void;
  detach(id: string): boolean;
  savePreset(id: string): void;
  restorePreset(id: string): boolean;
  restore(data: GuiWorkspaceData): void;
  toJSON(): GuiWorkspaceData;
}

export class GuiWorkspace extends HTMLElement {
  model: GuiWorkspaceModel;
  value: GuiWorkspaceData;
  usePersistence(
    store: import("../runtime/index.js").GuiPersistenceStore,
    key?: string,
  ): void;
  save(): unknown;
  render(): void;
}

export const workspaceModule: Readonly<{
  id: "workspace";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly ["gui-workspace"];
  setup(): { GuiWorkspaceModel: typeof GuiWorkspaceModel };
}>;
