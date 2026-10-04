# TASK-002 — Shared validated domain contracts

Status: done
Date: 2026-10-04

## Selection and repository state

Read AGENTS.md, task index, product and decisions; selected the earliest unfinished eligible task, TASK-002. TASK-001 was already done in both its file and the index. Read TASK-002's data-model, IPC, request-engine and import/export specifications, plus related variables, secrets and testing documents.

The repository began with the uncommitted TASK-001 baseline. Preserved its main/preload/renderer, existing smoke harness, report and task completion. Changes are limited to shared contracts, schema-test tooling/tests, dependency records, this report and TASK-002 status. No IPC handlers, networking, database, secret-store operations, importer/exporter operations or later feature implementation was added.

## Changes

- `src/shared/primitives.ts`: documented phase-1 limits, Unicode-character name/field bounds, UTF-8 byte bounds, UTC timestamps, normalized UUIDs, variable keys, methods/timeouts/media types, duplicate-ID checks and indexed/stable-row field paths. Shared code has no Electron/Node imports, IO or UUID generation; main will generate IDs in later tasks.
- `src/shared/request-config.ts`: configVersion=1 runtime/stored/export configurations, strict discriminated body/auth variants, ordered query/header/form/multipart rows and fresh product defaults. Arrays preserve duplicate keys and input order; repeated row IDs are rejected. Runtime file capability IDs are excluded from stored/export bodies; exported file rows require reselection. Stored credential fields accept only placeholder templates or secret references. Export auth accepts only placeholder/whitespace templates and explicit omission flags; credential header rows must be empty and disabled.
- `src/shared/entities.ts`: workspace/collection/environment/request DTOs, input/state/settings schemas, separate stored and masked sensitive-variable contracts, per-scope entry/key checks and upload capability metadata.
- `src/shared/results.ts`: complete documented error-code allowlist, strict `Result<T>` envelopes, execution/HTTP response DTOs and safe validation-error conversion. Unknown field names/input values/Zod messages are not echoed into shared errors. HTTP 4xx/5xx remain valid response results; duplicate response headers remain ordered.
- `src/shared/transfer.ts`: strict v1 portable workspace schema with entity/variable limits, source-ID/key uniqueness and collection/environment reference validation. Sensitive values, secret IDs, state, scripts, file paths/capabilities and responses have no export fields and are rejected. This validates DTO structure only; no file IO, import preview, remapping or transaction implementation.
- Zod **4.6.5** and Vitest **5.0.3** installed with exact pins and updated lockfile. Verified current versions/engine/peer metadata through official npm registry and checked [Zod API](https://zod.dev/api) / [Vitest guide](https://vitest.dev/guide/). Vitest's Node ^22.12 and Vite ^7 peer support match the existing baseline. Compatibility notes added to `docs/toolchain-lock.md`.
- `npm test` / `npm run test:unit` runs the pure schema suite. Existing `npm run test:smoke` remains available; Playwright now matches only `.spec.ts`, separately from Vitest's `tests/shared/**/*.test.ts`.

## Contract interpretation and task boundary

Structural boundary validation enforces types, field lengths, row counts and allowlists on every row, including disabled rows. It retains disabled draft content without semantic validation of headers, variable presence or file selection. Later send/materialization tasks skip disabled rows entirely and validate enabled resolved values.

Runtime/stored/export config schemas describe editable templates, not materialized wire requests. Incomplete URL/auth templates, invalid pre-substitution JSON and unselected file rows can be represented without opening sockets. GET/HEAD body rejection, actual URL/header/auth/content-type checks, JSON after substitution, actual file stat/aggregate sizes and encoded-response accounting remain with their documented execution tasks. Import byte limits are constants here; bounded file reading and import transactions remain later work. Arbitrary error messages are not automatically scrubbed by a shape schema; future handlers must construct sanitized errors rather than relay exceptions.

Routine DTO spelling: bodies use `kind`, auth uses `mode`, each request config carries `configVersion:1`, runtime file capabilities use `fileId`, stored auth fields use discriminated template/secret objects, and fields use dot/index or UUID-row paths. Timestamp strings require UTC `Z`; names trim and count Unicode code points. No behavior or scope decision was changed.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, Node v22.18.0, npm 11.6.2. Linux Electron baseline remains 44.5.1 with embedded Node 24.21.0 and Chromium 152.0.7977.130.

| Command/check | Result |
|---|---|
| `npm view zod version engines --json` and `npm view vitest version engines peerDependencies --json` (IPv4-first, official registry) | Exit 0; exact compatible stable versions recorded above |
| Exact dependency installation | Exit 0; no reported vulnerabilities |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm ci --fetch-retries=0 --fetch-timeout=20000` | Exit 0; 329 packages added, 330 audited, zero reported vulnerabilities |
| `npm exec --no -- install-electron` after clean install (IPv4-first) | Exit 0 |
| `npm run typecheck` | Exit 0; strict TypeScript passes |
| `npm run lint` | Exit 0 |
| `npm test` | Exit 0; 1 test file, **76 tests passed** |
| `npm run build` | Exit 0; all three production bundles built |
| `npm run test:smoke` with desktop access outside command sandbox | Exit 0; existing **1 Electron smoke test passed**, Chromium sandbox enabled |
| `npm ls --depth=0` | Exit 0; exact direct dependencies resolved without peer errors |
| Source inspection for `any`, Node/Electron imports or fetch in `src/shared` | No matches |
| `git diff --check` | Exit 0 |

Initial typecheck caught a test fixture inferred as null-only for environmentId; fixed the fixture's explicit nullable-string type. Final commands above were run after the correction and final clean install. No failed check was counted as passing.

## Acceptance evidence

76 schema cases establish valid method/body/auth variants; invalid names/timeouts/types/body discriminants and raw media types; 200-row and 100-variable bounds; multibyte UTF-8 body limits and Unicode field bounds; preserved ordered duplicate query/form rows; disabled-row structural/semantic distinction; strict unknown/executable/path fields; runtime/stored/export credential and capability separation; portable-format version/IDs/orphans/scope-key validation; stable UUID paths; sanitized error envelopes; HTTP error statuses and duplicate headers; selected-file metadata limits. No `any` bypass exists in the shared modules.

## Limitations and remaining blockers

No TASK-002 acceptance blocker remains. Unit tests run offline under developer Node; the Electron smoke is a baseline regression, not evidence that future IPC/database/network/transfer integrations exist. No Windows machine, Windows package, Linux package, native SQLite rebuild, disconnected-network acceptance, file operation or request send was tested. These remain later tasks and are not marked passed here.
