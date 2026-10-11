# TASK-037 — Nested-library packaged acceptance

Status: blocked — required actual Linux installer/preservation and Windows 11 checks unavailable.
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

## Exact remaining blockers and resumption

- **Linux actual install, manual upgrade, uninstall/reinstall preservation are not run.** Elevated `sudo -n true` returned `sudo: a password is required`. Existing installed package is 0.1.0 (`dpkg-query`), untouched; extracted payload checks cannot count as installer acceptance. Resume with OS-prompt authentication, install the exact hashed deb, run installed executable offline with synthetic profiles, then actual removal/reinstall and hash/logical-state preservation using the sequential procedure in [release.md](../release.md). Include new nested structure in reopened-state evidence. Never provide a sudo password in chat or command arguments.
- **Current native Windows build, installed Windows 11/offline/performance/legacy-upgrade/native-dialog/preservation acceptance are not run.** No authorized guest shell/desktop is connected. VBoxManage in this session reported unavailable `/dev/vboxdrv` and `NS_ERROR_SOCKET_FAIL`/COM server startup failure; this is an access observation, not diagnosis of the user's VM. GitHub remote master was `e1a073946d7bf494a4ab7d2f669e9f6721f7f8cb`, different from this checkout. Its existing workflow cannot attest this source; no dispatch was made. Resume on an accessible Windows 11 x64 runner using the current checkout, pinned native toolchain/SQLite rebuild, exact installer hashes and installed/manual checks from [release.md](../release.md) and [testing.md](../testing.md). Server CI smoke alone cannot substitute for Windows 11/native dialogs.
- **Default AppImage FUSE mounting not run:** no `/dev/fuse`. Extraction-and-run evidence is recorded separately. Other distributions/Wayland/platforms and downloaded Windows reputation prompts remain untested.

TASK-037 must remain unfinished while required platform/installer criteria are missing. No subsequent task was started and no public release readiness is claimed.

## Graphify and final review

Applied project Graphify skill with repository local-only override. Queried acceptance relationships, then inspected actual source/specifications; graph output is not test evidence. Local `python3 scripts/graphify.py update` succeeded with 1,183 nodes / 3,847 edges / 53 communities after initial changes. Generated graph remains ignored; no cloud extraction, global configuration, hooks or model labeling. Final `npm run typecheck && npm run lint && git diff --check` exited 0 after test corrections. Final Graphify update exited 0, still 1,183 nodes / 3,847 edges / 53 communities. Final `npm run test:unit -- --maxWorkers=1` exited 0: **37 files / 369 tests passed**, 146.67 s, after the earlier timeout. Developer SQLite was rebuilt for Node by that script; packaged Electron SQLite remains inside the unchanged hashed artifacts. No performance assertions were changed.
