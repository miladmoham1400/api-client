# TASK-015 — Auth editing and request materialization

Status: done
Date: 2026-10-05

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-015, request engine, variables and secrets. Inspected request/domain schemas, persistence and SecretStore lifecycle, variable resolver, renderer drafts/editors and tests. TASK-015 was the earliest unfinished task; TASK-011, TASK-012, TASK-013 and TASK-014 were done. Initial working tree was clean.

Implemented None/Bearer/Basic editor, literal credential persistence and main-side materialization for None/JSON/Raw. No sockets, execution IPC, redirects, form serialization, file access, OAuth, scripts or later-task features. Send stays disabled. Packages, lockfile and schema are unchanged.

## Changes

- Strict auth draft fields contain either a value or an opaque keep marker. Editor DTOs contain templates or masked storage/presence metadata, never literal credentials, secret IDs or ciphertext. New request defaults to Auth None. Password-type inputs permit literal/template replacement and preserve stored values left unchanged; missing session credentials and storage limitations are explained.
- Main classifies template-only strings using the existing credential schema. Literal-bearing token, username and password strings receive independently owned SecretStore records. Create/save wrap credential and owner changes in the store transaction; replacing/removing auth cleans old records and session values. Keep works only for the matching field on the owned prior request. Omitted auth preserves configuration for existing partial callers.
- Added main-only MaterializationService to validate owned workspace/request/environment IDs, require the captured environment to match active selection, load only workspace/selected-environment variables, resolve stored credentials in main and materialize a separate snapshot. Missing unused sensitive variables do not block; referenced unavailable values fail through field-specific resolver errors. No materialization result or variable-resolution capability was added to preload.
- Reusable `src/main/http/materialize.ts` has no Electron/database/socket dependency. It validates absolute HTTP/HTTPS URL, host, userinfo/fragment/line breaks; appends enabled query rows through URLSearchParams; validates enabled header names/values; preserves duplicate ordinary header rows and rejects managed/singleton/auth conflicts.
- Bearer and UTF-8 Basic authorization are generated in main; a resolved Basic username with colon fails. None has no body or automatic Content-Type. JSON validates after substitution and retains its exact source bytes. Raw retains UTF-8 text. JSON/+json Content-Type compatibility and valid raw override are enforced. Byte Content-Length and managed Accept-Encoding are generated.
- Snapshot metadata/header rows are frozen; the body getter returns fresh Buffer copies, preventing mutation of captured bytes. Later draft/variable edits cannot change a captured result. Resolved plaintext exists only in this main-only result and is neither persisted nor logged.
- Resolver gained an optional streaming output-byte bound for materialization, preserving single-pass behavior by default. Expansion is bounded before JSON parsing/byte allocation; resolved row/URL character limits are checked. Unsupported form bodies fail explicitly without serialization.

Checked official [Node header validator documentation](https://nodejs.org/api/http.html) and [URLSearchParams documentation for developer Node 22.18.0](https://nodejs.org/download/release/v22.18.0/docs/api/url.html). Header validator exceptions are caught and replaced with fixed errors; query append handles duplicates and encoding. No raw Node/JSON/SQLite exception is relayed.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64; developer Node 22.18.0 / npm 11.6.2. Desktop suite reports Electron 44.5.1, embedded Node 24.21.0 / ABI 149, Chromium 152.0.7977.130. Node then Electron native SQLite rebuilds ran sequentially; final binding targets Electron.

| Command/check | Actual result |
|---|---|
| Initial typecheck attempts | Exit 2; exact optional-property typing for the auth DTO/draft copy needed an explicit undefined case; corrected without casts/any |
| `npm run typecheck` after correction | Exit 0; also passed in both production builds |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` (initial) | Exit 0; 163 tests in 14 files |
| Same unit command after expansion limits | Exit 0; 164 tests in 14 files |
| Same unit command after active-environment check (final core code) | Exit 0; 164 tests in 14 files, including 8 materializer and 3 new auth/capture tests |
| `npm run lint` (final, after notice correction) | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Exit 0; native rebuild, production build/typecheck and all 12 Linux Electron tests passed, 40.5 seconds |
| `npm run build` after notice correction | Exit 0; main/preload/renderer build and strict typecheck passed |
| `npx playwright test tests/auth.spec.ts` after notice correction | Exit 0; targeted auth smoke passed, 3.1 seconds |
| Visual review | Inspected updated `/tmp/api-client-auth.png`: masked Bearer template input and credential limitation text; template-only auth has no standalone session-only warning |
| `git diff --check` | Exit 0 |

Screenshot is a temporary local artifact. Existing nonfatal Zod/Rollup annotation and Playwright color warnings remain. Initial failed checks were not counted as passes.

## Acceptance evidence

- Query tests preserve existing query and duplicate row order, encode `%2F` row input as `%252F`, encode Persian/space/slash values once, and leave input templates unchanged.
- Auth tests verify Bearer header and Basic base64 of UTF-8 username/password, resolved username-colon rejection, explicit Authorization allowed with None, and auth/header conflict rejection.
- Body tests verify raw Persian/emoji bytes and byte Content-Length, unchanged whitespace in substituted JSON, None versus empty Raw, blank/quoted-invalid JSON failure, GET/HEAD body rejection, +json support, raw Content-Type override and conflicting JSON type rejection.
- Validation tests cover managed headers, duplicate singleton headers, invalid token names/CRLF values, disabled malformed/missing rows, relative/userinfo/fragment/line-break URLs and unsupported schemes/forms. Missing/unavailable variables give field-specific errors with zero downstream snapshot consumption; no actual socket is opened by the tests or materializer.
- Snapshot tests verify frozen metadata/header arrays, defensive body-copy behavior, source immutability and stability after variable edits. Expansion beyond 5 MiB is rejected before JSON parsing; nested-looking substituted text stays literal.
- Repository/SecretStore tests verify literal auth absent from saved config/editor JSON, owned handles, keep preservation, transactional replacement rollback without leaked records, None cleanup, main-only sensitive variable resolution and unchanged saved templates. Missing session auth after restart remains masked and cannot materialize. Foreign environment capture fails.
- Real Electron auth UI smoke verifies None default, masked Basic inputs, explicit Save/Ctrl+S turning literals into stored markers, basic-field Save preserving credentials, restart/missing-state message, explicit replacement, Bearer template Save, None Save and disabled Send. Template-only notice correction passed an added assertion and targeted rerun.
- Existing body/fields, variables/two-workspace isolation, request failure/duplication/deletion, database recovery, capability, renderer security allowlist and layout/focus desktop checks passed in the full suite.

## Corrections and limitations

Screenshot review caught a session-only notice on template-only auth; it now appears only for stored credentials. Generic text still accurately explains the literal credential policy. This correction was verified with lint/build/typecheck and the targeted Electron smoke; unchanged core tests were not needlessly repeated.

No TASK-015 acceptance blocker remains. Real safeStorage was unavailable (`basic_text`) here; desktop credential evidence is session-only, while prior injected secure-store tests remain passing. Windows and packaged Linux/Windows apps were not tested. Materialization tests ran under developer Node; actual HTTP wire/socket behavior under Electron's embedded Node is not claimed. Materialization is a main-only service for the later execution pipeline, not yet connected to Send. No sockets, redirects, form serialization or actual response handling were implemented. Internet was not physically disconnected and no real credentials were used.
