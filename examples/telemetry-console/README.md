# PulseOps telemetry console

PulseOps is a focused GuiKit reference application for an industrial monitoring
team. It is intentionally not a component catalogue: every surface belongs to
a believable workflow—observe a live production line, investigate an alarm,
inspect its signal-processing flow, and produce an auditable shift handover.

## Run it

Run the existing local example server from the repository root:

```powershell
npm run demo:telemetry
```

Then open <http://127.0.0.1:4174/examples/telemetry-console/>. It can also be
served from any static server because telemetry and report compilation are safe
browser simulations.

## What it demonstrates

- Bounded multi-signal live chart with thresholds and annotations.
- Alarm lifecycle, toast feedback, structured logging, status bar, and an
  auditable event stream.
- Typed, executable-looking signal-flow node editor with inline controls.
- Interactive contextual tutorial for operator onboarding.
- TeX-backed shift-report workflow using a host-replaceable compiler adapter.
- Responsive sidebar/page navigation and configuration form.

For a real deployment, replace the simulated stream with a host bridge or
connector, route acknowledgements through an authenticated backend, and provide
the TeX compiler through the Python or C# host adapter.
