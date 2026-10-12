# Release acceptance — 0.1.0

This is the historical full acceptance record for **0.1.0**. The later [public 0.1.1 pre-release](https://github.com/miladmoham1400/api-client/releases/tag/v0.1.1) has new hashes and separate [build/publication evidence](tooling-reports/public-release.md). Its native Linux/Windows builds and focused installed-app checks passed; that does not convert unexecuted Windows 11/offline/manual/uninstall checks into passes in this matrix.

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

## TASK-037 — new nested-library acceptance (completed)

This completed record is separate from the historical 0.1.0 matrix and published 0.1.1 artifacts above. Initial (superseded) TASK-037 Linux builds used production source at `bc2380417ae8bb2fd4c3401e2852180f09268478`, with working-tree acceptance-test/document changes. Same version/filename does not mean same bytes. No Windows acceptance is inherited and no release/tag/version was changed.

| Fresh local artifact | Bytes | SHA-256 |
|---|---|---|
| `dist/windows/offline-api-client-0.1.1-x64-setup.exe` — **current candidate**, `cfed400` plus the guarded-dialog/Ctrl+S fix | 124690192 | `67a839a2d15e742b3821ecbb88eb4e1cde5d39880de58c126014ed0914a0a569` |
| Linux deb/AppImage from the fixed source | Not yet built | Pending the user's Ubuntu run (`dist/task037-linux-fix/`) |
| *Superseded (unfixed source):* `dist/task037-linux/offline-api-client-0.1.1-amd64.deb` | 112870588 | `dc3771d55769606d4da0dfbdd027744bb36d83fe3efbd083a5c421e16c0e833e` |
| *Superseded (unfixed source):* `dist/task037-linux/offline-api-client-0.1.1-x86_64.AppImage` | 143974249 | `cc593562edf9582fb9644318491faf2e3662d638ad2fbd557da1568a69604c1d` |
| *Superseded (unfixed source):* first Windows 11 build | 124690228 | `aea429986e134284e0449ebbc99fbf08f0e7ed558bbbdf30f526b39e9b9025ae` |

The Linux paragraphs below describe the superseded unfixed-source artifacts. They remain useful history; fixed-source reruns are recorded below. Fresh Ubuntu 24.04.3 x64/X11 build/typecheck/lint and builder-managed Electron SQLite rebuild succeeded. Final unit rerun passed all 369 tests across 37 files; the earlier timeout is retained in the report. Current deb metadata is amd64, version 0.1.1. Existing `dist/linux/` installers and installed 0.1.0 app were preserved. Extracting the new deb payload is not installation. The final complete loopback-only deb-payload desktop suite reported **36 passed, no skips** (5.1 min). Earlier attempts had a retired export-gate assertion and a fixture close during workspace transition; corrected test sequencing and dedicated v2 transfer checks passed against the same hashed payload. See [TASK-037 report](task-reports/TASK-037.md) for final checks and retained failures.

The new large-library deb-payload check passed at depth 16 with 100 collections, 1,000 folders and 1,000 requests plus an isolated second workspace: cold readiness 1505.72 ms (<=2000), selection p95 245.48 ms and search p95 151.36 ms (<=500), after one warm-up and 20 samples each. Live rows were bounded to 50 tree/100 search rows. All pages and first/middle/last exact method/URL/body sends were verified; normal restart retained complete structure/config/expansion and reset search. Full [Linux samples/hardware](task-reports/TASK-037-linux-performance.json) are recorded; this does not attest installed binaries or Windows performance.

| Required new target criterion | Linux (fixed source) | Windows 11 (fixed build `67a839a2…`) |
|---|---|---|
| Native new package build/hash | Passed: fixed-source deb/AppImage; hashes in continuation below | Passed: installer above; unit 368/369 non-elevated, plus the remaining symlink file 11/11 elevated, so all 369 covered |
| Actual install/removal/reinstall preservation | Passed: user-terminal upgrade, actual removal with unchanged synthetic DB hash, same-deb reinstall and nested reopen | Passed: installed over the previous build, uninstall kept all 37 data files byte-identical, reinstall/reopen restored nested state (current account, authorized deviation) |
| Loopback-only startup/edit/send and security/secret/file/response regression | Passed: full fixed-source installed suite 36/36 (5.0 min), loopback-only, no skips; payload also 36/36 | Passed: installed, app egress firewall-blocked, 31 passed / 0 failed / 5 Linux-only skipped; guard and Ctrl+S specs 5× repeat 30/30 |
| Guarded rename/delete after dirty Save; Ctrl+S on non-Latin layout | Passed: fixed-source deb full suite plus 5× repeats, 30/30; non-Latin DOM event (no Linux layout-switch manual check) | Passed: automated (6/6 each) and manual (guarded rename closes; Persian-layout Ctrl+S saves) |
| 1,000-request/folder depth-16 browsing/search/wire/restart | Passed: installed cold 1357.74 ms, p95 277.90/152.06 ms; payload also passed | Passed: cold 733.24 ms, selection p95 99.16 ms, search p95 67.22 ms |
| Closed legacy profile upgrade in target package | Passed: fixed-source installed and deb payload, closed synthetic legacy profile | Passed: fixture test, plus the real 0.1.0 test profile upgraded in place without loss (first build; storage code unchanged by the fix) |
| Native v1 import/v2 export/import and recovery | Passed: fixed-source installed native Linux dialogs (payload also passed) | Passed manually on the first build (transfer code unchanged by the fix) |
| AppImage extraction-and-run focused acceptance | Passed: fixed-source 11 focused offline tests, no skips (2.6 min) | Not applicable |
| Default AppImage FUSE startup | Not run: no `/dev/fuse` | Not applicable |

TASK-037 completed 2026-10-12 after review of the successful Linux installed run. Fixed-source Linux build/hash, full deb payload, five guard/Ctrl+S repeats and focused AppImage suites have passed. Actual user-terminal installation/upgrade, full installed suite and removal/reinstall preservation passed. `task037-linux-acceptance.sh` now separates independent prepare checks from installed-only acceptance and stops nonzero on failure. Windows Server CI smoke was not used and cannot substitute for Windows 11. Details are in the [TASK-037 report](task-reports/TASK-037.md#defect-fixes-and-windows-re-acceptance--2026-10-12-19201953). This records the accepted local unsigned artifacts and explicit coverage limits; no public release was published.


### Fixed-source Linux continuation — 2026-10-12

Current source `0586aaf22f3587ebf953c25e25531018a1ee8583` already contains all four supplied patch changes; no production source changed in this continuation. Build/type/lint/native rebuild and 369-unit suite passed. Fresh unpublished 0.1.1 artifacts below supersede the old Linux candidates without transferring old evidence:

| Local fixed artifact (`dist/task037-linux-fix/20261012-codex/`) | Bytes | SHA-256 |
|---|---|---|
| `offline-api-client-0.1.1-amd64.deb` | 112870776 | `8b09c1ce2b54079f296590d34c0e4be2bda5437909f7feae0ffa6181cb98bf46` |
| `offline-api-client-0.1.1-x86_64.AppImage` | 143974205 | `491e58c0ca577631888c9c671506fb07f76b9827619a4464c4c0a37ec36a1316` |

Ubuntu 24.04.3 x64/X11, kernel 7.0.0-38-generic, developer Node 22.18.0/npm 11.6.2. Offline full deb payload: **36/36**, guard/Ctrl+S five repeats: **30/30**, AppImage extraction focused checks: **11/11**, all without skips. Large-library cold readiness **1408.59 ms**, selection/search p95 **262.34/150.66 ms**, meeting reference bounds; [complete fixed-source samples](task-reports/TASK-037-linux-fixed-performance.json). Native dialogs/legacy upgrade/restart and HTTP/security behavior are covered by these fresh payload checks. User-terminal upgrade/install is now version 0.1.1 with installed executable/app.asar/native-addon byte identity verified; full installed 36-test acceptance and actual removal/reinstall preservation subsequently passed. See the [continuation and exact command](task-reports/TASK-037.md#linux-continuation--supplied-patchscript-review-2026-10-12) for the reviewed sudo-authenticated installed evidence. Linux manual Persian layout switching and default FUSE mode remain untested. No new Windows run or release publication was performed by Codex in this continuation.


### Final Linux installed acceptance — 2026-10-12 21:54–22:00

User-terminal installed-only sequence and durable [full transcript](task-reports/TASK-037-linux-installed/acceptance.txt) were reviewed: exact installer/source checks, installed executable/app.asar/N-API addon identity, full **36/36 installed offline tests** (exit 0), synthetic seed **1/1**, actual package removal with binary absent and unchanged closed DB hash, same-hash reinstall, byte identity again and nested preservation/reopen **1/1**, all exit 0. Closed DB SHA-256 before/after removal: `54abe211d532094196ac7c35304721220f5aa2ae55bc85ff21ba790d3b4cdce3`; [manifest](task-reports/TASK-037-linux-installed/preservation.json). Installed large-library cold **1357.74 ms**, selection p95 **277.90 ms**, search p95 **152.06 ms**, 20 samples each; [full samples](task-reports/TASK-037-linux-installed/performance.json). Targets passed. The earlier 21:50 path-check failure is retained in the report; it stopped before removal and was not counted as a pass.

Required TASK-037 acceptance is complete using the recorded Ubuntu x64/X11 and Claude-provided Windows 11 observations, with their explicit firewall/account/manual-dialog deviations. Windows automated native-dialog skips are not passes; manual transfer/file observations were recorded on the first milestone build (that code unchanged by the fixed guard/shortcut rebuild), while fixed-build guard/shortcut/manual loopback and preservation were reverified. Default AppImage FUSE mode, other platforms, Linux real Persian-layout switching and downloaded Windows reputation prompts remain not run. Public v0.1.1 downloads remain older bytes; no publishing/version/tag action occurred.
