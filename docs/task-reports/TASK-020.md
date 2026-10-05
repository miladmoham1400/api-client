# TASK-020 — URL-encoded form requests

Status: done
Date: 2026-10-05

## Inspection and scope

Read AGENTS.md, task-index.md, product.md, decisions.md, TASK-020, request-engine.md and ui-flows.md. The initial working tree was clean. TASK-020 was the earliest unfinished task and its dependency TASK-019 was done. Inspected editable/stored/runtime body schemas, request persistence and materialization, variable resolution, row/body controllers and existing fixtures/tests before editing.

Only URL-encoded forms were implemented. Multipart/file capabilities, navigation dialogs and later tasks remain outside this change.

## Changes

- Added URL-encoded forms to the validated editable body contract and persisted editor snapshots. Existing stored URL-encoded forms now open in the editor; stored multipart remains unavailable there.
- Added ordered form rows using the existing row editor: enabled switch, key/value inputs, add/remove and move up/down, stable row IDs, duplicate keys and empty values. Existing row/field limits and validation apply. Deep copies preserve saved rows and cached inactive body drafts independently. Only the active mode is saved/sent.
- Main materialization uses the existing enabled-row variable resolver, checks resolved field limits at original row indexes, appends rows to URLSearchParams and captures encoded bytes in the existing immutable transport snapshot. Disabled rows do not resolve variables or contribute bytes. Enabled missing/unavailable variables stop execution before network I/O.
- Default Content-Type is application/x-www-form-urlencoded. Explicit matching type with an optional charset is accepted; conflicting types/other parameters are rejected. Existing duplicate-singleton/managed-header checks remain. Main supplies exact Content-Length, including zero-length forms, and checks the existing serialized payload limit. GET/HEAD bodies remain rejected.
- No new packages, lockfile changes, migrations, renderer networking or IPC capabilities. Consulted the official [Node URLSearchParams documentation](https://nodejs.org/api/url.html#class-urlsearchparams) for append/serialization behavior; compatibility was exercised under both developer Node and Electron's embedded Node rather than inferred from version numbers.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64; developer Node 22.18.0, npm 11.6.2; Electron 44.5.1, embedded Node 24.21.0, ABI 149, Chromium 152.0.7977.130. Unit checks rebuilt SQLite for developer Node; desktop checks then rebuilt it for Electron. Real desktop tests used the built local application, Chromium sandbox enabled, temporary application storage and loopback fixtures. Native/loopback/Electron checks ran with sandbox escalation; no production sandbox bypass was added.

| Check | Actual result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | 245 passed in 21 files; 2.18 seconds |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Electron rebuild and production build passed; 17 desktop tests passed; 51.4 seconds |
| `git diff --check` | Passed |
| Screenshot inspection | Inspected `/tmp/api-client-urlencoded.png`: form mode/help and successful response rendered within the scrollable desktop panes. Row editing itself was exercised by the desktop test. Screenshot is temporary, not committed. |

No checks failed. Existing non-fatal Zod/Rollup PURE annotation and Playwright NO_COLOR/FORCE_COLOR warnings appeared.

## Acceptance evidence

- `tests/main/urlencoded.test.ts`: native HTTP echo matched exact expected encoded bytes and Content-Length for repeated keys, empty values, Persian/emoji, spaces, plus/ampersand/equals and literal percent sequences. Decoding retained original ordered pairs; source/snapshot mutations did not alter captured bytes. Empty keys and completely empty/all-disabled forms were also tested.
- The same tests verified enabled key/value substitution, disabled missing placeholders ignored, enabled missing/session-unavailable placeholders rejected at the original row path, resolved field limits, GET/HEAD rejection, matching/charset Content-Type, conflicting Content-Type/parameters, duplicate singleton rejection and engine-managed Content-Length.
- `tests/urlencoded.spec.ts`: real Electron UI added, reordered, removed and disabled form rows, then sent an unsaved form with exact fixture bytes. Send did not create a saved request. Enabling a missing-variable row or setting a conflicting Content-Type caused errors and no additional fixture request. Correcting the header allowed execution.
- Desktop smoke switched to JSON and back, retained form rows, saved via Ctrl+S, closed/relaunched Electron with the same storage, confirmed unchanged saved configuration/disabled rows and sent the reopened form correctly. Inactive JSON was absent after restart; startup did not send automatically.
- Shared body/row tests verified independent saved/cache copies and stable row identities. Main persistence tests verified validated form create, rejected duplicate row IDs without changing stored data, partial-save preservation and SQLite reopening. Existing query/header, JSON/raw, cancellation, redirect, response-safety and isolation tests also passed.

## Limitations and blockers

No remaining blocker for TASK-020. Windows and installed/package-specific smoke tests were not run and are not marked passed. This Linux environment reported safeStorage unavailable/basic_text with session-only secrets; no secure backend round-trip is claimed. The serialized payload check exists, but no 55 MiB form stress test was performed; existing row/field limits bound valid forms below that limit. No multipart body, file picker, binary download, response history or subsequent task was implemented.
