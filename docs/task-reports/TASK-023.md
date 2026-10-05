# TASK-023 — Draft navigation and destructive-action guards

Status: done
Date: 2026-10-05

## Inspection and scope

Read AGENTS.md, product.md, decisions.md, task-index.md, TASK-023, ui-flows.md, architecture.md and ipc-contract.md. The initial working tree was clean. TASK-023 was the earliest unfinished task; TASK-022, TASK-007, TASK-008 and TASK-009 were done in both task files and index. Consulted the existing local Graphify graph, then inspected renderer controllers, navigation/deletion controls, execution/workspace lifecycle and owned IPC. Source/specifications take precedence over graph edges.

Implemented only request-draft/active-request navigation, normal app close, coordinated destructive actions and their verification. No autosave, tabs, crash recovery, transfer, appearance polish, migration, package upgrade or packaging work. TASK-024 remains todo.

## Changes

- Added shared transition authorization with Cancel request/Stay followed by Save/Discard/Cancel. Only a successful Save authorizes the target. Deliberate discard is deferred until the target operation succeeds; failed switching/deletion keeps the draft. Existing explicit Discard edits remains available.
- Request open/create/duplicate/delete, workspace select/create/delete/reload and collection delete use the guard. Selecting the current request/workspace keeps its draft. Metadata naming and collection creation remain immediate operations; collection moves retain their existing dirty/send restriction. Destructive actions keep separate consequence confirmations. Cancelling/dismissing a confirmation while cancellation is pending invalidates that operation, including reopened request confirmations.
- Cancellation waits for terminal completion before proceeding and also handles preparation before an execution ID exists. It reads live execution refs rather than relying only on a rendered busy flag. Stay does not cancel, save or switch. New guarded drafts clear prior validation errors.
- Main intercepts normal window close/app.quit after startup subscription. It delivers a validated main-generated UUID token, accepts a decision only from the exact owned main frame and consumes only the matching pending token. Repeated close gestures share one pending decision; unsolicited/stale decisions fail. Startup/database recovery screens can close. Reload/crash invalidates the handshake. Added only fixed close subscription/decision APIs, with no generic IPC or renderer Node access.
- Main verifies the workspace exists and aborts its execution before database deletion. Upload/secret cleanup still follows committed deletion. A failed database delete preserves stored data; an already authorized cancellation is not undone.
- Added focused authorization, pre-deletion ordering and desktop interaction tests. Existing smoke teardown now force-terminates isolated fixture processes, so unsaved editors cannot stall cleanup. Force teardown is never normal-close acceptance evidence; restart and explicit close scenarios still exercise the actual guard.

## Official API references

Checked Electron's official [BrowserWindow close event](https://www.electronjs.org/docs/latest/api/browser-window#event-close) and [app.quit lifecycle](https://www.electronjs.org/docs/latest/api/app#appquit). Close can be prevented before unload; app.quit attempts to close windows and respects prevented closure. No package versions or lockfile changed.

## Actual checks

Environment: Ubuntu 24.04.3 LTS x64/X11; developer Node 22.18.0 and npm 11.6.2; Electron 44.5.1, embedded Node 24.21.0, ABI 149 and Chromium 152.0.7977.130. Native SQLite was rebuilt for developer Node before unit tests, then for Electron before desktop tests; final bindings target Electron. Desktop checks use the built local renderer, enabled Chromium sandbox, temporary storage and loopback fixtures. Native/loopback/GUI checks used execution escalation without disabling the application sandbox.

| Check | Actual result |
|---|---|
| `npm run typecheck` | Passed; also passed inside final build |
| `npm run lint` | Final run passed |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:unit` | Node SQLite rebuild passed; final run 284 tests passed in 25 files, 2.32 seconds |
| `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke` | Electron SQLite rebuild/build passed; all 22 desktop tests passed, 1.4 minutes; this preceded the final confirmation-invalidation refinement |
| `npm run build && npm run lint && npx playwright test tests/navigation.spec.ts tests/security.spec.ts tests/workspaces.spec.ts tests/collections.spec.ts tests/requests.spec.ts` | After the final refinement: build/typecheck/lint passed; all 7 affected desktop tests passed, 42.8 seconds |
| `python3 scripts/graphify.py update` | Final update passed: 839 nodes, 2,542 edges, 37 communities; local code-only extraction; generated output remains ignored |
| `git diff --check` | Passed after final documentation/status update |
| Screenshot inspection | Inspected `/tmp/api-client-navigation-close.png`: readable Save/Discard/Cancel dialog and backdrop fit the 1280×720 desktop. Initial capture caught the opening animation; final capture waited for full opacity. Screenshot is temporary, not committed. |

Initial typecheck caught an omitted editor guard prop; corrected it. Initial focused smoke attempts exposed test timing/locator issues: Settings must be opened before filling timeout; editor Cancel must be scoped separately from closing dialog buttons; successful Discard close can destroy the click context before Playwright acknowledges it. The close test tolerates only that exact target-closed error and still requires the application close event and restart assertions. Initial teardown hit context destruction, then SIGTERM respected the new close guard; fixture cleanup now uses explicit SIGKILL. Focused and complete desktop suites subsequently passed. Non-fatal existing Zod/Rollup annotation and Playwright color warnings remain.

## Acceptance evidence

- `tests/shared/navigation.test.ts`: clean transition, Stay without cancellation/save, Cancel without save, successful/failed Save, failed cancellation, terminal cancellation before dirty decisions and dirty-state recheck after cancellation.
- `tests/navigation.spec.ts`, first scenario: dirty request switch + Escape keeps input and saved selection; injected SQLite Save failure blocks workspace switch and normal close; successful Save persists before request navigation; Discard restores saved data across workspace switches. Repeated window close produces one token, Cancel keeps the draft/window, and unsolicited/stale close decisions fail. app.quit + Save closes normally and reopens saved workspace/request selection; window close + Discard reopens the previous saved name. Invalid Save blocks guarded Create; deliberate Discard creates a fresh valid draft; saving a new draft during workspace navigation creates/persists it and restores it on return.
- Second scenario: request switch and normal close during a held HTTP request offer Stay and preserve execution/editor. Confirmed request/workspace deletion cannot bypass active or dirty guards. Terminal cancellation closes fixture connections before deletion proceeds. Cancelling the dirty guard preserves the workspace and draft; a deliberate Discard allows request deletion. Injected request-delete failure still keeps the dirty draft and saved request after Discard was chosen. Collection-delete Cancel preserves the collection; Save allows deletion, moves the request to root and preserves its saved edits. Final active workspace deletion cancels before removing all workspace data.
- Third scenario: a held environment-list reply simulates preparation without an execution ID. Cancel-and-create does not change the editor until preparation is released and execution settles. In a second prepared attempt, cancelling the original workspace-delete confirmation while request cancellation is pending prevents subsequent deletion and retains the selected workspace/request.
- `tests/main/workspaces.test.ts` and `tests/main/execution.test.ts`: pre-delete callback sees the existing workspace; unknown IDs invoke no cleanup. Execution emits CANCELLED while the owning workspace still exists, before a deliberately failed deletion; stored data remains and the execution slot is released.
- `tests/security.spec.ts`: exact frozen API allowlist includes only the two fixed close APIs; another BrowserWindow's close decision is rejected with sanitized NOT_FOUND. Existing sandbox, denied networking/navigation, native SQL, persistence, multipart, cancellation, secret masking and isolation regressions remain passing.

Close/switch/delete scenarios were exercised through real desktop controls by automation and visually inspected. Normal close used BrowserWindow.close and app.quit; no separate human titlebar/OS gesture test is claimed.

## Limitations and remaining blockers

No implementation blockers remain for TASK-023. Windows and Wayland were not run and are not marked passed. No packaged-app startup/close, OS shutdown/logoff, hung-renderer recovery, forced termination or crash-draft recovery acceptance is claimed. Independent packaged Linux/Windows checks remain TASK-028/TASK-029. Actual Linux safeStorage reported unavailable/basic_text/session; encrypted storage was not verified.

Graphify reported partial extraction of existing test syntax in cancel-timeout.spec.ts and no symbols for several test files, including security.spec.ts. TypeScript compilation and actual tests passed independently. The graph is optional developer navigation, not complete architecture evidence or a test gate.
