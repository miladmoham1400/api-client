# TASK-009 — Saved requests and editor drafts

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-009, data model, UI flows, secrets and IPC contract. Inspected shared schemas, repositories, services, handlers, preload, shell/sidebar and existing tests before changes. TASK-009 was the earliest unfinished task; TASK-008 and TASK-002 were done. Initial working tree was clean.

Implemented request list/create/get/save/duplicate/delete and independent basic-field drafts. No HTTP sending, query/header/settings/body/auth editor, variable resolution, encryption implementation, nested collections or final dirty-navigation/OS-close decision flow was added. No package, lockfile, migration or repository changes.

## Changes

- Explicit request schemas and frozen preload methods validate incoming arguments and outgoing snapshots. Editor DTOs expose identity/name/method/URL only; no stored auth handles, credential values, ciphertext, request bodies or response data cross this feature boundary. Existing move API remains available.
- Main RequestService requires the active workspace and repository ownership for request and collection IDs. Request mutation, selection and output validation commit together. Get selects the owned request; startup list restores a valid selected request and preserves active environment selection.
- Creation uses main-generated IDs and documented default configuration. A new UI request starts as an unsaved GET/name/empty-URL draft; first explicit Save creates its row. Subsequent Save patches name/method/URL while preserving stored advanced configuration, grouping and secret references in main.
- Duplication uses the repository's independently owned secret-record mappings, new request ID and Unicode-safe ` (copy)` name; it selects the copy and copies no response. Deletion requires a consequence dialog and clears selected request through existing transactional repository behavior.
- Main-only staged RequestSecretLifecycle interface prepares duplicate/removal changes and commits session updates only after successful SQLite commit. On transaction failure it rolls back the staged plan. Provider preparation must leave live session values unchanged and finalizers must not throw. No provider/session-value store is installed yet; existing unresolved session metadata remains unresolved. No credential reveal/decryption was added.
- Renderer keeps saved fields and draft fields separate. Editing writes no database data. Save and Ctrl+S explicitly persist; failed Save keeps the entered draft, old saved row and readable error; Discard restores saved fields. Sidebar names open saved requests; create, duplicate and delete refresh grouping.
- Temporary navigation locking while dirty/busy, with explicit Save/Discard text, avoids silently replacing drafts before TASK-023's final decision flows. Workspace/collection operations, other request selection and saved-request duplication/deletion are disabled while dirty. Escape does not discard editor data. This is not a completed OS-close or Save/Discard/Cancel navigation-dialog feature.
- Request state resets by workspace with stale async responses ignored. Workspace controls remain mounted so existing dialog focus restoration is preserved. Send and advanced editors remain explicitly unavailable.

The basic create/save input intentionally contains name/method/urlTemplate (and collectionId for create); future editor tasks extend the boundary when their fields become available. Existing stored configuration stays in main and is preserved during these basic saves.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, developer Node 22.18.0 / npm 11.6.2. Electron 44.5.1, embedded Node 24.21.0 / ABI 149, Chromium 152.0.7977.130. SQLite native rebuilds ran sequentially for Node then Electron; final binding is prepared for Electron.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` (final) | Exit 0; strict TypeScript passes |
| `npm run lint` (final) | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` (initial) | Exit 0; 118 tests passed in 8 files |
| Same unit command after staged lifecycle changes | Exit 0; **119 tests passed in 8 files**, including 6 new request service/handler tests |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` (initial) | Native rebuild and build/typecheck passed; 6 desktop tests passed, workspace focus regression failed, described below |
| Same smoke command after fixes (final) | Exit 0; rebuild, production build/typecheck and **all 7 Linux Electron smokes passed**, 35.3 seconds |
| Visual review | Inspected `/tmp/api-client-requests.png`: saved copy name/method/URL and sidebar original/copy visible; response empty and Send unavailable |
| Existing layout/focus regression | Passed at 1280x720 and 1000x700, system light/dark, information-dialog keyboard focus and startup recovery |
| `git diff --check` | Exit 0 |

Screenshot is a local temporary review artifact, not a committed/bundled asset. No remote UI assets or network requests were introduced.

## Acceptance evidence

Actual temporary SQLite tests verify:

- Main defaults: GET, empty URL, no body/auth, empty query/header rows, 30,000 ms timeout, redirects off. Explicit create/save and request selection survive close/reopen. A local draft alone does not write.
- Basic-field saves preserve existing JSON body, timeout, redirect setting and owned secure credential reference. Returned DTO JSON contains neither secret ID nor ciphertext/auth data.
- Duplicate has a different request ID, Unicode-safe 100-character copy name and independently owned session-secret ID. Main-only mapping hook receives source/copy IDs; snapshots contain no response. Deletion preserves original request and clears selected copy.
- Foreign workspace/request/collection IDs, missing IDs, foreign sender, invalid name/method/URL limits and extra credential payload fields fail without writes.
- Injected Save failure leaves prior row/selection intact and returns no private SQLite detail. Selection-write failure rolls back new request creation and deletion.
- Staged secret changes commit outside the SQLite transaction; selection/deletion failure invokes rollback without changing simulated live session state or request rows.

Real Electron request UI smoke verifies:

- Create starts an unsaved default draft with zero request rows; name/method/URL edits persist only on Save.
- Editing an existing URL leaves the saved snapshot unchanged and disables navigation while dirty.
- Real SQLite trigger failure on Ctrl+S keeps URL draft and old saved row. Removing the trigger and retrying Ctrl+S succeeds. Discard restores saved name.
- Duplicate selects an independently identified saved copy with unchanged method/URL and no response; process restart restores its selection and config.
- Request deletion dialog initially focuses Cancel; cancellation retains the request. Confirmed deletion removes only the copy; opening the original succeeds. Send remains disabled.

Existing workspace create/select/delete/restart, collection grouping/moves/delete/isolation, database corruption/reopen, local-resource/sandbox/browser denials and shell tests all pass. Security assertions include the exact expanded frozen request method allowlist.

## Corrections and warnings

The initial desktop suite caught a workspace-selector focus regression after active workspace deletion. A workspace-keyed desktop subtree had remounted the workspace controls along with request state. The fix keeps those controls mounted, explicitly resets/filters request state by workspace and ignores stale results; the original focus assertion passed in the final full suite. The new request UI smoke passed in both runs. Initial failed checks were not counted as passes.

The prepared secret lifecycle was tightened to stage memory changes until database commit and roll them back on failure; an added focused test verifies this contract. Existing nonfatal Zod/Rollup comment-annotation and Playwright color-environment warnings remain.

## Limitations and blockers

No TASK-009 acceptance blocker remains. **Windows and packaged Linux/Windows applications were not tested**; desktop evidence uses the built local file-based app launched from the repository on Linux. Internet was not physically disconnected; existing local-resource/CSP checks passed.

Advanced editors, HTTP execution, actual safeStorage encryption/decryption and session-value storage remain their later tasks. The staged secret interface is tested with synthetic hooks, not a real secret backend; secure/session backend acceptance is not claimed. Existing session records have no live values to clone until TASK-013 integrates that store. TASK-023 must implement final dirty-navigation and OS-close decisions; closing the app with an unsaved draft is not guarded in this slice. No real credentials, real HTTP sends or response payloads were used.
