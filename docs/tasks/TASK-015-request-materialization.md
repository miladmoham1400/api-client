# TASK-015 — Implement auth editing and request materialization

Status: done
Dependencies: TASK-011, TASK-012, TASK-013, TASK-014

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/variables.md](../variables.md)
- [docs/secrets.md](../secrets.md)

## Goal and scope

Add None/Bearer/Basic editor and safe literal credential persistence. Build main-side immutable snapshot materializer: variables, URL/query, headers/auth and None/JSON/Raw serialization. Reject auth/content-type/managed-header conflicts.

## Acceptance criteria

No renderer-resolved secrets; correct auth bytes/query encoding and raw Unicode; GET/HEAD body rejected; missing variable/conflict fails before socket; saved templates unchanged.

## Verification

Materialization/auth/query/body tests with synthetic secrets and malformed fields.

## Excluded from this task

No sockets, redirects or form serialization.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-015.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
