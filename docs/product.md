# Product specification

## Outcome

A developer can open an installed desktop application with internet disconnected, select a project workspace, configure a saved request using variables and send it to an accessible localhost/LAN endpoint. Closing and reopening the app retains saved configuration.

## Scope

| ID | Requirement |
|---|---|
| P01 | Linux and Windows desktop packages, x64 initial target |
| P02 | Create, rename, select and delete independent workspaces |
| P03 | Create, rename and delete one-level collections; move requests between collections or workspace root |
| P04 | Create, duplicate, edit, explicitly save and delete requests |
| P05 | GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS |
| P06 | URL, ordered query parameters and ordered header rows; enabled switches |
| P07 | No body, JSON, raw text, URL-encoded form and multipart form with files |
| P08 | No auth, Bearer and Basic auth per request |
| P09 | Workspace variables and selectable per-workspace environments |
| P10 | Status, elapsed time, decoded body size, response headers and raw/pretty text |
| P11 | Overall timeout, cancellation and optional redirect following |
| P12 | Local SQLite persistence, versioned migrations and workspace isolation |
| P13 | Safe default JSON workspace export and transactional import |
| P14 | Light/dark theme, keyboard-accessible controls, readable errors |
| P15 | Local-only operation with no runtime external dependency |

## Phase-1 defaults

- One window, one editor and at most one active send. No automatic request on startup, selection, import or variable edit.
- English UI; LTR request editing, UTF-8 values; text may include Persian.
- New request: GET, no body, no auth, 30,000 ms overall timeout, redirects OFF.
- Timeout range: 100–300,000 ms. No infinite timeout setting.
- Manual Save (`Ctrl+S`); draft remains distinct from saved request. No autosave.
- Single active environment per workspace or None; last selection persists.
- Metadata changes persist immediately. Request drafts require Save.
- Workspace/collection/request names: trim, 1–100 characters. Duplicates allowed, IDs identify objects.
- Delete workspace removes its descendants after confirmation. Delete collection moves its requests to workspace root after confirmation. Delete request requires confirmation.
- Duplication creates a new ID, appends ` (copy)` while honoring name length, retains settings but not responses; secret handles are independently owned.
- Disconnection never blocks startup/local editing. Expected connection failures are shown as request errors, not app crashes.

## Deferred

Account, cloud sync, team collaboration, billing, OAuth flows, scripts/tests runner, automatic token extraction, persistent cookie jar, request history, multiple tabs, global variables, variable nesting, proxy configuration, custom CA/client certificate configuration, disabling TLS verification, HTTP/2, WebSockets, GraphQL tools, OpenAPI and Postman import, installer signing and auto-update.

## Acceptance story

1. Disconnect internet without disabling loopback.
2. Open the packaged application. Create `Clinic API` workspace and `Local` environment.
3. Add `base_url=http://127.0.0.1:<fixture-port>` and a sensitive test token.
4. Create a saved request `{{base_url}}/echo` with a query parameter and `Bearer {{token}}` auth.
5. Send; verify echoed request, status, headers, duration and body.
6. Cancel a delayed request; test timeout, HTTP 401 and an unreachable port.
7. Restart the app; workspace, environment and saved request remain, last response does not.
8. Create a second workspace with different `base_url`; confirm isolation.
9. Export, import as a new workspace, supply omitted credentials and select local files again.
10. Run this story independently on Linux and Windows packages.

## Completion rule

All tasks and release acceptance must have actual evidence. If Windows hardware/CI is unavailable, implementation may proceed but Windows validation and the phase-1 release remain incomplete.
