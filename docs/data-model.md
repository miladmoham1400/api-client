# Local data model

## Conventions

Use UUID text IDs generated in main, UTC ISO-8601 timestamps and integer booleans with CHECK constraints. Foreign keys ON for every connection. Parameterized statements only. Apply numbered migrations once in a transaction; failure rolls back and blocks normal startup. Use `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`.

| Table | Columns and purpose |
|---|---|
| workspaces | id PK, name, created_at, updated_at |
| collections | id PK, workspace_id FK cascade, name, sort_order, created_at, updated_at; UNIQUE(id,workspace_id) for composite references |
| environments | id PK, workspace_id FK cascade, name, created_at, updated_at; UNIQUE(id,workspace_id) |
| requests | id PK, workspace_id FK cascade, collection_id nullable, name, config_version=1, config_json, created_at, updated_at |
| variables | id PK, workspace_id FK cascade, environment_id nullable, key, is_sensitive, plain_value nullable, secret_id nullable, created_at, updated_at |
| secrets | id PK, workspace_id FK cascade, encrypted_value BLOB nullable, storage_mode (`secure` or `session`), created_at, updated_at; UNIQUE(id,workspace_id) |
| workspace_state | workspace_id PK FK cascade, active_environment_id nullable, selected_request_id nullable |
| app_settings | key PK, value_json (theme and last workspace only) |

## Integrity

- Requests `(collection_id,workspace_id)` references collections `(id,workspace_id)`. Environments and secret references use the same composite ownership pattern.
- Variables `(environment_id,workspace_id)` references environments. On environment deletion remove its variables explicitly inside the transaction before removing the environment.
- Partial unique indexes: `(workspace_id,key)` WHERE environment_id IS NULL; `(environment_id,key)` WHERE environment_id IS NOT NULL. Key comparison is case-sensitive.
- Non-sensitive variable: plain_value NOT NULL, secret_id NULL. Sensitive: plain_value NULL, secret_id NOT NULL. A session secret has no ciphertext; its in-memory value disappears on shutdown. An unresolved imported sensitive variable uses a session secret record with no in-memory value.
- workspace_state selected IDs must belong to its workspace; enforce composite FKs plus service-level validation. Clear selections explicitly before deleting selected requests/environments.
- Index workspace foreign keys and `(workspace_id,collection_id)` requests. Database constraints supplement, not replace, main-service ownership checks.
- Name validation and config schemas run in services before writes. Duplicate display names are allowed.

## Request configuration JSON v1

Store validated discriminated-union data, not executable code:

- method, urlTemplate, queryRows and headerRows: `{id,key,value,enabled}` ordered arrays.
- body: `none` | `json` with text | `raw` with text and mediaType | `urlencoded` with ordered text rows | `multipart` with ordered `{id,key,kind,enabled,value? ,fileName?,fileSize?}` rows. File capabilities are session-only and excluded from persisted JSON.
- auth: `none` | `bearer` with token template | `basic` with username/password templates. Credential-bearing literals use internal secret references in the stored form; shared UI DTOs do not expose ciphertext.
- timeoutMs, followRedirects.

Maintain separate runtime, stored and export schemas. Do not serialise them interchangeably. Ordered arrays preserve duplicate parameters, header rows and multipart fields.

## Transactions and lifecycle

Workspace deletion: abort its execution first, then delete descendants and secret records in one transaction. Collection deletion: move requests to root then delete collection, one transaction. Request deletion/duplication handles independently owned auth secrets in the same transaction. Variable conversion/deletion removes orphan secret records. Import creates a full workspace atomically. Draft/response/history are not stored.

Do not store absolute local upload paths, decrypted sensitive values, resolved request snapshots, response payloads or actual tokens in logs. Raw body/URL/header values that users enter without a sensitive designation remain ordinary plaintext configuration; see secrets.md.

Persist active environment selection per workspace. Unknown stale IDs fall back to None/root without leaking another workspace's selection.

## Migrations

The first migration creates the complete schema and constraints. Later changes use append-only migrations. Verify migration replay on a clean database, reopening an existing database, rollback on injected failure and cross-workspace FK rejection. Back up the closed database before destructive future migrations; phase 1 does not invent an automated backup service.
