# UI and interaction specification

## Main layout

Top bar: workspace selector, environment selector, variables button, theme toggle and workspace menu. Left sidebar: collections and root requests with create/rename/delete menus. Main: request name/save state, method + URL + Send/Cancel, tabs for Params/Headers/Body/Auth/Settings. Lower resizable response area: Status, duration, body size, Body/Headers tabs and raw/pretty toggle. Use Chakra v3 components and local icons/assets.

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

## Response safety

Text renderer only. Response containing `<script>` or HTML must appear as text and must not load resources or execute. Header values/cookies are visible to the local user but never copied to logs/export automatically. Do not reveal stack traces in UI.
