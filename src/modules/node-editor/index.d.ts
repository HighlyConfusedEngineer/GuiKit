export type GuiNodePortDirection = "input" | "output";

export interface GuiNodePort {
  id: string;
  label?: string;
  type?: string;
  maxLinks?: number;
  direction?: GuiNodePortDirection;
  [key: string]: unknown;
}

export type GuiNodeParameterType =
  | "text"
  | "number"
  | "range"
  | "select"
  | "boolean"
  | "readonly";

export interface GuiNodeParameterOption {
  value: string | number;
  label?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface GuiNodeParameter {
  id: string;
  label?: string;
  type?: GuiNodeParameterType;
  value?: unknown;
  inline?: boolean;
  disabled?: boolean;
  unit?: string;
  placeholder?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<string | number | GuiNodeParameterOption>;
  data?: unknown;
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
  allowMultipleConnections?: boolean;
  maxConnections?: number;
  groupId?: string;
  collapsed?: boolean;
  pinned?: boolean;
  subgraph?: GuiNodeGraphData;
  inputs?: Array<string | GuiNodePort>;
  outputs?: Array<string | GuiNodePort>;
  parameters?: GuiNodeParameter[];
  data?: unknown;
  [key: string]: unknown;
}

export interface GuiNodeLink {
  id: string;
  from: string;
  to: string;
  type?: string;
  points?: GuiNodeRoutingPoint[];
  data?: unknown;
  [key: string]: unknown;
}

export interface GuiNodeGraphData {
  nodes?: GuiNodeDefinition[];
  links?: GuiNodeLink[];
}

export type GuiNodeFlowDirection = "horizontal" | "vertical";

export interface GuiNodeRoutingPoint {
  x: number;
  y: number;
}

export interface GuiNodeRoutingObstacle {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

export interface GuiNodeRoutingOptions {
  flowDirection?: GuiNodeFlowDirection;
  obstacles?: GuiNodeRoutingObstacle[];
  clearance?: number;
  stub?: number;
  cornerRadius?: number;
}

export interface GuiNodeConnectionRoute {
  direction: GuiNodeFlowDirection;
  points: GuiNodeRoutingPoint[];
  path: string;
  routed: boolean;
}

export interface GuiNodeWireTypeDefinition {
  id?: string;
  type?: string;
  label?: string;
  color?: string;
  width?: number;
  opacity?: number;
  dash?: string | number[];
}

export interface GuiNodeWireType {
  id: string;
  label: string;
  color: string;
  width: number;
  opacity: number;
  dash: string;
}

export function routeNodeConnection(
  from: GuiNodeRoutingPoint,
  to: GuiNodeRoutingPoint,
  options?: GuiNodeRoutingOptions,
): GuiNodeConnectionRoute;

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
  setLinkPoints(id: string, points?: GuiNodeRoutingPoint[]): GuiNodeLink;
  groupNodes(ids: Iterable<string>, groupId?: string | null): GuiNodeDefinition[];
  setSubgraph(id: string, graph?: GuiNodeGraphData | null): Required<GuiNodeGraphData> | undefined;
  getSubgraph(id: string): Required<GuiNodeGraphData> | undefined;
  extract(ids: Iterable<string>): Required<GuiNodeGraphData>;
  duplicate(ids: Iterable<string>, options?: {
    x?: number; y?: number; keepTitles?: boolean;
  }): { nodes: GuiNodeDefinition[]; links: GuiNodeLink[] };
  autoLayout(options?: {
    direction?: GuiNodeFlowDirection; layerGap?: number; nodeGap?: number;
  }): GuiNodeDefinition[];
  validate(options?: { allowCycles?: boolean }): {
    valid: boolean;
    errors: Array<{ code: string; message: string; [key: string]: unknown }>;
    warnings: Array<{ code: string; message: string; [key: string]: unknown }>;
    order: string[];
  };
  toJSON(): Required<GuiNodeGraphData>;
}

export class GuiNodeEditor extends HTMLElement {
  readonly label: string;
  readOnly: boolean;
  flowDirection: GuiNodeFlowDirection;
  readonly graph: GuiNodeGraph;
  readonly wireTypes: GuiNodeWireType[];
  readonly selectedNodes: string[];
  readonly selectedLink: string | null;
  readonly graphPath: string[];
  history: import("../commands/index.js").GuiHistory | null;
  clipboard: import("../runtime/index.js").GuiClipboard | null;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly gridSize: number;
  readonly snapSize: number;
  setGraph(graph: GuiNodeGraph | GuiNodeGraphData, options?: { preservePath?: boolean }): void;
  setNodeSubgraph(id: string, graph: GuiNodeGraphData): Required<GuiNodeGraphData>;
  enterSubgraph(id: string): boolean;
  exitSubgraph(options?: { save?: boolean }): boolean;
  getGraph(): Required<GuiNodeGraphData>;
  addNode(node: GuiNodeDefinition): GuiNodeDefinition;
  updateNode(id: string, patch: Partial<GuiNodeDefinition>): GuiNodeDefinition;
  getNodeParameter(
    nodeId: string,
    parameterId: string,
  ): GuiNodeParameter | undefined;
  setNodeParameter(
    nodeId: string,
    parameterId: string,
    value: unknown,
  ): GuiNodeParameter | null;
  removeNode(id: string): boolean;
  connect(
    from: string,
    to: string,
    options?: Partial<GuiNodeLink> & { replaceInput?: boolean },
  ): GuiNodeLink | null;
  disconnect(id: string, options?: { reason?: string }): boolean;
  setWireTypes(
    definitions?:
      | Record<string, GuiNodeWireTypeDefinition>
      | GuiNodeWireTypeDefinition[],
  ): GuiNodeWireType[];
  registerWireType(
    type: string,
    definition?: GuiNodeWireTypeDefinition,
  ): GuiNodeWireType;
  getWireType(type: string): GuiNodeWireType;
  clear(): void;
  selectNode(id: string, additive?: boolean): boolean;
  selectLink(id: string): boolean;
  clearSelection(): void;
  openNodeSettings(id: string): boolean;
  closeNodeSettings(): boolean;
  setView(view: { x?: number; y?: number; zoom?: number }): void;
  zoomToFit(padding?: number): void;
  zoomToSelection(padding?: number): void;
  findNodes(query: string, options?: { select?: boolean; focus?: boolean }): GuiNodeDefinition[];
  autoLayout(options?: {
    direction?: GuiNodeFlowDirection; layerGap?: number; nodeGap?: number; fit?: boolean;
  }): GuiNodeDefinition[];
  alignSelection(alignment?: "left" | "center" | "right" | "top" | "middle" | "bottom"): boolean;
  distributeSelection(axis?: "horizontal" | "vertical"): boolean;
  groupSelection(groupId?: string): { id: string; nodes: GuiNodeDefinition[] } | null;
  ungroupSelection(): boolean;
  addComment(comment?: Partial<GuiNodeDefinition> & { text?: string }): GuiNodeDefinition;
  setNodeCollapsed(id: string, collapsed?: boolean): boolean;
  toggleBreakpoint(id: string, force?: boolean): boolean;
  setExecutionState(id: string,
    state?: "idle" | "queued" | "running" | "success" | "error" | "paused",
    detail?: Record<string, unknown>): boolean;
  setLinkPoints(id: string, points?: GuiNodeRoutingPoint[]): GuiNodeLink;
  validateGraph(options?: { allowCycles?: boolean }): ReturnType<GuiNodeGraph["validate"]>;
  copySelection(options?: { system?: boolean }): Promise<boolean>;
  cutSelection(options?: { system?: boolean }): Promise<boolean>;
  paste(options?: { system?: boolean; x?: number; y?: number; keepTitles?: boolean }):
    Promise<GuiNodeDefinition[] | null>;
  duplicateSelection(options?: { x?: number; y?: number; keepTitles?: boolean }):
    { nodes: GuiNodeDefinition[]; links: GuiNodeLink[] } | null;
}

export const nodeEditorModule: {
  readonly id: "node-editor";
  readonly version: "0.4.0";
  readonly description: string;
  readonly dependencies: readonly ["core"];
  readonly components: readonly ["gui-node-editor"];
  setup(): {
    GuiNodeEditor: typeof GuiNodeEditor;
    GuiNodeGraph: typeof GuiNodeGraph;
    routeNodeConnection: typeof routeNodeConnection;
  };
};

declare global {
  interface HTMLElementTagNameMap {
    "gui-node-editor": GuiNodeEditor;
  }
}
