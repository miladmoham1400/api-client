# Workspace transfer formats v1/v2

Export always emits v2; import accepts strict v1 and v2. Only the app's own format is supported. Postman compatibility is deferred.

## Shape

```json
{
  "format": "offline-api-client-workspace",
  "version": 2,
  "exportedAt": "2026-10-03T00:00:00.000Z",
  "workspace": {
    "id": "source-workspace-id",
    "name": "Clinic API",
    "collections": [],
    "folders": [],
    "environments": [],
    "variables": [],
    "requests": []
  }
}
```

Collection: `{id,name,sortOrder}`. Environment: `{id,name}`. Variable: `{id,environmentId:null|id,key,isSensitive,value?:string,requiresValue:boolean}`. Plain variable includes value and requiresValue=false. Sensitive variable omits value and requiresValue=true. Folder: `{id,collectionId,parentFolderId:null|id,name,sortOrder}`. V2 request: `{id,collectionId:null|id,folderId:null|id,name,config}` where config uses export schema, ordered rows and body modes from data-model.md.

Auth export preserves mode and template expressions that contain only placeholders/whitespace; omit credential literals and mixed literal/template strings, replacing with empty and `requiresCredentials:true`. Even non-sensitive variable references are retained as templates; users are responsible for classifying their variables correctly. Header credential rows are empty and disabled. File parts include field name, fileName and fileSize only, with `requiresSelection:true`; no path or capability. No secret database IDs, state, active environment selection or responses.

## Export operation

Load collections, folders, requests, environments and variables in one SQLite read transaction. Validate the full hierarchy, including empty folders, against that consistent saved snapshot. Construct export DTO explicitly from an allowlist; never dump database rows/config directly. Validate generated JSON and its 10 MiB UTF-8 byte limit before the native save dialog. Write atomically via same-directory temp file + rename; cancellation leaves no file. Never overwrite database or app files. Dialog explains exclusions and remaining ordinary-field risk. File JSON is UTF-8, human-readable.

## Import operation

Native open dialog, read max 10 MiB, parse JSON with strict schemas. Validate all entities before writing and provide summary preview containing only names/counts and omissions. Preview token is main-owned and refers to validated bytes; re-reading changed bytes requires a new preview. Confirm Import as new workspace.

Limits: at most 100 collections, 50 environments, 1,000 requests, 1,000 folders, folder depth 16, 100 variables per scope; row/text/body limits from IPC/engine also apply. Reject unsupported version/format, duplicate source IDs, duplicate variable keys per scope, orphan references, cross-scope relationships, invalid names/config, secret values in sensitive exported records, unknown executable/script fields and any file path/capability fields. Never eval or send imported content. Exceeding a limit gives an explicit import error.

Generate fresh UUIDs for every entity and ordered row, and remap collection/environment/folder references. Validate all parent references, same-collection membership, global entity IDs, acyclicity and bounded depth before preview or writes. Folder array order is arbitrary: insert a validated parent-before-child order in the transaction, preserving folder names and sort order. Requests retain workspace/collection/folder destinations. Import never merges with or overwrites an existing workspace. Append ` (imported)` to workspace name, truncating safely to 100 characters; identical names are still allowed. Default active environment None and no selected request. Sensitive values create unresolved session secret records; literal auth credentials require re-entry; upload parts require selection. Commit the entire workspace in one transaction; on failure zero partial entities remain. Remove preview token after success/cancel.

## Verification

Round-trip non-secret settings/ordered duplicate rows/templates intact with fresh IDs. Confirm exported synthetic secrets, file paths, raw secret IDs and responses absent. Sensitive omissions remain visibly unresolved until supplied. Invalid import leaves existing data byte-for-byte logically unchanged. Cancel open/save/preview is neutral and does not modify data.

## Compatibility and task boundary

V1 is the original strict envelope without `workspace.folders` or request `folderId`. Import v1 creates no folders and keeps all requests at their original workspace/collection root. A v1 file containing v2 fields is rejected rather than flattened. Transfer v2 requires `folders` (possibly empty) and nullable request `folderId`. Request `configVersion` stays 1 independently of transfer version. Unsupported formats/versions reject explicitly; old v1-only clients cannot import v2.

TASK-036 implements these source changes and replaces the temporary TASK-033 folder-export restriction. Preview exposes folder names and their count alongside existing entity names/counts and omission totals; it never exposes configs or paths. Successful/cancelled/replaced/lifecycle-cleared previews invalidate their token; changed on-disk bytes do not replace the validated content already previewed. Folder additions during an export chooser appear in the next export, because each export writes its earlier consistent saved snapshot.

No database migration, format interoperability, merging, publication or package version change is included. TASK-037 independently verifies fresh Linux/Windows packages and the complete library milestone. Existing v0.1.1 downloads do not contain these source changes. See [API library specification](api-library.md) and [TASK-036 evidence](task-reports/TASK-036.md).
