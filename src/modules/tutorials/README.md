# Interactive tutorials

Use `GuiTutorialModel` with `<gui-tutorial>` to guide people through a live interface. Each step names a CSS target, title, and concise description. The component scrolls that target into view, displays an accessible spotlight and dialog, and restores the page when dismissed.

```js
const tour = new GuiTutorialModel([
  { id: "search", target: "#search", title: "Search", description: "Find records by name or id." },
  { id: "save", target: "#save", title: "Save", description: "Store the current changes.", advanceOn: { event: "click" } },
]);
document.querySelector("gui-tutorial").model = tour;
tour.start();
```

Use stable ids for targets. Do not put secrets or security-critical confirmations behind a tutorial; the overlay is a teaching aid, not authorization.
