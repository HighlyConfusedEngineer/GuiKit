export interface GuiWizardStepDefinition {
  id: string;
  title?: string;
  description?: string;
  optional?: boolean;
  disabled?: boolean;
  validate?: boolean;
  [key: string]: unknown;
}

export interface GuiWizardStep extends Required<
  Pick<GuiWizardStepDefinition, "id" | "title" | "description" | "optional" | "disabled" | "validate">
> {
  current: boolean;
  complete: boolean;
  skipped: boolean;
  visited: boolean;
  [key: string]: unknown;
}

export interface GuiWizardState {
  active: string | null;
  completed: string[];
  skipped: string[];
  visited: string[];
  finished: boolean;
}

export interface GuiWizardStepStatePatch {
  complete?: boolean;
  skipped?: boolean;
  visited?: boolean;
  disabled?: boolean;
}

export interface GuiWizardValidationResult {
  valid: boolean;
  message?: string;
}

export interface GuiWizardValidationContext {
  step: GuiWizardStepDefinition;
  state: GuiWizardState;
  reason: string;
  wizard: GuiWizard;
}

export type GuiWizardValidator = (
  context: GuiWizardValidationContext,
) =>
  | boolean
  | string
  | void
  | GuiWizardValidationResult
  | Promise<boolean | string | void | GuiWizardValidationResult>;

export interface GuiWizardNavigationOptions {
  validate?: boolean;
  complete?: boolean;
  force?: boolean;
  focus?: boolean;
  reason?: string;
  data?: unknown;
}

export class GuiWizardModel {
  constructor(
    steps?: Array<string | GuiWizardStepDefinition>,
    options?: { active?: string; linear?: boolean },
  );
  readonly steps: GuiWizardStep[];
  readonly active: string | null;
  readonly currentIndex: number;
  linear: boolean;
  readonly finished: boolean;
  load(
    steps?: Array<string | GuiWizardStepDefinition>,
    options?: { active?: string; linear?: boolean },
  ): this;
  getStep(id: string): GuiWizardStepDefinition | undefined;
  canVisit(id: string): boolean;
  activate(id: string, options?: { force?: boolean }): boolean;
  setStepState(id: string, patch?: GuiWizardStepStatePatch): GuiWizardStep;
  skip(id?: string): boolean;
  finish(): GuiWizardState;
  reset(active?: string): GuiWizardState;
  restore(state?: Partial<GuiWizardState>): GuiWizardState;
  toJSON(): GuiWizardState;
}

export class GuiWizard extends HTMLElement {
  active: string | null;
  linear: boolean;
  readonly busy: boolean;
  readonly finished: boolean;
  readonly currentIndex: number;
  readonly steps: GuiWizardStep[];
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  refresh(): GuiWizardStep[];
  getState(): GuiWizardState;
  restoreState(state: Partial<GuiWizardState>): GuiWizardState;
  setValidator(stepId: string, validator?: GuiWizardValidator | null): this;
  setStepState(stepId: string, patch?: GuiWizardStepStatePatch): GuiWizardStep;
  goTo(stepId: string, options?: GuiWizardNavigationOptions): Promise<boolean>;
  next(options?: GuiWizardNavigationOptions): Promise<boolean>;
  back(options?: GuiWizardNavigationOptions): Promise<boolean>;
  skip(): Promise<boolean>;
  finish(data?: unknown): Promise<boolean>;
  reset(options?: { active?: string; focus?: boolean }): boolean;
}

export const wizardModule: {
  readonly id: "wizard";
  readonly version: string;
  readonly description: string;
  readonly dependencies: readonly ["core"];
  readonly components: readonly ["gui-wizard"];
  setup(): {
    GuiWizard: typeof GuiWizard;
    GuiWizardModel: typeof GuiWizardModel;
  };
};

declare global {
  interface HTMLElementTagNameMap {
    "gui-wizard": GuiWizard;
  }
}
