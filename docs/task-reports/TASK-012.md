# TASK-012 — Pure variable resolution

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-012, variables, request engine and architecture. Inspected shared contracts, variable schemas, error envelopes, source layout and test scripts. TASK-012 was the earliest unfinished task, with TASK-002 done. Initial working tree was clean.

Added only `src/shared/variables.ts` and focused deterministic tests, plus this report and synchronized task statuses. No UI, preload/IPC exposure, database changes, encryption, sockets, dependencies or send integration.

## Changes

- Pure scope merge filters by workspace and selected environment before validating participating keys. Workspace values are overridden by environment values, including present empty strings and unavailable values. Keys are case-sensitive; duplicate keys in one participating scope fail. Map storage safely supports keys such as `__proto__`.
- Captured resolution entries contain strings supplied by main after secret lookup; null represents unavailable values. The resolver does not load, reveal, persist or decrypt secrets. Missing and unavailable values produce sanitized errors identifying valid variable key and field path, without a value or partial resolved snapshot.
- Single-pass textual interpolation trims only placeholder keys, rejects invalid paired placeholders, leaves unmatched braces as text, and never rescans substituted values. No JSON escaping, recursive substitution or automatic URL/query encoding.
- Request traversal resolves URL, enabled query/header keys/values, JSON/raw text, enabled URL-encoded rows, enabled multipart text keys/values and file keys, Bearer token and Basic username/password. Disabled rows are excluded before any interpolation or hooks. Paths retain original row indexes. File metadata/capabilities, raw media type, method and numeric settings are not interpolated.
- Returns a separate resolved configuration without changing saved templates. Default JSON validation parses substituted text without rewriting it; a JSON hook can impose additional validation but cannot bypass syntax validation. URL/header hooks receive substituted values and map rejection or thrown details to fixed errors. Concrete URL/header policy, query encoding and all wire serialization remain later tasks.
- No logger or renderer API is added. Resolved values are intended only for main's later captured-send pipeline, as documented in the module.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, developer Node 22.18.0 / npm 11.6.2. Tests are pure TypeScript with no network calls, filesystem, Electron or socket imports in the resolver test. The full existing unit suite also ran. Node SQLite rebuild preceded that suite; Electron SQLite rebuild restored the development app's native target afterward.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` (initial) | Exit 2: error helper typed as a union prevented direct error access; corrected its failure-only return type |
| `npm run typecheck` after correction | Exit 0 |
| `npx vitest run tests/shared/variables.test.ts` (initial) | Exit 0; 6 tests passed |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | Exit 0; 135 tests passed in 11 files, including 8 resolver tests |
| `npx vitest run tests/shared/variables.test.ts` after JSON-hook tightening | Exit 0; all 8 resolver tests passed |
| `npm run lint` (final) | Exit 0 |
| `npm run build` (final) | Exit 0; strict typecheck and main/preload/renderer production builds passed |
| `npm run rebuild:electron` | Exit 0; rebuild complete |
| `git diff --check` | Exit 0 |

Existing nonfatal Zod/Rollup comment-annotation warnings appeared in the build. The initial failed typecheck was not counted as passed. No desktop smoke was run for this isolated, unintegrated pure module.

## Acceptance evidence

Eight tests cover all TASK-012 variable behavior categories:

- Environment precedence, empty override, case-sensitive keys, participating duplicate rejection, unavailable override, None selection, inactive/foreign exclusion and invalid participating key rejection. Invalid/duplicate excluded entries cannot affect resolution.
- Spaced placeholders, Unicode values, unmatched braces, invalid paired keys, missing paths and literal nested-looking output.
- Ordered duplicate query keys, unchanged `%2F` input and existing URL query, enabled headers, disabled invalid/missing rows, unchanged source snapshots, raw text and Basic auth.
- URL-encoded text, multipart text/file keys, disabled parts, untouched file names/capabilities and Bearer auth.
- Post-substitution JSON success preserving whitespace; unescaped quote failure and empty JSON failure with sanitized `body.text` errors. Original templates remain unchanged.
- Post-substitution URL/header/JSON hook behavior, original row-index errors, sanitized thrown validator details and a consumer counter remaining zero after a rejected resolution.
- Missing/unavailable errors for URL, query/header fields, raw body, form/file fields and all auth fields, with no success data. Supplied synthetic main-only values resolve as strings without diagnostics.

## Limitations and blockers

No TASK-012 acceptance blocker remains. No actual fixture request or socket was opened; zero downstream consumption is tested with a counter, not a transport integration. Main secret lookup, secure storage and log/export integration remain later tasks; no real credential or encryption backend was tested. No renderer behavior, Linux/Windows packaged application or Windows runtime was tested. The resolver is deliberately not connected to Save or Send, so current application behavior is preserved. Concrete materialization and encoding belong to TASK-015 and transport to later tasks.
