# Known limitations — version 0.1.0

Recorded 2026-10-10. The [release acceptance record](release-acceptance.md) distinguishes actual passes from untested targets. The packages are unsigned internal builds; nothing has been published automatically.

## Observed issues and evidence limits

- **Windows uninstall required a second attempt.** The first Settings uninstall left the install folder present; the second removed it. The first uninstaller window was not observed, so the cause is unknown. Both attempts preserved all synthetic app data; reinstall/reopen succeeded. See [TASK-029 attempt 6](task-reports/TASK-029.md#windows-attempt-6-manual-checks-and-uninstall-preservation-2026-10-10-12151240).
- **Ctrl+Enter immediately after Save may be ignored briefly.** TASK-029 observed an automated-test timing race while the shortcut listener refreshes after Save. Send remains available once idle. A one-frame/macrotask wait made the recorded Windows suite pass; production behavior was not changed. Only one final clean Windows suite is recorded, not repeated stability evidence. See [TASK-029 report](task-reports/TASK-029.md).
- **AppImage default FUSE launch is not tested.** The Ubuntu host had no `/dev/fuse`; only `APPIMAGE_EXTRACT_AND_RUN=1` was verified. This keeps normal Chromium sandboxing. Use the tested deb or extraction mode; do not disable the sandbox.
- **Platform coverage is narrow.** Ubuntu 24.04.3 x64/X11 and Windows 11 Pro x64 build 26300 are recorded. Other Linux distributions, Wayland, Windows 10/other Windows builds, ARM and macOS have no independent acceptance evidence. Default AppImage mount mode and downloaded-installer reputation prompts are not passed checks.
- **Windows chooser checks are manual.** The automated package suite has five Linux-only skips (export, import, multipart, uploads and namespace offline story). Actual manual A–Q with the installed app's egress blocked supplies the Windows file/transfer/offline evidence; skips themselves do not count as passes. Preservation used an authorized synthetic-data-only existing account rather than a separate account.
- **Internal distribution metadata remains.** Homepage/maintainer fields use reserved `.invalid` placeholders and package metadata declares `UNLICENSED`. The accepted packages recorded below used the Electron default icon; a subsequent user-authorized [custom icon](tooling-reports/app-icon.md) is now configured for source runs and future packages. Those future package bytes have not received new packaged acceptance. No public-distribution license, signing, update service or public download release was established by this task.
- **Tooling advisories were reported.** The Windows lockfile install reported eight moderate npm audit advisories and deprecated transitive packages. Their exact affected dependency paths/exploitability are not established by the captured install summary; no claim of zero vulnerabilities is made. Do not run `npm audit fix --force` to clear the count: it previously downgraded the pinned builder and broke packaging. Any dependency changes require compatibility checks and fresh package evidence.

## Product limits

One window, one editor, one active send; English UI; explicit Save and no autosave. Responses and unsaved drafts are session state, not request history. Installed local operations are offline, but a remote target still needs connectivity. Requests are never automatically retried or resent.

Sensitive protection applies to marked variables and literal Auth credentials, not arbitrary ordinary text. Storage can be session-only if a secure OS backend is unavailable; values must then be re-entered after restart. Secure ciphertext is OS/account-bound and is omitted from workspace exports. Ordinary saved/exported URL/query/body/header/plain-variable text can contain secrets. A server may echo credentials in its response.

Files require reselection after reopening/import/duplication. Same-size filesystem content changes can pass the size check; an immutable upload snapshot is not guaranteed. Maximum file size is 20 MiB, selected total 50 MiB and serialized payload 55 MiB. Text bodies are 5 MiB; encoded and decoded responses each 10 MiB. Binary responses and unsupported charsets show metadata without preview/download. See [HTTP limits](request-engine.md) and [transfer limits](import-export.md).

HTTP/1.1 only; redirects default off, max five hops, no HTTPS downgrade. TLS verification stays on. There is no UI for a custom CA, client certificate, proxy or TLS bypass. Duplicate singleton headers and engine-managed header overrides are rejected; exact header casing is not promised. Variables resolve once, without recursion or automatic JSON escaping.

## Deferred beyond phase 1

Cloud sync, accounts, teamwork, billing, scripts/test runner, OAuth, automatic token extraction, persistent cookie jar, request history, multiple tabs, global/nested variables, proxy/custom CA/client-certificate settings, HTTP/2, WebSockets, GraphQL-specific tooling, OpenAPI/Postman interoperability, localization, installer signing and auto-update. These have not been added as part of documentation. See [product scope](product.md).
