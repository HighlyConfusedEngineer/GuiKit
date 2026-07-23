# Security policy

## Supported versions

Until the first stable release, security fixes are applied to the latest
version on the `main` branch.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Report it privately
to the repository owner with:

- affected version or commit;
- a minimal reproduction;
- potential impact;
- any proposed mitigation.

Avoid including real secrets, personal data, or production host messages in a
report.

## Security boundaries

GuiKit does not authenticate or authorize native bridge calls. A host
application must validate every method and parameter it receives. Do not expose
arbitrary code execution, unrestricted filesystem paths, or raw database
queries through the bridge.

Translation values and toast messages are assigned through `textContent`, not
HTML. Applications that render their own HTML remain responsible for
sanitization and an appropriate Content Security Policy.
