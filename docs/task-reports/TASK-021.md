# TASK-021 — Upload file capabilities

Status: done
Date: 2026-10-05

## Inspection and scope

Read AGENTS.md, product.md, decisions.md, task-index.md, TASK-021 and its architecture, request-engine and IPC specifications. Initial working tree was clean. TASK-021 was the earliest unfinished task; TASK-013 and TASK-019 were done. Inspected owned IPC guards, preload contracts, workspace deletion, stored/runtime multipart schemas, persistence, materialization and existing security tests before editing. Consulted the existing local Graphify graph and then the actual source.

Implemented only native file selection, main-owned capabilities and pre-send file validation. No multipart editor/serializer/transport, import workflow, directory upload, persistent file paths or later task was implemented.

## Changes

- Added validated fixed `files.chooseUpload(workspaceId)` and `files.releaseUpload(workspaceId,fileId)` bridge methods. Native selection returns only `{fileId,name,size}`; cancellation returns successful `null`. Input UUIDs and strict output DTOs are checked in preload and main. No renderer-selected paths or generic IPC command runner are exposed.
- Added the main-only registry in `src/main/files/uploads.ts`, following the architecture's file responsibility. Random capability IDs carry private workspace/path/size information only in memory. Existing workspace ownership is verified on selection, release and preparation. Forged/released and foreign-workspace IDs share sanitized `FILE_REQUIRED` responses.
- Selection opens and inspects the actual descriptor: readable regular files only, including empty files, maximum 20 MiB. The main-only `openForSend` preparation reopens every enabled file, verifies regular-file status/readability/size and the 50 MiB selected-row total, and returns private closeable descriptors. Disabled rows require no capability; renderer-supplied size/name cannot authorize a file. Failed batch preparation closes descriptors already opened. Errors identify the original row without paths or raw OS messages.
- Renderer reload/crash, window close, application exit and workspace deletion invalidate capabilities. Generations also invalidate outstanding native dialogs. The asynchronous IPC guard rechecks sender/window/main-frame ownership after awaiting selection.
- Existing strict stored/import schemas remain unchanged: they accept display name/size and reject file handles and path fields. Added actual SQLite close/reopen evidence for metadata-only persistence and required reselection.
- Documented the file bridge in ipc-contract.md. Added focused main/preload tests and a real native chooser smoke. The test-only Python helper uses system X11/XTest libraries and synthetic temporary files; it is documented in tests/fixtures/README.md and is not part of the application runtime.
- No packages, lockfile changes or migrations. Checked official [Electron dialog documentation](https://www.electronjs.org/docs/latest/api/dialog) for asynchronous parent-owned single-file selection, cancellation and the Windows-only recent-documents option; checked official [Node filesystem documentation](https://nodejs.org/docs/latest-v24.x/api/fs.html) for descriptor open/stat/close and nonblocking flags. Compatibility was exercised with the repository's pinned toolchain.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, X11; developer Node 22.18.0 / npm 11.6.2; Electron 44.5.1 with embedded Node 24.21.0, ABI 149 and Chromium 152.0.7977.130. SQLite was rebuilt sequentially for developer Node and then Electron; final native bindings target Electron. Desktop tests launched the built local application with Chromium sandbox enabled and temporary application storage. Native and loopback checks used execution sandbox escalation; no production sandbox bypass was added.

| Command | Actual result |
|---|---|
| `npm run typecheck` | Passed, also repeated in final production build |
| `npm run lint` | Passed after final source relocation |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | Final run: 260 passed in 23 files; 2.30 seconds |
| `npm run test:smoke` | Electron rebuild/build passed; all 18 desktop tests passed in 58.0 seconds |
| `npm run rebuild:electron && npm run build && npx playwright test tests/uploads.spec.ts tests/security.spec.ts` | Repeated after moving the file registry to the documented main/files location: build and both tests passed; 7.1 seconds |
| `python3 scripts/graphify.py update` | Passed; final source graph: 768 nodes, 2,272 edges, 31 communities. Generated output remains ignored; no model/cloud extraction. |
| `git diff --check` | Passed |

An initial typecheck caught overly narrow inferred UUID fixture set typing; corrected the fixture to `Set<string>`. The first native smoke timed out after typing a file: GTK requires a second Return to accept the selected location. Corrected only the test helper; the focused smoke subsequently passed, followed by the full suite and final repeated smoke. Existing non-fatal Zod/Rollup PURE annotation and Playwright color warnings appeared.

## Acceptance evidence

- `tests/main/uploads.test.ts`: readable Unicode-named temporary file gives metadata-only selection and readable private descriptor; cleanup is idempotent. Forged/cross-workspace/released handles reject. New service/reload/deletion require reselection; pending selections cannot survive invalidation. Missing, changed-size, unreadable, replaced-by-directory and oversized files fail during preparation with row-specific errors. Selection rejects directories and files above 20 MiB. Repeated enabled rows count toward the 50 MiB sum; disabled rows need none.
- The same tests save only file name/size into SQLite, reopen it, retain that metadata, confirm absence of the native path/capability in stored JSON and reject sending without selection. Stored/export schemas reject handle and arbitrary path properties.
- `tests/preload/files.test.ts`: arbitrary paths are rejected before IPC, commands are fixed, methods are frozen and an unexpected path in outgoing metadata is rejected without disclosure.
- `tests/uploads.spec.ts`: actual Linux chooser selects the fixture and cancels normally. Renderer receives exactly fileId/name/size. Foreign/forged IDs reject. A live capability becomes invalid after reload; a freshly selected capability becomes invalid after full application restart; deleting its workspace rejects subsequent access. This smoke calls the bridge directly because the multipart UI belongs to TASK-022.
- Existing `tests/security.spec.ts` verifies the enlarged frozen allowlist while preserving sandbox, context isolation, absent Node/raw IPC, denied browser networking and owned-window enforcement. Existing desktop regressions all passed.

## Limitations and blockers

No remaining blocker for TASK-021. Windows, Wayland/portal variants and installed/package smoke tests were not executed and are not marked passed. The native smoke explicitly skips outside Linux/X11; a skip is not platform acceptance. Real safeStorage in this environment remains unavailable/basic_text with session-only secrets; no secure backend round-trip is claimed.

`openForSend` is verified preparation infrastructure, not an implemented multipart network path. TASK-022 must use its descriptors before connecting, serialize safely, enforce the 55 MiB complete payload limit, and close/reopen streams for cancellation and redirects. No actual multipart upload or 55 MiB multipart payload is claimed here. Same-size content changes and changes after the pre-send stat are not immutable snapshots, as documented in request-engine.md.

Pre-existing IPC documentation's request-body paragraph still describes text-only editable modes, whereas completed TASK-020 and the existing shared contract support URL-encoded forms. This contradiction does not affect file capabilities; existing URL-encoded behavior was preserved and its regression smoke passed. No alternative behavior was introduced for that unrelated paragraph.
