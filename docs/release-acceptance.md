# Release acceptance — 0.1.0

Recorded **2026-10-10** for TASK-030. Required phase-1 acceptance has independent evidence for the installed Ubuntu deb and Windows NSIS packages below. Linux AppImage acceptance applies to extraction-and-run mode only. These are unsigned internal builds, not a published or signed public release. Known issues and untested targets remain in [known limitations](known-limitations.md).

## Artifacts

| Platform/artifact | Version | SHA-256 | Original evidence |
|---|---|---|---|
| Linux `offline-api-client-0.1.0-amd64.deb` | 0.1.0 | `f03817791dec3cf874b84001a3020393dcb56a5e96a00f02fca192231486ac28` | [TASK-028](task-reports/TASK-028.md) |
| Linux `offline-api-client-0.1.0-x86_64.AppImage` | 0.1.0 | `0fc016e359cbf62b7384162a46c6cd6e5e771c86c070f683b447f80b03166178` | [TASK-028](task-reports/TASK-028.md), extraction mode |
| Windows `offline-api-client-0.1.0-x64-setup.exe` | 0.1.0 | `d8743c44c4b124361bf8b45c65e8eeb4cc6567c21eca4a6ba74973d7d8e44a4b` | [Windows build transcript](../task029-evidence/1-build-log.txt), [TASK-029](task-reports/TASK-029.md) |

Hashes identify the tested bytes. Rebuilding can produce different hashes even at the same version; no bit-identical reproducibility claim is made. Artifacts in `dist/` are ignored generated output; this document does not upload or supply binaries. Tool versions are pinned by `package.json`/lockfile and recorded in [toolchain lock](toolchain-lock.md).

## Independent environments and methods

| Detail | Linux | Windows |
|---|---|---|
| Test date | 2026-10-05 | 2026-10-09/10 build; 2026-10-10 final acceptance |
| OS | Ubuntu 24.04.3 LTS x64, X11; kernel 7.0.0-34-generic | Windows 11 Pro 10.0.26300 x64 |
| Developer tools | Node 22.18.0, npm 11.6.2 | Node 22.18.0, npm 11.6.2; Python 3.14.0; VS Build Tools 2022 17.14; PowerShell 5.1.26100 |
| Packager/native dependency | electron-builder 26.15.3, better-sqlite3 13.0.3, sequential target rebuild | Same pinned builder/driver; native Windows x64 rebuild recorded |
| Installed runtime | Electron 44.5.1, embedded Node 24.21.0, Chromium 152.0.7977.130, ABI 149 | Same runtime independently observed by Windows baseline spec |
| Installed executable | `/opt/offline-api-client/offline-api-client` | `%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe` |
| Offline method | Private network namespace with only loopback; no external interfaces/routes; egress probe fails | Automated suite with external TCP probe failing; final manual checks under outbound Windows Firewall block for installed executable, all profiles ON; app external request failed and loopback worked; temporary rule removed |
| Synthetic preservation storage | Dedicated temporary XDG userData | Existing account with no real app data; authorized deviation from separate-account procedure |
| Real secure backend | gnome_libsecret available; round-trip observed | Secure platform backend; round-trip and plaintext-absence checks observed |

Windows manual checks were performed by Claude through screen control in TASK-029, with recorded user authorization for the firewall/account deviations. TASK-030 reviewed that evidence; it did not operate the Windows machine, rerun Windows tests or independently hash its installer. A failed single TCP probe alone would not prove all egress blocked; the final restrictive-rule evidence and successful loopback requests supply the offline method. Linux and Windows evidence are not interchangeable.

## Required matrix

Each **Pass** below means the recorded target package has a successful check, with supporting automated and/or manual evidence. Windows skips are not passes; manual checks supply the corresponding rows.

| Required check from testing specification | Linux installed deb | Windows installed NSIS |
|---|---|---|
| Start with internet disconnected / egress blocked | **Pass** — namespace offline story and baseline | **Pass** — manual A under outbound block, automated baseline |
| Create/save/restart preserves data | **Pass** — workspaces, requests, fields, body, variables, offline story | **Pass** — isolated suite plus manual C/Q |
| Two workspaces cannot cross-read/update | **Pass** — collections, variables, workspaces, offline story | **Pass** — isolated suite plus manual N |
| Environment precedence and missing variables | **Pass** — variables/auth/offline story | **Pass** — variables/auth plus manual D/E |
| Local GET/JSON/form/file sends | **Pass** — execution, body/forms, multipart/uploads | **Pass** — execution/forms plus manual B/F/G/H and native file dialog |
| Cancel/timeout followed by successful send | **Pass** — cancel-timeout/execution/offline story | **Pass** — isolated suite plus manual I/J |
| 401/500 displayed as responses | **Pass** — execution/response/offline story | **Pass** — execution/response plus manual K |
| Import/export exclusions and round-trip | **Pass** — native export/import and offline story | **Pass** — manual O/P with native save/open dialogs and [exported synthetic JSON](../task029-evidence/6-export-testA.json) |
| TLS error remains enforced | **Pass** — execution/redirects | **Pass** — execution/redirects plus manual M |
| Native SQLite loads from packaged app | **Pass** — database load/write/reopen | **Pass** — database load/write/reopen and manual Q |
| Safe response text, no resource execution | **Pass** — baseline/security/response viewer | **Pass** — baseline/security/response viewer plus manual L |

Linux source: [TASK-028 report](task-reports/TASK-028.md), actual installed suite **26 passed, no skips**, and normal installed startup. AppImage extraction mode also recorded **26 passed, no skips** against the exact hashed package. Windows sources: [final automated transcript](../task029-evidence/2-offline-tests-log.txt), **21 passed, 0 failed, 5 skipped**, [manual A–Q](../task029-evidence/3-manual-checks.txt), [firewall add/remove log](../task029-evidence/a-firewall-log.txt) and [TASK-029 report](task-reports/TASK-029.md). The final five skipped specs were export/import/multipart/uploads native chooser automation and the Linux namespace story; manual Windows observations cover their product behavior. Earlier failed attempts remain in the task report and were superseded by the final checks, not erased.

## Build, install and preservation

| Additional release check | Linux | Windows |
|---|---|---|
| Lockfile install, lint, unit tests, production package build | **Pass**, 319 unit tests | **Pass**, 319 unit tests and native NSIS build |
| Actual install and regular-user launch | **Pass**, dpkg install and installed suite | **Pass**, per-user NSIS and installed suite/manual launch |
| Normal close/reopen | **Pass**, offline story and preservation test | **Pass**, database/manual Q and reinstall reopen |
| Default uninstall preserves local data | **Pass**, actual dpkg removal; synthetic database hash unchanged | **Pass**, second Settings removal completed; all 37 app-data file hashes unchanged |
| Reinstall and reopen same synthetic state | **Pass**, same hashed deb | **Pass**, same hashed NSIS; workspace/request/environment/theme observed |
| Signing status | Unsigned internal package | Signing explicitly skipped for executable/installer |

Linux preservation database SHA-256 before startup after reinstall: `6dbe6b3d00428603a731b32c80d1fa797fc893acddb573dc4781ebadc51bac10`. Windows preservation database SHA-256 before and after actual uninstall: `2b7254d32245ec77c1ab2c38a7c6196936503d06b1df443ccdfb3c4a2867efb4`, recorded in [preservation log](../task029-evidence/4-preservation-log.txt). After reopening, writes/caches may change; logical state was checked separately. The first Windows uninstall attempt left the app installed; successful removal required a second attempt. This remains an observed issue, not a universal clean-first-attempt claim.

## Not-run coverage and readiness

| Coverage outside the accepted package paths | Status |
|---|---|
| AppImage default FUSE mount launch | **Not run** — tested host lacks `/dev/fuse` |
| Other Linux distros / Wayland | **Not run** |
| Windows 10 / other Windows builds / ARM / macOS | **Not run** |
| SmartScreen behavior of a downloaded, reputation-marked installer | **Not run** — no prompt on locally built test file |
| Separate-account Windows uninstall preservation | **Not run** — authorized synthetic-only existing-account deviation |
| Repeated final clean Windows suite | **Not run** — one final clean run recorded |

The required phase-1 functional matrix is satisfied for the recorded installed Linux/Windows packages, with documented deviations and limitations. This supports an **unsigned internal 0.1.0 acceptance baseline**, not an assertion that every distribution path or platform is verified. Default FUSE mode remains unverified. Public distribution still needs real metadata and a licensing decision; signing and auto-update remain deferred. No publishing action was performed.

## Reproduce and review

Follow [release build procedures](release.md) and [testing strategy](testing.md) with synthetic data and the target-native toolchain. Never run rebuilds concurrently. Run the Linux isolated suite sequentially with `API_CLIENT_EXECUTABLE` selecting the exact installed package; use extraction mode for AppImage. Windows uses `npm.cmd`, target-native packaging, the installed-executable suite and the manual native-dialog/offline/preservation checks in [Windows procedure](../task029-evidence/STEPS.md). The completed [TASK-029 report](task-reports/TASK-029.md) records deviations from that original procedure, which used a separate account and network disconnection.

Verify installed identity, hashes, egress restriction with loopback working, normal close/reopen and actual uninstall behavior. Record new results separately; do not replace not-run entries with assumed passes. TASK-030's additional Linux guide checks and document validation are in [its report](task-reports/TASK-030.md); they do not rerun the full offline matrix.
