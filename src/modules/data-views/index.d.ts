export interface GuiSortRule {
  field: string;
  direction?: "asc" | "desc";
}

export class GuiDataCollection<Row extends Record<string, unknown> = Record<string, unknown>>
  extends EventTarget {
  constructor(rows?: Row[], options?: { key?: keyof Row & string });
  readonly length: number;
  readonly sourceLength: number;
  readonly sort: GuiSortRule[];
  readonly selectedKeys: unknown[];
  setRows(rows: Row[]): void;
  append(rows: Row | Row[]): void;
  at(index: number): Row | undefined;
  keyAt(index: number): unknown;
  indexOf(key: unknown): number;
  slice(start?: number, end?: number): Row[];
  setSort(sort?: GuiSortRule | GuiSortRule[]): void;
  setFilter(field: keyof Row & string,
    predicate: string | ((value: unknown, row: Row) => boolean) | null): void;
  clearFilters(): void;
  select(key: unknown, options?: { additive?: boolean; toggle?: boolean }): boolean;
  clearSelection(): void;
  update(key: unknown, patch: Partial<Row>): boolean;
  groups(field: keyof Row & string): Array<{ value: unknown; rows: Row[] }>;
  toCSV(fields?: Array<keyof Row & string>): string;
  toJSON(): unknown;
}

export class GuiPagedDataSource<Row extends Record<string, unknown> = Record<string, unknown>>
  extends EventTarget {
  constructor(loader: (request: {
    page: number; pageSize: number; offset: number; signal?: AbortSignal;
    sort: GuiSortRule[]; filters: Record<string, unknown>;
  }) => Promise<Row[] | { rows: Row[]; total: number }>, options?: {
    pageSize?: number; total?: number; maxPages?: number;
  });
  pageSize: number;
  total: number;
  page(index: number, options?: {
    reload?: boolean; signal?: AbortSignal;
    sort?: GuiSortRule[]; filters?: Record<string, unknown>;
  }): Promise<{ page: number; rows: Row[]; total: number }>;
  prefetch(indices: number | number[], options?: {
    reload?: boolean; signal?: AbortSignal; sort?: GuiSortRule[]; filters?: Record<string, unknown>;
  }): Promise<Array<{ page: number; rows: Row[]; total: number }>>;
  cancel(page?: number): number;
  invalidate(page?: number): void;
}

export interface GuiTreeItem<Node> {
  key: unknown;
  node: Node;
  level: number;
  parentKey: unknown;
  expanded: boolean;
  hasChildren: boolean;
  positionInSet: number;
  setSize: number;
}

export class GuiTreeModel<Node extends Record<string, unknown> = Record<string, unknown>>
  extends EventTarget {
  constructor(nodes?: Node[], options?: { key?: keyof Node & string; children?: keyof Node & string });
  setNodes(nodes: Node[]): void;
  toggle(key: unknown, force?: boolean): boolean;
  expandAll(): void;
  collapseAll(): void;
  find(key: unknown): Node | undefined;
  flatten(options?: { includeCollapsed?: boolean }): Array<GuiTreeItem<Node>>;
  toJSON(): unknown;
}

export class GuiVirtualList<Item = unknown> extends HTMLElement {
  itemHeight: number;
  overscan: number;
  items: Item[];
  renderItem: ((item: Item, index: number) => Node | string) | null;
  scrollToIndex(index: number, options?: { behavior?: ScrollBehavior }): void;
  requestRender(): void;
  render(): void;
}

export interface GuiDataGridColumn<Row = Record<string, unknown>> {
  field: keyof Row & string;
  label?: string;
  width?: number | string;
  sortable?: boolean;
  editable?: boolean;
  pinned?: boolean | "start" | "end";
  renderer?: string | ((value: unknown, row: Row, context: unknown) => Node | string);
}

export class GuiDataGrid<Row extends Record<string, unknown> = Record<string, unknown>>
  extends HTMLElement {
  model: GuiDataCollection<Row>;
  rows: Row[];
  columns: Array<GuiDataGridColumn<Row>>;
  rowHeight: number;
  registerRenderer(id: string, renderer: GuiDataGridColumn<Row>["renderer"]): () => boolean;
  setDataSource(source: GuiPagedDataSource<Row>, options?: { page?: number; signal?: AbortSignal }):
    Promise<{ page: number; rows: Row[]; total: number }>;
  loadPage(index: number, options?: { signal?: AbortSignal; reload?: boolean }):
    Promise<{ page: number; rows: Row[]; total: number }>;
  export(format?: "json" | "csv", fields?: Array<keyof Row & string>): string;
  render(): void;
}

export class GuiTreeView<Node extends Record<string, unknown> = Record<string, unknown>>
  extends HTMLElement {
  model: GuiTreeModel<Node>;
  nodes: Node[];
  labelField: keyof Node & string;
  readonly selected: unknown;
  render(): void;
}

export const dataViewsModule: Readonly<{
  id: "data-views";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly ["gui-virtual-list", "gui-data-grid", "gui-tree-view"];
  setup(): Record<string, unknown>;
}>;
