# TASK-032 — Owned folder schema and legacy preservation

Date: 2026-10-11. Status: done (Linux source/database evidence; untested platforms below).

## Selection, existing work and scope

Read AGENTS, product/decisions/index, TASK-032 and all referenced specifications (API library, data model, architecture, IPC, UI, transfer, testing, limitations and public-release evidence). TASK-031, TASK-004 and TASK-005 were done; TASK-032 was the earliest ready unfinished task. The working tree already contained TASK-031's sidebar fix, test/report and documentation/status changes; preserved them. No real user profile/database was opened.

Consulted local Graphify for migration/repository/schema relationships, then inspected source and tests. Query output was truncated (51 of 347 nodes), so no completeness claim. Only TASK-032 foundation implemented: migration, strict shared metadata, repository reads/integrity, tests and relevant documentation. No folder CRUD service/IPC/preload/UI, search, v2 transfer, package/dependency change or later task.

## Changes and implementation decisions

- Migration ledger was version 1; appended `002-api-library.ts` as version 2. Migration 1 remains byte-for-byte unchanged. Added collection/workspace-owned folders, composite parent/destination ownership, self-parent and folder-requires-collection checks, nullable request folder ID and owned indexes. Parent/destination FKs are deferred until commit for later transactional subtree relocation.
- A composite request FK needs a table rebuild. Inside the existing immediate migration transaction, copy requests, copy/drop workspace_state (its only inbound request FK), drop/recreate requests, restore workspace_state and indexes. Keep foreign keys ON throughout. Existing request/config JSON/timestamps/IDs and environment/selected-request state are copied unchanged. No silently recreated database, truncation, automatic backup service or `writable_schema`. Migration failure rolls back all changes.
- Added workspace-owned version-1 expansion storage with valid JSON and a 100,000-character storage bound. Strict DTOs bound unique UUID arrays to 1,000 collections/1,000 folders; reads filter stale/foreign expansion IDs without changing selected request/environment. No expansion-write API or UI wiring in this task.
- Separate shared library schemas distinguish workspace root, collection root and folder destinations. Request metadata contains identity, name, method, destination and timestamps only; no configuration/body/URL/auth/secrets. Existing phase-1 request/IPC/transfer schemas remain unchanged.
- Main-only `listFolders`, `getFolder`, `validateDestination`, `listLibraryRequests`, `getTreeState`. Folder reads validate actual collection ownership and bounded parent walks (depth <=16), rejecting cycles, missing parents or corrupt ownership with sanitized errors. No automatic repair/deletion. Metadata reads select only method from stored JSON, not full configuration or credentials.
- Request creation and raw SQL test fixtures now name their original eight columns explicitly, allowing the new nullable column to default to NULL. Existing database tests expect the new tables/ledger and still test failure at the next ledger version. Updated data-model documentation; historical TASK-031 work remains intact.

SQLite behavior checked against official [ALTER TABLE](https://www.sqlite.org/lang_altertable.html) and [foreign key documentation](https://www.sqlite.org/foreignkeys.html). The rebuild handles the known inbound state FK explicitly rather than disabling foreign keys. Exact preservation/rollback evidence below takes precedence over architectural assumptions.

## Focused evidence

`tests/main/api-library.test.ts` verifies:

- A closed synthetic version-1 copy with **1,005 requests** migrates without applying transfer capacity as a local data cap. Logical rows/config JSON bytes, secure ciphertext/session-secret records, variables, IDs/timestamps, collection/root placements, app settings, environment and selected request stay identical. All folder IDs are NULL. The untouched closed backup remains version 1. Migration/reopen replay preserves ledger and state.
- Injected SQL failure *after* the complete table rebuild rolls back schema/data/ledger, leaves no folders/staging/tree-state tables and preserves the selected request. Failing open closes its connection, keeps the old database available and a normal retry succeeds.
- Cross-workspace/collection folder parents and request destinations, folder without collection and self-parent fail. Selected-request FKs still prevent deleting a selected row directly. Relevant owned indexes exist; whole-workspace deletion still cascades safely.
- Cyclic, depth-17 and synthetic orphan hierarchies return sanitized errors without deleting their stored rows. Depth 16 works. Foreign-key disabling appears only in the synthetic corruption fixture, never in production.
- Metadata never contains config/auth/secret IDs; versioned tree-state reopen prunes stale/foreign IDs and defaults to empty for an untouched workspace.

`tests/shared/api-library.test.ts` verifies destination discriminants, strict metadata (reject extra credential/config fields), expansion version/uniqueness/capacity and absence of draft/search state. Existing migration, repository, service and transfer checks remain part of the full suite.

## Actual commands/results

Ubuntu 24.04.3 LTS x64/X11; developer Node 22.18.0/npm 11.6.2; pinned Electron 44.5.1/better-sqlite3 13.0.3 unchanged. Node and Electron native rebuilds run sequentially. Tests use temporary synthetic storage; no real credentials or user workspace data copied into reports/graphs.

| Check | Actual result |
|---|---|
| Initial `npm run typecheck` | Exit 2: two new fixtures passed runtime auth defaults where stored auth was required. Corrected by explicitly using stored None auth; no casts/any bypass. |
| `npm run typecheck && npm run lint && npm run rebuild:node && npx vitest run tests/main/database.test.ts tests/main/api-library.test.ts tests/shared/api-library.test.ts` | Exit 0: typecheck/lint/rebuild and all 13 focused tests passed in three files, 1.59 s. |
| `npm run test:unit -- --maxWorkers=1` outside execution sandbox | Exit 1: 331 passed / one failed in 31 files, 68.10 s. Existing variable-quota repository test exceeded its 5,000 ms timeout. No failed check counted passed. |
| First `npx vitest run --maxWorkers=1` retry outside execution sandbox | Exit 1: 330 passed / two timed out (variable-quota and invalid-method import), 130.60 s. No timeout/assertion changes. |
| Baseline comparison in temporary copy | Pre-TASK-032 database/repository files from HEAD with the same repository/import tests: 31/31 passed in 20.90 s. No workspace files reset. |
| Current-source focused retry, same two files | Exit 0: 31/31 passed in 21.35 s. |
| Final `npx vitest run --maxWorkers=1` | Exit 0: all 332 tests passed in 31 files, 51.13 s. Prior timeout failures remain recorded above. |
| `npm run build` | Exit 0: strict typecheck and production bundles passed; existing nonfatal Zod/Rollup annotation warnings. |
| `npm run rebuild:electron && bash scripts/test-offline.sh tests/database.spec.ts tests/collections.spec.ts tests/requests.spec.ts tests/multi-request.spec.ts tests/export.spec.ts tests/import.spec.ts tests/security.spec.ts` | Electron rebuild passed; test command exit 1: six passed / one failed, 2.9 minutes. Database ledger/recovery, collection isolation, native v1 export/import, request persistence and owned-window security passed. The 20-request story timed out on an enabled Send button click (30,000 ms) at line 102; no assertion/timeout/force-click workaround applied. |
| `bash scripts/test-offline.sh tests/multi-request.spec.ts` focused retry | Exit 0: one passed, 28.3 s (story 27.1 s). Twenty distinct saved requests survive normal reopen, every entry is selectable, first/middle/last send correct method/URL/body, no auto-send. The prior enabled-click timeout was not reproduced; its cause is not established. |
| `python3 scripts/graphify.py update` | Exit 0: 1,059 nodes / 3,299 edges / 48 communities. Code-only; 114 docs skipped, three callback-oriented tests yielded no symbols. Generated output ignored; not test evidence. |
| Final whitespace/status/document checks | Exit 0: `git diff --check`; all 37 task file/index statuses and dependencies match, next ready task TASK-033; changed documentation file-link targets exist (anchors not checked). Migration 1 byte comparison against HEAD also passed. |

## Limits and remaining work

Folder-free behavior/transfer v1 remains the current product contract. The new metadata is main-only and no writable folder API exists yet. TASK-033 must introduce folder operations and its intermediate export guard before folders become user-writable; TASK-034 supplies UI and expansion writes, TASK-035 search, TASK-036 transfer v2.

Windows, Wayland and installed/packaged applications are not tested or marked passed. No real-user-data migration, installer upgrade, encrypted OS backend, publication or new release claimed. Independent package acceptance remains TASK-037. All TASK-032 acceptance criteria have Linux evidence; no remaining task blocker. Earlier unit and desktop timeouts remain documented; no stability guarantee or entirely green combined desktop run is claimed. Task and index marked done together; TASK-033 was not started. Stop at TASK-032.

Desktop checks used the built local renderer, Chromium sandbox enabled, and the repository runner's private loopback-only namespace. This is source-app evidence, not installed/package acceptance. The final native SQLite binding targets Electron. No automatic test retry, timeout increase or force-click was added. The temporary baseline copy used HEAD database/repository files plus the same test files; it was only a comparison of the two affected unit files, not a full historical checkout/suite.
