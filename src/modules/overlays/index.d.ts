export class GuiOverlayController extends EventTarget {
  readonly stack: Array<{ id: string; kind: string; modal: boolean }>;
  open(overlay: HTMLElement, options?: {
    kind?: string; modal?: boolean; restoreFocus?: HTMLElement;
  }): unknown;
  close(overlay: HTMLElement, reason?: string): boolean;
  closeTop(reason?: string): boolean;
}

export class GuiDialog extends HTMLElement {
  readonly open: boolean;
  readonly returnValue: string;
  show(options?: { modal?: boolean }): void;
  close(returnValue?: string, reason?: string): boolean;
}

export class GuiPopover extends HTMLElement {
  readonly open: boolean;
  anchor: HTMLElement | null;
  show(anchor?: HTMLElement | null): void;
  showAt(x: number, y: number): void;
  hide(reason?: string): boolean;
  toggle(anchor?: HTMLElement | null): void;
  reposition(): void;
}

export class GuiContextMenu extends GuiPopover {
  target: HTMLElement | null;
}

export class GuiMenu extends HTMLElement {
  commands: import("../commands/index.js").GuiCommandRegistry | null;
  items(): HTMLElement[];
  refresh(): void;
  focusFirst(): void;
}

export class GuiTooltip extends HTMLElement {
  target: HTMLElement | null;
  show(): void;
  hide(): void;
}

export const overlayController: GuiOverlayController;
export const overlaysModule: Readonly<{
  id: "overlays";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly [
    "gui-dialog", "gui-popover", "gui-context-menu", "gui-menu", "gui-tooltip"
  ];
  setup(): { overlayController: GuiOverlayController };
}>;
