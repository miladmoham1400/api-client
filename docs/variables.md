# Variables and environments

## Scope and identity

A workspace owns variables and environments. A variable belongs to either workspace scope (environmentId NULL) or exactly one environment. Keys are case-sensitive and unique within their scope. Allowed key regex: `^[A-Za-z_][A-Za-z0-9_]{0,63}$`. Values are strings, including empty string.

Priority: selected environment > workspace. Environment None uses only workspace variables. Other workspaces and inactive environments never participate. A present empty string overrides the lower scope; it is not missing.

## Template syntax

`{{key}}` and `{{ key }}` resolve the same key. Trim only whitespace inside braces. Resolve a single pass; substituted values containing `{{...}}` remain literal. No recursion, functions, scripts, defaults, nested variables or global variables. A paired placeholder whose key is invalid is a validation error. Unmatched `{{`/`}}` are ordinary text.

Resolution runs in main on a captured send snapshot. If an enabled field contains a missing variable or unresolved sensitive value, reject before any socket is opened, and identify key and field path without revealing its value. Disabled rows are ignored completely, including validation and missing-variable checks.

## Supported locations

- URL template (including any embedded query), query keys/values, header keys/values.
- JSON/raw body text, URL-encoded keys/values, multipart text field keys/values and file field keys.
- Auth token, Basic username/password.
- Not request names, collection names, timeout, file paths, file names or methods.

Substitution is textual, never automatically JSON-escapes a value. Validate JSON after substitution; report a field error if invalid. A variable containing a quote inside a quoted JSON string may therefore require the user to supply an appropriately escaped value. Do not silently change the JSON or coerce values.

URL-template substitution does not guess path encoding. Query row names/values are appended using URLSearchParams encoding exactly once. Existing URL query is retained; enabled rows append in order. This permits repeated keys. `%2F` in a query row value is literal input and becomes `%252F`; a URL's pre-encoded query follows URL parser semantics.

## UI

Environment selector per workspace includes None. Variables panel switches explicitly between Workspace and selected environment; show source when inspecting effective values. New/rename/delete environment are local operations. Sensitive checkbox gives masked input and storage-capability message; see secrets.md.

Editing variables changes subsequent sends only; it never changes an active execution or saved templates. Changing workspace restores that workspace's environment choice. Deleting active environment selects None atomically.

## Required behavioral cases

1. Workspace host overridden by environment host.
2. Empty override, case-sensitive different keys and duplicate-key rejection.
3. None/inactive environment and other-workspace exclusion.
4. Disabled row with missing variable does not block send.
5. Missing variable gives field-specific error and zero fixture requests.
6. Nested-looking substituted value is not resolved twice.
7. JSON validates after substitution; templates remain unchanged.
8. Sensitive values resolve only in main; redaction in logs/export.
