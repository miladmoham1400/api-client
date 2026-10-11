# Application architecture

## Boundaries

Renderer React/Chakra -> explicit contextBridge preload API -> validated IPC handlers -> application services -> repositories / HTTP engine / secret store / native file dialogs.

Renderer cannot access Node, SQLite, filesystem or raw IPC. No local server is needed. Main process performs asynchronous HTTP I/O; bounded small SQLite operations may be synchronous. Import size/response limits prevent unbounded work. A worker is a future option if measurement justifies it.

## Suggested source layout

| Path | Responsibility |
|---|---|
| `src/main/index.ts` | App/window lifecycle, local resource loading |
| `src/main/ipc/` | Sender validation, schemas, typed result envelopes |
| `src/main/db/migrations/` | Ordered SQL migrations |
| `src/main/db/repositories/` | Workspace-scoped database access |
| `src/main/services/` | Workspaces, request persistence, import/export |
| `src/main/http/` | Materialization, Node transport, limits, cancellation |
| `src/main/security/` | Secret encryption and redacted diagnostic metadata |
| `src/main/files/` | File capability registry and native dialogs |
| `src/preload/index.ts` | Narrow frozen API; no generic invoke exposure |
| `src/shared/` | DTOs, discriminated unions, schemas, pure variable logic |
| `src/renderer/features/` | Workspaces, collections, editor, variables, response |
| `src/renderer/theme/` | Chakra v3 setup and local theme |
| `tests/fixtures/` | Local HTTP/HTTPS fixture servers, synthetic credentials |

Do not create empty framework layers for their own sake. Keep paths within these responsibilities.

## Startup and shutdown

Acquire single-instance lock. Wait for Electron ready, initialize safeStorage capability, open `app.getPath('userData')/offline-api-client.sqlite`, enable foreign keys outside transactions and apply migrations, then create the window. Never store writable data under the installation directory. Restore selected workspace/environment only if IDs still exist. Do not restore or send last response.

Database startup failure produces a local recovery screen with sanitized error and database location. Do not delete or recreate a failed database silently. On shutdown, abort active send, invalidate file handles and close database. Dirty-draft close is mediated by a Save / Discard / Cancel dialog, including OS window close events.

## Electron boundary

Set `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, `webSecurity:true`. Restrict navigation/window creation and permissions; validate IPC sender and frame against the owned window. Production CSP permits only bundled resources and forbids renderer network connections. Development tooling exceptions must not ship. Load a bundled local entry, not remote pages. Do not expose Electron event objects to renderer subscriptions.

API responses, imported names and errors are untrusted. Display response text safely, never via executable HTML. No remote image loading from response content.

## Send pipeline

Capture draft and selected environment IDs -> validate snapshot -> load workspace-scoped variables/secrets in main -> substitute once -> validate URL/headers/body -> serialize -> create execution ID -> send using Node -> collect bounded response -> return typed result. Do not mutate the saved request, variable templates or current draft during materialization.

One active execution per app. Send acceptance returns ID quickly; completion emits an owned-window event with the same ID. Completion is exactly once. Ignore stale renderer events. Cancel is idempotent and scoped to the sender's execution. A rejected send does not create an active execution.

## Draft and file capabilities

Renderer submits only opaque file IDs issued by main after a user file-dialog selection. Main privately maps them to paths and workspace ownership. After restart or import, file entries retain name/metadata but have no valid capability and must be selected again. Paths are never accepted from imported JSON or arbitrary renderer input.

## Approved next milestone: API library boundaries

Extend main-owned repositories/services and validated shared/preload contracts for folder hierarchy and bounded metadata navigation/search. Renderer owns tree presentation and ephemeral search state; persist only explicitly specified expansion IDs through main. Keep request configuration loading on selection, not per node. Transport/materialization/secrets retain their current boundaries. See [API library specification](api-library.md) for the authoritative new behavior, bounds, intermediate export gate and task mapping. Folder operations, metadata tree browsing and expansion persistence are implemented in source (TASK-033–034); search remains TASK-035.
