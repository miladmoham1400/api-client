# TASK-024 — Safe workspace JSON export

Status: done
Date: 2026-10-05

## Scope and inspection

Read AGENTS.md, product.md, decisions.md, task-index.md, TASK-024, import-export.md, secrets.md, architecture.md, ui-flows.md, data-model.md and IPC contract. Initial working tree was clean. TASK-024 was earliest unfinished; TASK-023 and TASK-013 are done in their task files and the index. Consulted the local Graphify graph, then inspected source. Only export was implemented; import remains TASK-025.

## Changes and acceptance evidence

- Explicit allowlists construct strict v1 export DTOs inside one synchronous SQLite read transaction. JSON is validated before opening the native save dialog; export uses saved configuration, without saving drafts or modifying selection.
- Sensitive variables omit values and secret IDs. Auth retains only placeholder/whitespace templates, omits literal and mixed credentials, and marks required credentials. Authorization/Proxy-Authorization/Cookie headers are emptied and disabled, including disabled source rows. File parts retain only field/filename/size metadata and require selection; capabilities, paths, responses and UI state are absent. No decryption is needed.
- The frozen preload transfer API accepts only a workspace UUID through a fixed owned-main-frame IPC channel. Renderer replacement, concurrent export and workspace deletion during the chooser cannot complete a stale write. Renderer receives saved/cancelled outcomes, without filesystem paths or serialized secrets.
- Main opens the native save dialog and writes human-readable UTF-8 via exclusive private same-directory temp file, sync and rename. Failure cleans up temporary files and preserves the previous destination. JSON extension, application/data directories, aliased protected directories, symlink targets and existing SQLite content are guarded. Errors are sanitized.
- The workspace menu opens an exclusions/ordinary-field-risk warning with Cancel initially focused. Cancel restores focus. Unsaved editor text remains intact after save/cancel/error. No navigation, autosave, request execution, import, secrets-included mode, dependency upgrade or phase-2 feature was added.
- Serializer tests cover all body modes, ordered duplicate and disabled rows, Unicode, non-secret settings, relationships, template preservation and strict JSON reparse. Synthetic secret bytes/IDs, path/capability fields, response fields and foreign workspace data are absent. This is round-trip **shape** verification; import and ID remapping are not implemented here.
- The concurrency fixture permits an external writer using fixture-only WAL and verifies a consistent old snapshot after an intervening commit; application journal settings remain unchanged. Atomic-write tests exercise failed rename, owner loss, successful replacement, cleanup and protected targets. IPC tests reject invalid input/foreign senders before opening a dialog.
- The Linux X11 desktop test uses synthetic credentials, actual native Save/Cancel, strict output parsing, saved configuration comparison, unsaved draft checks, protected-destination rejection and byte-for-byte database comparison. Warning screenshot `/tmp/api-client-export-warning.png` was visually inspected: readable exclusions/risk and focused neutral Cancel.

## Commands and actual results

Environment: Ubuntu 24.04.3 x64, X11. Developer Node 22.18.0/npm 11.6.2. Electron 44.5.1 uses Node 24.21.0, ABI 149, Chromium 152.0.7977.130. Native SQLite rebuilds for Node and Electron were sequential; Electron bindings remain installed for desktop development.

- `npm run test:unit`: 295 tests passed in 26 files (2.86 s), including 11 export cases. Initial run had 294 passed/1 failed because the snapshot concurrency fixture tried an external commit under the default rollback journal. Corrected the test to permit that commit with fixture-only WAL; subsequent unit run passed.
- `npm run typecheck` and `npm run lint`: passed. `npm run build` and `npm run rebuild:electron`: passed.
- `npx playwright test tests/export.spec.ts`: actual native export test passed (1/1, 8.5 s) after fixing test automation. Initial failures were an animation-opacity assertion, Persian keyboard layout typing Latin fixture paths incorrectly, and GTK Save name/location handling. The helper selects Latin group for synthetic keys, restores the previous group in finally, and replaces the filename with the full fixture path. One misplaced synthetic export was identified by format/workspace name and removed; no unrelated file was removed.
- `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke`: initial full run 22 passed/1 failed (1.7 min). Multipart native chooser automation failed; export and security passed. A second full `env NODE_OPTIONS=--dns-result-order=ipv4first npx playwright test` run also had 22 passed/1 failed (1.7 min), the same native Open automation issue. A focused export/multipart/upload run passed 3/3 (24.3 s), but repeating export/multipart still failed 1/4 (3 passed, 42.4 s). Inspection of the actual chooser showed its Open location entry was not reliably activated. The helper now uses GTK slash to open the absolute-path entry, replaces existing text, and synchronizes simulated events with X11. `env NODE_OPTIONS=--dns-result-order=ipv4first npx playwright test tests/multipart.spec.ts --repeat-each=3` then passed all 3 (37.7 s). **Final verification:** `env NODE_OPTIONS=--dns-result-order=ipv4first npx playwright test` passed **23/23 (1.8 min)** against the already rebuilt/built Electron app with the final helper. All desktop checks ran with the Electron sandbox enabled.
- `python3 scripts/graphify.py update`: local code-only update passed, 878 nodes/2705 edges/39 communities. No semantic/cloud extraction or model labeling. Security test file yielded no symbols; docs remain authoritative. Generated graph is ignored and is not test evidence.
- `git diff --check`: passed, including final report/status edits. Final `npm run lint && npm run typecheck` also passed.

Non-fatal output: existing Zod/Rollup PURE-comment warnings and Playwright color-environment warning. Desktop safeStorage reported `available:false`, backend `basic_text`, mode `session`; encrypted-storage behavior is not claimed.

## Official API verification

Native dialog options/result checked against [Electron dialog documentation](https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogwindow-options). File open/write/sync/rename and canonical-path handling checked against [Node 22 filesystem documentation](https://nodejs.org/docs/latest-v22.x/api/fs.html). Deferred synchronous transaction behavior checked against [better-sqlite3 API documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md). Existing pinned dependencies and lockfile were retained.

## Limitations and task boundary

Windows, Wayland and packaged/installed-app behavior were not tested and are not marked passed. Atomic rename was exercised on the local Linux filesystem; power-loss durability and Windows file-lock/overwrite behavior remain unverified. The native test helper requires Linux X11, system libX11/libXtst and supported Latin fixture paths. Ordinary-field secrets remain possible as documented and warned in the UI. TASK-025 and later tasks were not started.

No remaining TASK-024 blocker. Acceptance has Linux source-run evidence above; untested platform/release checks remain limitations, not passes. Task file and index are both marked done.
