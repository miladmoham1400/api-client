# TASK-034 — Nested library tree

Status: done  
Date: 2026-10-11

## Selection and environment

Selected TASK-034, the earliest unfinished task whose dependency TASK-033 was done. Read AGENTS, product, decisions, task/index and the referenced API-library, data-model, architecture, IPC, UI flows, transfer, testing, limitations and public-release specifications. The initial working tree already contained the uncommitted TASK-033 implementation and report; preserved that work. Starting HEAD: `6bc4d088f3658ea3f67290dcd762abd94677704b`. Only TASK-034 was executed.

Actual environment: Ubuntu 24.04.3 LTS x64/X11, developer Node 22.18.0, npm 11.6.2; existing Electron 44.5.1, better-sqlite3 13.0.3 and Zod 4.6.5. No package/lockfile changes, migration, release, real user-profile writes or production sandbox/TLS changes. Node and Electron native SQLite rebuilds ran sequentially.

## Changes

- Replaced the flat collection/request sidebar with an expandable collection/folder/request tree. Saved method badges, selected-row state, container breadcrumbs and ID-based duplicate-name labels distinguish nodes. Empty folders, root requests and global root creation remain available.
- Added contextual New request/New folder, Rename, Move and Delete actions. A single move-dialog destination chooser replaces the permanent move selector on every request. Folder moves exclude the moving subtree; main-process validation remains authoritative. Deletion confirmations describe actual promotion/removal counts.
- Contextual New request initializes an unsaved draft at the chosen destination; only explicit Save creates a row. Request Rename selects the request and focuses the name field for explicit Save. Existing Save/Discard/Cancel and active-send Cancel request/Stay guards cover selection and contextual mutations. Expansion never sends requests. Placement refresh preserves the current draft/body/response; Discard uses the latest surviving saved record rather than stale placement or a deleted draft.
- Added a metadata-only library snapshot and fixed frozen `library.list` / `library.setExpansion` IPC methods. Owned main-frame handlers validate inputs/replies; services enforce the active workspace. A snapshot transaction reads collection/folder metadata, request name/method/destination and tree state without loading every request configuration or secret.
- Persisted version-1 per-workspace expansion in the existing tree-state table. Writes validate owned IDs, unique bounded arrays and strict shape transactionally. Serialized renderer writes prevent older expansion gestures from overwriting newer ones. Reload prunes stale IDs; selection/restart reveals selected ancestors. No draft, response or panel-ratio persistence was added.
- Added roving tree focus and Up/Down/Home/End/Left/Right/Enter navigation, accessible context menus, dialog focus restoration and request-name focus for Rename. Updated the specifications/architecture/IPC/data-model documentation to describe this implemented slice.

## Actual checks and results

| Command/check | Actual result |
|---|---|
| Initial source typecheck/lint | Exit 0 |
| First `npm run test:unit -- --maxWorkers=1` with loopback permission | Exit 0: 345 tests, 35 files, 53.59 s; developer-Node SQLite rebuilt by script |
| Lint after new GUI tests | Initial exit 1: new helper used `let` for an unchanged variable; corrected to `const` |
| Initial production build | Electron rebuild succeeded; typecheck exited 2 because a workspace-snapshot check was mistakenly applied to a generic mutation result. Removed that check from the mutation helper; retained it on library reload. |
| First corrected `npm run build` and lint | Exit 0; all production bundles built |
| First `bash scripts/test-offline.sh tests/library-tree.spec.ts tests/collections.spec.ts tests/navigation.spec.ts tests/multi-request.spec.ts tests/security.spec.ts tests/panel-layout.spec.ts tests/json-display.spec.ts` | Exit 0: 9 passed, 1.3 min. The last filename did not exist and matched no tests; **this run did not verify JSON presentation**. Corrected filename in final run. |
| Final full `npm run test:unit -- --maxWorkers=1` | Exit 0: 346 passed, 35 files, 55.69 s. Includes Unicode code-point ordering and preload expansion validation. Subsequent changes were confined to renderer controller focus/latest-saved handling and GUI regressions, covered by the final build and Electron checks. |
| Final `npm run rebuild:electron && npm run build && npm run lint` | Exit 0; Electron native SQLite rebuilt, strict typecheck of source/tests and main/preload/renderer production bundles succeeded; lint passed. Existing Zod/Rollup annotation warnings remain. |
| Final offline Electron suite | Exit 0: **11 passed, 1.4 min, no skips**, using the eight spec files in the command below. An earlier identical final invocation produced a passed `test-results/.last-run.json`, but its tool output was truncated; reran sequentially to capture counts/exit status in `/tmp/task-034-electron-final.log`. JSON, panel layout and theme regressions all actually ran and passed. |
| Light/dark screenshot review | Inspected `/tmp/api-client-tree-light.png` and `/tmp/api-client-tree-dark.png` at 1000×700. Readable nested rows, method badges, duplicate labels, breadcrumbs and visible keyboard focus; independent sidebar/editor scrolling, header wraps without page horizontal overflow. Earlier screenshots caught theme-transition/modal animations; tests now wait for theme/contrast and disable screenshot animations. |
| `python3 scripts/graphify.py query "How do collection sidebar actions connect to draft navigation guards and request creation?"` | Exit 0; query truncated to 55/254 nodes. Inspected relevant source directly. |
| Final `python3 scripts/graphify.py update` | Exit 0: 1,139 nodes, 3,639 edges, 53 communities. Local code-only extraction, 117 non-code files skipped; two symbol-free files requeued, sensitive-named files excluded. Generated graph stays ignored; not test evidence. |
| Final `git diff --check` | Exit 0 after implementation and report/status updates |

Final desktop command:

```sh
bash scripts/test-offline.sh tests/library-tree.spec.ts tests/collections.spec.ts tests/navigation.spec.ts tests/multi-request.spec.ts tests/security.spec.ts tests/panel-layout.spec.ts tests/json-presentation.spec.ts tests/theme.spec.ts
```

The runner enables loopback only inside a private network namespace (no external IPv4/IPv6 routes), keeps Electron non-root with Chromium sandbox enabled, and uses synthetic disposable profiles/local HTTP fixtures. It runs the source-built production application, not an installed package.

## Acceptance evidence

| Criterion | Evidence |
|---|---|
| Users/Admin and Users/Auth create/populate/browse/select/send, empty folders/root usability | `tests/library-tree.spec.ts` builds both branches through UI, saves GET Admins and POST JSON Login, explicitly sends each and asserts exact wire method/path/body. Exactly two server requests occur across selection, mutation and restart. Empty duplicate folders remain browsable. Collections/multi-request regressions exercise root creation, selection and promotion. |
| Contextual destinations, no blank saved creation, correct mutations/counts | Tree tests save into the chosen folder, cancel an unsaved Scratch transition without another saved row, move Admin under Auth, rename Auth, delete Users with retained-subtree counts, then delete the collection with four removed folders/two promoted requests. Contextual request deletion confirms one permanent deletion and leaves no phantom draft. Collections tests cover contextual move destinations, validation, failure rollback and root promotion. |
| Correct configuration/path and explicit guarded behavior | Tree tests verify selected names/destinations, changing breadcrumbs after ancestor moves/renames/promotion, request Rename focus, dirty Cancel/Save/Discard and active Stay/Cancel request. Reselecting the current request preserves its dirty draft. Existing navigation tests verify workspace/request/mutation guards and preparation cancellation; multi-request checks saved configurations, exact selected wire behavior and reopening. |
| Workspace expansion, restart, pruning and selected ancestors | Main library test persists versioned state, reopens the database and prunes a deleted folder. Foreign-workspace/node writes and malformed/duplicate/1001-entry arrays fail without writes; injected persistence failure rolls back. Electron test closes normally, reopens the same synthetic profile and verifies selected config/path and expanded ancestors. Collection regression confirms workspace isolation and normal reopening. No draft/response fields exist in expansion inputs. |
| Keyboard/focus, duplicate labels, themes/minimum geometry | Tree tests check Left-parent/Right-child focus and accessible duplicate sibling labels; Rename focuses Request name. The implementation supports Up/Down/Home/End/Enter and context menus. Both themes are checked at 1000×700 with no document horizontal overflow and at least 4.5:1 tree-label contrast; screenshots reviewed. Existing theme and navigation tests cover keyboard dialogs and focus. This is focused accessibility evidence, not a full assistive-technology audit. |
| No permanent move selects or per-node configs/secrets | Tree test asserts no Destination select outside the move dialog. Main test spies on `getRequest` and makes it throw: library browsing still succeeds, returns metadata/method only and never calls that config loader. Strict metadata/IPC/preload and real Electron security regressions check the fixed capability surface. |

## Limitations and remaining work

No TASK-034 blockers remain. No later task was implemented. Search, virtualization/paging and measured 1,000-request navigation acceptance remain TASK-035; v2 folder transfer remains TASK-036. Folder-containing v1 export remains intentionally blocked. No performance or large-library UI capacity claim is made here.

No Windows run, new Linux/Windows package build/install smoke test or release publication was performed. Packaged/platform milestone evidence remains TASK-037. Existing public 0.1.1 downloads were not rebuilt and do not contain this work. No full desktop suite or screen-reader audit was run. Graphify is an incomplete optional discovery aid, not an acceptance gate.
