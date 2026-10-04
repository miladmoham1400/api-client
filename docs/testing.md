# Verification strategy

## Principles

Use local fixture servers; tests must not call public APIs or rely on internet. Use ephemeral ports and temporary databases/userData. Test meaningful product behavior. Each task records checks it actually ran; planned checks are not evidence.

## Fixture endpoints

| Endpoint | Behavior |
|---|---|
| /echo | Method, raw query, parsed ordered fields, headers and body; synthetic credentials only |
| /status/401 and /status/500 | HTTP errors with readable body |
| /delay | Delayed response for cancel and timeout |
| /redirect and /cross-origin | Same/cross-origin hops, POST/303 and 307 replay |
| /loop | More than five redirect hops |
| /gzip, /br, /bad-encoding | Valid/corrupt compressed responses |
| /large and /compressed-large | Encoded/decoded limit enforcement |
| /html | Literal HTML/script payload for safe display |
| /binary and /empty | Binary and zero-byte response |
| /multipart | Parse text, duplicate fields, uploaded bytes and filenames |

Add local HTTPS fixture with a test-only self-signed certificate for TLS rejection and downgrade tests. Production verification stays enabled; fixture transport injection may use a test trust CA without adding a UI bypass. Never embed real credentials.

## Test layers

- Pure unit: variable resolution, one-pass substitution, schema limits, auth/header conflict, serialization, redaction.
- Repository integration: migrations, isolation/ownership, partial unique keys, cascade operations, rollback and persisted selections.
- HTTP integration: exact method/query/body bytes, form/files, statuses, redirects, origin credential stripping, timeout/cancel races, decompression and binary classification.
- Electron smoke: preload boundary, native binding, startup, saved data reopen, file dialog/upload capabilities, dirty draft and response display.
- UI focused/manual: keyboard/focus, light/dark, field errors, state transitions. Do not snapshot every Chakra component.

## Required acceptance matrix

| Check | Linux package | Windows package |
|---|---|---|
| Start with internet disconnected | required | required |
| Create/save/restart preserves data | required | required |
| Two workspaces cannot cross-read/update | required | required |
| Environment precedence and missing variables | required | required |
| Local GET/JSON/form/file sends | required | required |
| Cancel/timeout followed by successful send | required | required |
| 401/500 displayed as responses | required | required |
| Import/export exclusions and round-trip | required | required |
| TLS error remains enforced | required | required |
| Native SQLite loads from packaged app | required | required |
| Safe response text, no resource execution | required | required |

Prove offline behavior with egress blocked or internet disconnected while loopback remains available. Record OS/build/package hash and method; a mock of online status is insufficient. CI may automate what it can and document remaining physical GUI checks.

## Evidence format

Task report: date, environment/versions, commands, exit codes, result summary, screenshots/log excerpts only if useful and sanitized, criteria satisfied, unexecuted checks and blockers. Release acceptance in docs/release-acceptance.md has per-OS pass/fail/not-run and reproducible steps. Never convert `not-run` to pass.
