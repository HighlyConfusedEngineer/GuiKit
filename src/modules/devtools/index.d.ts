export interface GuiAccessibilityIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  selector: string;
}

export function auditAccessibility(root?: ParentNode): {
  valid: boolean;
  issues: GuiAccessibilityIssue[];
  checkedAt: string;
};

export interface GuiPlaygroundControl {
  label?: string;
  property?: string;
  attribute?: string;
  type?: string;
  value?: unknown;
  options?: Array<string | { value: string; label: string }>;
}

export class GuiComponentPlayground extends HTMLElement {
  component: HTMLElement | null;
  controls: GuiPlaygroundControl[];
  events: string[];
  audit(): ReturnType<typeof auditAccessibility>;
}

export class GuiDiagnosticsPanel extends HTMLElement {
  diagnostics: import("../runtime/index.js").GuiDiagnostics;
  render(): void;
}

export interface GuiDevelopmentRecord { kind: string; name: string; detail: unknown; timestamp: string; }
export class GuiDevelopmentSession extends EventTarget {
  constructor(options?: { limit?: number; modules?: unknown; diagnostics?: EventTarget; logger?: EventTarget; bridge?: { invoke?: Function } });
  readonly records: GuiDevelopmentRecord[];
  record(kind: string, name: string, detail?: unknown): GuiDevelopmentRecord;
  attach(source: EventTarget, eventName: string, kind?: string): () => void;
  observeBridge<T extends { invoke?: Function }>(bridge: T): T;
  dispose(): void;
}
export class GuiDeveloperInspector extends HTMLElement { session?: GuiDevelopmentSession; render(): void; }

export const devtoolsModule: Readonly<{
  id: "devtools";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly ["gui-component-playground", "gui-diagnostics-panel", "gui-developer-inspector"];
  setup(): { auditAccessibility: typeof auditAccessibility; GuiDevelopmentSession: typeof GuiDevelopmentSession };
}>;
