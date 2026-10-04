# TASK-007 — Workspace CRUD and selection

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-007 and its UI-flow/IPC specifications; also inspected architecture and data model. Inspected existing repositories, schemas, renderer, preload, main lifecycle and tests before edits. TASK-007 was the earliest unfinished task; TASK-005 and TASK-006 were done. Initial working tree was clean.

Implemented workspace list/create/rename/select/delete only. No automatic examples, collection/request editing, environment/variable management, request execution or dirty-draft flow was added. Existing repository/schema/migration behavior was retained; no dependency, lockfile or package-script changes.

## Changes

- Shared workspace input tuples validate UUIDs and trimmed 1–100-character names; duplicate names remain allowed. Snapshot DTOs contain workspace identities and selectedWorkspaceId only, with unique IDs and existing-selection validation. No descendant data, request configuration or secret record crosses this API.
- Main WorkspaceService uses existing repositories. Creation selects the new workspace. Metadata changes and selection updates commit in one transaction, including outgoing snapshot validation. Rename preserves selection. Deleting the active workspace clears selection to the permitted empty-state fallback; deleting an inactive workspace preserves the active one. Startup listing restores only a still-existing persisted ID.
- Owned IPC guard now passes parsed inputs to operations and supports validated sanitized domain-error mapping. Workspace handlers reject foreign senders/frames before touching repositories, validate incoming and outgoing DTOs, and return sanitized failures. Main registers only five explicit workspace channels and removes them on window close.
- Frozen preload workspaces API exposes only list/create/rename/delete/select. Its private helper validates arguments and result envelopes; no renderer-selected channel or raw invoke is exposed.
- Renderer loads actual workspace metadata, provides selection, create/rename dialogs and workspace action menu. Deletion names its target and explicitly explains descendant deletion and irreversibility; Cancel is initially focused. Dialog cancellation and focus restoration work, including returning to the selector after the deleted workspace's menu becomes disabled.
- Mutation failures keep the saved view and entered dialog name intact, show readable sanitized errors and allow retry/reload. Controls are disabled while operations run; stale async results are ignored. Workspace names render as React text. Collection/request controls and sending remain explicitly unavailable.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, developer Node 22.18.0 / npm 11.6.2. Electron 44.5.1, embedded Node 24.21.0 / ABI 149, Chromium 152.0.7977.130. Existing SQLite native binding was rebuilt sequentially for developer Node and Electron; final binding is prepared for Electron.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` (final) | Exit 0, strict TypeScript passes |
| `npm run lint` (final) | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | Exit 0; Node native rebuild succeeded; **107 tests passed in 6 files**, including 5 new workspace service/handler tests |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Electron native rebuild and production build/typecheck passed; initial suite had **4 passing tests and 1 test-selector failure**, described below |
| `npx playwright test tests/workspaces.spec.ts` after assertion correction | Exit 0; workspace UI test passed, 8.9 seconds |
| `npx playwright test` (final, after additional security/preload assertions) | Exit 0; **all 5 Linux Electron smokes passed**, 16.0 seconds |
| Visual review | Reviewed settled actual Electron screenshot `/tmp/api-client-workspaces.png`: selected workspace and focus ring visible, regions readable, future operations disabled. Existing layout smoke also passed at 1280x720 and 1000x700 in system light/dark appearance |
| Source inspection | New feature code has no any bypass, logging, browser fetch, renderer Node/SQLite access or executable HTML rendering |
| `git diff --check` | Exit 0 |

The screenshot is a temporary local review artifact, not a bundled or committed product asset. Official Chakra [Input guidance](https://chakra-ui.com/docs/components/input) was checked while implementing labeled inputs; controls use v3 compound Menu/Dialog/NativeSelect APIs and an explicitly associated native label.

## Acceptance evidence

Main tests use actual temporary SQLite databases and owned-handler fixtures:

- Reject empty/whitespace/overlong/non-string names, wrong argument shapes/counts, invalid IDs and missing workspaces without writes. Trim and preserve Persian names. Reject copied/subframes, detached frames, foreign senders and closed windows.
- Create and rename workspaces, allow duplicate names with independent IDs, persist selection and names through connection reopen, retain selection on inactive deletion, clear selection on active/last deletion and restore stale valid UUID selection as None.
- Inject selection-write and workspace-delete SQLite failures; confirm full rollback and sanitized errors. Invalid existing outgoing metadata also rolls back a new workspace creation.
- Populate two workspaces with collections, requests, environments, variables and secret records; delete one and verify its descendants are removed while the other's metadata remains unchanged. API snapshots expose only workspace metadata; descendant UI remains outside this task.
- Verify sanitized DATABASE_UNAVAILABLE behavior for closed/missing database service.

Real Linux Electron UI smoke covers:

- Empty startup, invalid-shape preload rejection without writes, whitespace/101-character input rejection and Escape/focus restoration.
- Create two workspaces, trim names, switch selection and display only the selected workspace name in the sidebar; rename and restore the selected workspace/name after process restart.
- Inject a real SQLite rename trigger failure; preserve the entered dialog name and saved name, omit private error details, cancel and verify the old sidebar name.
- Show deletion consequences and initial Cancel focus; cancellation leaves selection intact. Confirm active deletion yields empty selection and restores selector focus; remaining workspace can be selected and is restored after restart. Delete the last workspace and restart to an empty database view.
- Sending remains disabled; resources are local file/data URLs. No target request or example data is created by application startup.

Security smoke verifies the expanded frozen allowlist, absence of renderer Node/raw IPC, and denial of an unauthorized second window's workspace creation with no metadata writes. Existing sandbox, local CSP/resource, denied remote browser capability and native database recovery/reopen checks also pass.

## Corrections and warnings

Initial typechecking caught an unconstrained iterable schema in the private preload helper, a polymorphic Box label attribute and a runtime-vs-stored auth shape in a test fixture. These were corrected with typed array-schema constraints, a native associated label and explicit no-auth stored fixture; final typecheck/lint passed.

The first desktop suite failed when a test queried the sidebar by accessible role while a modal correctly made the background inaccessible. The test now checks persisted data while the dialog is open and the sidebar after Cancel; no modal isolation was weakened. A first screenshot captured a dialog exit animation; final visual evidence waits until visible dialogs have exited. Earlier failures are recorded here, not counted as passes.

Existing nonfatal Zod/Rollup annotation and Playwright NO_COLOR/FORCE_COLOR warnings remain.

## Limitations and blockers

No TASK-007 acceptance blocker remains. **Windows and packaged Linux/Windows applications were not tested**. Evidence uses the built file-based app launched from the repository on Linux; this does not substitute for later independent OS packaging acceptance. Internet was not physically disconnected; local-only operation is supported here by production CSP/resource checks and the absence of network code in workspace operations.

Descendant browsing/editing and environment selection remain their later tasks; this slice exposes only workspace identities and selection, preventing accidental descendant leakage. No active execution or request draft exists yet, so execution-abort/dirty-draft coordination remains in the documented later tasks. Screen-reader and native Windows focus behavior were not tested. No credentials or real HTTP requests were used.
