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

## Reproducible local offline acceptance (Linux)

Run `npm run test:unit` first (rebuilds SQLite for developer Node), then `npm run test:offline` (rebuilds SQLite for Electron, builds and runs the complete desktop suite). Never run native rebuilds concurrently. For an existing Electron build, `bash scripts/test-offline.sh tests/offline.spec.ts` runs the focused story.

The offline runner requires Linux, `unshare`, `ip`, a non-root user, working user/network namespaces and the local graphical display. It creates a private network namespace, brings up only loopback, then maps the invoking UID/GID into an inner user namespace for sandboxed Electron. It changes no host interfaces/routes/firewall. The app, fixture servers and Playwright all inherit the isolated network: IPv4/IPv6 non-loopback egress has no interface/route. The focused test checks only `lo` exists, the IPv4 routing table is empty and a documentation-address TCP probe fails with `ENETUNREACH`; loopback sends must succeed. A namespace setup failure is a failed prerequisite, not offline acceptance. Restricted execution environments may require permission to create namespaces and access the GUI.

`tests/offline.spec.ts` intentionally skips outside this runner; that skip is not evidence. It verifies startup, environment precedence, sensitive auth, explicit send, cancel/timeout/error recovery, normal close/reopen, workspace isolation, safe export/import and explicit credential/file recovery. The complete desktop suite also covers negative fixtures, forms/files, redirects, safe response text and boundary validation under the same egress block. Fixtures contain synthetic data only; temporary app data/files are removed. No production sandbox or TLS bypass is used.

This source-built Electron check does not satisfy the independent Linux/Windows packaged-app matrix. Record the actual OS/display/storage capability and not-run targets in the task report. Secure-backend doubles establish conditional unit behavior; they do not prove availability of a real OS credential backend.

## Approved next milestone: large nested API library

TASK-031–037 require focused multi-request, migration/ownership/cycle, guarded navigation, large-tree/search, transfer v1/v2 and independent packaged acceptance checks. Use the specified 1,000-request/1,000-folder synthetic baseline, measured readiness/timing methodology and no auto-send assertions. Retain all existing HTTP/security/offline tests; this addition is a plan, not test evidence. See [API library specification](api-library.md) for the authoritative new behavior, bounds, intermediate export gate and task mapping. Migration, folder/tree and bounded-search source checks are recorded in TASK-032–035 reports. TASK-035 records the reproducible fixture, actual timing samples and its earlier cold-target failure followed by measured optimization. TASK-036 records strict v1/v2 transfer and native Linux source-app evidence. TASK-037 independently reruns acceptance against fresh package bytes; source evidence does not pass installed/package/platform gates. Its report records actual new checks and required not-run blockers.
