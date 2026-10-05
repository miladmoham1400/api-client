# TASK-022 — Multipart text/file requests

Status: done
Date: 2026-10-05

## Inspection and scope

Read AGENTS.md, product.md, decisions.md, task-index.md, TASK-022, request-engine.md and ui-flows.md, plus architecture.md and ipc-contract.md. The initial working tree was clean. TASK-022 was the earliest unfinished task; dependencies TASK-020, TASK-021, TASK-017 and TASK-018 were done in both the index and their task files. Consulted the project Graphify skill/graph, then inspected source for materialization, transport, redirects, execution lifetimes, upload capabilities, persistence and body/controller state.

Implemented only multipart editing, serialization, streaming, preflight, redirect replay and associated persistence/resource handling. No TASK-023 navigation/close dialogs, transfer workflow, phase-2 feature, migration or packaging work was implemented.

## Changes

- Enabled validated multipart body drafts/editor snapshots, with ordered text/file rows, duplicate keys, enabled switches, row type selection, add/remove/reorder and accessible native file-selection controls. File display shows name/size and a reselection hint for saved metadata. Cancelled selection keeps the draft/old file without a failure toast. Keys/text values resolve variables only for enabled rows, with original row paths and resolved field limits.
- Body-mode caches deep-copy multipart rows and retain inactive drafts. Save persists only the active mode, strips file capability IDs and retains display metadata. The current editor independently retains its live selections after Save; ephemeral IDs do not make a saved draft dirty. Restart/opened saved file rows require selection again. Removed/replaced selections, discard, request changes and workspace teardown release editable capabilities. This does not change existing navigation guards.
- Added a private replayable streaming-body interface while preserving existing defensive byte snapshots for other body modes. Main captures selected file capabilities independently from editable handles, preflights all enabled files before accepting and again before each connection, and closes preparation descriptors immediately. Editing/releasing a draft selection cannot change an accepted execution. Captured variables/text remain unchanged across redirects.
- Main file adapters read asynchronously in chunks no larger than 64 KiB; renderer receives only capability/display metadata. Closing during an outstanding read defers descriptor closure until its callback returns, avoiding descriptor reuse races. No complete upload file is read into renderer or materialized into bodyBytes.
- The maintained encoder owns multipart delimiters, generated boundary, UTF-8 part headers, escaping and calculated Content-Length. An ordered FormDataLike adapter preserves interleaved duplicate keys. Explicit enabled multipart Content-Type is rejected; existing engine-managed framing rules remain. The exact serialized length must be at most 55 MiB; streaming also verifies the emitted length/limit. Single-file 20 MiB and enabled selected-row 50 MiB limits still apply.
- Native transport pipelines the upload with backpressure and destroys/closes resources on response completion, cancellation, timeout, errors and early terminal responses. Body errors remain sanitized domain errors. Allowed 307/308 redirects reopen file streams with the captured boundary/parts; POST-to-GET rewrites drop the source and entity headers. Existing credential stripping, downgrade and hop policies remain in place.
- Updated the IPC contract's obsolete text-only body paragraph to reflect completed URL-encoded support and this task's multipart support. Documented the encoder decision and exact toolchain additions. No generic IPC, arbitrary renderer/import path access or browser networking was added.

## Dependencies and official-source verification

Verified exact stable versions with `npm view` against the official npm registry before installation: runtime **form-data-encoder 4.1.0**, test-only **busboy 1.6.0** and **@types/busboy 1.5.4**. Encoder Node >=18 and parser Node >=10.16.0 requirements fit both project runtimes. `npm install --save-exact form-data-encoder@4.1.0` and `npm install --save-dev --save-exact busboy@1.6.0 @types/busboy@1.5.4` succeeded and each reported zero vulnerabilities. Package/lockfile pins and integrity records were updated; no existing package was upgraded. `npm ls ... --depth=0` confirmed those three versions.

Consulted the official encoder [release](https://github.com/octet-stream/form-data-encoder/releases/tag/v4.1.0), [API/source](https://github.com/octet-stream/form-data-encoder), FormDataLike/FileLike interfaces and installed implementation for streaming, calculated length, boundary ownership and escaping. Consulted official [Busboy documentation](https://github.com/mscdex/busboy) for streaming parsing and UTF-8 part parameter decoding. Fixture parsing uses an independent library, not handcrafted multipart encoding.

## Actual checks

Environment: Ubuntu 24.04.3 LTS x64/X11; developer Node 22.18.0 and npm 11.6.2; Electron 44.5.1 with embedded Node 24.21.0, ABI 149 and Chromium 152.0.7977.130. Unit tests rebuilt SQLite for developer Node, then desktop checks rebuilt it for Electron. Final native bindings target Electron. Desktop checks launched the built local app with Chromium sandbox enabled, temporary application storage and loopback fixtures. Native/loopback checks used execution sandbox escalation; no production sandbox bypass was introduced.

| Check | Actual result |
|---|---|
| `npm run typecheck` | Passed; also passed inside final build |
| `npm run lint` | Final run passed |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | Final run: 274 passed in 24 files; 2.66 seconds |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Electron rebuild and production build passed; all 19 desktop tests passed, reported duration 1.2 minutes |
| Focused native multipart/capability smoke | After fixing chooser timing, both `tests/multipart.spec.ts` and `tests/uploads.spec.ts` passed; 16.5 seconds |
| `python3 scripts/graphify.py update` | Passed: 818 nodes, 2,439 edges, 42 communities; code-only local extraction. Generated output remains ignored. |
| `git diff --check` | Passed |
| Screenshot inspection | Inspected `/tmp/api-client-multipart.png`: successful multipart response, redirect count and editor/response scroll panes fit the 1280×720 desktop. Multipart row interactions were exercised in the UI smoke; the captured viewport showed the editor header and response. Temporary screenshot is not committed. |

Initial typechecks exposed a union-narrowing issue in body copies and an incomplete test storage-backend fixture; corrected both. Lint caught a test variable that should be const; corrected it. The first native UI smoke failed because the chooser stayed open after rapid Return confirmations. A retry passed; inspection confirmed the typed fixture location. The helper now checks chooser visibility and retries GTK's asynchronous location confirmation with a bounded timeout. Focused and complete desktop suites then passed. Existing non-fatal Zod/Rollup PURE annotation and Playwright color warnings appeared.

## Acceptance evidence

- `tests/main/multipart.test.ts` with `tests/fixtures/multipart.ts`: native HTTP delivers exact interleaved duplicate text/file fields, Persian/emoji keys and filenames, UTF-8 values, empty text/file content and binary file bytes. Parsed Content-Type has the generated boundary and Content-Length matches actual bytes. Library escaping prevents quoted/newline names from injecting headers or extra parts. Source mutations do not change captured text.
- Real 307 and 308 fixtures receive identical parts, bytes and boundary on replay, using newly opened descriptors even after releasing the draft capability. Real 301/302/303 fixtures rewrite POST to GET without multipart/entity headers. Descriptors are closed after preparation and terminal transfers.
- Limit tests reject above 20 MiB/file, above 50 MiB selected rows, and a valid-row configuration with 50 MiB files plus text exceeding 55 MiB serialized payload. Missing selections, missing files and changed-size files produce sanitized errors; a file changed between acceptance and start fails before any socket connection. Disabled file/text rows need no selection/variable values. Explicit Content-Type and managed Content-Length reject before I/O.
- Backpressured 20 MiB fixture tests cancel and time out real streaming uploads under developer Node. They verify descriptor closure, one terminal completion per execution and a released active slot. Repeated Cancel remains idempotent. Resources are polled until pending read callbacks have closed their descriptors.
- Actual SQLite close/reopen retains display metadata without native paths/capabilities and materialization requires reselection. Shared body-state tests verify independent cached/saved row copies, retained live selections, metadata-only comparisons and rejection of arbitrary path properties.
- `tests/multipart.spec.ts`: real sandboxed Electron editor/native chooser selects and cancels, edits/reorders/disables rows, resolves Unicode text, sends an unsaved file body through a 307 replay without implicit Save, retains the selection across mode switches and Ctrl+S, then relaunches and requires fresh selection without issuing a request. Reselection enables sending; type conversion/removal works; explicit Content-Type prevents another fixture request. This exercises encoding/file replay under embedded Node 24.21.0. Existing isolation, transport, cancellation, auth, response-safety, persistence and Electron-boundary smoke regressions also pass.

## Limitations and blockers

No remaining blocker for TASK-022. Windows, Wayland/portal variants and installed/package-specific acceptance were not run and are not marked passed. The native chooser smokes explicitly skip outside Linux/X11; a skip is not another-platform pass. The backpressured file cancellation/timeout tests run under developer Node; the Electron multipart smoke verifies successful native file selection, upload, replay and persistence. No renderer memory benchmark is claimed: the validated bridge carries metadata only, the snapshot has no buffered file body, and source inspection confirms bounded main-only file reads.

Same-size filesystem content changes and post-stat changes are not immutable file snapshots, as already documented. FormData encoder semantics normalize text line endings to CRLF and escape quote/CR/LF in part names; file bytes are unchanged. Actual Linux safeStorage reported unavailable/basic_text with session-only secrets; no secure backend round-trip is claimed. No upload history, persistent file paths, cookie jar, import/export implementation or later task was added.
