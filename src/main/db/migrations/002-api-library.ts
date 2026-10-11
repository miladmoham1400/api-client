/** Append-only library foundation. Keep foreign keys enabled and preserve selections explicitly. */
export const apiLibrarySchema = `
CREATE TABLE folders (
 id TEXT PRIMARY KEY NOT NULL,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 collection_id TEXT NOT NULL, parent_folder_id TEXT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(id,collection_id,workspace_id),
 FOREIGN KEY(collection_id,workspace_id) REFERENCES collections(id,workspace_id),
 FOREIGN KEY(parent_folder_id,collection_id,workspace_id) REFERENCES folders(id,collection_id,workspace_id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(parent_folder_id IS NULL OR parent_folder_id <> id)
);
CREATE INDEX folders_workspace_collection_parent ON folders(workspace_id,collection_id,parent_folder_id);
CREATE INDEX folders_parent_owner ON folders(parent_folder_id,collection_id,workspace_id);

CREATE TABLE requests_library (
 id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 collection_id TEXT, name TEXT NOT NULL, config_version INTEGER NOT NULL CHECK(config_version=1),
 config_json TEXT NOT NULL CHECK(json_valid(config_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 folder_id TEXT,
 UNIQUE(id,workspace_id), FOREIGN KEY(collection_id,workspace_id) REFERENCES collections(id,workspace_id),
 FOREIGN KEY(folder_id,collection_id,workspace_id) REFERENCES folders(id,collection_id,workspace_id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(folder_id IS NULL OR collection_id IS NOT NULL)
);
INSERT INTO requests_library(id,workspace_id,collection_id,name,config_version,config_json,created_at,updated_at)
 SELECT id,workspace_id,collection_id,name,config_version,config_json,created_at,updated_at FROM requests;
-- workspace_state is the only inbound request FK in the version-1 schema.
-- Copy/drop/recreate it in the same migration transaction so DROP requests never
-- deletes or invalidates selected IDs. No foreign_keys OFF or writable_schema.
CREATE TABLE library_state_backup AS SELECT * FROM workspace_state;
DROP TABLE workspace_state;
DROP TABLE requests;
ALTER TABLE requests_library RENAME TO requests;
CREATE TABLE workspace_state (
 workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 active_environment_id TEXT, selected_request_id TEXT,
 FOREIGN KEY(active_environment_id,workspace_id) REFERENCES environments(id,workspace_id),
 FOREIGN KEY(selected_request_id,workspace_id) REFERENCES requests(id,workspace_id)
);
INSERT INTO workspace_state SELECT * FROM library_state_backup;
DROP TABLE library_state_backup;
CREATE INDEX requests_workspace_collection ON requests(workspace_id,collection_id);
CREATE INDEX requests_workspace_folder ON requests(workspace_id,collection_id,folder_id);
CREATE INDEX requests_folder_owner ON requests(folder_id,collection_id,workspace_id);
CREATE INDEX state_environment_workspace ON workspace_state(active_environment_id,workspace_id);
CREATE INDEX state_request_workspace ON workspace_state(selected_request_id,workspace_id);

CREATE TABLE workspace_tree_state (
 workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version=1),
 expansion_json TEXT NOT NULL CHECK(json_valid(expansion_json) AND length(expansion_json) <= 100000)
);
`
