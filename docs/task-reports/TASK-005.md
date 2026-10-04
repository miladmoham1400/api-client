# TASK-005 — Workspace-scoped repositories

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-005, data model and IPC contract; inspected the existing stored DTO/config schemas and secrets specification. TASK-005 was the earliest unfinished task with completed dependency TASK-004. Initial working tree was clean. Existing implementation and dependency files remain unchanged.

Added only main-process repository code and focused temporary-database tests. No IPC data handlers, renderer CRUD, networking, encryption implementation, plaintext secret fallback, schema migration change or later task was implemented.

## Changes

`src/main/db/repositories/index.ts` provides explicit operations for workspaces, collections, requests, environments, variables, selections and secret records. Values use bound SQL parameters. Private table interpolation uses a fixed TypeScript allowlist; no renderer-facing generic table/query API exists. Descendant lookups/mutations include workspace_id and id; target collections/environments/secrets are checked before writes. Missing and unauthorized IDs produce the same sanitized NOT_FOUND error.

Names, IDs, variable values/keys, stored configurations and returned database rows are runtime validated. UUIDs/timestamps are generated in main. Database failures become sanitized repository errors rather than raw SQLite exceptions. Saved JSON uses the stored schema, excluding runtime upload capabilities and literal auth credentials. Variable upsert preserves case-sensitive per-scope identity and enforces 100 entries per scope.

Transactions implement collection deletion with requests moved to root; request moves; selected request/environment clearing; environment variable/secret cleanup; workspace descendant deletion and last-workspace clearing; variable conversion/deletion orphan cleanup; request save/delete orphan auth-secret cleanup; and duplication with independently owned new auth-secret records. Duplication truncates names by Unicode code points before appending ` (copy)` and returns internal source/new secret-ID mappings.

Secure-record duplication copies the existing ciphertext BLOB without decrypting it. Session-record duplication creates independent unresolved session metadata; no session value store exists yet. The returned mappings are the integration point for TASK-013 to copy/invalidate in-memory values. These records/mappings remain main-only and are not exposed as fake completed credential operations. Referenced secrets cannot be shared with another request/variable owner or deleted underneath an owner.

Workspace selection persists in app_settings. Per-workspace state persists and stale/foreign stored selection IDs resolve to None. Workspace deletion accepts a main-only beforeDelete hook for the future execution service to abort before descendant deletion; this task implements no execution itself.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, developer Node 22.18.0 / npm 11.6.2; existing better-sqlite3 13.0.3. Electron regression remains 44.5.1 / embedded Node 24.21.0 / ABI 149.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` (final) | Exit 0; strict checks pass |
| `npm run lint` (final) | Exit 0 |
| `npm test` (final) | Exit 0; Node native preparation succeeds; **102 tests pass in 5 files**, including 13 repository cases |
| `npm run build` | Exit 0; production bundles build |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Exit 0; Electron native rebuild/build succeeds; **3 existing Linux Electron smoke tests pass** |
| Source inspection of new repository module | No any bypass, logging, Electron import or fetch |
| `git diff --check` | Exit 0 |

No packages/scripts changed, so dependency installation was not repeated. Native Node/Electron tests ran sequentially; binding is left prepared for Electron by the final smoke command.

## Acceptance evidence

Temporary-database tests cover:

- Cross-workspace collection/environment/request/variable/secret read and mutation rejection, foreign request targets/secret references and selection rejection, without altering the original workspace.
- Parameterized names containing SQL-like text; validation and stored config round trips.
- Request moves and collection deletion preserving saved requests and selected request at root.
- Actual close/reopen preserving workspace/environment/request selection; safe selected-ID clearing before deletion; last-workspace clearing.
- Foreign/stale stored selection metadata falling back to None.
- Case-sensitive keys, separate workspace/environment scopes, upsert retaining ID, 100-entry limit and sensitive-to-plain conversion cleanup.
- Environment deletion removing variables/orphan secret records while retaining workspace variables.
- Independently owned secure and unresolved session secret duplication, explicit mappings, 100-character Unicode copy names, protection from sharing/removal and independent original/copy deletion.
- Superseded auth-secret cleanup on save.
- Injected SQLite trigger failures rolling back collection moves, environment variable/secret deletion, selection clearing, duplication secret creation and workspace deletion/state/settings changes.
- Missing-ID and invalid secret/auth payload rejection without writes.

The desktop suite is regression evidence for existing startup/native/security behavior, not a claim that repositories are wired to IPC or UI. The new repository methods are exercised directly under developer Node using actual temporary SQLite databases.

## Corrections and warnings

Initial typecheck found that StoredCredential was not an exported shared alias; repository code now derives it from the existing schema. A test-fixture edit for actual connection reopen briefly introduced a syntax error, which was corrected before final verification. Final checks passed after corrections; earlier failures were not counted as passing.

Existing nonfatal Zod/Rollup comment-annotation and Playwright NO_COLOR/FORCE_COLOR warnings remain. No raw credential or database exception logging was added.

## Limitations and blockers

No TASK-005 acceptance blocker remains. Windows and packaged-app behavior were not tested. Encryption/decryption, session value cloning/eviction and safeStorage capability integration remain TASK-013; caller services must use the returned duplication mappings and coordinate session cleanup. Execution abort is only a hook until execution exists. User confirmations, CRUD UI, explicit IPC methods, import transactions and repository integration with those flows remain their later tasks. No production credential values were used in tests.
