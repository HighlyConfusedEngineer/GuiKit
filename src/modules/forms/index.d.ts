export type GuiFormFieldType =
  | "text" | "email" | "password" | "url" | "search"
  | "number" | "range" | "boolean" | "select" | "multiselect"
  | "textarea" | "color" | "date" | "time" | "datetime-local" | "readonly";

export interface GuiFormCondition {
  field: string;
  equals?: unknown;
  notEquals?: unknown;
  includes?: unknown;
  truthy?: boolean;
}

export interface GuiFormField {
  id: string;
  type?: GuiFormFieldType | string;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  default?: unknown;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: Array<string | { value: string; label?: string; disabled?: boolean }>;
  visibleWhen?: GuiFormCondition | ((values: Record<string, unknown>) => boolean);
  enabledWhen?: GuiFormCondition | ((values: Record<string, unknown>) => boolean);
  validate?: (value: unknown, context: GuiFormValidationContext) =>
    boolean | string | Promise<boolean | string>;
  transform?: (value: unknown) => unknown;
  autocomplete?: string;
  rows?: number;
  unit?: string;
  group?: string;
}

export interface GuiFormSchema {
  id?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  groups?: Array<{ id: string; label: string }>;
  fields: GuiFormField[];
}

export interface GuiFormValidationContext {
  field: GuiFormField;
  values: Record<string, unknown>;
  signal?: AbortSignal;
}

export class GuiFormModel extends EventTarget {
  constructor(schema?: GuiFormSchema, values?: Record<string, unknown>);
  readonly schema: GuiFormSchema;
  readonly values: Record<string, unknown>;
  readonly errors: Record<string, string>;
  readonly dirty: boolean;
  setSchema(schema: GuiFormSchema, values?: Record<string, unknown>): void;
  field(id: string): GuiFormField | undefined;
  state(id: string): {
    visible: boolean; enabled: boolean; readonly: boolean; dirty: boolean; error: string | null;
  } | undefined;
  get<T = unknown>(id: string): T;
  set(id: string, value: unknown, options?: { source?: string }): boolean;
  patch(values: Record<string, unknown>, options?: { source?: string }): string[];
  registerValidator(id: string, validator: GuiFormField["validate"]): () => boolean;
  validate(options?: { fields?: string[]; signal?: AbortSignal }): Promise<{
    valid: boolean; errors: Record<string, string>; values: Record<string, unknown>;
  }>;
  reset(values?: Record<string, unknown>): void;
  commit(): void;
  toJSON(): unknown;
}

export class GuiFormEditorRegistry {
  register(type: string, factory: (context: unknown) => HTMLElement): () => boolean;
  create(type: string, context: unknown): HTMLElement | undefined;
  has(type: string): boolean;
}

export class GuiForm extends HTMLElement {
  model: GuiFormModel;
  schema: GuiFormSchema;
  value: Record<string, unknown>;
  editors: GuiFormEditorRegistry;
  validate(options?: { fields?: string[]; signal?: AbortSignal }): Promise<unknown>;
  reset(): void;
  render(): void;
}

export const formEditors: GuiFormEditorRegistry;
export const formsModule: Readonly<{
  id: "forms";
  version: "0.1.0";
  description: string;
  dependencies: readonly string[];
  components: readonly ["gui-form"];
  setup(): { formEditors: GuiFormEditorRegistry };
}>;
