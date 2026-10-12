# TASK-037 — Verify and document nested-library packaged acceptance

Status: done
Dependencies: TASK-036
Priority: highest — approved API-library milestone

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Run the integrated nested-library story, close defects within this milestone, build and independently verify fresh target-native Linux/Windows installers. Record hashes/OS/performance/upgrade/offline/manual results and update user guide/limitations/acceptance. Do not reuse 0.1.1 evidence for new bytes.

## Acceptance criteria

- Synthetic phase-1 database upgrades without loss; nested example plus 1,000-request/1,000-folder library survives normal close/reopen and stays workspace-isolated.
- Browse/search/select/send first/middle/last with correct wire method/URL/body; preserve all dirty/active-send/security/TLS/secret/file/response behavior and no auto-send.
- V1 import and v2 export/import restore structure and exclusions; actual native chooser behavior independently recorded per OS.
- Linux and Windows packages rebuilt natively with SQLite, hashed, installed and exercised offline with loopback available; Windows 11 baseline checks recorded separately from Server CI smoke.
- Actual migration, performance, offline, dialogs and installer preservation checks have evidence or explicit not-run blockers; never mark this task done with required platform criteria missing.
- User guide/known limitations/acceptance describe actual shipped behavior, exact artifact hashes and remaining defects. No inherited green result from historical tasks/releases.

## Verification

Appropriate full unit/type/lint/build and desktop/offline suites, independent packaged upgrade/restart/native dialog/uninstall-preservation checks, recorded performance samples. Stop if platform access is missing: complete independent work and report the exact unfinished criterion.

## Excluded from this task

No automatic release publication/version/tag change, signing setup, updater, unrelated next-phase features or production sandbox/TLS bypass.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-037.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.

## Execution history — 2026-10-12 (earlier blockers retained)

Independent Linux build/hash and extracted-payload acceptance evidence is recorded in [TASK-037 report](../task-reports/TASK-037.md). Required actual Linux install/manual upgrade/removal/reinstall preservation needs sudo authentication through the OS prompt. Current native Windows build and installed Windows 11 offline/native-dialog/legacy-upgrade/performance/preservation checks need an accessible authorized Windows runner. No required platform result is inherited from previous artifacts. Task remains unfinished; resume this task before declaring the nested-library milestone accepted.

Update, 2026-10-12: current-source Windows 11 build and installed acceptance were executed. The installer hash, upgrade, offline suite, performance, native dialogs, v1/v2 transfer and uninstall/reinstall preservation are recorded in the [report](../task-reports/TASK-037.md). The task stays **blocked** for these reasons:
- **Windows guarded-dialog defect:** in-scope product defect. After a successful dirty-guard Save, the rename/delete dialog does not close (`library-tree:105` and `navigation:133` fail). A source fix needs approval and then rebuilds and re-acceptance of both platforms.
- **Windows unit result:** the unit suite is 368/369 because the symlink test needs Developer Mode or elevation.
- **Ctrl+S on non-Latin layouts:** recorded defect, decision pending.
- **Linux:** actual install, removal and reinstall still need sudo authentication.

Update, 2026-10-12 evening: both defects are fixed in the working tree, and the Windows installer was rebuilt (`67a839a2…a0a569`). It passed everything on Windows 11: unit 369/369 (symlink case elevated), installed suite 31 passed / 5 Linux-only skipped / 0 failed, 5× repeats of the guard and Ctrl+S specs, manual Persian Ctrl+S and guarded rename, and uninstall/reinstall preservation. Details are in the [report](../task-reports/TASK-037.md#defect-fixes-and-windows-re-acceptance--2026-10-12-19201953).

The task stays **blocked** only on Linux. The deb/AppImage must be rebuilt from the fixed source and re-run, including the actual sudo install and removal/reinstall preservation, on the user's Ubuntu machine with the provided script.


Linux continuation, 2026-10-12: supplied patch is already applied in `0586aaf`; no source overwritten. Hardened the supplied Linux acceptance runner and rebuilt fresh deb/AppImage, preserving older outputs. Current unit suite: 369/369 passed; fresh deb full suite 36/36, five guard/Ctrl+S repeats 30/30, AppImage extraction focused suite 11/11. Fixed-source payload results and hashes are recorded in the [report](../task-reports/TASK-037.md#linux-continuation--supplied-patchscript-review-2026-10-12). Status remains blocked because actual Linux installation/removal/reinstallation needs user-terminal sudo authentication; extraction is not installation.


User-terminal update, 2026-10-12 21:50: actual upgrade/install 0.1.0 → 0.1.1 succeeded and installed code matches the deb. Runner stopped at a legacy native-SQLite comparison path; corrected to the observed `prebuilds/linux-x64.node`, with byte comparison verified. Remaining blocker is full installed offline acceptance and actual removal/reinstall nested preservation, not package rebuilding. Status stays blocked; resume the same installed-only command.


## Completion — 2026-10-12 22:00

The corrected installed-only Linux run passed: full installed suite 36/36, actual removal with unchanged closed database hash, same-deb reinstall and nested preservation verify 1/1 (seed also 1/1). Installed large-library cold/p95 measurements meet the specification. Combined with the recorded independent Windows 11 build/installed/offline/manual/performance/preservation evidence, required acceptance is complete. Earlier blockers above are resolved; skipped/default-FUSE/other-platform checks remain documented limitations. Current exact hashes, durable Linux transcript/manifest/samples and per-criterion evidence are in the [final report](../task-reports/TASK-037.md#final-installed-linux-acceptance-and-completion--2026-10-12-21542200). Task/index are both done. No release publication or later task was started.
