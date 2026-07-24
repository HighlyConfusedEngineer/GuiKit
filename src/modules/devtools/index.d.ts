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

export const devtoolsModule: Readonly<{
  id: "devtools";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly ["gui-component-playground", "gui-diagnostics-panel"];
  setup(): { auditAccessibility: typeof auditAccessibility };
}>;
