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
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly gridSize: number;
  readonly snapSize: number;
  setGraph(graph: GuiNodeGraph | GuiNodeGraphData): void;
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
}

export const nodeEditorModule: {
  readonly id: "node-editor";
  readonly version: "0.3.0";
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
