# TASK-004 — Implement SQLite bootstrap and migrations

Status: todo
Dependencies: TASK-003

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/data-model.md](../data-model.md)
- [docs/architecture.md](../architecture.md)
- [docs/setup.md](../setup.md)

## Goal and scope

Open database under userData, enable foreign keys, implement migration runner and schema/indexes. Pin/rebuild SQLite binding for Electron. Add sanitized startup failure screen and shutdown cleanup.

## Acceptance criteria

Clean and existing database startup work; injected migration failure rolls back without deletion; workspace composite FK constraints reject invalid relations; native binding loads in development Electron.

## Verification

Temporary-db migration/reopen/rollback/constraint tests plus Electron native binding smoke.

## Excluded from this task

No renderer CRUD or alternate database server.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-004.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
