# TASK-008 — Collection CRUD and request grouping

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-008, data model and UI flows; also read the IPC contract and inspected existing repositories, workspace services/handlers, preload, renderer and tests. TASK-008 was the earliest unfinished task with completed dependency TASK-007. Initial working tree was clean.

Implemented one-level collection list/create/rename/delete and grouping/moves for existing saved requests. No nested collections, drag-and-drop, request creation/editing/saving/sending, automatic example data, variable/environment management or dirty-draft flow was added. Existing migrations/repositories and dependencies were preserved.

## Changes

- Shared validated grouping DTO contains workspaceId, owned collection identities and saved request summaries only. Validation rejects duplicate IDs, foreign workspace metadata and unknown collection membership; request configurations and secrets are not returned.
- Main CollectionService requires the active workspace and uses existing repository ownership checks for request, collection and destination IDs. Mutations and outgoing grouping validation commit together in a SQLite transaction. Missing/foreign/inactive IDs receive sanitized NOT_FOUND behavior.
- Collection deletion uses the existing transactional move-to-root repository operation, preserving request configurations and selected request. Other workspaces remain untouched. Moves accept a same-workspace collection ID or null for root.
- Five explicit owned-window handlers and validated frozen preload methods: collections.list/create/rename/delete and requests.move. Main cleans up channels on window close. No renderer-selected channel, raw IPC, Node, filesystem path or generic command API was exposed.
- Sidebar shows actual collections and root/grouped saved request names. Collection menus provide rename and consequence-confirmed delete. Per-request labeled destination selectors support collection/root moves; collection ordinals distinguish duplicate destination names while IDs remain internal.
- Empty/loading/error states, trimmed 1–100-character name validation, initial input/Cancel focus and dialog focus restoration. Failed operations preserve the current grouping and dialog input. Workspace-keyed component lifetime and generation checks prevent old async results from displaying a prior workspace's rows.
- Updated shell capability text and security allowlist assertions. Request creation/editing and sending remain explicitly unavailable.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, developer Node 22.18.0 / npm 11.6.2. Electron 44.5.1, embedded Node 24.21.0 / ABI 149, Chromium 152.0.7977.130. No dependency, lockfile or script changes. Native SQLite rebuilds ran sequentially; final binding is prepared for Electron.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` | Exit 0; strict TypeScript passes |
| `npm run lint` | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | Exit 0; Node SQLite rebuild succeeded; **113 tests passed in 7 files**, including 6 new collection service/handler cases |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Exit 0; Electron SQLite rebuild and production build/typecheck succeeded; **6 Linux Electron smokes passed**, 21.7 seconds |
| Visual review | Inspected actual `/tmp/api-client-collections.png` at 1280x720: collection actions, root request names/destination controls and scrollable sidebar readable; editor/response controls remain unavailable |
| Existing layout/focus smoke | Passed at 1280x720 and 1000x700, system light/dark, dialog focus trap/restoration and startup retry |
| `git diff --check` | Exit 0 |

Screenshot is a temporary local review artifact, not a bundled or committed product asset. No check failure occurred in the reported runs; an outgoing-schema test fixture was adjusted before execution to use a request summary rather than a stored request with extra config fields, so it tests invalid membership specifically.

## Acceptance evidence

Actual temporary SQLite service/handler tests cover:

- Invalid names, UUIDs, payload types/counts and foreign/detached/copied/closed frames rejected before writes; trimmed Persian names accepted.
- Duplicate collection names with different IDs; rename, moves between collections and root, and actual connection reopen preserving grouping. Summaries exclude config; stored request configuration remains unchanged.
- Active workspace enforcement plus foreign collection/request/destination rejection. Switching active workspace returns only that workspace's metadata.
- Deletion moving saved requests to root, preserving their configuration and selected request, with the other workspace's collection/request unchanged.
- Injected delete failure after request moves rolls back both grouping and collection deletion. Injected request-update failure preserves grouping. Invalid outgoing request metadata rolls back new collection creation. Private database error details are not returned.
- Rejection of foreign/duplicate/inconsistent grouping DTOs and sanitized database-unavailable errors.

Real Electron sidebar smoke covers:

- Create two ID-distinct same-name collections, trim names, reject whitespace and initially focus the name input.
- Seed saved request fixtures in the temporary database from the test's main-process context only; application startup creates no requests or demo collections.
- Move a root fixture to either collection and back to root; rename a collection and restore focus to its action trigger.
- Deletion dialog explicitly says requests move to root and are not deleted; initial Cancel focus and cancellation preserve grouping.
- Real SQLite delete-trigger failure leaves the collection/request association intact and shows a sanitized error. After removing the test trigger, confirmed deletion moves the saved request to root and returns focus to Create Collection.
- Switch between two workspaces; sidebar displays only owned fixtures. Main rejects a move to a foreign destination. Restart restores remaining collection IDs and both saved requests at root; Send remains disabled.

Existing workspace CRUD/restart, database corruption/reopen, local-only resources, sandbox/browser capability denials, frozen narrow API and shell regressions all pass. Security smoke now asserts the exact collection methods and move-only requests group.

## Limitations and blockers

No TASK-008 acceptance blocker remains. **Windows and packaged Linux/Windows applications were not tested**; evidence uses the built local file-based application launched from the repository on Linux. Internet was not physically disconnected; existing production resource/CSP checks remain regression evidence, and collection operations introduce no network code.

Request selection, CRUD/drafts and execution remain later tasks. Request fixtures are synthetic and temporary, not product defaults. No real credentials or HTTP requests were used. Screen-reader behavior, native Windows focus and an artificially delayed cross-workspace IPC response were not separately tested; workspace switch isolation was exercised through actual UI and main-service operations. Existing nonfatal Zod/Rollup annotation and Playwright color-environment warnings remain.
