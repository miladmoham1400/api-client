# TASK-033 — Validated folder operations and request destinations

Status: done  
Date: 2026-10-11

## Selection and environment

TASK-033 was the earliest unfinished task with its dependency (TASK-032) done. The repository was clean at inspection, starting at `6bc4d088f3658ea3f67290dcd762abd94677704b`. Read AGENTS, product, decisions, task/index and referenced API-library, data-model, architecture, IPC, UI, transfer, testing, limitations and public-release specifications. Only TASK-033 was executed; TASK-034–037 remain unfinished.

Actual environment: Ubuntu 24.04.3 LTS x64, local X11 display; developer Node 22.18.0 and npm 11.6.2. Existing pinned Electron 44.5.1, better-sqlite3 13.0.3 and Zod 4.6.5 were retained. Node and Electron native SQLite rebuilds ran sequentially. No package/lockfile/version, migration, production sandbox/TLS, release or real user-profile changes.

## Changes

- Added strict folder snapshot/input/result schemas, fixed `folders.list/create/rename/move/delete` bridge functions, owned main-frame handlers and active-workspace services. Metadata contains only collection/folder identities, names, ordering, parents and timestamps; no configs/credentials per node or generic command/channel API.
- Added transactional owned repository folder operations. Validate proposed hierarchy before writes: collection/parent ownership, missing IDs, cycles/self/descendant parenting, and depth 16 including every descendant. Folder creation enforces 1,000 folders; larger existing libraries remain readable/editable/removable.
- Cross-collection subtree moves update every descendant folder and nested request in one transaction using migration 2's deferred references. IDs, config/auth records and surviving selected request remain intact.
- Folder deletion promotes direct requests and child folders to the parent/collection root, retaining child subtrees. Collection deletion clears both request destination IDs before removing its folders; requests/config/secrets survive at workspace root.
- Request summaries/editors return actual nullable folder IDs. Create/Move preserve explicit folder destinations; old-shaped input alone normalizes omitted folder IDs to null. Partial config Save never changes placement; Duplicate retains destination and independently copies secret records.
- Added `FOLDER_EXPORT_UNAVAILABLE`: any owned folder, including an empty folder, blocks v1 export before the native chooser. Recheck after the chooser before starting a write to prevent a folder introduced during the dialog from being flattened. Folder-free v1 serialization/import remains unchanged.
- Updated API-library, data-model and IPC documentation. Added meaningful repository/service/handler/preload and real Electron regressions. Migration fixtures now seed the original schema directly rather than invoke current folder-aware repositories against schema 1; the WAL snapshot fixture injects its concurrent commit once despite additional ownership reads.

## Actual commands and results

| Command/check | Result |
|---|---|
| Initial `git status --short` | Exit 0, clean |
| Initial `npm run typecheck` after implementation | Exit 0 |
| `npm run rebuild:node` followed by initial five-file focused Vitest run | Rebuild exit 0; tests exit 1: 106 passed / 3 failed, 8.17 s. Two legacy fixtures invoked current repositories against schema 1; the concurrent export fixture injected its commit twice. Corrected fixtures without changing migrations or export snapshot semantics. |
| Six-file focused Vitest run with new folder tests | Exit 1: 116 passed / 2 failed, 25.02 s. New test asserted nonexistent `formatVersion` instead of actual `version`; compound ownership/depth test exceeded 5,000 ms during setup/assertions (7.417 s). Corrected the field and gave only this new compound test 15,000 ms. No global/existing test timeout or product performance target changed. |
| Typecheck of new tests | Initial exit 2: synthetic helper returned runtime auth shape instead of stored auth; corrected to explicit None stored auth. Subsequent typecheck exit 0. |
| `npx vitest run tests/main/folders.test.ts tests/main/api-library.test.ts tests/main/collections.test.ts tests/main/requests.test.ts tests/main/export.test.ts tests/preload/folders.test.ts tests/shared/contracts.test.ts --maxWorkers=1` | Exit 0: 119 passed, 7 files, 19.46 s |
| `npm run test:unit -- --maxWorkers=1` outside execution sandbox for loopback fixtures | Exit 0: 342 passed, 33 files, 60.04 s; developer-Node SQLite rebuilt first |
| `npm run typecheck`, `npm run lint`, `git diff --check` | Exit 0 after corrections; final build also typechecked all source/tests |
| `npm run rebuild:electron && npm run build` | Exit 0; Electron SQLite rebuild and main/preload/renderer production bundles succeeded. Existing Zod/Rollup annotation warnings appeared; no dependency changes to silence them. |
| First request to run offline Electron checks | No process started: automatic permission review timed out. One permitted retry succeeded; the timeout is not counted as a test failure/pass. |
| `bash scripts/test-offline.sh tests/folders.spec.ts tests/security.spec.ts tests/collections.spec.ts tests/requests.spec.ts tests/export.spec.ts tests/import.spec.ts` | Exit 0: all 6 passed, 46.8 s, no skips. Source-built production Electron, private loopback-only network namespace, non-root Chromium sandbox enabled. |
| `python3 scripts/graphify.py query "Where are request placement, collection deletion, workspace export and IPC registration implemented?"` | Exit 0; output truncated to 57/172 nodes by query budget. Relevant source inspected directly. |
| `python3 scripts/graphify.py update` | Exit 0: 1,096 nodes / 3,473 edges / 54 communities. Code-only local extraction; docs skipped. Two callback-based spec files yielded no symbols (`folders.spec.ts`, `security.spec.ts`); graph is incomplete discovery aid, not verification evidence. Generated output remains ignored. |

## Acceptance evidence

| Criterion | Actual evidence |
|---|---|
| CRUD, collection roots and nested depth 16; reject invalid destinations/depth/cycles without partial changes | `tests/main/folders.test.ts` creates and reopens depth 16 plus a nested request; depth 17, deepest-descendant overflow, self/descendant parent, missing/foreign IDs and mismatched collections fail with serialized database unchanged. Duplicate trimmed Unicode names remain ID-distinct. Existing API-library corruption tests still pass. |
| Atomic cross-collection moves, preserving IDs/config/auth/selection | Three-level subtree with direct/nested requests and synthetic secret moves together; unrelated root request and secret record unchanged, selected request preserved, foreign-key check empty. Injected request-update failure rolls back folder and request changes. |
| Preserve-on-delete semantics | Direct requests/children promoted at nested and collection root; deeper subtree retained. Collection removal preserves all nested requests/config at workspace root and selected surviving request. Trigger failures during folder/collection removal roll back all preceding writes. |
| Partial Save and independent duplication | Partial request-service Save retains folder; Duplicate retains placement and independently owned ciphertext/secret records, surviving original deletion. Explicit request moves to folder/root and legacy omitted-folder normalization checked. Existing secret lifecycle/rollback tests pass in the full suite. |
| Sender/workspace/input/output validation and narrow preload | Foreign sender, missing/cloned frame, inactive/foreign workspace and malformed/extra arguments rejected. Strict snapshot validation rejects duplicates, unknown fields and foreign/orphan ownership. Outgoing-validation failure rolls back mutations. Preload test verifies immutable fixed methods/channels, validation before invocation, sanitized unsafe output and explicit destinations. Real Electron security test confirms exact allowlist and sandbox/Node/browser capability restrictions. |
| No-loss export gate; folder-free v1 transfer works | Empty-folder export leaves database/files unchanged and never invokes chooser; folder added during chooser prevents destination replacement/temp-file creation. Removing folders permits version-1 export. Existing redaction/WAL snapshot/atomic write and import tests pass, including native Linux chooser regressions. |
| Real registered Electron API, persistence, no auto-send | `tests/folders.spec.ts` passes: nested request and duplicate, rename/promotion/cross-collection move, selected request/body restored after restart, and collection deletion promotion. Synthetic loopback server receives **zero requests** throughout local operations/restart. |

## Limitations and remaining work

No TASK-033 blockers remain. This is a backend/bridge execution slice: folders are not yet exposed as an expandable sidebar or contextual UI; TASK-034 remains todo. Search/paged tree and measured 1,000-item UI performance belong to TASK-035; v2 transfer to TASK-036. Folder-containing export is intentionally unavailable until that task.

The Electron folder test uses forced fixture teardown (`app.exit`) and demonstrates committed-data reopening, not normal-close/unsaved-draft acceptance. No full desktop suite, newly built/installed Linux package, AppImage mounting, Windows run or Windows package/manual chooser was performed here. Existing published 0.1.1 downloads were not rebuilt/published and contain none of this task's changes. Independent packaged/platform milestone acceptance remains TASK-037; historical phase-1/Windows evidence is not transferred to this source change. Graphify results are optional and do not count as test evidence.
