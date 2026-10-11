# TASK-031 — Multi-request creation and selection

Date: 2026-10-11. Status: done (Linux source-app evidence; platform/package limits below).

## Selection and inspection

Initial working tree clean at `faca6ea1cfefe4dbb9466cdace3dda7b1e7a69e4`. TASK-031 was the earliest unfinished task; TASK-009 and TASK-023 were done in their files/index with historical reports. Read AGENTS, product, decisions, index, selected task, API-library specification, data model, architecture, IPC, UI, transfer, testing, known limitations and public-release evidence. Inspected repositories/services, draft/navigation/sidebar controllers and existing tests before editing.

Consulted the local Graphify query for request creation/selection/deletion. Its 1,500-token output was truncated (53 of 217 nodes shown); source and specifications were authoritative. No agents, cloud extraction, package changes or later tasks were used.

Multiple saved requests already exist in the released source; one editor is not a storage limit. The alleged inability to save a second request was not reproduced. The separately documented Save-before-collection-delete failure was reproduced in the current built source. Published installer binaries were not rerun or changed in this task.

## Change and reproduced defect

When the dirty-navigation guard saves a request before deleting its collection, Save increments the sidebar revision. The old revision effect called the same `apply` function used for mutations, acquiring its `running` lock for an automatic `collections.list` read. The guard's subsequent delete could return false because that read was running, leaving the confirmation open and the collection intact. Revision-effect cleanup also reset the shared mutation lock/generation.

Separate automatic refresh from user mutations. Background reads no longer acquire the mutation lock or reset mutation state on every request revision. Both reads and mutations use a generation check so newer operations invalidate older replies; unmount invalidates outstanding work. Mutation busy/error behavior, confirmation invalidation, ownership, explicit Save and active-send/dirty guards remain intact. No main/preload/schema/transport changes.

Added `tests/multi-request.spec.ts`: all 20 requests are created and explicitly saved through real UI controls, distributed across two collections and workspace root, with distinct IDs, alternating POST/PUT, unique URLs and JSON bodies. A cancelled guarded creation preserves the unsaved draft and exact saved snapshot without creating another row. Normal `BrowserWindow.close` and application close event precede reopening. Every sidebar entry is then selected and its method/URL/body checked. First/middle/last requests are explicitly sent to a loopback fixture and exact received method/URL/body and displayed response are asserted. The fixture observes zero sends during creation, moving, selection and restart, and exactly three explicit sends. All saved request summaries remain unchanged by sending.

Existing navigation tests supply the regression for Save-before-delete, failed Save/failed deletion, Save/Discard/Cancel, Stay/cancellation during sends, confirmation invalidation and preparation before execution IDs. Existing unit tests verify preserved configurations/credential references, independent secret copies, transaction rollback, isolation and migrations. Added a guide paragraph explaining repeated Create Request → Save → sidebar selection; known limitations now distinguish the source fix from unchanged published 0.1.1 installers.

## Actual checks

Ubuntu 24.04.3 LTS x64/X11; developer Node 22.18.0/npm 11.6.2, Electron 44.5.1/better-sqlite3 13.0.3. No versions changed. SQLite native rebuilds were sequential: Electron for desktop checks, Node for units, then Electron again. All desktop profiles/databases and server payloads are synthetic; no real user profile/database or credentials were read or modified. Chromium sandbox remained enabled.

| Command/check | Actual result |
|---|---|
| Initial `npm run rebuild:electron && npm run build && npx playwright test tests/navigation.spec.ts tests/requests.spec.ts` inside execution sandbox | Native rebuild/build/typecheck passed; test command exit 1, all four tests could not execute normally: Electron launch failed or loopback listen EPERM. Not application passes/failures. |
| Same focused Playwright command outside execution sandbox, before fix | Exit 1: three passed, one failed in 31.0 s. Delete-guard test timed out waiting for Delete collection dialog to close after Save, at navigation.spec.ts:216. |
| `npm run typecheck` after adding multi-request test | Exit 0. |
| `npm run build && npm run lint` after fix | Exit 0; strict typecheck, production bundles and lint passed. Existing nonfatal Zod/Rollup annotation warnings remain. |
| `npx playwright test tests/multi-request.spec.ts tests/navigation.spec.ts tests/requests.spec.ts tests/collections.spec.ts tests/secrets.spec.ts` outside execution sandbox | Exit 0: all seven passed, 46.8 s. New 20-request test passed in 12.2 s; deletion regression passed in 9.7 s. Actual safeStorage was basic_text/session/unavailable, so real encrypted-backend acceptance is not claimed. |
| `npm run test:unit -- --maxWorkers=1` outside execution sandbox | Exit 0: 325 tests passed in 29 files, 34.06 s; Node SQLite rebuild passed. Serial workers avoid known fixture-load timeouts without increasing test timeouts. |
| Final Electron rebuild and affected desktop tests under `scripts/test-offline.sh` | Exit 0: all nine passed, 58.9 s; 20-request story 12.2 s and deletion regression 9.5 s. Auth, owned-window security and workspace isolation/restart also passed under loopback-only network isolation. Final SQLite binding targets Electron. |
| `python3 scripts/graphify.py update` | Exit 0: 1,031 nodes, 3,209 edges, 54 communities. New callback-based desktop test yielded no modeled symbols; 113 docs intentionally skipped. Generated output ignored; graph is not test evidence. |
| `git diff --check` | Exit 0 after final report/status update. |

Final isolated command: `npm run rebuild:electron && bash scripts/test-offline.sh tests/multi-request.spec.ts tests/navigation.spec.ts tests/requests.spec.ts tests/collections.spec.ts tests/auth.spec.ts tests/security.spec.ts tests/workspaces.spec.ts`. The runner creates a private network namespace containing loopback only, with no host network/interface changes; Electron stays sandboxed and runs as the invoking non-root user.

## Acceptance and limitations

Twenty independently saved requests, both collection/root destinations, normal close/reopen, every request selectable, exact first/middle/last sends, no automatic sends, guarded cancelled creation and the existing destructive/navigation guards have passing Linux source-app evidence. Unit checks cover retained old rows/configuration/secret references; no migration or stored-data format change was introduced.

Windows, Wayland, installed/package builds, titlebar actions by a human, OS shutdown/logoff, real encrypted credential backend and published installer upgrades were not tested. No new package, version/tag or publication. These are not claimed passed; independent new milestone packaged acceptance remains TASK-037. Folder schema/operations/tree/search/transfer v2 remain TASK-032–036, unimplemented.

No remaining TASK-031 blocker. Task file and index are done together; next ready task is TASK-032, which was not started. Stop at TASK-031.
