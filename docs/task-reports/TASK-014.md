# TASK-014 — Environments and variables management

Status: done
Date: 2026-10-05

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-014, variables, secrets, UI flows and IPC contract. Inspected repositories, SecretStore, shared DTOs, owned handlers, preload, workspace/request controllers, shell and tests. TASK-014 was the earliest unfinished task; TASK-007, TASK-012 and TASK-013 were done. Initial working tree was clean.

Implemented environment CRUD/selection and scoped variable management only. No auth editor, send/materialization integration, global variables, scripts, automatic extraction, export, package changes or schema changes.

## Changes

- Added strict environment/variable snapshots and explicit frozen preload groups. Arguments and results are validated; main verifies owned sender, active workspace and environment/variable ownership. Secret IDs and ciphertext never enter these DTOs.
- Environment service creates, renames, deletes and selects environments; None is explicit. Selection preserves the selected request and remains stored per workspace. Deleting an active environment selects None and removes its variables/secrets in one SecretStore owner transaction. Environment count/name and variable scope/key/value limits are enforced.
- Variable creation rejects an existing key in its scope. Updates require a matching owned ID, scope and key; UI keeps existing keys fixed while editing values/sensitive designation. Empty string and case-sensitive keys are supported. Delete and sensitive/plain conversion clean up orphan records/session values transactionally.
- Sensitive lists expose masked presence/storage metadata. Plain values stay visible. Explicit Edit/Reveal retrieves a local value through a validated owned handler; missing session values offer blank re-entry. Masked list/effective preview never decrypts. Decrypt failure remains a sanitized error without deleting its record.
- Effective preview merges workspace and selected environment metadata with environment priority, including empty overrides, and labels its source. It excludes inactive and foreign scopes; it does not resolve templates or send requests.
- Top environment selector and Variables button replace unavailable controls. The scrollable Chakra dialog contains environment management, deletion consequence/confirmation, explicit Workspace/selected-environment scope, editable plain/password inputs, sensitive toggle, masking/reveal/hide, storage/missing-value messages and effective preview.
- UI busy guards serialize operations. Workspace-keyed state and generation guards discard stale results; close, scope changes and workspace changes clear revealed/editor values. Dialog returns focus to Variables. Request draft and saved templates are not rewritten by variable/environment changes. About text and IPC contract reflect the capability.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, developer Node 22.18.0 / npm 11.6.2. Actual Electron suite reports Electron 44.5.1, embedded Node 24.21.0 / ABI 149, Chromium 152.0.7977.130. Node then Electron SQLite rebuilds ran sequentially; final binding targets Electron.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` | Exit 0; repeated successfully during final production build |
| `npm run lint` (final) | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` (initial) | Exit 0; 152 tests in 13 files |
| Same unit command after secure-variable reopen test | Exit 0; 153 tests in 13 files, including 6 new variable-management tests |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Exit 0; native rebuild, production build/typecheck and all 11 Linux Electron tests passed, 54.2 seconds |
| Visual review | Inspected `/tmp/api-client-variables.png`: environment None, Workspace scope, masked sensitive row and session-only explanation in scrollable dialog |
| `git diff --check` | Exit 0 |

Real safeStorage capability was unavailable with `basic_text`, so this desktop run exercised session-only values and re-entry. Secure OS round-trip checks were null/skipped, not passed. Existing nonfatal Zod/Rollup annotation and Playwright color warnings remain. Screenshot is a temporary local review artifact.

## Acceptance evidence

- Main/repository tests verify environment create/rename/select, per-workspace restoration after database reopen, empty environment override, case-sensitive keys, None fallback and duplicate scope-key rejection. Preview contains only owned selected scopes.
- Sensitive list JSON excludes synthetic plaintext and secret IDs; explicit owned reveal returns the value. New session store reports missing presence/reveal. Conversion/deletion removes secret records.
- Environment deletion failure via a SQLite trigger retains active selection, variable record and live sensitive value; retry removes the environment/descendants and selects None atomically.
- IPC tests reject foreign scopes, inactive workspaces, foreign senders, malformed keys and oversized values without writes. Existing exact frozen API security assertions now include environments/variables and passed in Electron.
- Injected secure AES-GCM provider verifies sensitive variable persistence/reopen with masked list and explicit reveal. This is not real OS secure backend evidence.
- Two-workspace real Electron UI smoke creates workspace and environment variables, rejects duplicate creation, verifies masked list then explicit reveal/hide, creates/renames/selects environment, saves an empty override and checks its effective source. Workspace B starts empty and retains its independent value. Switching/restarting restores A's environment; missing sensitive session value is visible and can be re-entered. Active environment deletion selects None; B remains isolated. Close restores Variables-button focus.
- Existing request/body/field persistence, workspace/collection CRUD, database recovery, capability, sandbox/API denials and layout/focus desktop tests all passed.

## Limitations and blockers

No TASK-014 acceptance blocker remains. Windows and packaged Linux/Windows apps were not tested. Real secure storage was unavailable, so secure reopen is verified only with the injected provider; the desktop suite exercised the session-only branch. Internet was not physically disconnected. The effective preview is metadata/text precedence, not a sent request; no sockets or materialization were added. Auth and actual send snapshot loading remain TASK-015 and later tasks. Ordinary unmarked values remain plaintext by design. No real credentials were used.
