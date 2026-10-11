# Workspace transfer format v1

Only the app's own format is supported. Postman compatibility is deferred.

## Shape

```json
{
  "format": "offline-api-client-workspace",
  "version": 1,
  "exportedAt": "2026-10-03T00:00:00.000Z",
  "workspace": {
    "id": "source-workspace-id",
    "name": "Clinic API",
    "collections": [],
    "environments": [],
    "variables": [],
    "requests": []
  }
}
```

Collection: `{id,name,sortOrder}`. Environment: `{id,name}`. Variable: `{id,environmentId:null|id,key,isSensitive,value?:string,requiresValue:boolean}`. Plain variable includes value and requiresValue=false. Sensitive variable omits value and requiresValue=true. Request: `{id,collectionId:null|id,name,config}` where config uses export schema, ordered rows and body modes from data-model.md.

Auth export preserves mode and template expressions that contain only placeholders/whitespace; omit credential literals and mixed literal/template strings, replacing with empty and `requiresCredentials:true`. Even non-sensitive variable references are retained as templates; users are responsible for classifying their variables correctly. Header credential rows are empty and disabled. File parts include field name, fileName and fileSize only, with `requiresSelection:true`; no path or capability. No secret database IDs, state, active environment selection or responses.

## Export operation

Load a consistent workspace snapshot. Construct export DTO explicitly from an allowlist; never dump database rows/config directly. Validate generated JSON, then native save dialog. Write atomically via same-directory temp file + rename; cancellation leaves no file. Never overwrite database or app files. Dialog explains exclusions and remaining ordinary-field risk. File JSON is UTF-8, human-readable.

## Import operation

Native open dialog, read max 10 MiB, parse JSON with strict schemas. Validate all entities before writing and provide summary preview containing only names/counts and omissions. Preview token is main-owned and refers to validated bytes; re-reading changed bytes requires a new preview. Confirm Import as new workspace.

Limits: at most 100 collections, 50 environments, 1,000 requests, 100 variables per scope; row/text/body limits from IPC/engine also apply. Reject unsupported version/format, duplicate source IDs, duplicate variable keys per scope, orphan references, cross-scope relationships, invalid names/config, secret values in sensitive exported records, unknown executable/script fields and any file path/capability fields. Never eval or send imported content. Exceeding a limit gives an explicit import error.

Generate fresh UUIDs for every entity and remap collection/environment references. Import never merges with or overwrites an existing workspace. Append ` (imported)` to workspace name, truncating safely to 100 characters; identical names are still allowed. Default active environment None and no selected request. Sensitive values create unresolved session secret records; literal auth credentials require re-entry; upload parts require selection. Commit the entire workspace in one transaction; on failure zero partial entities remain. Remove preview token after success/cancel.

## Verification

Round-trip non-secret settings/ordered duplicate rows/templates intact with fresh IDs. Confirm exported synthetic secrets, file paths, raw secret IDs and responses absent. Sensitive omissions remain visibly unresolved until supplied. Invalid import leaves existing data byte-for-byte logically unchanged. Cancel open/save/preview is neutral and does not modify data.

## Approved next milestone: transfer v2

TASK-036 implements the linked v2 folder/request shape and validates hierarchy before preview, while continuing to import v1. Request configuration remains version 1. Retain all existing omissions, limits and atomicity; add a 1,000-folder limit and depth 16. TASK-033 must first prevent v1 export from silently dropping folders; folder-free v1 transfer remains available until v2 is implemented. See [API library specification](api-library.md) for the authoritative new behavior, bounds, intermediate export gate and task mapping. These changes are approved but not implemented.
