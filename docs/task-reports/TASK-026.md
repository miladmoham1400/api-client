# TASK-026 — Themes and accessibility polish

Status: done
Date: 2026-10-05

## Inspection and scope

Initial working tree was clean. Read AGENTS.md, product.md, decisions.md, task-index.md, TASK-026 and ui-flows.md; inspected architecture/IPC contracts and relevant source. TASK-025 is done in its task file/index; TASK-026 was the earliest unfinished task with completed dependencies. Consulted local Graphify before tracing theme/provider/repository/editor/response relationships; source/specifications remained authoritative. No TASK-027 acceptance story, package/release task, localization, user-defined theme or multiple-tab work was implemented. Existing packages/lockfile remain unchanged.

## Changes

- Validated owned-main-frame `app.getTheme`/`app.setTheme` fixed IPC, frozen preload API and local SQLite app_settings persistence. Default is System; Light/Dark/System survive reopen. Invalid/foreign input cannot change preferences; failed write rolls back. Theme operations do not alter workspace/request/variable selections or configuration.
- Extended the stable bundled Chakra v3 provider with explicit preferences, root light/dark classes, semantic tokens and system-media observation. Native Theme selector is keyboard accessible and labeled. Successful changes update appearance without replacing the editor; failed reads use System with an actionable message, and failed writes retain prior appearance and draft.
- Scoped Ctrl+Enter to editor focus while retaining idle/busy/composition/dialog guards. Ctrl+S ignores composition and open dialogs. Keyboard Save restores temporarily lost field focus after React commits enabled inputs, without taking a user's newly moved focus.
- Focusable sidebar/editor/main/response scroll regions, keyboard Smaller/Larger response controls with bounded height, native mouse resizing retained and ResizeObserver synchronization. Labels have focus-ring clearance; timeout helper/error spacing avoids overlap.
- Auth field errors now have IDs and invalid/described-by associations. Field errors use built-in `red.fg` semantic color across request/body/multipart/workspace/collection editors: no custom palette or user theme was added. Existing error text, limits and guarded destructive/import/navigation flows remain intact.

## Keyboard/light-dark layout checklist and evidence

Checklist audited on real sandboxed Linux Electron windows using Playwright keyboard/mouse actions and visual screenshot inspection. This is not an independent human-only or assistive-technology certification.

| Check | Actual evidence |
|---|---|
| Initial System and media changes | Theme defaults to System; emulated dark/light system changes update effective appearance. Explicit Light/Dark ignore opposing system media. |
| Keyboard theme selection/draft preservation | Home/ArrowDown/Tab change the native selector; request name remains unchanged during both appearances. Failed SQL write retains Light and an unsaved row value. |
| Restart persistence | Light, Dark and System each persist through normal app close/relaunch. Saved request remains; System continues to follow media after restart. |
| Field readability/contrast | Invalid timeout remains described by its error. Representative foreground/background contrast measured 8.3747:1 Light and 10.4825:1 Dark after correction. Screenshots `/tmp/api-client-theme-light.png` and `/tmp/api-client-theme-dark.png` visually inspected. |
| Baseline layout | 1280×720 light/dark screenshots reviewed; 1000×700 checked for horizontal overflow. Shell smoke independently checks named region bounds at both resolutions. Scrollable editor can reach fields and panels. |
| Ctrl+S / Ctrl+Enter | Ctrl+S validates/saves and restores Request URL focus. Ctrl+Enter from editor sends one loopback request; outside-editor focus and open import dialog send zero. Save in the dialog does not create a request. Existing cancel-timeout smoke verifies no second send during active execution. |
| Dialog focus | Import opens on neutral Cancel; Escape closes without saving and returns to Import trigger. Shell smoke verifies About focus trap, Escape and trigger restoration; existing navigation/deletion/import/export flows remain covered by regression smoke. |
| Row keyboard editing | Add param via Enter; Tab moves key to value and typed value is retained across failed theme write. Existing request-fields smoke exercises ordered/disabled/duplicate rows and keyboard persistence. |
| Scroll/resizing | Focused editor PageDown changes scroll position. Enter on Larger/Smaller changes measured response height; pointer drag also resizes, then keyboard decrease works. |
| Local assets | Built renderer performance resources are only file/data URLs; baseline smoke checks no remote resources. No remote script/font/icon or new runtime package was added. |

## Commands and actual results

Environment: Ubuntu 24.04.3 x64/X11. Developer Node 22.18.0/npm 11.6.2; Electron 44.5.1 uses Node 24.21.0, ABI 149, Chromium 152.0.7977.130. Native SQLite rebuilds for Node/Electron were sequential; final bindings are Electron's.

- `npm run typecheck` and `npm run lint`: passed. `npm run test:unit`: **315 tests passed, 28 files (6.33 s)**, including preference default/reopen, unrelated-data preservation, sender/input validation and injected write rollback. These tests establish behavior, not component markup.
- `npm run rebuild:electron && npm run build`: passed, including typecheck. Rebuild/build repeated for changed UI before smoke runs; no dependency versions changed.
- Initial focused `tests/theme.spec.ts tests/shell.spec.ts tests/security.spec.ts`: 2 passed/1 failed (5.7 s). Theme test exposed insufficient default `fg.error` contrast (3.7631:1 Light). Switched field-error text to built-in `red.fg`; subsequent measurements passed at 8.3747/10.4825.
- Three subsequent theme checks failed at keyboard Send/focus (6.8/6.7/6.7 s): Ctrl+S temporarily disabled the URL input and left focus on body, where the new editor-only Send guard correctly refused sending. A first animation-frame focus restoration was too early; restoring after React's enabled-input commit corrected the underlying focus loss. Diagnostic output contained only element tag/label, no input values, and was removed.
- `env NODE_OPTIONS=--dns-result-order=ipv4first npx playwright test tests/theme.spec.ts`: **1 passed (5.3 s)** after correction, including all checklist behavior above.
- Final `env NODE_OPTIONS=--dns-result-order=ipv4first npm run test:smoke`: **25 tests passed (2.1 min)** against final spacing/focus refinements. Its Electron rebuild, typecheck and build also passed. Final theme test passed in 4.3 s; final `npm run lint` passed.
- `python3 scripts/graphify.py update`: passed after final source changes, **938 nodes/2965 edges/38 communities**. Local code-only extraction; security/theme spec test files yielded no symbols, CSS unsupported, docs excluded. Generated graph remains ignored discovery data, never test evidence.
- `git diff --check`: passed, including final report/status edits.

Non-fatal output: existing Zod/Rollup PURE-comment and Playwright color-environment warnings. Actual safeStorage capability remains session-only/basic_text in this Linux environment; no real secure-backend or release claim is made by this task.

## Official compatibility verification

Chakra v3 [dark-mode documentation](https://chakra-ui.com/docs/styling/dark-mode#element-specific-dark-mode) documents root light/dark classes and semantic tokens; [color documentation](https://chakra-ui.com/docs/theming/customization/colors) documents semantic foreground usage. Inspected pinned Chakra 3.37.0 token definitions: red.fg uses red.700 in Light/red.300 in Dark. Extended the repository's local provider instead of adding browser-storage or next-themes persistence; no Chakra v2 APIs are used.

## Limitations and boundary

Windows, Wayland, packaged/installed startup, real OS theme switching and screen-reader/assistive-technology combinations are untested and not marked passed. System behavior here is tested using browser media emulation. Representative text contrast/visual review is not exhaustive accessibility certification. Test cleanup can forcibly terminate isolated fixtures; only explicit normal close/relaunch in the theme test counts as restart evidence. TASK-027 and later remain untouched. TASK-026 is done with the recorded Linux acceptance evidence; no task blocker remains. Platform-specific release acceptance belongs to the later tasks and is not claimed here.
