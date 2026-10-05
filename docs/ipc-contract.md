# Main/preload/renderer contract

## Envelope

`Result<T> = {ok:true,data:T} | {ok:false,error:{code,message,field?,retryable}}`.
Runtime-validate incoming payloads and outgoing shared DTOs. Do not return stacks, raw filesystem errors, ciphertext, Node objects, buffers or Electron event objects. Use serializable values. UUIDs are IDs, not authorization: every handler verifies sender and workspace ownership.

## Narrow API

| Group | Methods |
|---|---|
| app | getBootstrap(), setTheme(theme), requestCloseDecision(decision) |
| workspaces | list(), create(name), rename(id,name), delete(id), select(id) |
| collections | list(workspaceId), create(workspaceId,name), rename(workspaceId,id,name), delete(workspaceId,id) |
| environments | list(workspaceId), create(workspaceId,name), rename(workspaceId,id,name), delete(workspaceId,id), select(workspaceId,idOrNull) |
| variables | list(workspaceId,environmentIdOrNull), upsert(workspaceId,scope,key,value,isSensitive), delete(workspaceId,id), reveal(workspaceId,id) |
| requests | newRow(workspaceId), list(workspaceId), get(workspaceId,id), create(workspaceId,input), save(workspaceId,id,input), duplicate(workspaceId,id), delete(workspaceId,id), move(workspaceId,id,collectionIdOrNull) |
| files | chooseUpload(workspaceId) -> opaque file ID + name + size; releaseUpload(workspaceId,fileId) |
| execution | send(workspaceId,requestIdOrNull,draft,environmentIdOrNull), cancel(executionId), onCompleted(callback) -> unsubscribe |
| transfer | exportWorkspace(workspaceId) using native save dialog; chooseImport() -> validated preview token; importWorkspace(previewToken) |

These are API shapes, not instructions to expose a generic `invoke(channel,args)` function. Use explicit contextBridge functions and schema allowlists.

`requests.newRow` returns a main-generated UUID and a blank enabled key/value row for a draft in the active owned workspace. It does not persist a request or row. Query/header arrays and timeout/redirect settings are validated on explicit create/save; omitted settings in a partial save preserve their stored values.

Request create/save accepts an optional active body: `none`, `json` source text, `raw` text/mediaType, ordered `urlencoded` text rows, or ordered `multipart` text/file rows. Inactive mode drafts never enter the payload. Text bodies enforce the 5 MiB UTF-8 limit; all body modes enforce GET/HEAD body prohibition. JSON syntax is validated after substitution during materialization. Omitted body preserves stored configuration. Multipart file rows may submit an ephemeral `fileId` for Send, but persistence strips it and retains only file name/size display metadata. Editor snapshots return saved metadata without live capabilities; opening/restarting requires reselection. Saving in the current editor preserves its live selection independently from saved data. Strict schemas reject arbitrary path fields.

Request create/save also accepts optional auth: None, Bearer token, or Basic username/password. Credential draft fields use `{kind:'value',value}` to enter a literal/template or `{kind:'keep'}` to retain the matching field of the owned saved request. Keep cannot introduce an arbitrary secret handle or initialize a new credential. Template-only strings may remain in configuration; literal-bearing strings use SecretStore records. Auth editor snapshots return templates or `{kind:'stored',hasValue,storageMode}` without secret IDs or plaintext literals. Omitted auth preserves existing configuration. Main-only materialization resolves captured variables/credentials and returns immutable metadata plus defensive body-byte copies; no resolved snapshot API is exposed to renderer in TASK-015.

Sensitive variables list returns presence, masked display and persistence capability, not plaintext. Reveal/edit happens only on explicit user action. Draft auth inputs may contain templates or ephemeral literals. Main stores credential literals through the secret store and redacts list responses. Requests.get for editing can return decrypted credentials only to the owned window and only for the selected request.

Environment snapshots include owned environments, active selection and current secure/session storage capability. Variable lists include the requested owned scope and a masked effective preview from workspace plus selected environment, with source environment IDs. Preview does not decrypt or interpolate values. `variables.upsert` accepts an optional final variable ID: omit/null for a new key (duplicates in that scope fail), or supply the owned existing ID to edit that key's value/sensitive designation. Existing keys are fixed during edit. Reveal returns only `{value}` to the owned window; no secret ID or ciphertext is returned.

`execution.send` returns `{executionId}` after validation and snapshot materialization; actual network operation starts asynchronously. `onCompleted` receives `{executionId,result:HttpResponse|ExecutionError}` once. Emit completion after the invocation result is delivered or maintain a main-side retrievable completion record so very fast responses cannot race subscription setup. Register listener before enabling Send. Listener cleanup prevents accumulation.

`files.chooseUpload` accepts only an existing workspace UUID and opens a main-owned native single-file dialog. Success returns `{fileId,name,size}` (no path); ordinary cancellation returns `{ok:true,data:null}`. Selection must be a readable regular file no larger than 20 MiB. `releaseUpload` accepts only workspace/file UUIDs and returns `null`; unknown, released or foreign-workspace handles return the same sanitized `FILE_REQUIRED`. Deleting a workspace, renderer reload/crash, window close and app exit invalidate its capabilities; pending dialogs cannot recreate them after invalidation. Main-only `UploadService.captureForSend` captures selected capabilities, then reopens and validates enabled file rows before each multipart connection, with row-specific errors and a 50 MiB total limit. Saved/imported file rows retain only display metadata and require reselection. Multipart uses a private replayable streaming body source, with engine-generated boundary/Content-Type/known Content-Length, a 55 MiB serialized limit and cleanup on every terminal path. Releasing a draft selection does not alter an accepted execution; allowed body-preserving redirects reopen its captured files. No resolved body, descriptor or stream crosses IPC.

## Domain errors

VALIDATION, NOT_FOUND, OWNERSHIP, DATABASE_UNAVAILABLE, DATABASE_WRITE_FAILED, VARIABLE_MISSING, SECRET_UNAVAILABLE, FILE_REQUIRED, FILE_CHANGED, FILE_TOO_LARGE, REQUEST_BUSY, INVALID_URL, INVALID_HEADER, AUTH_CONFLICT, CONTENT_TYPE_CONFLICT, UNSUPPORTED_SCHEME, TIMEOUT, CANCELLED, DNS_FAILURE, CONNECTION_REFUSED, TLS_FAILURE, NETWORK_FAILURE, RESPONSE_TOO_LARGE, DECOMPRESSION_FAILURE, REDIRECT_LIMIT, REDIRECT_DOWNGRADE, INVALID_IMPORT, UNSUPPORTED_FORMAT_VERSION, IMPORT_TOO_LARGE.

HTTP status 4xx/5xx is a successful transport result. User cancellation of file open/save dialogs is an ordinary cancelled operation, not a red failure toast. Repository mutation errors leave UI data intact. Missing/unauthorized IDs share sanitized not-found behavior where appropriate.

## Payload limits

At boundary enforce names, timeout range, max 200 query/header/form rows per group, 100 variable entries per scope, 10,000 characters per row value/variable value/URL template, max 5 MiB raw/JSON text body and limits in request-engine.md/import-export.md. Field-specific validation messages identify the failing row without echoing credential values.
