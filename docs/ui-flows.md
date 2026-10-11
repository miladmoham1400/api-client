# UI and interaction specification

## Main layout

Top bar: workspace selector, environment selector, variables button, theme toggle and workspace menu. Left sidebar: collections and root requests with create/rename/delete menus. Main: request name/save state, method + URL + Send/Cancel, tabs for Params/Headers/Body/Auth/Settings. Response area: Status, duration, body size, Body/Headers tabs and raw/pretty toggle. Default layout stacks request above response; a toggle can place request left of response. Use Chakra v3 components and local icons/assets.

Start with no workspace: empty state with Create Workspace. Workspace with no request: Create Request. Do not create demo workspaces or send sample requests automatically. A single editor keeps phase 1 manageable; min window ~1000x700 with panels scrollable/resizable, controls usable at 1280x720.

## Flows

1. Create/select workspace -> load its collections, saved requests and environment selection.
2. Create request -> draft defaults; Save persists. Send works on saved or unsaved draft and never saves implicitly.
3. Edit params/headers as ordered key/value rows with enabled switch and add/remove. Duplicate query/form keys allowed. Show field-specific errors next to matching rows.
4. Body selector changes mode. Preserve each mode's unsaved content within the current editor session; Save persists only the active mode. Never accidentally send inactive mode fields.
5. Auth None/Bearer/Basic. Mask credential inputs; allow templates. Warn about Auth conflict only on validation, with actionable field location.
6. Settings timeout and Follow redirects checkbox. Show secure TLS verification as fixed behavior, not a fake toggle.
7. Send -> freeze snapshot; show busy and Cancel. Editing may continue but no second Send until completion. Completion belongs to the original snapshot and stays visibly associated with it; indicate if current draft changed since send.
8. HTTP 4xx/5xx show response normally. Transport failures show code/message with no invented HTTP status. Cancel is neutral state. Display binary response as metadata.
9. Navigate to another request/workspace or close app with dirty draft -> Save / Discard / Cancel. Save errors keep draft and block navigation. Switch during active send -> prompt Cancel request / Stay before proceeding; same workspace request switching also requires cancellation.
10. Delete workspace/collection/request -> explicit confirmation with consequence. Collection delete moves requests to root. Ensure dirty-draft and active-send handling is not bypassed by deletion.
11. Variables panel scope selector, environment CRUD, sensitive checkbox, masked preview and explicit reveal/edit. Missing session values after restart/import prompt user to supply them.
12. Export uses native save dialog and notes exclusions; Import uses native open dialog, preview summary, then explicit Import as new workspace. Neither triggers a request.

## Accessibility and states

Keyboard navigation and focus restoration in dialogs, meaningful labels, visible focus, sufficient theme contrast. Ctrl+S saves; Ctrl+Enter sends only from editor when idle; Escape does not unexpectedly discard work. Disable or explain unavailable operations. Show loading, empty and persistence-failure states explicitly. Delete/draft/import dialogs are product controls, not agent permission flows.

## Theme persistence

Default system theme on first launch; Light/Dark/System preference stored locally. Use Chakra v3 compatible provider setup, no v2 imports. Theme change never remounts editor with data loss.

## Request/response layout — 2026-10-10

User authorized a toggle between stacked and side-by-side panels and freely adjustable relative sizes. The **Stacked / Side by side** toggle has a pressed state indicating side-by-side mode. Each panel scrolls independently. A pointer-draggable, keyboard-focusable separator changes heights in stacked mode and widths in side-by-side mode. Keep request share between 20% and 80% so both panels remain available; preserve proportional sizing as the window resizes. Arrow Up/Down adjust stacked sizes; Left/Right adjust side-by-side sizes; Shift increases the step, Home/End go to the limits. Response **Smaller/Larger** also adjust its size along the current axis. The separator replaces the response panel's old native resize corner.

Keep separate ratios for each layout within the running session, initially 55% request in stacked mode and 50% side by side. Layout/ratios are presentation state and reset on restart; no new persistence or IPC command. Switching layout must not remount either panel, clear active/inactive body drafts, reset selected request/response tabs or Pretty, save edits, send/cancel requests or change snapshot ownership. Existing workspace-keyed request-editor resets remain unchanged.

## Response safety

Text renderer only. Response containing `<script>` or HTML must appear as text and must not load resources or execute. Header values/cookies are visible to the local user but never copied to logs/export automatically. Do not reveal stack traces in UI.

## JSON presentation — 2026-10-10

JSON body editing and JSON response Raw/Pretty views use bundled, dependency-free lexical colors for keys, strings, numbers, booleans, null and punctuation, with light/dark palettes. Coloring never reformats the editable or raw text; Pretty remains an explicitly selected derived response view. Incomplete JSON and variable templates remain editable. Native textarea selection, keyboard editing, resizing and scrolling remain available; the decorative coloring layer is hidden from assistive technology. Editor highlighting is bounded to 64 Ki characters and 4,096 tokens; larger or denser editor content stays readable as plain text. Response highlighting has a separate 1 Mi-character / 32,768-token budget so Pretty expansion and ordinary dense responses retain their colors. Beyond the response budget, preserve a colored prefix and show the entire unchanged remainder as plain text, with an explicit explanatory notice outside the response text. Forced-colors mode uses system text colors. Render every token as React text, never executable HTML.

## Approved next milestone: API library navigation

TASK-031 first verifies multiple saved requests with the existing editor. TASK-034 implements nested expandable folders, contextual creation/moves, saved-method badges and guarded selection/breadcrumbs in source. TASK-035 implements quick workspace-scoped search and paged large-tree rendering. Keep explicit Send, one editor/send, draft guards and response/snapshot semantics. No tabs or auto-send. See [API library specification](api-library.md) for the authoritative new behavior, bounds, intermediate export gate and task mapping. Tree/search operations are implemented in source, with measured Linux large-library evidence in the TASK-035 report; packaged-platform acceptance remains TASK-037.

### Nested tree controls (TASK-034)

The API library tree shows collection roots, folders and saved requests. The ellipsis action menu supplies New folder/New request for a chosen container, Rename, Move and Delete as applicable. Requests move using a one-time Destination dialog rather than a permanent select for every row. Request Rename selects the request through the navigation guard and focuses its name for explicit editing/Save. Sibling duplicate names have numbered labels; IDs remain the identity. Folder/collection deletion confirmations show exact descendant/direct counts and promotion consequences.

New request creates only an unsaved draft with a separate owned destination; Save persists there. Cancellation/discard leaves no blank saved row. Folder mutations use the existing dirty Save/Discard/Cancel and active-send Cancel request/Stay guard. Metadata refresh updates a surviving selected request's placement/path without replacing its body/draft or retargeting responses. Expansion does not send/cancel/save requests.

Tree rows use roving focus: Up/Down traverse visible rows, Home/End go to the ends, Right expands/enters, Left collapses/goes to parent, Enter selects/toggles. Tab reaches each visible row's action menu and existing app controls. The editor shows a text-only container breadcrumb. Expanded collection/folder IDs persist by workspace through the validated main API; restore prunes stale IDs and reveals selected request ancestors. Search, explicit paging and measured performance are implemented in TASK-035; see its report for actual checks.

### Search and bounded browsing (TASK-035)

Search requests accepts a literal name/method/path query of at most 200 characters. Nonempty trimmed queries show method, name, full path and a page-relative result number, retaining duplicates. The collection chooser restricts results to an owned collection; All collections includes root requests. At most 100 results render, with totals and explicit Previous/Next results. A result uses the same dirty/active-send guards as tree selection; it reveals the selected ancestors without sending. Search text/filter/pages remain session-only. Clear search restores normal browsing and expansion; an empty/whitespace query also restores browsing.

The tree renders at most 50 rows from one coherent metadata snapshot, with visible-node totals and Previous/Next nodes. This is an explicit pager, not a truncated library. Keyboard navigation crosses page boundaries; Home/End reach logical tree endpoints, and selected request reveal chooses its page even if its ancestors were collapsed. Sidebar scrolling remains independent of the editor. Metadata refresh replaces the snapshot and restarts search pagination, avoiding mixed revisions. Search errors offer restart from the first page; obsolete replies are ignored after query/filter/workspace changes. No full editor is mounted per library node, and no request-count cap or child-list IPC is added.
