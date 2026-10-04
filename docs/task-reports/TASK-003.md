# TASK-003 — Secure Electron lifecycle and preload boundary

Status: done
Date: 2026-10-04

## Selection and scope

Read AGENTS.md, product, decisions, task index, TASK-003 and its architecture/IPC specifications. TASK-003 was the earliest unfinished task with completed dependency TASK-002. Initial git status was clean; existing TASK-001/002 files and reports were preserved. No data features, database initialization, HTTP sends, dirty-draft feature or later task was implemented.

Checked the current official [Electron security guide](https://www.electronjs.org/docs/latest/tutorial/security), [webContents API](https://www.electronjs.org/docs/latest/api/web-contents) and [contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge), alongside the installed Electron 44.5.1 types.

## Changes

- Main owns one window, obtains the single-instance lock before startup, restores/focuses it on a second-instance event and quits when the window closes. Startup failures quit without logging raw exceptions. Database startup/recovery and resource shutdown will connect in their later tasks.
- Explicit production flags: Node integration off (including workers/subframes), context isolation on, sandbox on globally and per window, web security on, webview support off and insecure content off.
- A dedicated in-memory renderer session denies permission requests/checks and downloads. Window creation, frame/top-level navigation, redirects and webview attachment are blocked. Renderer resource requests are restricted to the bundled renderer directory; development allows only the configured loopback tooling origin/WebSocket host. Packaged mode ignores the development URL.
- CSP additionally denies objects, frames, base URL changes and form submissions. The existing production transform retains `connect-src 'none'` and strips development WebSocket exceptions.
- Explicit frozen `window.offlineApi.app.getBootstrap()` is the only exposed operation. It reports foundation stage and database/request capabilities as false. No pending feature method, generic IPC function, event object, arbitrary path operation or raw Node/Electron API is exposed. The API is exposed only in the main frame.
- Main validates actual sender identity, actual main-frame identity, exact trusted entry URL, live owned window, incoming zero-argument payload and outgoing bootstrap DTO. Unauthorized access returns sanitized NOT_FOUND; validation/operation errors do not expose stacks or raw exceptions. Preload validates returned envelopes too.
- The sandboxed preload bundles Zod locally (`build.externalizeDeps:false`); built inspection confirms Electron is its only external require. No renderer remote dependency was added.
- Added internal validated listener helper with event stripping, exact listener removal, idempotent unsubscribe and suppression of late delivery. It is tested but no pending execution subscription is exposed before execution exists.
- Added shared bootstrap/API types and renderer declaration, focused guard/listener unit tests and live Electron security smoke tests. Vitest includes these new main/preload test directories.

## Actual verification

Environment: Ubuntu 24.04.3 LTS x64, developer Node 22.18.0, npm 11.6.2. Electron smoke reports Electron 44.5.1, embedded Node 24.21.0, Chromium 152.0.7977.130. No dependencies changed; no new install was needed.

| Command/check | Result |
|---|---|
| `npm run typecheck` (final) | Exit 0; strict TypeScript passes |
| `npm run lint` (final) | Exit 0 |
| `npm test` | Exit 0; **83 tests passed in 3 files** (76 existing + 6 guard + 1 listener) |
| `npm run build` | Exit 0; main, self-contained sandbox preload and renderer builds pass |
| `npm run test:smoke` (final, with desktop access outside command sandbox) | Exit 0; build passes and **2 Electron smoke tests pass** with Chromium sandbox enabled |
| Built preload inspection | Only `require("electron")`; no external Zod require |
| Built HTML inspection | Local bundled script; restrictive production CSP including `connect-src 'none'`, `frame-src 'none'` and no WebSocket allowance |
| `git diff --check` | Exit 0 |

Unit evidence: different sender, copied/subframe/detached frame, navigated main frame, closed/missing window and unexpected arguments reject before operation execution. Errors are sanitized. Listener accepts only validated data, does not forward Electron events, removes exactly once and ignores late notifications.

Live smoke evidence: local Chakra UI opens and responds; renderer has no process/require/raw IPC; actual window preferences confirm sandbox/context isolation/web security and no Node/webview integration; bridge is frozen and contains only implemented bootstrap. A real second window with the same trusted URL and preload cannot call the owned bootstrap handler. A second native app process exits zero while the original single window remains. Window.open returns null, renderer remote fetch is denied, notifications are denied and attempted navigation is intercepted at will-frame-navigate with the local document retained. The owned window can still obtain bootstrap after the denied navigation.

## Corrections and warnings

Initial strict checks caught widened literal return types; explicit typed returns/const literal objects corrected them. Electron's runtime `getLastWebPreferences` inspection is not in its public TypeScript declaration, so the smoke uses a checked reflective call with unknown/object validation rather than an any cast. The live second-window test uses the known built preload path, because preload was not a string in the inspected preferences.

An initial navigation assertion waited for will-navigate, which did not fire after the earlier will-frame-navigate handler prevented the action. The test now observes the actual earlier interception. Earlier failed checks were not counted as passing; final commands above passed after corrections.

Bundling Zod produces two upstream Rollup comment-annotation warnings; the comments are removed and the build succeeds. Playwright retains the harmless NO_COLOR/FORCE_COLOR environment warning. No sandbox-disabling workaround was added.

## Limitations and blockers

No TASK-003 acceptance blocker remains. Linux built-bundle desktop behavior was exercised; Windows and both OS packaged applications were not tested. Development HMR was not smoke-tested. This is local startup/resource and browser-boundary evidence, not a disconnected-network acceptance test or packet-level capture. SafeStorage/database startup, saved state, request lifecycle/cancellation and dirty-draft close are future task responsibilities. The internal listener helper awaits use by an actually implemented event capability; no fake completion event exists.
