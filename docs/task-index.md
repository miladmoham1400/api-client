# Ordered task index

Execute one task at a time unless explicitly instructed otherwise. Follow dependencies; numerical order is the default. A task marked blocked does not become done because its code exists. Early UI/feature tasks may show unavailable states for later features, but must not present fake successes. No task is completed by this planning pack.

There are 30 tasks: foundation (001–006), local project/request features (007–015), transport and response (016–019), forms/files and draft handling (020–023), transfer and polish (024–026), acceptance and release (027–030).

| Order | Task | Dependencies | Status |
|---|---|---|---|
| 1 | [TASK-001 — Establish compatible toolchain and build skeleton](tasks/TASK-001-toolchain-baseline.md) | None | done |
| 2 | [TASK-002 — Define shared validated domain contracts](tasks/TASK-002-shared-contracts.md) | TASK-001 | done |
| 3 | [TASK-003 — Secure Electron lifecycle and preload boundary](tasks/TASK-003-electron-boundary.md) | TASK-002 | done |
| 4 | [TASK-004 — Implement SQLite bootstrap and migrations](tasks/TASK-004-sqlite-migrations.md) | TASK-003 | done |
| 5 | [TASK-005 — Implement workspace-scoped repositories](tasks/TASK-005-repositories.md) | TASK-004 | done |
| 6 | [TASK-006 — Build Chakra desktop shell](tasks/TASK-006-ui-shell.md) | TASK-003 | done |
| 7 | [TASK-007 — Connect workspace CRUD and selection](tasks/TASK-007-workspace-crud.md) | TASK-005, TASK-006 | done |
| 8 | [TASK-008 — Connect collection CRUD and request grouping](tasks/TASK-008-collection-crud.md) | TASK-007 | done |
| 9 | [TASK-009 — Implement saved requests and editor drafts](tasks/TASK-009-request-persistence.md) | TASK-008, TASK-002 | done |
| 10 | [TASK-010 — Build query/header/settings editors](tasks/TASK-010-request-fields.md) | TASK-009 | done |
| 11 | [TASK-011 — Build JSON/raw body editing](tasks/TASK-011-text-body-editor.md) | TASK-010 | done |
| 12 | [TASK-012 — Implement pure variable resolution](tasks/TASK-012-variable-resolver.md) | TASK-002 | done |
| 13 | [TASK-013 — Implement secure and session-only secret store](tasks/TASK-013-secret-store.md) | TASK-005 | done |
| 14 | [TASK-014 — Build environments and variables management](tasks/TASK-014-variables-ui.md) | TASK-007, TASK-012, TASK-013 | done |
| 15 | [TASK-015 — Implement auth editing and request materialization](tasks/TASK-015-request-materialization.md) | TASK-011, TASK-012, TASK-013, TASK-014 | done |
| 16 | [TASK-016 — Implement single-hop HTTP transport](tasks/TASK-016-http-transport.md) | TASK-015, TASK-003 | done |
| 17 | [TASK-017 — Implement documented redirect policy](tasks/TASK-017-redirect-policy.md) | TASK-016 | done |
| 18 | [TASK-018 — Implement overall timeout and cancellation](tasks/TASK-018-cancel-timeout.md) | TASK-017 | done |
| 19 | [TASK-019 — Build response viewer and execution feedback](tasks/TASK-019-response-viewer.md) | TASK-018, TASK-006 | done |
| 20 | [TASK-020 — Add URL-encoded form requests](tasks/TASK-020-urlencoded-body.md) | TASK-019 | done |
| 21 | [TASK-021 — Implement upload file capabilities](tasks/TASK-021-upload-capabilities.md) | TASK-013, TASK-019 | todo |
| 22 | [TASK-022 — Add multipart text/file requests](tasks/TASK-022-multipart-body.md) | TASK-020, TASK-021, TASK-017, TASK-018 | todo |
| 23 | [TASK-023 — Finish draft navigation and destructive-action guards](tasks/TASK-023-draft-navigation.md) | TASK-022, TASK-007, TASK-008, TASK-009 | todo |
| 24 | [TASK-024 — Implement safe workspace JSON export](tasks/TASK-024-workspace-export.md) | TASK-023, TASK-013 | todo |
| 25 | [TASK-025 — Implement previewed transactional workspace import](tasks/TASK-025-workspace-import.md) | TASK-024 | todo |
| 26 | [TASK-026 — Complete themes and accessibility polish](tasks/TASK-026-theme-accessibility.md) | TASK-025 | todo |
| 27 | [TASK-027 — Run integrated offline acceptance and close defects](tasks/TASK-027-offline-acceptance.md) | TASK-026 | todo |
| 28 | [TASK-028 — Package and verify Linux build](tasks/TASK-028-linux-package.md) | TASK-027 | todo |
| 29 | [TASK-029 — Package and verify Windows build](tasks/TASK-029-windows-package.md) | TASK-027 | todo |
| 30 | [TASK-030 — Write user guide and release acceptance record](tasks/TASK-030-release-documentation.md) | TASK-028, TASK-029 | todo |

## Progress protocol

Allowed statuses: todo, in_progress, blocked, done. Keep task file and table synchronized. Record actual evidence in docs/task-reports/TASK-NNN.md during implementation. The report directory and verified toolchain/release guides are intentionally not populated by this planning pack.

TASK-028 and TASK-029 share TASK-027 as dependency, so Windows packaging can proceed even if Linux-specific validation is blocked. TASK-030 needs both OS tasks complete. Do not create agent workers unless explicitly requested by the user.
