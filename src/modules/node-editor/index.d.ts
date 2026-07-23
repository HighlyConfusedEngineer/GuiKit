export type GuiNodePortDirection = "input" | "output";

export interface GuiNodePort {
  id: string;
  label?: string;
  type?: string;
  maxLinks?: number;
  direction?: GuiNodePortDirection;
  [key: string]: unknown;
}

export interface GuiNodeDefinition {
  id: string;
  title?: string;
  type?: string;
  description?: string;
  color?: string;
  x?: number;
  y?: number;
  width?: number;
  inputs?: Array<string | GuiNodePort>;
  outputs?: Array<string | GuiNodePort>;
  data?: unknown;
  [key: string]: unknown;
}

export interface GuiNodeLink {
  id: string;
  from: string;
  to: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface GuiNodeGraphData {
  nodes?: GuiNodeDefinition[];
  links?: GuiNodeLink[];
}

export class GuiNodeGraph {
  constructor(graph?: GuiNodeGraphData);
  readonly nodes: GuiNodeDefinition[];
  readonly links: GuiNodeLink[];
  getNode(id: string): GuiNodeDefinition | undefined;
  getLink(id: string): GuiNodeLink | undefined;
  getPort(id: string): GuiNodePort | undefined;
  load(graph?: GuiNodeGraphData): this;
  clear(): void;
  addNode(node: GuiNodeDefinition): GuiNodeDefinition;
  updateNode(id: string, patch: Partial<GuiNodeDefinition>): GuiNodeDefinition;
  moveNode(id: string, x: number, y: number): { x: number; y: number };
  removeNode(id: string): boolean;
  connect(
    firstPortId: string,
    secondPortId: string,
    options?: Partial<GuiNodeLink> & { replaceInput?: boolean },
  ): GuiNodeLink;
  removeLink(id: string): boolean;
  toJSON(): Required<GuiNodeGraphData>;
}

export class GuiNodeEditor extends HTMLElement {
  readonly label: string;
  readOnly: boolean;
  readonly graph: GuiNodeGraph;
  readonly selectedNodes: string[];
  readonly selectedLink: string | null;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly gridSize: number;
  readonly snapSize: number;
  setGraph(graph: GuiNodeGraph | GuiNodeGraphData): void;
  getGraph(): Required<GuiNodeGraphData>;
  addNode(node: GuiNodeDefinition): GuiNodeDefinition;
  updateNode(id: string, patch: Partial<GuiNodeDefinition>): GuiNodeDefinition;
  removeNode(id: string): boolean;
  connect(
    from: string,
    to: string,
    options?: Partial<GuiNodeLink> & { replaceInput?: boolean },
  ): GuiNodeLink | null;
  disconnect(id: string): boolean;
  clear(): void;
  selectNode(id: string, additive?: boolean): boolean;
  selectLink(id: string): boolean;
  clearSelection(): void;
  setView(view: { x?: number; y?: number; zoom?: number }): void;
  zoomToFit(padding?: number): void;
}

export const nodeEditorModule: {
  readonly id: "node-editor";
  readonly version: string;
  readonly description: string;
  readonly dependencies: readonly ["core"];
  readonly components: readonly ["gui-node-editor"];
  setup(): { GuiNodeEditor: typeof GuiNodeEditor; GuiNodeGraph: typeof GuiNodeGraph };
};

declare global {
  interface HTMLElementTagNameMap {
    "gui-node-editor": GuiNodeEditor;
  }
}
