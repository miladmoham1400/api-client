# TASK-004 — SQLite bootstrap and migrations

Status: done
Date: 2026-10-04

## Selection and scope

Initial git status was clean. Read AGENTS.md, product, decisions, task index, TASK-004 and its data-model/architecture/setup references. TASK-004 was the earliest unfinished task whose dependency TASK-003 was done. Preserved the existing API/security/baseline implementation. No renderer CRUD, repository services, alternate server, request engine, secrets service or installer was added.

## Changes

- Pinned better-sqlite3 13.0.3, @electron/rebuild 4.2.0 and @types/better-sqlite3 9.6.0 with lockfile. Official npm metadata verified the driver requires Node >=22 and rebuild requires Node >=22.12; both fit developer Node 22.18.0. Consulted [Electron native-module guidance](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules), [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) and [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html).
- `src/main/db/migrations/001-initial.ts` defines the complete first schema, composite ownership references, workspace cascades, variable partial unique indexes, request JSON/version checks, integer sensitive-flag checks and secure/session storage invariants. Selected request/environment references stay scoped to their workspace and must be explicitly cleared before deletion. Names/config validation remains the responsibility of later services as documented.
- `src/main/db/database.ts` opens the native driver, enables and checks foreign keys before transactions, validates contiguous migration plans and ledger history, and applies all pending migration SQL plus ledger entries in one immediate transaction. Foreign-key checks precede commit. Failures roll back and close the connection; no database deletion/recreation or plaintext fallback occurs. Unknown newer/discontinuous histories are rejected.
- Main opens `app.getPath('userData')/offline-api-client.sqlite` after ready and before creating the window. Bootstrap reports actual ready/unavailable database status while requests remain unavailable. Graceful will-quit closes the owned database.
- Failed startup keeps a local sandboxed window with a fixed sanitized message and explicit database location. React renders these as text; no raw SQLite error, stack or file contents are shown. The message directs the user to close the app and check access; no destructive recovery command is exposed.
- Runtime rebuild scripts separate developer Node and Electron targets. Unit tests prepare Node; dev/start/smoke prepare Electron. This avoids accidentally loading the wrong ABI after switching test targets. Native preparation belongs to development tooling, not installed-app startup. Toolchain notes document sequential usage and per-OS requirements.
- Added six temporary-database integration cases and one Electron native/recovery case. Existing desktop tests now use temporary configuration directories so they do not initialize or mutate a real user database. Existing security expectations now reflect an actually ready database, without exposing data operations.

## Actual commands and results

Environment: Ubuntu 24.04.3 LTS x64; developer Node v22.18.0, npm 11.6.2; Electron 44.5.1 / embedded Node 24.21.0 / module ABI 149 / Chromium 152.0.7977.130.

| Command/check | Actual result |
|---|---|
| Official `npm view` version/engine checks | Exit 0; exact versions and compatible requirements recorded above |
| Pinned dependency installation | Exit 0; no reported vulnerabilities |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm ci` | Exit 0; 355 packages added, 356 audited, zero reported vulnerabilities |
| `npm run typecheck` (final) | Exit 0; strict checks pass |
| `npm run lint` (final) | Exit 0 |
| `npm test` after clean install | Exit 0; Node native preparation succeeds; **89 tests pass in 4 files** |
| `npm exec --no -- install-electron` (IPv4-first, after clean install) | Exit 0 |
| `npm run test:smoke` (IPv4-first; desktop access outside command sandbox) | Exit 0; Electron rebuild completes, production build passes, **3 Electron smoke tests pass** |
| `npm ls --depth=0` | Exit 0; pinned direct dependencies resolved |
| `git diff --check` | Exit 0 |

No native-target mutation was run concurrently with its test execution in the final clean verification sequence. The working native binding is left prepared for Electron; `npm test` automatically prepares Node before testing again.

## Acceptance evidence

Temporary-db tests establish all schema tables, foreign keys enabled, replay without changed ledger, preserved data on reopen, rollback of injected DDL/data/ledger failure, safe close/reopen after failure, clean initial-failure rollback, unknown history rejection and corrupt-file byte preservation. Constraints reject cross-workspace collections, environments, secret references and selected IDs. Other cases verify case-sensitive per-scope variable uniqueness, sensitive/plain and secure/session invariants, selected-object deletion protection and workspace cascades.

The Electron native smoke uses the actual built app with isolated userData. App startup applies migration 1; the binding loads under ABI 149, writes a synthetic workspace row and reads it after app close/relaunch. After replacing that test-only file with corrupt bytes, startup shows “Database unavailable” and the database location, capabilities report unavailable, and the corrupt file remains byte-for-byte intact. Existing local UI and owned-window/security smoke tests also pass. Node-only tests were not used as a substitute for Electron native validation.

## Corrections and warnings

Initial strict checks caught an unknown PRAGMA result and a misplaced recovery render inside an effect; fixed with explicit result validation and the recovery render at component level. The first native smoke attempted a lexical require unavailable in Playwright's Electron evaluation environment; corrected to an explicitly app-resolved main-process createRequire loader. Final checks passed after these corrections. No earlier failure was reported as a pass.

The known Zod/Rollup comment-annotation warnings and Playwright NO_COLOR/FORCE_COLOR warning remain nonfatal. Native rebuild completion and real execution are established; no claim is made that compilation from source, rather than a compatible prebuilt artifact, occurred.

## Limitations and blockers

No TASK-004 acceptance blocker remains. Linux development/built-bundle native loading is verified. Windows native rebuild/runtime, both packaged-app targets, unpacking/installer configuration and disconnected-internet release acceptance remain untested and belong to later tasks. Development hot reload was not tested. Graceful app shutdown/relaunch was exercised; crash/power-loss durability was not tested. Full variable/request/schema validation and ownership service checks remain TASK-005 and later feature work. No automatic backup, repair, replacement or cloud dependency was introduced.
