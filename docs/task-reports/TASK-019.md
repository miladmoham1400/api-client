# TASK-019 — Response viewer and execution feedback

Status: done
Date: 2026-10-05

## Scope and inspection

Read AGENTS.md, product.md, decisions.md, task-index.md, TASK-019, request-engine.md and ui-flows.md. TASK-019 was the earliest unfinished eligible task: TASK-018 and TASK-006 were done. The initial working tree was clean. Inspected the existing shell, execution subscription/controller, validated response DTO, fixtures and desktop tests before editing.

## Changes

- Replaced the response placeholder with status/message, elapsed milliseconds, decoded byte count, final URL/redirect count, Body/Headers tabs and ordered raw headers. Duplicate headers remain separate lines.
- Text bodies and header values use React text children, including HTML and scripts. Binary bodies show byte count, content type and classification reason. Transport failures and neutral cancellation show no invented HTTP status; existing execution code/message feedback remains in the editor.
- Raw is the default and remains unchanged. Pretty is opt-in JSON formatting, limited to 65,536 UTF-16 code units of input and 1 Mi characters of output; invalid/deep/large input falls back to Raw with an explanation. Formatting is cached only for the current response.
- Retained the validated terminal result in renderer memory, associated with the execution ID and the captured name/method/URL template/environment label. Draft comparison is ephemeral and shows when the editor differs from the sent snapshot. Results clear on a new send/workspace change and are never written to SQLite. Main-process resolved variables/credentials remain private.
- Added bounded-format unit tests and a real Electron response fixture test; updated the cancellation test's obsolete placeholder expectation. No packages, lockfile, main transport, IPC capabilities, persistence schema or later tasks changed.

## Actual checks

Environment: Ubuntu 24.04.3 LTS x64; developer Node 22.18.0, npm 11.6.2; Electron 44.5.1, embedded Node 24.21.0, ABI 149, Chromium 152.0.7977.130. Native SQLite rebuilt separately for developer Node and Electron. Desktop tests launched the built local application with Chromium sandbox enabled, temporary application storage and local loopback fixtures.

| Command / review | Actual result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | 237 tests passed in 20 files; 2.12 seconds |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Electron rebuild and production build passed; 16 desktop tests passed; 47.1 seconds |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npx playwright test tests/response-viewer.spec.ts` after strengthening stale-event evidence | Final targeted run: 1 passed; 4.6 seconds. Earlier screenshot/replay refinement run also passed, 4.5 seconds. |
| `git diff --check` | Passed |
| Visual review | Inspected actual desktop screenshots of Raw, Pretty, transport error and cancellation. Pretty body reviewed after scrolling the response pane; text and controls remained readable. Actions were driven by Playwright, followed by visual screenshot inspection, rather than a separate human-operated desktop session. |

Non-fatal existing output: Rollup removed misplaced PURE annotations in Zod dependencies; Playwright reported NO_COLOR/FORCE_COLOR precedence. No check failed. The native/desktop fixture checks required execution outside the filesystem sandbox for native rebuild, loopback sockets and real Electron.

## Acceptance evidence

| Criterion | Evidence |
|---|---|
| 401/500 are normal responses | Real loopback HTTP 401 and 500 displayed status/body, with no transport alert. |
| Invalid JSON Raw remains usable | Invalid JSON remained byte-for-text identical after Pretty; large text also remained available with bounded-format explanation. Unit tests cover valid UTF-8 content, invalid/non-JSON input and excessive nesting/expansion. |
| Duplicate Set-Cookie preserved | UI raw headers contained both synthetic cookie lines consecutively, in original order. These are public fixture values, not credentials. |
| HTML is literal text | Script/image payload matched the response text exactly; no script/img/iframe element appeared in the response region, no execution flag was set and no renderer HTTP request occurred. |
| Old completion cannot overwrite newer state | Replayed an actual previous completion through main's completion channel while a newer request was pending and again after it completed. Confirmed replay receipt in an independent preload subscriber, then confirmed the newer captured body remained intact. |
| No response persists after restart | Explicitly saved request configuration after a successful response, closed Electron and relaunched with the same application storage. Response area was empty and no response body existed. |
| Snapshot association | Edited the URL during a delayed request: response label retained the original URL and displayed the changed-draft notice; completion showed the captured response. |
| Metadata / distinct states | Verified final redirect URL and one hop, decoded size, JSON modes, binary size/type, connection-reset error and cancellation. Existing timeout/keyboard test passed with the live response viewer. |

Temporary visual artifacts: `/tmp/api-client-response-raw.png`, `/tmp/api-client-response-pretty.png`, `/tmp/api-client-response-error.png`, `/tmp/api-client-response-cancel.png` (not committed).

## Limitations and remaining blockers

No blockers for TASK-019. Windows, packaged installation, offline installed-app acceptance and independent OS release smoke tests were not performed; no claims of passing those checks. This Linux environment reports safeStorage unavailable/basic_text and uses session-only secrets; no secure backend round-trip is claimed. Pretty intentionally excludes large/deep JSON and preserves Raw. No binary download, HTML preview, response history, scripts, forms/uploads, draft-navigation dialogs or subsequent task work was implemented.
