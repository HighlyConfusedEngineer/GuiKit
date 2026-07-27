export interface GuiAppPage { id: string; title: string; icon?: string; content?: string; [key: string]: unknown; }
export interface GuiAppManifestInit { id?: string; title?: string; locale?: string; theme?: string; navigation?: "sidebar" | "tabs" | "swipe" | "dashboard"; pages: GuiAppPage[]; }
export class GuiAppManifest { constructor(value: GuiAppManifestInit); static validate(value: GuiAppManifestInit): Readonly<GuiAppManifestInit>; readonly value: GuiAppManifestInit; readonly pages: GuiAppPage[]; toJSON(): GuiAppManifestInit; }
export class GuiAppShellModel extends EventTarget { constructor(manifest: GuiAppManifest | GuiAppManifestInit); readonly manifest: GuiAppManifest; readonly activePage: string; select(pageId: string): GuiAppPage; }
export class GuiAppShell extends HTMLElement { manifest?: GuiAppManifest; model?: GuiAppShellModel; render(): void; }
export const appShellModule: Readonly<{ id: "app-shell"; version: "0.2.0"; description: string; dependencies: readonly []; components: readonly ["gui-app-shell"]; setup(): { GuiAppManifest: typeof GuiAppManifest; GuiAppShellModel: typeof GuiAppShellModel }; }>;
