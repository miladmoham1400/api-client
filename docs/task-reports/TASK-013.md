# TASK-013 — Secure and session-only secret store

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-013, secrets, data model and architecture. Inspected secret repositories, staged request lifecycle, workspace deletion, Electron startup/shutdown and existing tests. TASK-013 was the earliest unfinished task; TASK-005 was done. Initial working tree was clean.

Implemented a main-only SecretStore and integrated its lifecycle with startup, requests, workspaces and shutdown. No variables/auth UI, renderer reveal API, master password, blanket database encryption, login requirement, send pipeline or export implementation. No package, lockfile or schema changes.

## Changes

- Injected safeStorage-compatible backend checks encryption availability and, on Linux, excludes `basic_text` and `unknown`. Capability exceptions yield session-only mode. Secure operations encrypt before writing ciphertext BLOBs; encryption errors fail explicitly without plaintext fallback. Session mode persists only a null-ciphertext record and holds values in main memory.
- Owned create/update/unresolved/reveal/presence/delete methods use existing repositories. Foreign IDs fail without revealing values. Decrypt failure or missing session value raises sanitized SECRET_UNAVAILABLE and preserves the record. Presence is masked metadata and does not decrypt; secure presence indicates stored material and available capability, not proof that ciphertext can decrypt.
- Synchronous owner transactions stage memory changes and restore the prior session map on failure. Owner creation/conversion/deletion should run through `store.transaction` with its repository writes; orphan session entries are pruned inside that transaction. Standalone operations reject an already-open unmanaged transaction. This prepares variable/auth services without implementing their UI.
- Request lifecycle hooks independently clone values and re-encode copied records according to current capability. Missing session values remain missing in independent copies; secure decryption failure rolls duplication back. Session duplication/removal changes publish only after the request transaction commits. Existing basic editor DTOs contain no auth values or handles.
- Main creates the store after Electron ready/database open, passes it into request and workspace services, clears committed workspace session values after deletion and clears memory on shutdown. No new IPC/preload method or plaintext logger was added.

Verified the [official Electron safeStorage documentation](https://www.electronjs.org/docs/latest/api/safe-storage): synchronous availability/backend APIs identify Linux's insecure fallback, while encryption returns a Buffer. The current implementation uses synchronous APIs to fit the existing synchronous SQLite/lifecycle transaction interface; Electron recommends async APIs and documents possible OS-store blocking. An async migration would require changing transaction staging and is not claimed here. No plaintext-encryption override is used.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64; developer Node 22.18.0 / npm 11.6.2. Actual smoke output: Electron 44.5.1, embedded Node 24.21.0 / ABI 149, Chromium 152.0.7977.130. Native SQLite rebuilds ran sequentially for Node then Electron; final binding targets Electron.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` (initial implementation) | Exit 0 |
| Typecheck after first tests | Exit 2; a narrowed credential union was lost inside a test closure; captured the validated secret ID before the closure |
| `npm run typecheck` after correction | Exit 0; also passed in final production build |
| `npm run lint` (final) | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` (initial) | Exit 0; 145 tests in 12 files |
| Same unit command after presence/rollback regressions | Exit 0; 147 tests in 12 files, including 12 secret-store cases |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Exit 0; Electron rebuild, main/preload/renderer production build and all 10 Linux Electron tests passed, 46.5 seconds |
| `git diff --check` | Exit 0 |

Actual real Electron capability: `available: false`, `backend: basic_text`, mode `session`. The smoke deliberately did not encrypt through this insecure backend: round-trip and ciphertext checks returned null, not passed. Ordinary startup/UI and the existing security allowlist remained functional; there is no renderer `secrets` API. Smoke diagnostics contain only capability booleans/backend/mode, not synthetic values.

Existing nonfatal Zod/Rollup annotation and Playwright color-environment warnings appeared. The failed typecheck was not counted as passed.

## Acceptance evidence

- Injected secure provider uses randomized AES-GCM test encryption. Secure value reveals correctly after database reopen; checkpointed database files contain no synthetic value as UTF-8 plaintext. Masked metadata contains no value/ciphertext. Foreign-workspace reveal is rejected.
- Injected unavailable, `basic_text` and `unknown` cases never invoke encryption, store null ciphertext and contain no synthetic plaintext in database files. A new store loses session values and reports missing presence/reveal. Capability exceptions also produce session-only mode.
- Encryption/decryption exceptions become fixed errors without synthetic values. Decrypt failure preserves the original record; update encryption failure preserves ciphertext. Masked presence never invokes decryption. The injected Windows branch checks availability without invoking Linux backend selection; this is not Windows OS validation.
- Sensitive variable owner transaction stores null plain value and an owned handle. Conversion to ordinary data removes its secret. Auth uses owned handles; foreign workspace reuse fails. These are main/repository tests, not variables/auth UI acceptance.
- Secure and session request duplicates have independent handles and values. Updating/deleting a copy leaves the original value intact. Missing-value duplicates stay unresolved. Changing capability from session to secure re-encodes copied content using the secure provider.
- Injected owner failure rolls back record and session updates; request selection failures roll back duplication/deletion while retaining the original session value. Secure duplication decrypt failure leaves only the original request/secret. Committed workspace deletion clears its records/session entries.
- Existing workspace, collection, request/body/field persistence, database recovery, renderer security and layout/focus smokes passed with real startup/lifecycle integration.

## Limitations and blockers

No TASK-013 implementation acceptance blocker remains. **Real OS-backed secure storage was unavailable here**, so secure persistence/reopen evidence is from the injected provider; real secure backend encryption/decryption is unverified. Windows and packaged Linux/Windows apps were not tested. The real Electron smoke checks capability and conditionally round-trip only when secure; it does not exercise secure SQLite persistence on this environment.

No actual credentials were used. Diagnostics evidence is fixed-error assertions, capability-only smoke output and inspection of code without plaintext logging, not an external logging-system audit. Ordinary URL/body/header/plain-variable text remains plaintext by design. Explicit reveal/edit IPC, storage messaging and actual variable/auth input integration remain TASK-014/015. Those services must use the provided owner transaction wrapper for cleanup; session-only values intentionally disappear after shutdown. No transport, export, physical internet disconnection or release acceptance is claimed.
