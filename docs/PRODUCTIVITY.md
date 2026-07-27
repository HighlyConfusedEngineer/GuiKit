# Productivity controls

`@gui-template/core/productivity` is an optional module for dense application
workflows. It depends only on the command module and registers its custom
elements when imported.

## Virtual combobox

`GuiComboboxModel` accepts static options or an asynchronous `loader`. The
`<gui-combobox>` component filters by label, value, description, and keywords,
renders a bounded option window, and supports keyboard navigation and optional
multi-selection.

```js
import { GuiComboboxModel } from "@gui-template/core/productivity";

const model = new GuiComboboxModel({
  multiple: true,
  options: [{ value: "cpu", label: "CPU", keywords: ["processor"] }],
});
document.querySelector("gui-combobox").model = model;
```

## Scheduling

Use one `GuiScheduleModel` for `<gui-date-range-picker>` and
`<gui-scheduler>`. It validates ordered ranges, normalizes event timestamps,
and supports host-defined time zones. Recurrence, invitations, and persistence
belong in the application adapter.

## Advanced analysis

`GuiAnalysisSeries` feeds `<gui-analysis-chart>`, which switches between
histogram, scatter, heatmap, spectrogram, and gauge views. The standalone
`analysisHistogram()` and `heatmap()` helpers deliberately aggregate data before DOM
rendering; keep raw high-rate samples in the live-chart buffer or host worker.

## Property grid

`GuiPropertyGridModel` infers a flat schema from an object or accepts explicit
field metadata. It supports text, number, boolean, choice, and JSON values.
Cancel `gui:property-change-request` to apply application policy before an
edit commits.

## File transfers

`GuiUploadQueue` validates count, type, and size before retaining a browser
`File`. Uploads require a host adapter:

```js
await queue.upload({
  async upload(file, { offset, onProgress, signal }) {
    // Send only an authorized chunk through the host or HTTPS transport.
    onProgress(offset + file.size);
    return { remoteId: "approved-by-host" };
  },
});
```

The component never chooses a destination, authenticates a request, or grants
filesystem access. Resume offsets are available to the adapter, which owns
durable storage and integrity validation.

## Notification history and shortcuts

`GuiNotificationCenter` groups durable, readable notifications separately from
ephemeral toast messages. `GuiShortcutProfiles` validates shortcut conflicts,
serializes named profiles, and can apply one to `GuiCommandRegistry`. Treat
profile storage as user preferences and let the host decide where it persists.
