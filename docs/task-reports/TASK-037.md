# TASK-037 — Nested-library packaged acceptance

Status: blocked — waiting only on the Linux run of the fixed source (rebuild, payload/AppImage suites, sudo install and removal/reinstall preservation).
- Windows 11: the guarded-dialog and Ctrl+S defects found on 2026-10-12 are fixed; the rebuilt installer passed every Windows check (see "Defect fixes and Windows re-acceptance").
- Linux: the earlier deb/AppImage were built from the unfixed source, so they are superseded and need a rebuild; actual install/preservation was never run (sudo).

Execution dates: 2026-10-11–12 (Asia/Tehran).

## Selection, scope and provenance

Selected the earliest unfinished task, TASK-037, with TASK-036 done. Read AGENTS.md, product, decisions, task index, the task and its referenced API-library/data-model/architecture/IPC/UI/transfer/testing/limitations/public-release specifications. Initial working tree was clean at `bc2380417ae8bb2fd4c3401e2852180f09268478` (`finished TASK-036`). Only acceptance tests and documentation changed. Runtime source, pinned packages, lockfile, version, release/tag and production security settings are unchanged. No later task, publication, push or workflow dispatch occurred.

Tests use isolated temporary synthetic profiles and loopback APIs, never user workspaces or credentials. New packages use `dist/task037-linux/`, preserving existing `dist/linux/` artifacts and the installed 0.1.0 app. These unpublished 0.1.1 bytes are distinct from public 0.1.1 downloads; historical platform passes do not cover them.

## Changes

- Added a target-Electron SQLite migration fixture: a separately closed original-schema database, 1,005 requests across two workspaces, collections, environments, ordered request configuration, Unicode text, variable/secret references, selection and theme. Compare every legacy table and exact configuration text after migration; check migration ledger, foreign keys, no invented folders, workspace isolation, normal reopen, unchanged closed backup hash and zero sends. Synthetic secret records contain no credential values.
- Extended large-library acceptance to depth 16, 100 collections, 1,000 folders and 1,000 requests, retaining measured cold/selection/search bounds, all-page reachability and first/middle/last exact wire assertions. Added normal close/reopen and exact structure/configuration comparisons. Performance output can be saved to a test-only environment-selected report path.
- Added actual Linux native-dialog v1 import after nested v2 round-trip/recovery; verify no folders, original collection/workspace destinations, new workspace/no selection and no send.
- Removed the retired TASK-033 folder-export rejection assertion. V2 export now opens a native chooser and is covered by dedicated transfer tests. Changed the folder restart step to normal close.
- Updated the guide for collection/folder contextual creation, nested browsing, bounded search/paging, keyboard navigation, moves/deletion promotion and transfer exclusions. Corrected stale product/testing/IPC milestone descriptions; distinguish current source/local builds from public downloads. Added separate unfinished acceptance and limitations records.

## Environment and artifacts

Ubuntu 24.04.3 x64/X11, kernel `7.0.0-38-generic`, Intel i7-1165G7 @ 2.80 GHz, 8 logical CPUs, 16,538,353,664 bytes RAM. Developer Node 22.18.0/npm 11.6.2; packaged Electron 44.5.1 uses embedded Node 24.21.0, ABI 149 and Chromium 152.0.7977.130. Pinned better-sqlite3 13.0.3 and electron-builder 26.15.3; no version guessing/upgrading.

| Fresh local artifact | Bytes | SHA-256 |
|---|---|---|
| `dist/task037-linux/offline-api-client-0.1.1-amd64.deb` | 112870588 | `dc3771d55769606d4da0dfbdd027744bb36d83fe3efbd083a5c421e16c0e833e` |
| `dist/task037-linux/offline-api-client-0.1.1-x86_64.AppImage` | 143974249 | `cc593562edf9582fb9644318491faf2e3662d638ad2fbd557da1568a69604c1d` |

Hashes recorded in generated `dist/task037-linux/SHA256SUMS.txt` and rechecked after test-fixture corrections. Deb metadata: package `offline-api-client`, version 0.1.1, amd64. Generated installers/build logs are local ignored outputs, not committed release assets.

## Commands and actual evidence

1. `npm run typecheck && npm run lint && npm run test:unit -- --maxWorkers=1`: type/lint passed; unit command exited 1, **368 passed / 1 failed** across 37 files (142.79 s). Existing `tests/main/library-search.test.ts` first case exceeded its unchanged 5 s timeout (6.381 s). A targeted elevated retry was not executed because approval review timed out; safe default-sandbox `npx vitest run tests/main/library-search.test.ts --maxWorkers=1` then exited 0, **2/2 passed** (4.65 s). The targeted rerun alone is not a clean full-unit-suite pass; the later full rerun is recorded in item 8. No assertion or performance threshold was relaxed.
2. `npm run build && npx electron-builder --config electron-builder.json --config.directories.output=dist/task037-linux --linux AppImage deb --x64 --publish never`: exited 0, bundles and target-native SQLite rebuild/package completed. Existing Zod annotation warnings and builder rebuild/dependency advice were emitted; no dependency changes were made.
3. `dpkg-deb --extract dist/task037-linux/offline-api-client-0.1.1-amd64.deb dist/task037-linux/deb-extracted`: exited 0. All deb acceptance below uses its exact extracted `/opt/offline-api-client/offline-api-client` payload, **not an installed app**.
4. `API_CLIENT_EXECUTABLE="$PWD/dist/task037-linux/deb-extracted/opt/offline-api-client/offline-api-client" API_CLIENT_PERFORMANCE_REPORT=/tmp/task037-deb-performance.json bash scripts/test-offline.sh`: first complete attempt exited 1, **34 passed / 2 timed out**, plus one worker teardown timeout (7.6 min). Folder test still expected the retired export gate; the new migration fixture closed during a workspace transition. Failures are retained, not counted as passes.
5. Focused `bash scripts/test-offline.sh tests/folders.spec.ts tests/library-upgrade.spec.ts --trace=retain-on-failure` with the same executable: exited 1, folder passed (3.0 s), migration fixture timed out, plus teardown error. Trace showed migration/table/configuration comparisons passed, then normal close hung immediately after switching workspaces. Waiting for the restored selected editor and enabled Save before closing corrected fixture sequencing. A bootstrap-readiness change alone had not resolved it. Final focused `bash scripts/test-offline.sh tests/library-upgrade.spec.ts --trace=retain-on-failure`: exited 0, **1 passed** (test 5.5 s / total 6.4 s), same hashed payload.
6. Final full deb-payload rerun, identical executable with `API_CLIENT_PERFORMANCE_REPORT=/tmp/task037-deb-performance-final.json`: Playwright final report **36 passed, no skips (5.1 min)**. No failures/teardown error reported. The original command session ID was unavailable after context compaction; its final process exit code was not separately recovered. This result records the actual completed test report.
7. `API_CLIENT_EXECUTABLE="$PWD/dist/task037-linux/offline-api-client-0.1.1-x86_64.AppImage" APPIMAGE_EXTRACT_AND_RUN=1 bash scripts/test-offline.sh tests/library-upgrade.spec.ts tests/library-tree.spec.ts tests/import.spec.ts tests/offline.spec.ts tests/database.spec.ts tests/security.spec.ts`: exited 0, **7 passed, no skips (1.7 min)**. Exact AppImage extraction-and-run payload: native SQLite/corruption recovery, closed legacy upgrade, nested browse/send/restart/guards, native v1/v2 transfer, integrated loopback-only story and production-window security. This was a focused suite, not the full 36-test suite, installer acceptance or default FUSE startup.

8. Final `npm run test:unit -- --maxWorkers=1`: exited 0, **37 files / 369 tests passed** (146.67 s), log `/tmp/api-client-task037-unit-final.log`. This supersedes the initial unit timeout while retaining it above.

Offline wrapper uses private user/network namespaces, only loopback, no IPv4 routes and an external probe returning ENETUNREACH; Electron runs as a non-root user with Chromium sandbox enabled. Native Linux save/open/file dialogs are exercised rather than replaced with renderer paths. Actual safeStorage backend reported `gnome_libsecret`, available/secure, successful round-trip and plaintext absent. TLS/redirect enforcement, workspace/frame ownership, cancellation, dirty guards, request files/forms, untrusted response text and explicit sending remain covered by the full desktop suite. No host network/firewall changes or production sandbox/TLS bypass occurred.

Raw command logs are local `/tmp/api-client-task037-*.log`, with final deb log `/tmp/api-client-task037-deb-offline-final.log`. Temporary logs/traces/screenshots are not durable committed artifacts; command/results and non-sensitive performance samples are retained here.

## Linux large-library measurements

Final deb-payload samples: cold readiness **1505.72 ms** (target <=2000), selection p95 **245.48 ms**, search p95 **151.36 ms** (targets <=500). One warm-up, 20 distinct selection samples and 20 distinct search samples; complete samples/hardware/dataset are in [TASK-037-linux-performance.json](TASK-037-linux-performance.json). Tree live rows <=50, search <=100; all 2,100 logical collection/folder/request nodes and all 1,000 search results were reachable. First/middle/last selected requests sent the exact expected method/URL/body; navigation did not auto-send. Normal restart retained structure/configuration/expansion and reset session search; second workspace stayed isolated.

The first attempt also passed the scale case: cold 1308.46 ms, selection p95 247.08 ms, search p95 151.52 ms. These samples are a separate run, not averaged into the final values. Viewports 1280×720 and 1000×700 had no document horizontal overflow; inspected the final 1000×700 synthetic screenshot with independently scrolling tree/editor/response. This attests this Linux payload/environment, not Windows or installed launch timings.

## Windows 11 current-source execution — 2026-10-12

Executed on the user's Windows 11 Pro x64 PC (`Microsoft Windows [Version 10.0.26300.9550]`, Intel i7-14700HX, 28 logical CPUs, 68,413,153,280 bytes RAM). Claude drove it through the linked desktop session, and the user approved two UAC prompts. Checkout `G:\api-client` at `cfed400` (`blocked Task-037`). This commit has the same `src/`, `package.json`, lockfile and builder configuration as Linux source `bc23804`. Only acceptance tests and documents differ. `git status` before the build showed the user's existing ` M package-lock.json` change, which was preserved, and the new evidence folder. Node v22.18.0 and npm 11.6.2 were used. Raw logs, helper scripts and the v2 export are in `task037-evidence/` in that checkout. They are local evidence, not release assets.

User-authorized deviations:
- The existing 0.1.0 profile contains test data only and was used for the installed upgrade.
- Egress was blocked by a temporary outbound Windows Firewall rule. The rule `TASK037-block-offline-api-client` applied only to the installed app executable, on all profiles (added 10:27:03, removed 10:58:20; `f-firewall-log.txt`). This is not network-namespace isolation. The echo server ran on loopback.
- Preservation ran in the current account, the same deviation as TASK-029, not a separate account.
- Claude performed the manual UI checks with computer use, not a human tester.

| Fresh local artifact | Bytes | SHA-256 |
|---|---|---|
| `dist/windows/offline-api-client-0.1.1-x64-setup.exe` (NSIS one-click, per-user, unsigned) | 124690228 | `aea429986e134284e0449ebbc99fbf08f0e7ed558bbbdf30f526b39e9b9025ae` |

Commands and results (log file in parentheses):

1. **Build checks** (`w1-build-log.txt`): `npm.cmd ci` exited 0 (589 packages). `install-electron`, `typecheck` and `lint` each exited 0. `npm.cmd run test:unit -- --maxWorkers=1` exited 1: **368 passed / 1 failed** across 37 files. The failing case is `tests/main/export.test.ts:110`, where `symlinkSync` hit `EPERM: operation not permitted`. Creating symlinks on Windows needs Developer Mode or elevation, and this host has neither. That is a host-privilege limit; system settings were not changed. The symlink-alias export rejection is therefore **not verified on Windows**. The Linux full unit suite passed 369/369.
2. **Packaging** (`w1b-package-log.txt`): `npm.cmd run package:win` exited 0. electron-builder 26.15.3 rebuilt better-sqlite3 natively for Electron 44.5.1 x64; code signing was skipped (unsigned). `certutil` produced the hash above.
3. **Installed upgrade** (`w-preservation-log.txt`, sections 1–3): The baseline had installed exe 0.1.0.0 and SQLite `970A8E58…1534` (143,360 bytes). Installing the new 0.1.1 bytes over 0.1.0 left every data file unchanged before first open. On the first open with egress blocked:
   - Test A, Test B and Test A (imported) were all present.
   - Phase-1 requests Env check and Hello GET appeared under Workspace root, with no invented folders.
   - The Local environment, Light theme, `base_url` and stored sensitive token (shown as "Securely stored", value not displayed) were intact.
   - Hello GET returned 200 from loopback, and `http://1.1.1.1/` returned `NETWORK_FAILURE`.
   - After normal close, SQLite was `24769B1E…CA3C` (180,224 bytes; migration applied).
4. **Installed desktop suite** (`w3-desktop-suite-log.txt`): `API_CLIENT_EXECUTABLE=%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe`, `playwright test`, egress blocked. Exited 1: **29 passed, 2 failed, 5 skipped** (2.6 min).
   - The skips are the Linux-only export, import, multipart, uploads and namespace offline-story specs. They are covered manually below, not counted as passes.
   - Passed included `library-scale`, `library-search`, `library-upgrade` (1,005-request closed legacy fixture), `library-tree` contextual creation, `folders`, `collections`, `database`, `security`, `requests` and `navigation:30`.
   - Failed: `library-tree.spec.ts:105` (the Rename folder dialog stays visible after the dirty-guard Save) and `navigation.spec.ts:133` (the Delete collection dialog stays visible after the dirty-guard Save).
5. **Windows performance** (installed app; samples, CPU and dataset in [TASK-037-windows-performance.json](TASK-037-windows-performance.json)): depth 16, 100 collections, 1,000 folders and 1,000 requests, viewport 1280×720.
   - Cold readiness **911.42 ms** (target ≤2000).
   - Selection p95 **98.92 ms** and search p95 **67.40 ms** (targets ≤500).
   - Maximum 50 tree and 100 search rows.
6. **Guard rerun** (`w4-guard-rerun-log.txt`): `--repeat-each=2` on both specs exited 1, 7 passed / 3 failed. `library-tree:105` failed in both repeats (3/3 overall). `navigation:133` passed once and failed once, so it is intermittent.
7. **Guard diagnosis** (`w5-diagnose-log.txt`, probe `rename-guard.diag.spec.ts`, exited 0, 3 repeats): The probe repeats the `library-tree:105` steps and samples state for about 3 s after the dirty-guard Save. Every sample showed the following:
   - The database folder name was already `Renamed`.
   - The dirty request was saved as `Dirty name`.
   - The Rename dialog stayed open, with no alert and an enabled Save name button.

   The operation succeeds, but the dialog never closes and no error is shown. This matches `CollectionSidebar.submit()` getting `false` from `guard(...)`. The probable cause is `mutate()`'s final `reload()` being superseded by the revision-triggered `reload()`; a stale `generation` stamp returns `false` without an error. That cause is inferred from the code and not instrumented. It is a **product defect in milestone scope**: the guarded rename/delete dialog stays open after success. It was not fixed here, because fixing it changes runtime bytes and invalidates both platform packages. *(Fixed later the same day; see "Defect fixes and Windows re-acceptance".)*
8. **Manual installed-app checks** (egress blocked, loopback echo server 127.0.0.1:8787/8788):
   - **Nested library:** Created collection **Win Lib**, folder **Outer** and nested folder **Inner**. Created **Deep Echo** (GET `{{base_url}}/hello?depth=2`) in Inner; the path showed `Workspace root / Win Lib / Outer / Inner` and the send returned 200 OK. Created **Upload Mid** in Outer as a POST multipart request.
   - **Native file chooser:** The "Select upload file" chooser opened, and a typed path selected `upload-sample.txt (5 bytes)`. Save then send returned 200 with filename `upload-sample.txt` and body `hello`.
   - **Search:** `deep` found 1 result with path `Workspace root / Win Lib / Outer / Inner` and selected it without sending.
   - **TLS:** An unsaved request to `https://127.0.0.1:8788/hello` gave `TLS_FAILURE` (self-signed); the draft was discarded.
   - **v2 export:** The native "Export workspace JSON" save chooser opened with the default `workspace.json` and filter `Workspace JSON (*.json)`. A first typed path was appended to the default name and Windows rejected it as an invalid file name, which was an input slip. The retry saved `w6-export-testA-v2.json` (4,898 bytes, format 2). It contains 1 collection, 2 nested folders and 4 requests with correct collection/folder IDs. The sensitive `token` has no value (`requiresValue: true`), and the file row keeps only the name and size (`requiresSelection: true`), with no path.
   - **v2 import:** The native open chooser previewed 1 collection, 2 folders, 1 environment, 4 requests and 3 variables. Omissions were listed: 1 sensitive value and 2 files requiring selection. The import created a new **Test A (imported)** with environment None and no selection, and the Win Lib/Outer/Inner tree was restored.
   - **v1 import:** Through the native chooser, `task029-evidence/6-export-testA.json` previewed 0 collections, 0 folders and 2 requests. It imported as a new workspace with both requests at Workspace root and no folders.
   - **Isolation and reopen:** Test B showed no collections or requests. After normal close and reopen, the app restored Test A, Local, Light, the expanded tree and the selected Deep Echo.
9. **Uninstall/reinstall preservation** (`w-preservation-log.txt`, sections 4–7):
   - **Before uninstall:** 37 data files were recorded, with SQLite `A2E90026…35FE` (188,416 bytes).
   - **First uninstall attempt:** Settings → Installed apps → Uninstall started `Un_A.exe`. Its "Are you sure you want to uninstall offline-api-client?" confirmation opened behind Settings, as a taskbar entry. The record taken in that state (10:53:59) still shows the app installed and is retained as premature.
   - **Second record:** After clicking OK, the record at 10:55:06 shows the install folder absent and all 37 data files byte-identical. This explains the TASK-029 "second attempt" observation. No data-deletion option was offered.
   - **Reinstall:** Running the same hashed installer reinstalled exe 0.1.1.0. Reopening showed the nested tree, Local environment, Light theme and selection. Deep Echo sent 200, and `http://1.1.1.1/` again returned `NETWORK_FAILURE`. The draft was discarded.
   - **After reinstall/reopen:** SQLite was unchanged (`A2E90026…35FE`). Only Chromium shader/LevelDB log caches changed.
10. **Manual-session incidents:**
    - During the upgrade check a mis-click saved Hello GET's URL as `http://1.1.1.1/`. It was restored to `http://127.0.0.1:8787/hello` and saved; synthetic data only.
    - **Ctrl+S did not save while the Windows input language was Persian.** `requests/controller.ts:81` tests `event.key.toLowerCase()==='s'`, and that layout produces a different `key`. Automated `requests.spec` passes because Playwright sends `s`. This is a keyboard-layout-dependent product defect, recorded and not fixed. A layout-independent `event.code==='KeyS'` check would need new bytes and reruns. *(Fixed later the same day.)*

## Defect fixes and Windows re-acceptance — 2026-10-12 (19:20–19:53)

The user asked to finish the task, so the two in-scope defects found above were fixed in the working tree (not committed). The diff is 4 files, +33/−7 (`task037-fix.patch` attached in chat, equivalent to `git diff` against `cfed400`):

- **`src/renderer/features/collections/sidebar.tsx`**: a library mutation now keeps `running` set and runs its follow-up reload as the owner (`reload(true)`). A revision-triggered reload can no longer start while the mutation finishes and invalidate the mutation's `generation` stamp. Previously the mutation then returned `false` with no error and the Rename/Delete dialog stayed open. The diagnostic probe confirmed that symptom (operation saved, dialog open, no alert).
- **`src/renderer/features/requests/controller.ts`**: Ctrl+S also matches the physical `KeyS` code when the layout produces a non-Latin character. Latin layouts still use `event.key`, so Dvorak/AZERTY behavior is unchanged.
- **`tests/requests.spec.ts`**: regression step dispatching Ctrl with `key: 'س'`, `code: 'KeyS'` and asserting the request saves.
- **`tests/linux-preservation.check.ts`**: the seed phase also creates collection → folder → nested folder → request (before the selected root request). The verify phase asserts their IDs, names, parents and destination after actual removal/reinstall. This makes the Linux preservation check cover nested state as required.

No other runtime file, dependency, lockfile, version or security setting changed.

Container (Linux, Node 22.22.0, npm 11.6.2, as root) checks of the fixed tree: `npm ci` with local Node headers, `tsc --noEmit` 0, `eslint .` 0, `vitest run --maxWorkers=1` **368 passed, 1 skipped**. The skip is `uploads.test.ts`, whose permission-denial case cannot be verified as root. Electron tests could not run there because Electron headers/prebuilds are blocked by the network allowlist. Graphify (`setup-graphify.py`, then `graphify.py update`) refreshed to 1,184 nodes / 3,861 edges / 54 communities.

Windows 11 (same PC and toolchain; logs in `task037-evidence/`):

| Fixed-build artifact | Bytes | SHA-256 |
|---|---|---|
| `dist/windows/offline-api-client-0.1.1-x64-setup.exe` | 124690192 | `67a839a2d15e742b3821ecbb88eb4e1cde5d39880de58c126014ed0914a0a569` |

Installed `offline-api-client.exe` SHA-256 `2411ebbf68e3907bc74e517ed638c835b92695749c2b1fbdfb68449306fd66d2`, version 0.1.1.0. The earlier `aea42998…` installer is superseded and is not a candidate.

1. **Rebuild** (`r1-build-log.txt`):
   - `npm.cmd ci`, `install-electron`, `typecheck` and `lint` all exited 0.
   - `test:unit` exited 1: 368 passed / 1 failed, again only the `export.test.ts:110` symlink `EPERM`.
   - `package:win` exited 0: native better-sqlite3 rebuild for Electron 44.5.1 x64, NSIS one-click per-user, unsigned.
2. **Elevated unit rerun** (`r2-elevated-unit-log.txt`): after the user approved UAC, it ran at High Mandatory Level (S-1-16-12288). `vitest run tests/main/export.test.ts` exited 0 with **11/11 passed**, including symlink alias/target rejection. Together with step 1, all 369 unit tests passed on Windows. No system setting (Developer Mode) was changed.
3. **Install over the previous build** (`w-preservation-log.txt`, `fix-before-install` → `fix-after-install`): all 37 data files were byte-identical.
4. **Installed suite, app egress blocked** by firewall rule `TASK037-block-offline-api-client` (added 19:36:58, removed 19:53:14; `f-firewall-log.txt`), `r4-desktop-suite-log.txt`:
   - `playwright test` exited 0: **31 passed, 0 failed, 5 skipped**. The skips are the Linux-only export, import, multipart, uploads and offline-story specs, covered manually earlier on Windows.
   - Then `library-tree`, `navigation` and `requests` specs with `--repeat-each=5` exited 0: **30/30 passed**. That makes `library-tree:105` and `navigation:133` 6/6 each, and the Ctrl+S spec 6/6.
5. **Performance** (installed fixed build, [TASK-037-windows-performance.json](TASK-037-windows-performance.json)): cold **733.24 ms**, selection p95 **99.16 ms**, search p95 **67.22 ms**, ≤50 tree and ≤100 search rows.
6. **Manual checks, fixed build, egress blocked:**
   - Unsaved request name, then Rename folder `Inner` → `Inner Renamed`, Save name, then Save in the unsaved-changes prompt: the dialog **closed**. The tree and path showed `Inner Renamed`, and the request was saved.
   - Switched the Windows keyboard to **Persian**; the S key typed `س`, confirming the layout. Ctrl+S then saved the edited request name (status Saved). The layout was then switched back to English.
   - Deep Echo returned 200 from loopback.
7. **Uninstall/reinstall preservation**:
   - The record before uninstall (SQLite `39A68C10…14D4`, 188,416 bytes) matched the after-uninstall record byte-for-byte for all 37 files, with the install folder gone. This time the NSIS confirmation appeared in front of Settings.
   - Reinstalling the same hashed installer and reopening restored Test A, Local, Light and the nested `Win Lib/Outer/Inner Renamed/Deep Echo` selection.
   - The record after reinstall shows SQLite unchanged; only Chromium shader/LevelDB-log caches differ.

Windows 11 acceptance for the fixed bytes is therefore complete. The deviations remain as recorded above: firewall egress block instead of a disconnected network, the user's account with test data only, and checks performed by Claude.

## Exact remaining blockers and resumption

- *Resolved 2026-10-12:* the Windows guarded-dialog failures, the Ctrl+S layout defect and the Windows unit symlink case are fixed or verified; see the section above.
- **Linux deb/AppImage must be rebuilt from the fixed source and re-accepted.** The `dc3771d5…`/`cc593562…` artifacts and their suite results predate the fix and are superseded. Resume on the Ubuntu machine with `bash task037-linux-acceptance.sh /path/to/api-client /path/to/task037-fix.patch`, run as the regular user (the script is attached in chat). It applies the patch, runs install/type/lint/unit/Graphify, builds into `dist/task037-linux-fix/` with hashes, runs the full payload suite plus 5× guard/Ctrl+S repeats and the AppImage focused suite, then does the sudo steps below.
- **Linux actual install, manual upgrade, uninstall/reinstall preservation are not run.** Elevated `sudo -n true` returned `sudo: a password is required`. Existing installed package is 0.1.0 (`dpkg-query`), untouched; extracted payload checks cannot count as installer acceptance. Resume with OS-prompt authentication, install the exact hashed deb, run installed executable offline with synthetic profiles, then actual removal/reinstall and hash/logical-state preservation using the sequential procedure in [release.md](../release.md). Include new nested structure in reopened-state evidence. Never provide a sudo password in chat or command arguments.
- *Superseded 2026-10-12:* the earlier "no Windows runner" blocker was resolved by the Windows 11 execution above. Windows Server CI smoke was not used and is not a substitute.
- **Default AppImage FUSE mounting not run:** no `/dev/fuse`. Extraction-and-run evidence is recorded separately. Other distributions/Wayland/platforms and downloaded Windows reputation prompts remain untested.

TASK-037 must remain unfinished while required platform/installer criteria are missing. No subsequent task was started and no public release readiness is claimed.

## Graphify and final review

Applied project Graphify skill with repository local-only override. Queried acceptance relationships, then inspected actual source/specifications; graph output is not test evidence. Local `python3 scripts/graphify.py update` succeeded with 1,183 nodes / 3,847 edges / 53 communities after initial changes. Generated graph remains ignored; no cloud extraction, global configuration, hooks or model labeling. Final `npm run typecheck && npm run lint && git diff --check` exited 0 after test corrections. Final Graphify update exited 0, still 1,183 nodes / 3,847 edges / 53 communities. Final `npm run test:unit -- --maxWorkers=1` exited 0: **37 files / 369 tests passed**, 146.67 s, after the earlier timeout. Developer SQLite was rebuilt for Node by that script; packaged Electron SQLite remains inside the unchanged hashed artifacts. No performance assertions were changed.
