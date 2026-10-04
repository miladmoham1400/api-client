# TASK-010 — Query/header/settings editors

Status: done
Date: 2026-10-04

## Selection and scope

TASK-010 was the earliest unfinished task, with TASK-009 done. Read AGENTS.md, product, decisions, task index, selected task, IPC contract, UI flows and request engine. Inspected existing shared schemas, request service/handlers/preload, renderer drafts and tests before editing. Initial working tree was clean.

Implemented only ordered query/header rows and timeout/redirect settings. No network behavior, auth UI, body editor, variable resolution or later-task implementation. Packages, lockfile and database schema are unchanged.

## Changes

- Params and Headers support add, key/value edit, remove, enable/disable and explicit up/down ordering. React keys and edits use stable row UUIDs. Duplicate keys and disabled rows remain in the draft and saved configuration.
- A narrow validated `requests.newRow(workspaceId)` method generates blank row IDs in main, checks the active workspace and owned sender, and writes nothing. Preload remains an explicit frozen allowlist; its security assertion includes this method. The IPC contract documents the helper.
- Editor DTOs include query/header arrays, timeout and redirect flag. Create/save validate these fields and preserve other stored configuration. Optional fields allow existing basic-only API saves to preserve omitted settings. No auth handles or credentials were added to DTOs.
- Draft copying separates saved rows from editable rows. Explicit Save/Ctrl+S persists the configuration; Discard restores it. Row creation alone does not persist it. Existing dirty/busy navigation guards and stale-workspace response handling remain.
- Settings expose integer timeout 100–300,000 ms and redirects off by default. TLS verification is shown as fixed. Inputs and inline errors identify field paths without echoing entered values. Tuple IPC validation removes only the argument index so paths such as `headerRows[0].value` can cross the error envelope.
- Body/auth and Send remain unavailable. Header wire rules and materialization remain later-task work; saved text may contain unresolved templates.

## Actual checks

Environment: Ubuntu 24.04.3 LTS x64; developer Node 22.18.0 and npm 11.6.2. Actual Electron smoke output reports Electron 44.5.1, embedded Node 24.21.0, ABI 149 and Chromium 152.0.7977.130. Native SQLite rebuilds ran sequentially for Node and Electron; final binding targets Electron.

| Command/check | Result |
|---|---|
| `npm run typecheck` | Exit 0; also rerun successfully by production build |
| `npm run lint` | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | Exit 0; 123 tests passed in 9 files |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Exit 0; Electron SQLite rebuild, production build/typecheck and all 8 Linux desktop tests passed, 41.5 seconds |
| Visual review | Inspected `/tmp/api-client-request-fields.png`; saved Params tab, scrollable editor, sidebar and unavailable response/Send state displayed |
| `git diff --check` | Exit 0 |

Nonfatal existing Zod/Rollup comment-annotation and Playwright color-environment warnings appeared during the smoke build/run. They did not fail the checks. Screenshot is a temporary local review artifact, not a bundled asset.

## Acceptance evidence

- Focused state tests verify immutable edits/toggles/removal/reordering by ID, preserved saved rows, duplicate query keys and bounded movement.
- Schema tests verify timeout endpoints, rejection of out-of-range/fractional/NaN values, duplicate row ID rejection, 200-row limit and overlength row values with field-path errors.
- Temporary SQLite tests verify main-generated distinct row IDs without writes; duplicate/disabled rows, order and settings survive close/reopen. Basic-only save preserves settings. Invalid field/timeout inputs and inactive-workspace row creation fail without changing saved state.
- New real Electron keyboard smoke adds rows with Enter, types keys/values with Tab focus navigation, toggles enabled/redirect flags with Space, reorders/removes rows, and checks default redirects off. It verifies timeout 99 and 300001 errors, successful Ctrl+S, unchanged saved state during editing, Discard restoration and identical configuration after process restart.
- Existing request failure/duplication/deletion, workspace and collection persistence/isolation, native database, boundary security, layout and focus tests all passed in the full desktop suite.

## Limitations and blockers

No TASK-010 acceptance blocker remains. Windows and packaged Linux/Windows applications were not tested; desktop evidence is the built repository app on Linux. Internet was not physically disconnected. No request was sent and no transport, redirect execution, TLS execution or auth behavior is claimed. Final navigation/OS-close decisions remain TASK-023. No real credentials were used.
