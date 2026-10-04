export const initialSchema = `
CREATE TABLE workspaces (
 id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE collections (
 id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL, sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(id,workspace_id)
);
CREATE TABLE environments (
 id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(id,workspace_id)
);
CREATE TABLE secrets (
 id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 encrypted_value BLOB, storage_mode TEXT NOT NULL CHECK(storage_mode IN ('secure','session')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(id,workspace_id),
 CHECK((storage_mode='secure' AND encrypted_value IS NOT NULL AND typeof(encrypted_value)='blob') OR
       (storage_mode='session' AND encrypted_value IS NULL))
);
CREATE TABLE requests (
 id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 collection_id TEXT, name TEXT NOT NULL, config_version INTEGER NOT NULL CHECK(config_version=1),
 config_json TEXT NOT NULL CHECK(json_valid(config_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(id,workspace_id), FOREIGN KEY(collection_id,workspace_id) REFERENCES collections(id,workspace_id)
);
CREATE TABLE variables (
 id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 environment_id TEXT, key TEXT NOT NULL COLLATE BINARY,
 is_sensitive INTEGER NOT NULL CHECK(is_sensitive IN (0,1)), plain_value TEXT, secret_id TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 FOREIGN KEY(environment_id,workspace_id) REFERENCES environments(id,workspace_id),
 FOREIGN KEY(secret_id,workspace_id) REFERENCES secrets(id,workspace_id),
 CHECK((is_sensitive=0 AND plain_value IS NOT NULL AND secret_id IS NULL) OR
       (is_sensitive=1 AND plain_value IS NULL AND secret_id IS NOT NULL))
);
CREATE TABLE workspace_state (
 workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 active_environment_id TEXT, selected_request_id TEXT,
 FOREIGN KEY(active_environment_id,workspace_id) REFERENCES environments(id,workspace_id),
 FOREIGN KEY(selected_request_id,workspace_id) REFERENCES requests(id,workspace_id)
);
CREATE TABLE app_settings (
 key TEXT PRIMARY KEY NOT NULL CHECK(key IN ('theme','lastWorkspaceId')),
 value_json TEXT NOT NULL CHECK(json_valid(value_json))
);
CREATE INDEX collections_workspace ON collections(workspace_id);
CREATE INDEX environments_workspace ON environments(workspace_id);
CREATE INDEX requests_workspace_collection ON requests(workspace_id,collection_id);
CREATE INDEX secrets_workspace ON secrets(workspace_id);
CREATE INDEX variables_workspace ON variables(workspace_id);
CREATE INDEX variables_environment_workspace ON variables(environment_id,workspace_id);
CREATE INDEX variables_secret_workspace ON variables(secret_id,workspace_id);
CREATE INDEX state_environment_workspace ON workspace_state(active_environment_id,workspace_id);
CREATE INDEX state_request_workspace ON workspace_state(selected_request_id,workspace_id);
CREATE UNIQUE INDEX variables_workspace_key ON variables(workspace_id,key) WHERE environment_id IS NULL;
CREATE UNIQUE INDEX variables_environment_key ON variables(environment_id,key) WHERE environment_id IS NOT NULL;
`
