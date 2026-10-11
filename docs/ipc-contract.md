# Main/preload/renderer contract

## Envelope

`Result<T> = {ok:true,data:T} | {ok:false,error:{code,message,field?,retryable}}`.
Runtime-validate incoming payloads and outgoing shared DTOs. Do not return stacks, raw filesystem errors, ciphertext, Node objects, buffers or Electron event objects. Use serializable values. UUIDs are IDs, not authorization: every handler verifies sender and workspace ownership.

## Narrow API

| Group | Methods |
|---|---|
| app | getBootstrap(), getTheme(), setTheme(light/dark/system), onCloseRequested(callback), requestCloseDecision(token,decision) |
| workspaces | list(), create(name), rename(id,name), delete(id), select(id) |
| collections | list(workspaceId), create(workspaceId,name), rename(workspaceId,id,name), delete(workspaceId,id) |
| library | list(workspaceId), setExpansion(workspaceId,{expandedCollectionIds,expandedFolderIds}) |
| folders | list(workspaceId), create(workspaceId,collectionId,parentFolderIdOrNull,name), rename(workspaceId,id,name), move(workspaceId,id,collectionId,parentFolderIdOrNull), delete(workspaceId,id) |
| environments | list(workspaceId), create(workspaceId,name), rename(workspaceId,id,name), delete(workspaceId,id), select(workspaceId,idOrNull) |
| variables | list(workspaceId,environmentIdOrNull), upsert(workspaceId,scope,key,value,isSensitive), delete(workspaceId,id), reveal(workspaceId,id) |
| requests | search(workspaceId,{query,collectionId?,offset,limit,revision?}), newRow(workspaceId), list(workspaceId), get(workspaceId,id), create(workspaceId,input), save(workspaceId,id,input), duplicate(workspaceId,id), delete(workspaceId,id), move(workspaceId,id,collectionIdOrNull,folderIdOrNull?) |
| files | chooseUpload(workspaceId) -> opaque file ID + name + size; releaseUpload(workspaceId,fileId) |
| execution | send(workspaceId,requestIdOrNull,draft,environmentIdOrNull), cancel(executionId), onCompleted(callback) -> unsubscribe |
| transfer | exportWorkspace(workspaceId) -> {status:'saved'|'cancelled'} using native save dialog; chooseImport() -> cancelled/summary preview; importWorkspace(previewToken) -> {workspaceId,name}; cancelImport(previewToken) -> null |

These are API shapes, not instructions to expose a generic `invoke(channel,args)` function. Use explicit contextBridge functions and schema allowlists.

`requests.newRow` returns a main-generated UUID and a blank enabled key/value row for a draft in the active owned workspace. It does not persist a request or row. Query/header arrays and timeout/redirect settings are validated on explicit create/save; omitted settings in a partial save preserve their stored values.

Request create/save accepts an optional active body: `none`, `json` source text, `raw` text/mediaType, ordered `urlencoded` text rows, or ordered `multipart` text/file rows. Inactive mode drafts never enter the payload. Text bodies enforce the 5 MiB UTF-8 limit; all body modes enforce GET/HEAD body prohibition. JSON syntax is validated after substitution during materialization. Omitted body preserves stored configuration. Multipart file rows may submit an ephemeral `fileId` for Send, but persistence strips it and retains only file name/size display metadata. Editor snapshots return saved metadata without live capabilities; opening/restarting requires reselection. Saving in the current editor preserves its live selection independently from saved data. Strict schemas reject arbitrary path fields.

Request create/save also accepts optional auth: None, Bearer token, or Basic username/password. Credential draft fields use `{kind:'value',value}` to enter a literal/template or `{kind:'keep'}` to retain the matching field of the owned saved request. Keep cannot introduce an arbitrary secret handle or initialize a new credential. Template-only strings may remain in configuration; literal-bearing strings use SecretStore records. Auth editor snapshots return templates or `{kind:'stored',hasValue,storageMode}` without secret IDs or plaintext literals. Omitted auth preserves existing configuration. Main-only materialization resolves captured variables/credentials and returns immutable metadata plus defensive body-byte copies; no resolved snapshot API is exposed to renderer in TASK-015.

Sensitive variables list returns presence, masked display and persistence capability, not plaintext. Reveal/edit happens only on explicit user action. Draft auth inputs may contain templates or ephemeral literals. Main stores credential literals through the secret store and redacts list responses. Requests.get for editing can return decrypted credentials only to the owned window and only for the selected request.

Environment snapshots include owned environments, active selection and current secure/session storage capability. Variable lists include the requested owned scope and a masked effective preview from workspace plus selected environment, with source environment IDs. Preview does not decrypt or interpolate values. `variables.upsert` accepts an optional final variable ID: omit/null for a new key (duplicates in that scope fail), or supply the owned existing ID to edit that key's value/sensitive designation. Existing keys are fixed during edit. Reveal returns only `{value}` to the owned window; no secret ID or ciphertext is returned.

`execution.send` returns `{executionId}` after validation and snapshot materialization; actual network operation starts asynchronously. `onCompleted` receives `{executionId,result:HttpResponse|ExecutionError}` once. Emit completion after the invocation result is delivered or maintain a main-side retrievable completion record so very fast responses cannot race subscription setup. Register listener before enabling Send. Listener cleanup prevents accumulation.

`files.chooseUpload` accepts only an existing workspace UUID and opens a main-owned native single-file dialog. Success returns `{fileId,name,size}` (no path); ordinary cancellation returns `{ok:true,data:null}`. Selection must be a readable regular file no larger than 20 MiB. `releaseUpload` accepts only workspace/file UUIDs and returns `null`; unknown, released or foreign-workspace handles return the same sanitized `FILE_REQUIRED`. Deleting a workspace, renderer reload/crash, window close and app exit invalidate its capabilities; pending dialogs cannot recreate them after invalidation. Main-only `UploadService.captureForSend` captures selected capabilities, then reopens and validates enabled file rows before each multipart connection, with row-specific errors and a 50 MiB total limit. Saved/imported file rows retain only display metadata and require reselection. Multipart uses a private replayable streaming body source, with engine-generated boundary/Content-Type/known Content-Length, a 55 MiB serialized limit and cleanup on every terminal path. Releasing a draft selection does not alter an accepted execution; allowed body-preserving redirects reopen its captured files. No resolved body, descriptor or stream crosses IPC.

Normal window close and app quit are intercepted in main after startup subscription. `onCloseRequested` delivers only a validated `{token}` with a fresh main-generated UUID. The renderer applies active-request and dirty-draft guards, then `requestCloseDecision(token,'close'|'cancel')` returns `Result<null>`. Main checks the exact owned main frame and consumes only the matching pending token; unsolicited/stale decisions cannot close a window. Repeated close gestures share one pending decision. Startup/recovery screens may close without editor guards. Renderer crash/forced process termination is not unsaved-draft recovery.

`transfer.exportWorkspace` takes only the workspace UUID, never a renderer-selected path or secrets flag. Main constructs and validates a strict allowlisted v2 export, including folders/destinations, from saved data in one SQLite read transaction before showing an owned native save dialog. The renderer explains omissions and ordinary-field risks first. Cancellation is an ordinary `{status:'cancelled'}` result and creates no temporary/destination file. Success returns only `{status:'saved'}`, with no path or exported payload. Main rechecks the exact owner before writing/committing; same-directory exclusive temp/write/sync/rename preserves an existing destination on failure. Only JSON destinations outside application/data directories are allowed; symlink destinations and SQLite file signatures are rejected. Export does not save drafts, change selections, decrypt secrets or execute requests.


`transfer.chooseImport` accepts no path or content from renderer. Main opens an owned single-file native dialog, reads at most 10 MiB, decodes strict UTF-8 and validates formats v1/v2, hierarchy, limits, IDs, relationships and omissions before retaining one parsed preview. The renderer receives only a random token, workspace/collection/folder/environment names, entity counts and omission counts. Choosing another file invalidates the prior token. Confirmation imports exactly the validated preview, without re-reading a changed file; a new choice requires new validation/preview. Success consumes the token; `cancelImport` consumes it without writes. Reload/crash/window close invalidate pending previews and in-flight selections. Unknown/stale tokens share a sanitized expired-preview error.

`transfer.importWorkspace` accepts only the preview UUID and creates a new workspace in one transaction, regenerating entity/row/secret IDs and remapping owned collection/environment/folder references. Sensitive values and omitted literal credentials become unresolved session records; files have metadata without capabilities. The new name ends in ` (imported)` within 100 Unicode characters; identical names remain allowed. New state is None/no selected request. Current app selection, existing workspaces, drafts and responses stay intact; the UI refreshes the workspace list without navigating. Import never executes a request. Write failure rolls back all descendants and retains the preview for retry.


`app.getTheme` takes no arguments and returns `light`, `dark` or `system`, defaulting to System when no local setting exists. `app.setTheme` accepts only that enum and transactionally persists the preference in SQLite app_settings; invalid/foreign input cannot change it. Both use the owned main-frame guard. The renderer applies bundled Chakra v3 light/dark classes and semantic colors, observing the system media query only for effective System appearance. Successful changes update appearance without remounting the editor; failures keep the prior appearance/draft and show a sanitized retry message. Theme selection never navigates, saves a request or sends one.

## Domain errors

FOLDER_EXPORT_UNAVAILABLE, EXPORT_WRITE_FAILED, VALIDATION, NOT_FOUND, OWNERSHIP, DATABASE_UNAVAILABLE, DATABASE_WRITE_FAILED, VARIABLE_MISSING, SECRET_UNAVAILABLE, FILE_REQUIRED, FILE_CHANGED, FILE_TOO_LARGE, REQUEST_BUSY, INVALID_URL, INVALID_HEADER, AUTH_CONFLICT, CONTENT_TYPE_CONFLICT, UNSUPPORTED_SCHEME, TIMEOUT, CANCELLED, DNS_FAILURE, CONNECTION_REFUSED, TLS_FAILURE, NETWORK_FAILURE, RESPONSE_TOO_LARGE, DECOMPRESSION_FAILURE, REDIRECT_LIMIT, REDIRECT_DOWNGRADE, INVALID_IMPORT, UNSUPPORTED_FORMAT_VERSION, IMPORT_TOO_LARGE.

HTTP status 4xx/5xx is a successful transport result. User cancellation of file open/save dialogs is an ordinary cancelled operation, not a red failure toast. Repository mutation errors leave UI data intact. Missing/unauthorized IDs share sanitized not-found behavior where appropriate.

## Payload limits

At boundary enforce names, timeout range, max 200 query/header/form rows per group, 100 variable entries per scope, 10,000 characters per row value/variable value/URL template, max 5 MiB raw/JSON text body and limits in request-engine.md/import-export.md. Field-specific validation messages identify the failing row without echoing credential values.

## Approved next milestone: folder and search APIs

The API table above describes the current source API; published 0.1.1 installers do not include the new folder calls. TASK-033 implements explicit workspace-owned folder CRUD/move handlers and folder-aware request destinations, without changing partial-save config preservation. TASK-035 adds bounded metadata-only search; caller, destination and workspace ownership are validated in main. No generic IPC or credential-bearing tree/search DTO is permitted. See [API library specification](api-library.md) for the authoritative new behavior, bounds, intermediate export gate and task mapping. Folder/tree operations and bounded search are implemented in source (TASK-033–035); v2 transfer is implemented in TASK-036; packaged acceptance remains TASK-037.

### TASK-033 destination and folder contracts

Request summaries/editors include nullable `folderId`. Create accepts an optional `folderId` (omitted means null); Move accepts an optional fourth folder argument (omitted means null). A non-null folder requires a matching owned collection. Save accepts configuration fields only and preserves placement; Duplicate retains placement while copying secret records independently. Folder calls return `{workspaceId,collections,folders}` with validated owned metadata and hierarchy, never request configurations or credentials. Reads and mutations require the active workspace and exact owned main frame. Folder creation is capped at 1,000; reads/edit/removal do not truncate larger legacy libraries. All hierarchy mutations are transactional and enforce depth 16/cycle checks.

Until TASK-036, `transfer.exportWorkspace` returns `FOLDER_EXPORT_UNAVAILABLE` for a workspace containing any folders, even empty ones, before opening the save dialog. It rechecks after the dialog before starting a write. Folder-free workspace transfer remains v1. No tree UI/search/persistence-write API is introduced by TASK-033.

### TASK-034 metadata and expansion API

`library.list` returns a strict owned `{workspaceId,collections,folders,requests,treeState}` snapshot in one read transaction. Requests carry metadata (ID/name/saved method/destination/timestamps) only; no body, URL, auth/secret value or response is loaded for browsing. Cross-entity duplicate identities, orphan/foreign destinations and expansion IDs reject. `library.setExpansion` accepts only two unique bounded UUID arrays (at most 1,000 each), persists version 1 and returns validated state. Main checks the active workspace and exact owned frame for both calls; foreign/missing IDs reject before any write. Restoration prunes stale IDs. No generic UI-settings runner, drafts, paths, search query or response persistence is added.

## TASK-035 search and continuation

`requests.search` is a fixed frozen bridge method. Main checks the exact owned frame and active workspace. Input is strict: query at most 200 UTF-16 code units, optional owned collection UUID (null/omitted means all collections), safe nonnegative integer offset and limit 1–100. Offset above zero requires a 64-character hexadecimal revision returned by the first page. Unknown/deleted/foreign collection IDs return `NOT_FOUND`; malformed input, out-of-range offset or stale/mismatched revision returns `VALIDATION` without mutation.

The validated reply contains `{workspaceId,query,collectionId,offset,limit,revision,total,nextOffset,rows}`. Rows are request metadata plus a full container path; no config, URL, body, headers, variables, credential or response values. `nextOffset` is null at the end, otherwise the exact following offset. Main sorts by path/name/method/ID using deterministic code-point comparison. Search trims and NFC-normalizes the query and folds Latin case; matching is literal substring against name, method or path separately. Punctuation has no wildcard/regex interpretation.

Revision is a SHA-256 digest of owned library metadata and normalized query/filter/page size. Selection and expansion do not invalidate it; metadata mutation does. It is a consistency token, never authorization. Continuation cannot combine different queries/filters/sizes/revisions. The UI discards obsolete replies, restarts at offset zero after metadata refresh, and offers explicit retry from the first page on failure.

## TASK-036 folder-aware transfer

Existing owned transfer channels and main-owned preview token lifecycle remain. Strict import preview adds `folders: string[]` containing only names; its length supplies the folder count. No config, parent IDs, source bytes or file path crosses the preview boundary. Main validates complete v1/v2 input before preview and export always emits v2; request configuration stays v1. Native choosers and atomic files remain main-owned. See [transfer specification](import-export.md).
