# API library: nested folders and quick request selection

Status: approved specification; full nested-library feature not implemented. TASK-031 verifies existing multi-request navigation and TASK-032 implements the migration/read foundation; TASK-033 implements validated folder operations and the export gate. TASK-034 adds the nested tree UI, contextual actions and expansion persistence. Search and v2 transfer remain later tasks. User authorized this as the highest-priority next milestone on 2026-10-11. TASK-031–037 implement it sequentially. Existing 0.1.1 downloads and TASK-001–030 acceptance do not contain or verify these changes.

## Outcome and boundaries

Users can keep many saved requests, organize them into collection-owned nested folders, browse/search the library, select any request and explicitly Send it. Phase 1 already permits multiple saved requests; one editor and one active send are retained. If the installed UI appears unable to create a second request, TASK-031 diagnoses and verifies that workflow before introducing folders. Do not presume a one-row database restriction or invent a reproduced defect.

No multiple tabs, concurrent/batch sends, history, scripts, OAuth, cURL/OpenAPI/Postman interoperability, cloud, global variables, inherited folder auth/settings, auto-update or drag-and-drop is included. Existing HTTP/auth/body/variable semantics, explicit Save, secret storage and response safety remain unchanged. Folders are organizational metadata, not filesystem paths or execution modules.

```text
Workspace
└── Collection: My API
    └── Users
        ├── GET — List users
        ├── POST — Create user
        ├── Admin
        │   ├── GET — List admins
        │   └── DELETE — Remove admin
        └── Auth
            ├── POST — Login
            ├── POST — Logout
            └── POST — Refresh token
```

## Placement and invariants

- A collection belongs to one workspace. A folder belongs to exactly one collection/workspace; its nullable parent refers to another folder in that same collection/workspace. Collection roots have depth 0; folder depth is 1–16.
- Requests have one destination `{collectionId,folderId}`: workspace root = both null; collection root = collection ID/non-null and folder null; folder = both non-null with matching workspace/collection ownership. Existing root requests remain valid.
- Each folder can hold requests and child folders. Names retain trimming and 1–100 characters; duplicate names remain allowed and never identify an entity. Disambiguate duplicate sibling labels visibly, while using full IDs internally.
- Reject cycles, self-parenting, foreign workspace IDs, missing destinations and moves whose deepest descendant would exceed depth 16. Validate in main and supplement with composite database constraints. No unbounded recursive traversal; detect invalid persisted hierarchy and return sanitized errors without deleting data.
- Creation in a folder or collection records the explicit destination. A new unsaved draft is not persisted until Save; cancellation must not create a blank saved request. Renaming/moving organizational metadata persists immediately, with existing dirty/active-send guards.
- Support moving a request between workspace root, collection roots and folders in the same workspace. Folder moves support another parent/root, including another collection in that workspace: preserve IDs and atomically update descendant collection memberships. Cross-workspace moves are rejected.
- Duplication keeps its destination and existing independently owned secret-copy behavior. No implicit credential inheritance from folders.

## Deletion and active state

Deletion requires a confirmation with exact affected folder/request counts. Folder deletion removes only that folder: its direct requests and child folders move to its parent (or collection root), retaining the descendants' structure. Do not delete its requests or flatten the surviving child subtrees. Collection deletion moves every request, including nested descendants, to workspace root and removes its folder tree. Workspace deletion retains the existing explicit full-descendant removal rule.

All placement updates/deletion are transactional. Preserve request IDs, configuration, secret ownership and selected request when it survives; invalidate only genuinely removed references. Dirty drafts use the existing Save / Discard / Cancel guard. Active sends use the existing cancellation/navigation guard; no automatic cancel/send or retargeting of an accepted snapshot. Selection, expansion, search, moving, import and restart must not send an HTTP request. Keep file capabilities workspace-scoped and preserve existing reselection rules.

## Tree and quick selection

- Sidebar displays workspace-root requests and expandable collections/folders, with the saved method badge and request name. Unsaved editor changes do not overwrite library metadata. Provide explicit New folder, New request, Rename, Move and Delete actions in context, plus an accessible destination chooser. Drag-and-drop is deferred.
- Clicking a request selects it in the existing editor; show breadcrumbs identifying its collection/folder path. Empty folders remain visible. Selecting the active request is neutral.
- Persist expanded collection/folder IDs per workspace in a bounded versioned UI-state record; prune stale IDs on restore. Existing selected-request/environment persistence remains authoritative. On reopening a selected request, reveal its ancestors. Search query/results remain session-only.
- Keyboard: Up/Down navigate visible rows, Right expands or enters an expanded container, Left collapses or goes to its parent, Enter selects a request/toggles a container. Use appropriate tree semantics, visible focus, accessible names and method labels. Context actions remain keyboard accessible in both themes.
- Search active-workspace request names, methods and collection/folder paths; optional collection filter. Match literal trimmed query, case-insensitive for Latin characters with NFC normalization; no regex, wildcard interpretation or transliteration. Empty query restores normal browsing. Never search/log bodies, headers, auth or variable values.
- Results display method, name and full path, preserve duplicate requests and select through the same guards. Main owns search authorization. Query limit 200 characters; result pages at most 100, with deterministic ordering, explicit continuation and no silent truncation. Cancel/ignore stale results after query/workspace change. Clearing search preserves normal tree state; selection reveals the result's ancestors.
- Collections/folders sort by `sortOrder`, then name (deterministic code-point comparison), then ID; request siblings sort by name then ID. Folder rows precede request rows. Search sorts by path/name/method/ID. Reordering UI is deferred.
- After a library mutation, restart paged search/child listing or validate a snapshot revision; do not combine pages from different library revisions and silently skip or duplicate rows.

## Capacity and measurable acceptance

The first verified baseline is **1,000 saved requests and 1,000 folders across up to 100 collections**, depth up to 16, in one workspace; a second workspace verifies isolation. These are verification/transfer bounds, not an invented one-request limit or a promise of unlimited throughput. Preserve existing larger databases without truncation or destructive migration. Folder creation/import must enforce the 1,000-folder bound; editing/removal/recovery of existing data remains possible. Existing import limits of 1,000 requests/100 collections/10 MiB are retained, with 1,000 folders added for v2. Local request creation receives no new arbitrary count restriction in this milestone.

At 1280×720 (also check minimum 1000×700), verify collapsed/expanded browsing, scrolling, search and correct selection/send for first/middle/last requests. The tree must keep live rows bounded (virtualization or incremental child rendering), with continuation when children are paged; never mount every request editor/body. Do not load all full configurations or secret values to browse metadata.

TASK-035 records a reproducible synthetic dataset, OS/hardware/build, sample counts and timings. After one warm-up, measure 20 distinct selections and 20 searches: warm p95 selection-to-editor and search-to-visible-results each <=500 ms on the documented reference machine; cold library usable <=2 s. No sleep-based fake readiness, no absolute CI guarantee or skipped timing marked passed. If the measured target fails, optimize within the task or leave the performance criterion unfinished. Mutation/selection must not repeatedly copy every full request configuration.

## Persistence and migration

Append a migration after the existing ledger; do not edit migration 1. Add `folders` with `{id,workspace_id,collection_id,parent_folder_id,name,sort_order,created_at,updated_at}`, owned composite unique keys and indexes for `(workspace_id,collection_id,parent_folder_id)`. Add nullable `requests.folder_id` while retaining `collection_id` and configuration version 1. Enforce same-workspace/collection destinations with composite references plus service validation, and `folder_id IS NULL OR collection_id IS NOT NULL`.

Add a separate versioned workspace tree-view-state table/record for expansion IDs; no drafts/responses/history persist. Migration leaves existing requests at their existing collection/workspace root, all IDs/config/credentials/environment selections intact. Reopen and replay are idempotent. Injected failure rolls back schema/data and exposes existing recovery behavior. Do not operate migrations or tests against real user profiles; preserve a copy of a closed synthetic legacy database for before/after comparisons.

## Narrow IPC extension

Add explicit `folders.list/create/rename/move/delete` scoped to workspace, and folder-aware request create/duplicate/move DTOs; extend grouping metadata without exposing configs/credentials per tree node. Maintain legacy request destinations by normalizing omitted `folderId` to null only for old-shaped inputs, not by silently dropping an explicit folder ID. Preserve omitted fields on partial saves; editing config must not reset placement.

Add bounded `requests.search(workspaceId,{query,collectionId?,offset,limit})`, returning validated summaries with method/path and continuation. Listing children accepts validated container IDs and bounded pagination if needed. No arbitrary SQL, generic IPC, raw local path access or renderer Node APIs. Validate both sender and ownership at every mutation/read, including after awaiting UI/native operations. Stale IDs produce existing sanitized result errors; path/name text is untrusted text.

## Transfer compatibility and intermediate task gate

TASK-036 adds workspace JSON **v2**, retaining v1 import. V2 adds `workspace.folders: [{id,collectionId,parentFolderId,name,sortOrder}]` and a nullable `folderId` to requests. Config stays v1; transfer version and request-config version are distinct. Export v2 consistently, including empty folders. Import v1 places all requests at their old collection/workspace root and creates no folders; old clients reject v2 explicitly, not partially import it.

Validate unique source IDs across all entities, owner/collection consistency, parent existence, acyclicity, depth/count/byte bounds before preview or writes. Map fresh folder IDs in a validated parent-before-child order and remap every request/parent/collection reference. Array order is not trusted. Preview contains counts/names/omission summary only; commit all entities atomically with existing token lifecycle. Preserve all current secret, file-path/capability, response and selection exclusions; no credentials in export by default.

During TASK-032–035, until v2 transfer exists, an attempt to export a workspace containing folders must fail explicitly before save dialog/write, explaining that folder export is not yet available. Never emit v1 that silently loses/ flattens folders. V1 transfer for folder-free workspaces keeps working. Add this guard when folders first become writable (TASK-033), and remove the temporary restriction only after TASK-036 acceptance. Intermediate builds are not complete folder-library releases.

## Completion gate

TASK-037 proves old-data upgrade, complete nested organization, large-library browsing/search, exact selected HTTP request, all guards, secret isolation and v1/v2 transfer on synthetic data. Build/hash/test fresh Linux and Windows packages independently, including offline startup/local work/send and normal close/reopen. Record Windows runner OS accurately; Server smoke is not Windows 11 baseline acceptance. Untested dialogs, migration/performance/platform checks stay not-run and the affected task unfinished. No automatic publication or tag/version change is authorized by this planning milestone.
