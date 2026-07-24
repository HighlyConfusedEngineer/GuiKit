const GuiElement = globalThis.HTMLElement ?? class {};
const GuiEventTarget = globalThis.EventTarget ?? class {};
const hasDOM = typeof document !== "undefined" && typeof customElements !== "undefined";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function emit(target, type, detail, cancelable = false) {
  if (typeof CustomEvent === "undefined") return true;
  return target.dispatchEvent(new CustomEvent(type, {
    bubbles: true,
    cancelable,
    composed: true,
    detail,
  }));
}

function matchCondition(condition, values) {
  if (!condition) return true;
  if (typeof condition === "function") return Boolean(condition(clone(values)));
  const actual = values[condition.field];
  if ("equals" in condition) return Object.is(actual, condition.equals);
  if ("notEquals" in condition) return !Object.is(actual, condition.notEquals);
  if ("includes" in condition) return Array.isArray(actual) && actual.includes(condition.includes);
  if ("truthy" in condition) return Boolean(actual) === Boolean(condition.truthy);
  return true;
}

function normalizeField(field) {
  if (!field?.id || !/^[a-z][a-z0-9._:-]*$/i.test(field.id)) {
    throw new TypeError("Every form field requires a stable id.");
  }
  const options = (field.options ?? []).map((option) => (
    typeof option === "object"
      ? { value: String(option.value), label: option.label ?? String(option.value), disabled: Boolean(option.disabled) }
      : { value: String(option), label: String(option), disabled: false }
  ));
  return {
    id: field.id,
    type: field.type ?? "text",
    label: field.label ?? field.id,
    description: field.description ?? "",
    placeholder: field.placeholder ?? "",
    required: Boolean(field.required),
    disabled: Boolean(field.disabled),
    readonly: Boolean(field.readonly || field.type === "readonly"),
    default: clone(field.default),
    min: field.min,
    max: field.max,
    step: field.step,
    minLength: field.minLength,
    maxLength: field.maxLength,
    pattern: field.pattern,
    options,
    visibleWhen: field.visibleWhen,
    enabledWhen: field.enabledWhen,
    validate: field.validate,
    transform: field.transform,
    autocomplete: field.autocomplete ?? "off",
    rows: Math.max(2, Number(field.rows) || 4),
    unit: field.unit ?? "",
    group: field.group ?? "",
  };
}

function coerce(field, value) {
  if (field.transform) return field.transform(value);
  if (["number", "range"].includes(field.type)) {
    if (value === "" || value == null) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(field.min ?? -Infinity, Math.min(field.max ?? Infinity, number));
  }
  if (field.type === "boolean") return Boolean(value);
  if (field.type === "multiselect") return [...new Set([...(value ?? [])].map(String))];
  return value == null ? "" : String(value);
}

export class GuiFormModel extends GuiEventTarget {
  #schema;
  #values = {};
  #initial = {};
  #errors = {};
  #validators = new Map();

  constructor(schema = { fields: [] }, values = {}) {
    super();
    this.setSchema(schema, values);
  }

  get schema() { return clone(this.#schema); }
  get values() { return clone(this.#values); }
  get errors() { return clone(this.#errors); }
  get dirty() {
    return JSON.stringify(this.#values) !== JSON.stringify(this.#initial);
  }

  setSchema(schema, values = {}) {
    const fields = (schema?.fields ?? []).map(normalizeField);
    const ids = new Set();
    for (const field of fields) {
      if (ids.has(field.id)) throw new Error(`Field "${field.id}" is duplicated.`);
      ids.add(field.id);
    }
    this.#schema = {
      id: schema.id ?? "form",
      title: schema.title ?? "",
      description: schema.description ?? "",
      submitLabel: schema.submitLabel ?? "Save",
      groups: clone(schema.groups ?? []),
      fields,
    };
    this.#values = Object.fromEntries(fields.map((field) => [
      field.id,
      coerce(field, values[field.id] ?? field.default ?? (field.type === "boolean" ? false : "")),
    ]));
    this.#initial = clone(this.#values);
    this.#errors = {};
    this.#notify("schema");
  }

  field(id) {
    const field = this.#schema.fields.find((candidate) => candidate.id === id);
    return field ? clone(field) : undefined;
  }

  state(id) {
    const field = this.#schema.fields.find((candidate) => candidate.id === id);
    if (!field) return undefined;
    return {
      visible: matchCondition(field.visibleWhen, this.#values),
      enabled: !field.disabled && matchCondition(field.enabledWhen, this.#values),
      readonly: field.readonly,
      dirty: !Object.is(this.#values[id], this.#initial[id]),
      error: this.#errors[id] ?? null,
    };
  }

  get(id) {
    if (!(id in this.#values)) throw new Error(`Unknown field "${id}".`);
    return clone(this.#values[id]);
  }

  set(id, value, options = {}) {
    const field = this.#schema.fields.find((candidate) => candidate.id === id);
    if (!field) throw new Error(`Unknown field "${id}".`);
    const next = coerce(field, value);
    const detail = { id, value: clone(next), previous: clone(this.#values[id]), source: options.source ?? "api" };
    if (!emit(this, "gui:form-value-request", detail, true)) return false;
    this.#values[id] = next;
    delete this.#errors[id];
    this.#notify("value", detail);
    return true;
  }

  patch(values, options = {}) {
    const changed = [];
    for (const [id, value] of Object.entries(values ?? {})) {
      if (id in this.#values && this.set(id, value, options)) changed.push(id);
    }
    return changed;
  }

  registerValidator(id, validator) {
    if (typeof validator !== "function") throw new TypeError("A validator must be a function.");
    this.#validators.set(id, validator);
    return () => this.#validators.delete(id);
  }

  async validate(options = {}) {
    const errors = {};
    const fields = options.fields
      ? this.#schema.fields.filter((field) => options.fields.includes(field.id))
      : this.#schema.fields;
    for (const field of fields) {
      const state = this.state(field.id);
      if (!state.visible || !state.enabled) continue;
      const value = this.#values[field.id];
      const empty = value == null || value === "" || (Array.isArray(value) && !value.length);
      let error = null;
      if (field.required && empty) error = `${field.label} is required.`;
      else if (!empty && field.minLength != null && String(value).length < field.minLength) {
        error = `${field.label} must contain at least ${field.minLength} characters.`;
      } else if (!empty && field.maxLength != null && String(value).length > field.maxLength) {
        error = `${field.label} must contain at most ${field.maxLength} characters.`;
      } else if (!empty && field.pattern && !new RegExp(field.pattern).test(String(value))) {
        error = `${field.label} has an invalid format.`;
      } else if (!empty && field.min != null && Number(value) < field.min) {
        error = `${field.label} must be at least ${field.min}.`;
      } else if (!empty && field.max != null && Number(value) > field.max) {
        error = `${field.label} must be at most ${field.max}.`;
      }
      const validators = [field.validate, this.#validators.get(field.id)].filter(Boolean);
      for (const validator of validators) {
        if (error) break;
        const result = await validator(clone(value), {
          field: clone(field),
          values: this.values,
          signal: options.signal,
        });
        if (result === false) error = `${field.label} is invalid.`;
        else if (typeof result === "string") error = result;
      }
      if (error) errors[field.id] = error;
    }
    this.#errors = { ...this.#errors, ...errors };
    for (const field of fields) {
      if (!(field.id in errors)) delete this.#errors[field.id];
    }
    this.#notify("validate", { valid: !Object.keys(errors).length });
    return { valid: !Object.keys(errors).length, errors: clone(errors), values: this.values };
  }

  reset(values = this.#initial) {
    this.#values = Object.fromEntries(this.#schema.fields.map((field) => [
      field.id,
      coerce(field, values[field.id] ?? field.default ?? ""),
    ]));
    this.#errors = {};
    this.#notify("reset");
  }

  commit() {
    this.#initial = clone(this.#values);
    this.#notify("commit");
  }

  toJSON() {
    return { schema: this.schema, values: this.values, errors: this.errors, dirty: this.dirty };
  }

  #notify(operation, detail = {}) {
    emit(this, "gui:form-model-change", {
      operation,
      values: this.values,
      dirty: this.dirty,
      ...detail,
    });
  }
}

export class GuiFormEditorRegistry {
  #editors = new Map();
  register(type, factory) {
    if (!type || typeof factory !== "function") throw new TypeError("An editor needs type and factory.");
    this.#editors.set(type, factory);
    return () => this.#editors.delete(type);
  }
  create(type, context) {
    return this.#editors.get(type)?.(context);
  }
  has(type) { return this.#editors.has(type); }
}

const FORM_STYLES = `
  :host { display: block; color: var(--gui-text, #e5e7eb); }
  form { display: grid; gap: 1rem; }
  header h2 { margin: 0 0 .25rem; font-size: 1.1rem; }
  header p, .description { margin: 0; color: var(--gui-text-muted, #94a3b8); font-size: .85rem; }
  fieldset { display: grid; gap: .8rem; margin: 0; padding: 1rem; border: 1px solid var(--gui-border, #334155);
    border-radius: .65rem; }
  .ungrouped-fields { display: grid; gap: .8rem; }
  legend { padding-inline: .35rem; font-weight: 700; }
  .field { display: grid; gap: .35rem; }
  label { font-weight: 600; font-size: .88rem; }
  input, select, textarea { box-sizing: border-box; width: 100%; padding: .58rem .65rem;
    color: inherit; background: var(--gui-surface-raised, #172033); border: 1px solid var(--gui-border, #334155);
    border-radius: .45rem; font: inherit; }
  input[type=checkbox] { width: auto; }
  .check { display: flex; align-items: center; gap: .55rem; }
  .with-unit { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: .5rem; }
  .error { color: var(--gui-danger, #f87171); font-size: .8rem; }
  .actions { display: flex; justify-content: end; gap: .6rem; }
  button { padding: .55rem .85rem; color: var(--gui-accent-contrast, white);
    background: var(--gui-accent, #3b82f6); border: 0; border-radius: .45rem; font: inherit; font-weight: 650; }
  :host([compact]) fieldset { padding: .65rem; gap: .55rem; }
`;

export class GuiForm extends GuiElement {
  #model;
  #root;
  #modelListener = () => this.render();
  #editors = formEditors;

  constructor() {
    super();
    if (!this.attachShadow) return;
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${FORM_STYLES}</style><form novalidate></form>`;
    this.#root.querySelector("form").addEventListener("input", (event) => this.#input(event));
    this.#root.querySelector("form").addEventListener("change", (event) => this.#input(event));
    this.#root.querySelector("form").addEventListener("submit", (event) => void this.#submit(event));
    this.#root.querySelector("form").addEventListener("reset", (event) => {
      event.preventDefault();
      this.#model?.reset();
    });
  }

  set model(value) {
    this.#model?.removeEventListener?.("gui:form-model-change", this.#modelListener);
    this.#model = value;
    this.#model?.addEventListener?.("gui:form-model-change", this.#modelListener);
    this.render();
  }
  get model() { return this.#model; }

  set schema(value) {
    if (this.#model) this.#model.setSchema(value, this.#model.values);
    else this.model = new GuiFormModel(value);
  }
  get schema() { return this.#model?.schema; }
  get value() { return this.#model?.values ?? {}; }
  set value(value) { this.#model?.patch(value); }
  set editors(value) { this.#editors = value; this.render(); }
  get editors() { return this.#editors; }

  connectedCallback() {
    if (!this.#model) {
      const inline = this.querySelector?.('script[type="application/json"]');
      this.model = new GuiFormModel(inline ? JSON.parse(inline.textContent) : { fields: [] });
    }
  }

  disconnectedCallback() {
    this.#model?.removeEventListener?.("gui:form-model-change", this.#modelListener);
  }

  async validate(options) { return this.#model.validate(options); }
  reset() { this.#model.reset(); }

  render() {
    const form = this.#root?.querySelector("form");
    if (!form || !this.#model) return;
    form.replaceChildren();
    const schema = this.#model.schema;
    if (schema.title || schema.description) {
      const header = document.createElement("header");
      if (schema.title) {
        const title = document.createElement("h2");
        title.textContent = schema.title;
        header.append(title);
      }
      if (schema.description) {
        const description = document.createElement("p");
        description.textContent = schema.description;
        header.append(description);
      }
      form.append(header);
    }
    const groups = new Map();
    const groupDefinitions = new Map((schema.groups ?? []).map((group) => [group.id, group]));
    for (const field of schema.fields) {
      const state = this.#model.state(field.id);
      if (!state.visible) continue;
      const groupId = field.group || "";
      let container = groups.get(groupId);
      if (!container) {
        if (groupId) {
          container = document.createElement("fieldset");
          const legend = document.createElement("legend");
          legend.textContent = groupDefinitions.get(groupId)?.label ?? groupId;
          container.append(legend);
        } else {
          container = document.createElement("div");
          container.className = "ungrouped-fields";
        }
        groups.set(groupId, container);
        form.append(container);
      }
      container.append(this.#renderField(field, state));
    }
    if (!this.hasAttribute("hide-actions")) {
      const actions = document.createElement("div");
      actions.className = "actions";
      const reset = document.createElement("button");
      reset.type = "reset";
      reset.textContent = this.getAttribute("reset-label") ?? "Reset";
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = schema.submitLabel;
      actions.append(reset, submit);
      form.append(actions);
    }
  }

  #renderField(field, state) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    wrapper.dataset.field = field.id;
    const id = `${this.id || "gui-form"}-${field.id.replace(/[^a-z0-9_-]/gi, "-")}`;
    const custom = this.#editors?.create(field.type, {
      field: clone(field),
      value: this.#model.get(field.id),
      state,
      form: this,
    });
    let input = custom;
    if (!input) input = this.#createNativeEditor(field, id);
    input.dataset.fieldInput = field.id;
    input.disabled = !state.enabled;
    input.readOnly = state.readonly;
    if (field.type === "boolean") {
      const label = document.createElement("label");
      label.className = "check";
      label.htmlFor = id;
      label.append(input, document.createTextNode(field.label));
      wrapper.append(label);
    } else {
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = field.label;
      wrapper.append(label);
      if (field.unit) {
        const row = document.createElement("div");
        row.className = "with-unit";
        row.append(input, document.createTextNode(field.unit));
        wrapper.append(row);
      } else wrapper.append(input);
    }
    if (field.description) {
      const description = document.createElement("span");
      description.className = "description";
      description.textContent = field.description;
      wrapper.append(description);
    }
    if (state.error) {
      const error = document.createElement("span");
      error.className = "error";
      error.id = `${id}-error`;
      error.textContent = state.error;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", error.id);
      wrapper.append(error);
    }
    return wrapper;
  }

  #createNativeEditor(field, id) {
    let input;
    if (field.type === "select" || field.type === "multiselect") {
      input = document.createElement("select");
      input.multiple = field.type === "multiselect";
      for (const option of field.options) {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        element.disabled = option.disabled;
        const value = this.#model.get(field.id);
        element.selected = Array.isArray(value) ? value.includes(option.value) : String(value) === option.value;
        input.append(element);
      }
    } else if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = field.rows;
      input.value = this.#model.get(field.id);
    } else if (field.type === "readonly") {
      input = document.createElement("output");
      input.value = this.#model.get(field.id);
      input.textContent = String(input.value ?? "");
      input.tabIndex = 0;
    } else {
      input = document.createElement("input");
      input.type = field.type === "boolean" ? "checkbox" : field.type;
      if (field.type === "boolean") input.checked = this.#model.get(field.id);
      else input.value = this.#model.get(field.id) ?? "";
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.min != null) input.min = field.min;
      if (field.max != null) input.max = field.max;
      if (field.step != null) input.step = field.step;
      if (field.minLength != null) input.minLength = field.minLength;
      if (field.maxLength != null) input.maxLength = field.maxLength;
      if (field.pattern) input.pattern = field.pattern;
      input.autocomplete = field.autocomplete;
    }
    input.id = id;
    input.required = field.required;
    return input;
  }

  #input(event) {
    const input = event.target.closest?.("[data-field-input]");
    if (!input || !this.#model) return;
    let value;
    if (input instanceof HTMLInputElement && input.type === "checkbox") value = input.checked;
    else if (input instanceof HTMLSelectElement && input.multiple) {
      value = [...input.selectedOptions].map((option) => option.value);
    } else value = input.value;
    this.#model.set(input.dataset.fieldInput, value, { source: "user" });
    emit(this, "gui:form-change", {
      id: input.dataset.fieldInput,
      value: this.#model.get(input.dataset.fieldInput),
      values: this.#model.values,
      dirty: this.#model.dirty,
    });
  }

  async #submit(event) {
    event.preventDefault();
    const result = await this.#model.validate();
    this.render();
    if (!result.valid) {
      this.#root.querySelector('[aria-invalid="true"]')?.focus();
      emit(this, "gui:form-invalid", result);
      return;
    }
    if (!emit(this, "gui:form-submit-request", result, true)) return;
    emit(this, "gui:form-submit", result);
  }
}

export const formEditors = new GuiFormEditorRegistry();

export const formsModule = Object.freeze({
  id: "forms",
  version: "0.1.0",
  description: "Schema-driven forms, settings panels, validation, and property inspectors.",
  dependencies: [],
  components: ["gui-form"],
  setup() {
    if (hasDOM && !customElements.get("gui-form")) customElements.define("gui-form", GuiForm);
    return { formEditors };
  },
});

if (hasDOM && !customElements.get("gui-form")) customElements.define("gui-form", GuiForm);
