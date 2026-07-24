const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};

function dispatch(target, name, detail = {}, cancelable = false) {
  if (!hasDOM) return true;
  return target.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    cancelable,
    composed: true,
    detail,
  }));
}

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeStep(step, index) {
  const source = typeof step === "string" ? { id: step, title: step } : step;
  if (!source || typeof source !== "object") {
    throw new TypeError(`Wizard step ${index + 1} must be a string or object.`);
  }
  if (!source.id) {
    throw new TypeError(`Wizard step ${index + 1} requires a non-empty id.`);
  }
  const id = String(source.id);
  return {
    ...clone(source),
    id,
    title: String(source.title ?? id),
    description: String(source.description ?? ""),
    optional: Boolean(source.optional),
    disabled: Boolean(source.disabled),
    validate: source.validate !== false,
  };
}

function orderedIds(steps, values) {
  const selected = new Set([...(values ?? [])].map(String));
  return steps.filter((step) => selected.has(step.id)).map((step) => step.id);
}

/**
 * DOM-independent state and navigation rules for GuiWizard.
 */
export class GuiWizardModel {
  #steps = [];
  #active = null;
  #completed = new Set();
  #skipped = new Set();
  #visited = new Set();
  #linear = false;
  #finished = false;

  constructor(steps = [], options = {}) {
    this.#linear = Boolean(options.linear);
    this.load(steps, options);
  }

  get steps() {
    return this.#steps.map((step) => ({
      ...clone(step),
      current: step.id === this.#active,
      complete: this.#completed.has(step.id),
      skipped: this.#skipped.has(step.id),
      visited: this.#visited.has(step.id),
    }));
  }

  get active() {
    return this.#active;
  }

  get currentIndex() {
    return this.#steps.findIndex((step) => step.id === this.#active);
  }

  get linear() {
    return this.#linear;
  }

  set linear(value) {
    this.#linear = Boolean(value);
  }

  get finished() {
    return this.#finished;
  }

  load(steps = [], options = {}) {
    if (!Array.isArray(steps)) throw new TypeError("Wizard steps must be an array.");
    const normalized = steps.map(normalizeStep);
    const ids = new Set();
    for (const step of normalized) {
      if (ids.has(step.id)) {
        throw new Error(`Wizard step "${step.id}" already exists.`);
      }
      ids.add(step.id);
    }

    this.#steps = normalized;
    this.#completed.clear();
    this.#skipped.clear();
    this.#visited.clear();
    this.#finished = false;
    if (options.linear !== undefined) this.#linear = Boolean(options.linear);

    const requested = options.active === undefined ? null : String(options.active);
    const first = normalized.find((step) => !step.disabled)?.id ?? null;
    this.#active = first;
    if (requested && this.getStep(requested) && this.canVisit(requested)) {
      this.#active = requested;
    }
    if (this.#active) this.#visited.add(this.#active);
    return this;
  }

  getStep(id) {
    const step = this.#steps.find((candidate) => candidate.id === String(id));
    return step ? clone(step) : undefined;
  }

  canVisit(id) {
    const targetId = String(id);
    const index = this.#steps.findIndex((step) => step.id === targetId);
    if (index < 0 || this.#steps[index].disabled) return false;
    if (!this.#linear) return true;
    return this.#steps.slice(0, index).every((step) => (
      step.disabled
      || this.#completed.has(step.id)
      || this.#skipped.has(step.id)
    ));
  }

  activate(id, options = {}) {
    const targetId = String(id);
    const step = this.#steps.find((candidate) => candidate.id === targetId);
    if (!step) throw new Error(`Unknown wizard step "${targetId}".`);
    if (step.disabled) return false;
    if (!options.force && !this.canVisit(targetId)) return false;
    this.#active = targetId;
    this.#visited.add(targetId);
    this.#finished = false;
    return true;
  }

  setStepState(id, patch = {}) {
    const targetId = String(id);
    const index = this.#steps.findIndex((step) => step.id === targetId);
    if (index < 0) throw new Error(`Unknown wizard step "${targetId}".`);

    if (patch.disabled !== undefined) {
      this.#steps[index] = {
        ...this.#steps[index],
        disabled: Boolean(patch.disabled),
      };
    }
    if (patch.complete !== undefined) {
      if (patch.complete) this.#completed.add(targetId);
      else this.#completed.delete(targetId);
    }
    if (patch.skipped !== undefined) {
      if (patch.skipped) {
        if (!this.#steps[index].optional) {
          throw new Error(`Wizard step "${targetId}" is not optional.`);
        }
        this.#skipped.add(targetId);
        this.#completed.delete(targetId);
      } else {
        this.#skipped.delete(targetId);
      }
    }
    if (patch.visited !== undefined) {
      if (patch.visited) this.#visited.add(targetId);
      else this.#visited.delete(targetId);
    }
    if (this.#steps[index].disabled && this.#active === targetId) {
      this.#active = this.#steps.find((step) => !step.disabled)?.id ?? null;
      if (this.#active) this.#visited.add(this.#active);
    }
    this.#finished = false;
    return this.steps[index];
  }

  skip(id = this.#active) {
    if (!id) return false;
    const step = this.getStep(id);
    if (!step) throw new Error(`Unknown wizard step "${id}".`);
    if (!step.optional || step.disabled) return false;
    this.setStepState(id, { skipped: true, visited: true });
    return true;
  }

  finish() {
    this.#finished = true;
    return this.toJSON();
  }

  reset(active) {
    this.#completed.clear();
    this.#skipped.clear();
    this.#visited.clear();
    this.#finished = false;
    const requested = active === undefined ? null : String(active);
    const first = this.#steps.find((step) => !step.disabled)?.id ?? null;
    this.#active = requested && this.getStep(requested) && !this.getStep(requested).disabled
      ? requested
      : first;
    if (this.#active) this.#visited.add(this.#active);
    return this.toJSON();
  }

  restore(state = {}) {
    if (!state || typeof state !== "object") {
      throw new TypeError("Wizard state must be an object.");
    }
    this.#completed = new Set(orderedIds(this.#steps, state.completed));
    this.#skipped = new Set(
      orderedIds(this.#steps, state.skipped)
        .filter((id) => this.getStep(id).optional),
    );
    this.#visited = new Set(orderedIds(this.#steps, state.visited));
    const active = state.active === undefined ? this.#active : String(state.active);
    if (active && this.getStep(active) && this.canVisit(active)) {
      this.#active = active;
    } else {
      this.#active = this.#steps.find((step) => this.canVisit(step.id))?.id ?? null;
    }
    if (this.#active) this.#visited.add(this.#active);
    this.#finished = Boolean(state.finished);
    return this.toJSON();
  }

  toJSON() {
    return {
      active: this.#active,
      completed: orderedIds(this.#steps, this.#completed),
      skipped: orderedIds(this.#steps, this.#skipped),
      visited: orderedIds(this.#steps, this.#visited),
      finished: this.#finished,
    };
  }
}

function normalizedValidationResult(result) {
  if (result === undefined || result === true) return { valid: true, message: "" };
  if (result === false) return { valid: false, message: "Complete this step to continue." };
  if (typeof result === "string") return { valid: false, message: result };
  if (result && typeof result === "object") {
    return {
      valid: result.valid !== false,
      message: String(result.message ?? ""),
    };
  }
  return { valid: Boolean(result), message: "" };
}

/**
 * Responsive, accessible multi-step workflow component.
 */
export class GuiWizard extends GuiElement {
  static observedAttributes = [
    "active",
    "linear",
    "label",
    "back-label",
    "next-label",
    "finish-label",
    "skip-label",
  ];

  #model = new GuiWizardModel();
  #validators = new Map();
  #stepElements = new Map();
  #stepButtons = new Map();
  #settingActive = false;
  #busy = false;
  #observer;
  #stepObserver;
  #hasRefreshed = false;
  #shell;
  #nav;
  #stepList;
  #heading;
  #description;
  #progress;
  #progressText;
  #slot;
  #error;
  #backButton;
  #skipButton;
  #nextButton;

  connectedCallback() {
    if (!this.shadowRoot) this.#createView();
    this.refresh();
    this.#observer = new MutationObserver(() => this.refresh());
    this.#observer.observe(this, { childList: true });
    this.#stepObserver = new MutationObserver(() => this.refresh());
    this.#stepObserver.observe(this, {
      attributes: true,
      subtree: true,
      attributeFilter: [
        "data-wizard-step",
        "data-title",
        "data-description",
        "data-optional",
        "data-disabled",
        "data-validate",
      ],
    });
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#stepObserver?.disconnect();
  }

  attributeChangedCallback(name, _previous, current) {
    if (!this.#shell) return;
    if (name === "active" && !this.#settingActive && current) {
      this.goTo(current, { validate: false, reason: "attribute" }).then((changed) => {
        if (!changed) this.#reflectActive();
      });
      return;
    }
    if (name === "linear") this.#model.linear = this.linear;
    this.#render();
  }

  get active() {
    return this.#model.active ?? this.getAttribute("active");
  }

  set active(value) {
    if (value !== null && value !== undefined) {
      this.goTo(String(value), { validate: false, reason: "programmatic" });
    }
  }

  get linear() {
    return this.hasAttribute("linear");
  }

  set linear(value) {
    this.toggleAttribute("linear", Boolean(value));
  }

  get busy() {
    return this.#busy;
  }

  get finished() {
    return this.#model.finished;
  }

  get currentIndex() {
    return this.#model.currentIndex;
  }

  get steps() {
    return this.#model.steps;
  }

  get canGoBack() {
    return Boolean(this.#adjacentStep(-1));
  }

  get canGoNext() {
    return Boolean(this.#adjacentStep(1));
  }

  refresh() {
    if (!hasDOM || !this.#shell) return this.steps;
    const elements = [
      ...this.querySelectorAll(":scope > [data-wizard-step]"),
    ];
    const definitions = elements.map((element) => ({
      id: element.dataset.wizardStep,
      title: element.dataset.title ?? element.dataset.wizardStep,
      description: element.dataset.description ?? "",
      optional: element.hasAttribute("data-optional"),
      disabled: element.hasAttribute("data-disabled"),
      validate: element.dataset.validate !== "false",
    }));
    const previousState = this.#hasRefreshed ? this.#model.toJSON() : null;
    const requestedActive = this.getAttribute("active") ?? previousState?.active;
    this.#model = new GuiWizardModel(definitions, {
      active: requestedActive,
      linear: this.linear,
    });
    if (previousState) this.#model.restore(previousState);
    this.#stepElements = new Map(
      elements.map((element) => [element.dataset.wizardStep, element]),
    );
    for (const id of this.#validators.keys()) {
      if (!this.#stepElements.has(id)) this.#validators.delete(id);
    }
    this.#hasRefreshed = true;
    this.#reflectActive();
    this.#render();
    return this.steps;
  }

  getState() {
    return clone(this.#model.toJSON());
  }

  restoreState(state) {
    this.#model.restore(state);
    this.#reflectActive();
    this.#clearError();
    this.#render();
    this.#stateChanged("restore");
    return this.getState();
  }

  setValidator(stepId, validator) {
    const id = String(stepId);
    if (!this.#model.getStep(id)) throw new Error(`Unknown wizard step "${id}".`);
    if (validator === null || validator === undefined) {
      this.#validators.delete(id);
    } else {
      if (typeof validator !== "function") {
        throw new TypeError("A wizard validator must be a function.");
      }
      this.#validators.set(id, validator);
    }
    return this;
  }

  setStepState(stepId, patch = {}) {
    const updated = this.#model.setStepState(stepId, patch);
    this.#reflectActive();
    this.#render();
    this.#stateChanged("step-state", { step: updated });
    return clone(updated);
  }

  async goTo(stepId, options = {}) {
    if (this.#busy) return false;
    const target = this.#model.getStep(stepId);
    if (!target || target.disabled) return false;
    const previous = this.#model.active;
    if (target.id === previous) return true;

    const fromIndex = this.#model.currentIndex;
    const toIndex = this.#model.steps.findIndex((step) => step.id === target.id);
    const direction = toIndex > fromIndex ? "forward" : "back";
    if (direction === "forward" && options.validate !== false) {
      const valid = await this.#validateCurrent(options.reason ?? "navigate");
      if (!valid) return false;
    }

    const allowed = dispatch(this, "gui:wizard-step-change-request", {
      from: previous,
      to: target.id,
      direction,
      reason: options.reason ?? "programmatic",
      state: this.getState(),
    }, true);
    if (!allowed) return false;

    const previousState = this.#model.toJSON();
    if (direction === "forward" && previous && options.complete !== false) {
      this.#model.setStepState(previous, { complete: true, skipped: false });
    }
    const activated = this.#model.activate(target.id, {
      force: Boolean(options.force),
    });
    if (!activated) {
      this.#model.restore(previousState);
      this.#render();
      return false;
    }

    this.#reflectActive();
    this.#clearError();
    this.#render(previous, direction, options.focus !== false);
    const state = this.getState();
    dispatch(this, "gui:wizard-step-change", {
      active: target.id,
      previous,
      direction,
      reason: options.reason ?? "programmatic",
      state,
    });
    this.#stateChanged("step-change");
    return true;
  }

  async next(options = {}) {
    const target = this.#adjacentStep(1);
    if (!target) return this.finish(options.data);
    return this.goTo(target.id, {
      ...options,
      reason: options.reason ?? "next",
    });
  }

  async back(options = {}) {
    const target = this.#adjacentStep(-1);
    if (!target) return false;
    return this.goTo(target.id, {
      ...options,
      validate: false,
      complete: false,
      reason: options.reason ?? "back",
    });
  }

  async skip() {
    if (this.#busy) return false;
    const current = this.#model.getStep(this.active);
    const target = this.#adjacentStep(1);
    if (!current?.optional || !target) return false;
    const allowed = dispatch(this, "gui:wizard-skip-request", {
      step: current,
      state: this.getState(),
    }, true);
    if (!allowed) return false;
    const previousState = this.#model.toJSON();
    if (!this.#model.skip(current.id)) return false;
    const changed = await this.goTo(target.id, {
      validate: false,
      complete: false,
      reason: "skip",
    });
    if (!changed) {
      this.#model.restore(previousState);
      this.#render();
    }
    if (changed) {
      dispatch(this, "gui:wizard-skip", {
        step: current,
        state: this.getState(),
      });
    }
    return changed;
  }

  async finish(data) {
    if (this.#busy || !this.active) return false;
    if (this.#adjacentStep(1)) return false;
    const valid = await this.#validateCurrent("finish");
    if (!valid) return false;
    const current = this.#model.getStep(this.active);
    const allowed = dispatch(this, "gui:wizard-finish-request", {
      step: current,
      data: clone(data),
      state: this.getState(),
    }, true);
    if (!allowed) return false;

    this.#model.setStepState(current.id, { complete: true, skipped: false });
    this.#model.finish();
    this.#render();
    const state = this.getState();
    dispatch(this, "gui:wizard-finish", {
      step: current,
      data: clone(data),
      state,
    });
    this.#stateChanged("finish");
    return true;
  }

  reset(options = {}) {
    const allowed = dispatch(this, "gui:wizard-reset-request", {
      state: this.getState(),
    }, true);
    if (!allowed) return false;
    const previous = this.active;
    this.#model.reset(options.active);
    this.#reflectActive();
    this.#clearError();
    this.#render(previous, "back", options.focus !== false);
    const state = this.getState();
    dispatch(this, "gui:wizard-reset", { state });
    this.#stateChanged("reset");
    return true;
  }

  #createView() {
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = WIZARD_STYLES;

    this.#shell = document.createElement("div");
    this.#shell.className = "shell";

    this.#nav = document.createElement("nav");
    this.#nav.className = "rail";
    const railHeading = document.createElement("strong");
    railHeading.className = "rail-heading";
    const progressGroup = document.createElement("div");
    progressGroup.className = "progress-group";
    this.#progressText = document.createElement("span");
    this.#progressText.className = "progress-text";
    this.#progress = document.createElement("div");
    this.#progress.className = "progress";
    this.#progress.setAttribute("role", "progressbar");
    const progressValue = document.createElement("i");
    this.#progress.append(progressValue);
    progressGroup.append(this.#progressText, this.#progress);
    this.#stepList = document.createElement("ol");
    this.#stepList.className = "steps";
    this.#nav.append(railHeading, progressGroup, this.#stepList);

    const main = document.createElement("section");
    main.className = "main";
    const header = document.createElement("header");
    header.className = "header";
    const titleGroup = document.createElement("div");
    this.#heading = document.createElement("h2");
    this.#heading.tabIndex = -1;
    this.#description = document.createElement("p");
    titleGroup.append(this.#heading, this.#description);
    header.append(titleGroup);

    this.#error = document.createElement("div");
    this.#error.className = "error";
    this.#error.setAttribute("role", "alert");
    this.#error.hidden = true;

    const content = document.createElement("div");
    content.className = "content";
    this.#slot = document.createElement("slot");
    content.append(this.#slot);

    const footer = document.createElement("footer");
    footer.className = "footer";
    this.#backButton = this.#button("back", () => this.back());
    const endActions = document.createElement("div");
    endActions.className = "end-actions";
    this.#skipButton = this.#button("skip", () => this.skip());
    this.#nextButton = this.#button("next primary", () => this.next());
    endActions.append(this.#skipButton, this.#nextButton);
    footer.append(this.#backButton, endActions);

    main.append(header, this.#error, content, footer);
    this.#shell.append(this.#nav, main);
    root.append(style, this.#shell);
    this.#stepList.addEventListener("click", this.#onStepClick);
    this.#stepList.addEventListener("keydown", this.#onStepKeyDown);
  }

  #button(className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.addEventListener("click", onClick);
    return button;
  }

  #render(previous, direction = "forward", focus = false) {
    if (!this.#shell) return;
    const steps = this.#model.steps;
    const current = steps.find((step) => step.current);
    const enabled = steps.filter((step) => !step.disabled);
    const enabledIndex = enabled.findIndex((step) => step.id === current?.id);
    const progress = this.finished
      ? 100
      : enabled.length
        ? ((enabledIndex + 1) / enabled.length) * 100
        : 0;

    this.#nav.setAttribute("aria-label", this.getAttribute("label") ?? "Wizard progress");
    this.#nav.querySelector(".rail-heading").textContent =
      this.getAttribute("label") ?? "Setup progress";
    this.#progressText.textContent = current
      ? `Step ${enabledIndex + 1} of ${enabled.length}`
      : "No steps";
    this.#progress.setAttribute("aria-valuemin", "0");
    this.#progress.setAttribute("aria-valuemax", "100");
    this.#progress.setAttribute("aria-valuenow", String(Math.round(progress)));
    this.#progress.querySelector("i").style.width = `${progress}%`;

    this.#stepList.replaceChildren();
    this.#stepButtons.clear();
    steps.forEach((step, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.stepId = step.id;
      button.dataset.state = step.skipped
        ? "skipped"
        : step.complete
          ? "complete"
          : step.current
            ? "current"
            : "pending";
      const reachable = this.#model.canVisit(step.id);
      button.disabled = step.disabled;
      button.setAttribute("aria-current", step.current ? "step" : "false");
      button.setAttribute("aria-disabled", String(step.disabled || (!reachable && !step.current)));
      button.tabIndex = step.current ? 0 : -1;

      const marker = document.createElement("span");
      marker.className = "marker";
      marker.textContent = step.complete ? "✓" : step.skipped ? "–" : String(index + 1);
      marker.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.className = "step-text";
      const title = document.createElement("strong");
      title.textContent = step.title;
      const meta = document.createElement("small");
      meta.textContent = step.optional
        ? "Optional"
        : step.complete
          ? "Complete"
          : step.description;
      text.append(title, meta);
      button.append(marker, text);
      item.append(button);
      this.#stepList.append(item);
      this.#stepButtons.set(step.id, button);
    });

    for (const [id, element] of this.#stepElements) {
      const active = id === current?.id;
      element.hidden = !active;
      element.inert = !active;
      element.setAttribute("aria-hidden", String(!active));
    }

    this.#heading.textContent = current?.title ?? "Wizard";
    this.#description.textContent = current?.description ?? "";
    this.#description.hidden = !current?.description;
    this.#backButton.textContent = this.getAttribute("back-label") ?? "Back";
    this.#skipButton.textContent = this.getAttribute("skip-label") ?? "Skip";
    this.#nextButton.textContent = this.canGoNext
      ? this.getAttribute("next-label") ?? "Continue"
      : this.getAttribute("finish-label") ?? "Finish";
    this.#backButton.disabled = this.#busy || !this.canGoBack;
    this.#skipButton.hidden = !current?.optional || !this.canGoNext;
    this.#skipButton.disabled = this.#busy;
    this.#nextButton.disabled = this.#busy || !current || this.finished;
    this.#shell.toggleAttribute("data-busy", this.#busy);

    const incoming = current ? this.#stepElements.get(current.id) : null;
    if (incoming && previous && previous !== current.id) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced && incoming.animate) {
        incoming.getAnimations().forEach((animation) => animation.cancel());
        incoming.animate([
          {
            opacity: 0,
            transform: `translateX(${direction === "forward" ? "1rem" : "-1rem"})`,
          },
          { opacity: 1, transform: "translateX(0)" },
        ], {
          duration: 260,
          easing: "cubic-bezier(.22, 1, .36, 1)",
        });
      }
    }
    if (focus) requestAnimationFrame(() => this.#heading.focus());
  }

  #adjacentStep(offset) {
    const steps = this.#model.steps;
    let index = this.#model.currentIndex + offset;
    while (index >= 0 && index < steps.length) {
      if (!steps[index].disabled) return steps[index];
      index += offset;
    }
    return undefined;
  }

  async #validateCurrent(reason) {
    const step = this.#model.getStep(this.active);
    const element = this.#stepElements.get(step?.id);
    if (!step || !element || !step.validate) return true;

    const controls = [
      ...element.querySelectorAll("input, select, textarea"),
    ].filter((control) => !control.disabled);
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      this.#validationFailed(step, invalid.validationMessage, "native");
      return false;
    }

    const validator = this.#validators.get(step.id);
    if (!validator) return true;
    this.#setBusy(true);
    try {
      const result = normalizedValidationResult(await validator({
        step: clone(step),
        state: this.getState(),
        reason,
        wizard: this,
      }));
      if (!result.valid) {
        this.#validationFailed(step, result.message, "validator");
        return false;
      }
      this.#clearError();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#validationFailed(step, message, "exception");
      dispatch(this, "gui:wizard-error", {
        operation: "validate",
        step,
        error,
      });
      return false;
    } finally {
      this.#setBusy(false);
    }
  }

  #validationFailed(step, message, source) {
    const text = message || "Complete this step to continue.";
    this.#error.textContent = text;
    this.#error.hidden = false;
    dispatch(this, "gui:wizard-validation-error", {
      step,
      message: text,
      source,
      state: this.getState(),
    });
  }

  #clearError() {
    if (!this.#error) return;
    this.#error.textContent = "";
    this.#error.hidden = true;
  }

  #setBusy(value) {
    this.#busy = Boolean(value);
    this.toggleAttribute("busy", this.#busy);
    this.setAttribute("aria-busy", String(this.#busy));
    this.#render();
  }

  #reflectActive() {
    if (!this.#model.active) return;
    this.#settingActive = true;
    this.setAttribute("active", this.#model.active);
    this.#settingActive = false;
  }

  #stateChanged(operation, detail = {}) {
    dispatch(this, "gui:wizard-state-change", {
      operation,
      state: this.getState(),
      ...detail,
    });
  }

  #onStepClick = (event) => {
    const button = event.target.closest("[data-step-id]");
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    this.goTo(button.dataset.stepId, {
      reason: "indicator",
      focus: true,
    });
  };

  #onStepKeyDown = (event) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    const buttons = [...this.#stepButtons.values()].filter((button) => !button.disabled);
    const current = buttons.indexOf(event.target.closest("[data-step-id]"));
    if (current < 0) return;
    event.preventDefault();
    let index = current;
    if (["ArrowDown", "ArrowRight"].includes(event.key)) {
      index = (current + 1) % buttons.length;
    }
    if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
      index = (current - 1 + buttons.length) % buttons.length;
    }
    if (event.key === "Home") index = 0;
    if (event.key === "End") index = buttons.length - 1;
    buttons[index].focus();
  };
}

export const wizardModule = Object.freeze({
  id: "wizard",
  version: "0.1.0",
  description: "Validated, resumable multi-step workflows with accessible navigation.",
  dependencies: ["core"],
  components: ["gui-wizard"],
  setup() {
    if (hasDOM && !customElements.get("gui-wizard")) {
      customElements.define("gui-wizard", GuiWizard);
    }
    return { GuiWizard, GuiWizardModel };
  },
});

const WIZARD_STYLES = `
  :host {
    display: block;
    min-width: 0;
    color: var(--gui-text, #17181c);
    font-family: var(--gui-font, ui-sans-serif, system-ui);
    contain: layout style;
  }

  *, *::before, *::after { box-sizing: border-box; }

  .shell {
    display: grid;
    grid-template-columns: minmax(13rem, 17rem) minmax(0, 1fr);
    overflow: hidden;
    min-height: 30rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: var(--gui-radius-lg, 1rem);
    background: var(--gui-surface, white);
    box-shadow: var(--gui-shadow-md, 0 .6rem 1.8rem rgb(20 24 40 / .08));
  }

  .rail {
    padding: 1.35rem;
    border-right: 1px solid var(--gui-border, #dfe2ea);
    background:
      radial-gradient(circle at 0 0, var(--gui-accent-soft, #ededff), transparent 13rem),
      var(--gui-surface-raised, #f7f8fb);
  }

  .rail-heading {
    display: block;
    margin-bottom: .75rem;
    font-size: .8rem;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .progress-group {
    display: grid;
    gap: .45rem;
    margin-bottom: 1.15rem;
  }

  .progress-text {
    color: var(--gui-text-muted, #666b78);
    font-size: .72rem;
  }

  .progress {
    overflow: hidden;
    height: .35rem;
    border-radius: 999px;
    background: var(--gui-border, #dfe2ea);
  }

  .progress i {
    display: block;
    width: 0;
    height: 100%;
    border-radius: inherit;
    background: var(--gui-accent, #5b5ce2);
    transition: width 240ms cubic-bezier(.22, 1, .36, 1);
  }

  .steps {
    display: grid;
    gap: .32rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps button {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: .65rem;
    width: 100%;
    min-width: 0;
    padding: .65rem;
    border: 0;
    border-radius: .7rem;
    background: transparent;
    color: var(--gui-text-muted, #666b78);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background 160ms ease,
      color 160ms ease,
      transform 180ms cubic-bezier(.22, 1, .36, 1);
  }

  .steps button:hover:not(:disabled, [aria-disabled="true"]) {
    background: var(--gui-surface, white);
    color: var(--gui-text, #17181c);
    transform: translateX(.15rem);
  }

  .steps button:focus-visible {
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 1px;
  }

  .steps button[aria-disabled="true"]:not([aria-current="step"]) {
    cursor: not-allowed;
    opacity: .48;
  }

  .steps button[aria-current="step"] {
    background: var(--gui-surface, white);
    color: var(--gui-text, #17181c);
    box-shadow: var(--gui-shadow-sm, 0 .2rem .8rem rgb(20 24 40 / .08));
  }

  .marker {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .65rem;
    background: var(--gui-surface, white);
    font-size: .72rem;
    font-weight: 800;
  }

  [data-state="current"] .marker {
    border-color: var(--gui-accent, #5b5ce2);
    background: var(--gui-accent, #5b5ce2);
    color: white;
  }

  [data-state="complete"] .marker {
    border-color: var(--gui-success, #17a88b);
    background: color-mix(in srgb, var(--gui-success, #17a88b) 14%, transparent);
    color: var(--gui-success, #12806c);
  }

  .step-text {
    display: grid;
    min-width: 0;
    gap: .12rem;
  }

  .step-text strong,
  .step-text small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .step-text strong { font-size: .82rem; }
  .step-text small { font-size: .67rem; font-weight: 500; }

  .main {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.5rem 1.65rem 1rem;
  }

  .header h2 {
    margin: 0;
    outline: none;
    font-size: clamp(1.35rem, 3vw, 2rem);
    letter-spacing: -.035em;
  }

  .header p {
    max-width: 58ch;
    margin: .35rem 0 0;
    color: var(--gui-text-muted, #666b78);
    line-height: 1.5;
  }

  .error {
    margin: 0 1.65rem .75rem;
    padding: .7rem .8rem;
    border: 1px solid color-mix(in srgb, var(--gui-danger, #d14343) 38%, transparent);
    border-radius: .65rem;
    background: color-mix(in srgb, var(--gui-danger, #d14343) 10%, transparent);
    color: var(--gui-danger, #b62929);
    font-size: .8rem;
    font-weight: 650;
  }

  .content {
    min-height: 0;
    padding: .5rem 1.65rem 1.5rem;
  }

  ::slotted([data-wizard-step]) {
    min-width: 0;
  }

  ::slotted([data-wizard-step][hidden]) {
    display: none !important;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.65rem;
    border-top: 1px solid var(--gui-border, #dfe2ea);
    background: var(--gui-surface-raised, #f7f8fb);
  }

  .end-actions {
    display: flex;
    gap: .6rem;
  }

  .footer button {
    min-height: 2.45rem;
    padding: .55rem .9rem;
    border: 1px solid var(--gui-border, #dfe2ea);
    border-radius: .65rem;
    background: var(--gui-surface, white);
    color: var(--gui-text, #17181c);
    font: 700 .78rem/1 var(--gui-font, ui-sans-serif, system-ui);
    cursor: pointer;
  }

  .footer button:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gui-border, #dfe2ea), var(--gui-text, #17181c) 22%);
    transform: translateY(-1px);
  }

  .footer button:focus-visible {
    outline: 2px solid var(--gui-focus, rgb(91 92 226 / .35));
    outline-offset: 2px;
  }

  .footer button.primary {
    border-color: var(--gui-accent, #5b5ce2);
    background: var(--gui-accent, #5b5ce2);
    color: white;
  }

  .footer button:disabled {
    cursor: not-allowed;
    opacity: .45;
    transform: none;
  }

  .shell[data-busy] .content { opacity: .72; }

  @media (max-width: 48rem) {
    .shell {
      grid-template-columns: 1fr;
    }

    .rail {
      overflow: hidden;
      padding: 1rem;
      border-right: 0;
      border-bottom: 1px solid var(--gui-border, #dfe2ea);
    }

    .steps {
      grid-auto-columns: minmax(10rem, 1fr);
      grid-auto-flow: column;
      overflow-x: auto;
      padding-bottom: .25rem;
      scroll-snap-type: x proximity;
    }

    .steps li { scroll-snap-align: start; }
    .steps button:hover:not(:disabled, [aria-disabled="true"]) {
      transform: translateY(-1px);
    }
  }

  @media (max-width: 34rem) {
    .header { padding: 1.2rem 1rem .75rem; }
    .content { padding: .5rem 1rem 1.25rem; }
    .error { margin-inline: 1rem; }
    .footer {
      align-items: stretch;
      padding: .85rem 1rem;
    }
    .end-actions { flex: 1; justify-content: flex-end; }
    .footer button { min-width: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      transition-duration: .01ms !important;
    }
  }
`;

if (hasDOM && !customElements.get("gui-wizard")) {
  customElements.define("gui-wizard", GuiWizard);
}
