# TASK-011 — JSON/raw body editing

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-011, request engine and UI flows. Inspected shared body/request contracts, main persistence service, renderer controller/editor and existing tests. TASK-011 was the earliest unfinished task; TASK-010 was done. Initial working tree was clean.

Implemented None/JSON/Raw body editing only. No forms/files UI, variable resolution, JSON materialization, wire serialization, transport or auth UI. Dependencies, lockfile and database schema are unchanged.

## Changes

- Body tab has an accessible mode selector, JSON/Raw text area, UTF-8 byte count and raw media-type input (default `text/plain`). New requests retain the documented None default. Text is stored without JSON parsing, formatting or template substitution.
- Separate session-only JSON/Raw caches retain inactive text and media type while switching modes and after successful Save. Create, request load, Discard and restart reset caches. Only the active discriminated body is included in the Save payload; None contains no text fields.
- Shared create/save schemas and existing validated preload/IPC handlers accept an optional active text body. The supplied body rejects GET/HEAD bodies, text over 5 MiB in UTF-8 and invalid raw media types. Inline sanitized errors identify `body`, `body.text` or `body.mediaType`; failed validation retains the draft.
- Main persists active text bodies and returns them in editor DTOs. Omitted body preserves stored configuration for existing partial-save callers. Unsupported stored form bodies remain in main and return null in this editor boundary; the UI explains preservation until an available mode is explicitly selected. No forms or file capabilities were added.
- Empty JSON can be saved as an editing draft and is distinct from None. UI explains that empty JSON cannot be sent and JSON syntax validation occurs after variable substitution. Syntax checking at save would reject unresolved templates and is deliberately deferred to materialization.
- Existing ownership, explicit Save/Ctrl+S, navigation locks and unavailable Send behavior remain. About text and IPC documentation reflect the new capability.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64; developer Node 22.18.0 / npm 11.6.2. Smoke output reports Electron 44.5.1, embedded Node 24.21.0 / ABI 149, Chromium 152.0.7977.130. SQLite rebuilds ran sequentially for Node then Electron; final binding targets Electron.

| Command/check | Actual result |
|---|---|
| `npm run typecheck` | Exit 0; repeated successfully in production build |
| `npm run lint` | Exit 0 |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` (initial) | Exit 0; 126 tests passed in 10 files |
| Same unit command after adding stored-form preservation regression | Exit 0; 127 tests passed in 10 files |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Exit 0; Electron native rebuild, production renderer/main/preload build and all 9 Linux desktop tests passed, 45.8 seconds |
| Visual review | Inspected `/tmp/api-client-body.png`: saved POST request, Body selector set to None, scrollable editor and unavailable Send/response state |
| `git diff --check` | Exit 0 |

No failed check was counted as passed. Existing nonfatal Zod/Rollup annotation and Playwright color-environment warnings appeared. Screenshot is a temporary local review artifact.

## Acceptance evidence

- Focused state test switches JSON -> Raw -> None -> JSON -> Raw and verifies exact cached text/media type, with only the selected mode in the active body and validated save payload.
- Schema test distinguishes empty JSON from None, accepts unresolved templates without substitution, accepts the exact 5 MiB ASCII boundary, rejects oversized Persian UTF-8 text with `body.text`, rejects GET/HEAD bodies and malformed media type, and rejects extra inactive text on None.
- Temporary SQLite tests verify unchanged whitespace/Unicode/template JSON source, preservation on partial save, rejected HEAD-body save without altering the previous body, and raw Persian/emoji text with media type after database close/reopen. A separate regression verifies unsupported stored form body preservation without exposing its configuration through this text editor.
- Real Electron smoke verifies None default, actionable GET-body and raw media-type errors, source text retention through mode switching, successful Ctrl+S of JSON, retention of inactive Raw text after that Save, raw Save/restart with Unicode unchanged, and absence of the unsaved inactive JSON source after restart. It explicitly saves and checks empty JSON, then None, as different DTOs. Send stays disabled.
- Existing field, request failure/duplication/deletion, workspace/collection persistence and isolation, security allowlist, database startup, layout and focus desktop checks also passed.

## Limitations and blockers

No TASK-011 acceptance blocker remains. Windows and packaged Linux/Windows apps were not tested. Desktop evidence uses the built local repository app on Linux; internet was not physically disconnected. No HTTP body bytes were sent and no JSON post-substitution validation or transport behavior is claimed. Inactive mode content is session-only and deliberately absent after restart. Final navigation/OS-close decisions remain TASK-023. No real credentials were used.
