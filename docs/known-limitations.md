# Known limitations

Recorded 2026-10-10. The [release acceptance record](release-acceptance.md) distinguishes actual passes from untested targets. The original 0.1.0 packages were unsigned internal builds; 0.1.1 is an unsigned public pre-release. Publication requires explicit manual dispatch.

## Public 0.1.1 pre-release

Version 0.1.1 was published through an explicitly dispatched workflow. Native Ubuntu 24.04 and Windows Server 2022 builds, installation and focused desktop checks passed. Full Windows 11 offline/manual file-dialog and uninstall/reinstall acceptance has not been repeated for the new artifacts. One native Windows unreadable-file fixture was skipped because the elevated runner retained read access; the deterministic denied-open error-handling test passed. Default AppImage FUSE mounting remains unverified.

The published 0.1.1 navigation deletion-dialog test timed out after choosing Save while deleting a collection. TASK-031 reproduced and fixed the Save-triggered sidebar refresh/mutation race in source; see [TASK-031 evidence](task-reports/TASK-031.md). Published installers have not been rebuilt with that fix, and no new full desktop/package acceptance is claimed. See [panel layout evidence](tooling-reports/panel-layout.md) and [0.1.1 release evidence](tooling-reports/public-release.md). The original 0.1.0 observations below remain historical.

The nested-library source milestones TASK-031–036, including strict v2 folder-aware transfer and v1 import, are separate from those published binaries. Fresh packaged Linux/Windows library acceptance remains TASK-037; TASK-036 does not supply Windows chooser or packaged-app evidence. Exports above 10 MiB reject before the save chooser, even if the saved database itself is larger. See [TASK-036 evidence](task-reports/TASK-036.md).

## Nested-library TASK-037 acceptance — unfinished

Fresh unpublished Linux deb/AppImage acceptance artifacts were built separately in `dist/task037-linux/`; exact hashes and current results are in [TASK-037](task-reports/TASK-037.md) and [new acceptance record](release-acceptance.md#task-037--new-nested-library-acceptance-unfinished). These are different bytes from public 0.1.1 downloads despite retaining version 0.1.1. No new Windows installer or publication was performed.

Actual Linux install/removal/reinstall is not run because sudo requires authentication unavailable to this session; the installed 0.1.0 package is preserved. The current session cannot run Windows 11 acceptance: VBoxManage reports unavailable driver/IPC, and no authorized guest shell/desktop is connected. Remote master differs from this local source, so its existing CI cannot verify these exact bytes. Historical Windows/installer evidence does not clear these blockers. Independent extracted-deb/AppImage checks are recorded separately, including failed attempts and test-fixture corrections.

## Observed issues and evidence limits

- **Windows uninstall required a second attempt.** The first Settings uninstall left the install folder present; the second removed it. The first uninstaller window was not observed, so the cause is unknown. Both attempts preserved all synthetic app data; reinstall/reopen succeeded. See [TASK-029 attempt 6](task-reports/TASK-029.md#windows-attempt-6-manual-checks-and-uninstall-preservation-2026-10-10-12151240).
- **Ctrl+Enter immediately after Save may be ignored briefly.** TASK-029 observed an automated-test timing race while the shortcut listener refreshes after Save. Send remains available once idle. A one-frame/macrotask wait made the recorded Windows suite pass; production behavior was not changed. Only one final clean Windows suite is recorded, not repeated stability evidence. See [TASK-029 report](task-reports/TASK-029.md).
- **AppImage default FUSE launch is not tested.** The Ubuntu host had no `/dev/fuse`; only `APPIMAGE_EXTRACT_AND_RUN=1` was verified. This keeps normal Chromium sandboxing. Use the tested deb or extraction mode; do not disable the sandbox.
- **Platform coverage is narrow.** Ubuntu 24.04.3 x64/X11 and Windows 11 Pro x64 build 26300 are recorded. Other Linux distributions, Wayland, Windows 10/other Windows builds, ARM and macOS have no independent acceptance evidence. Default AppImage mount mode and downloaded-installer reputation prompts are not passed checks.
- **Windows chooser checks are manual.** The automated package suite has five Linux-only skips (export, import, multipart, uploads and namespace offline story). Actual manual A–Q with the installed app's egress blocked supplies the Windows file/transfer/offline evidence; skips themselves do not count as passes. Preservation used an authorized synthetic-data-only existing account rather than a separate account.
- **Original internal distribution metadata.** The accepted 0.1.0 packages used `.invalid` homepage/maintainer fields and the Electron default icon. Public 0.1.1 packages use the real repository/maintainer metadata and custom icon, with separate focused packaged checks. Metadata still declares `UNLICENSED`; no open-source license, signing or update service was added.
- **Tooling advisories were reported.** The Windows lockfile install reported eight moderate npm audit advisories and deprecated transitive packages. Their exact affected dependency paths/exploitability are not established by the captured install summary; no claim of zero vulnerabilities is made. Do not run `npm audit fix --force` to clear the count: it previously downgraded the pinned builder and broke packaging. Any dependency changes require compatibility checks and fresh package evidence.

## Product limits

One window, one editor, one active send; English UI; explicit Save and no autosave. Responses and unsaved drafts are session state, not request history. Installed local operations are offline, but a remote target still needs connectivity. Requests are never automatically retried or resent.

Sensitive protection applies to marked variables and literal Auth credentials, not arbitrary ordinary text. Storage can be session-only if a secure OS backend is unavailable; values must then be re-entered after restart. Secure ciphertext is OS/account-bound and is omitted from workspace exports. Ordinary saved/exported URL/query/body/header/plain-variable text can contain secrets. A server may echo credentials in its response.

Files require reselection after reopening/import/duplication. Same-size filesystem content changes can pass the size check; an immutable upload snapshot is not guaranteed. Maximum file size is 20 MiB, selected total 50 MiB and serialized payload 55 MiB. Text bodies are 5 MiB; encoded and decoded responses each 10 MiB. Binary responses and unsupported charsets show metadata without preview/download. See [HTTP limits](request-engine.md) and [transfer limits](import-export.md).

HTTP/1.1 only; redirects default off, max five hops, no HTTPS downgrade. TLS verification stays on. There is no UI for a custom CA, client certificate, proxy or TLS bypass. Duplicate singleton headers and engine-managed header overrides are rejected; exact header casing is not promised. Variables resolve once, without recursion or automatic JSON escaping.

## Deferred beyond phase 1

Cloud sync, accounts, teamwork, billing, scripts/test runner, OAuth, automatic token extraction, persistent cookie jar, request history, multiple tabs, global/nested variables, proxy/custom CA/client-certificate settings, HTTP/2, WebSockets, GraphQL-specific tooling, OpenAPI/Postman interoperability, localization, installer signing and auto-update. These have not been added as part of documentation. See [product scope](product.md).
