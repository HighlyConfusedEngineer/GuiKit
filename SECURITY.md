# Security policy

## Supported versions

Until the first stable release, security fixes are applied to the latest
version on the `main` branch. Maintainers target an acknowledgement within
five business days and provide a remediation timeline after triage.

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

The logging manager redacts common credential fields and bounds serialized
values before they reach a sink. This is defense in depth: applications must
still avoid logging secrets and personal data. Native and HTTP collectors are
responsible for authentication, access controls, encrypted transport,
retention, and deletion. Treat exported JSONL files as potentially sensitive.

## Deployment baseline

Treat every webview document as untrusted until its origin, navigation policy,
and bridge surface are explicitly configured by the host. Production hosts
should use a restrictive Content Security Policy, disable arbitrary remote
navigation, allow only reviewed media/connect origins, and expose a narrow
allowlist of bridge methods. Do not grant a page filesystem, shell, credential,
or unrestricted network access through a convenience bridge method.
