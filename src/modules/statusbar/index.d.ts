export type GuiStatusbarPosition = "top" | "bottom";
export type GuiStatusbarLive = "off" | "polite" | "assertive";
export type GuiStatusbarItemType =
  | "text"
  | "status"
  | "progress"
  | "action"
  | "separator";
export type GuiStatusbarItemAlignment = "start" | "center" | "end";
export type GuiStatusbarItemVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";
export type GuiStatusbarItemPriority = "low" | "normal" | "high";

export interface GuiStatusbarItem {
  id: string;
  type?: GuiStatusbarItemType;
  align?: GuiStatusbarItemAlignment;
  variant?: GuiStatusbarItemVariant;
  priority?: GuiStatusbarItemPriority;
  order?: number;
  label?: string;
  value?: string | number;
  icon?: string;
  tooltip?: string;
  progress?: number;
  disabled?: boolean;
  hidden?: boolean;
  compact?: boolean;
  data?: unknown;
}

export interface GuiStatusbarUpdateOptions {
  announce?: boolean;
}

export class GuiStatusbar extends HTMLElement {
  position: GuiStatusbarPosition;
  compact: boolean;
  fixed: boolean;
  live: GuiStatusbarLive;
  items: GuiStatusbarItem[];
  setItems(items?: Array<GuiStatusbarItem | string>): GuiStatusbarItem[];
  getItem(id: string): GuiStatusbarItem | undefined;
  addItem(item: GuiStatusbarItem | string): GuiStatusbarItem;
  upsertItem(item: GuiStatusbarItem): GuiStatusbarItem;
  updateItem(
    id: string,
    patch?: Partial<GuiStatusbarItem>,
    options?: GuiStatusbarUpdateOptions,
  ): GuiStatusbarItem;
  setItemValue(
    id: string,
    value: string | number,
    options?: GuiStatusbarUpdateOptions,
  ): GuiStatusbarItem;
  removeItem(id: string): boolean;
  clear(): void;
}

export const statusbarModule: {
  readonly id: "statusbar";
  readonly version: string;
  readonly description: string;
  readonly dependencies: readonly ["core"];
  readonly components: readonly ["gui-statusbar"];
  setup(): { GuiStatusbar: typeof GuiStatusbar };
};

declare global {
  interface HTMLElementTagNameMap {
    "gui-statusbar": GuiStatusbar;
  }
}
