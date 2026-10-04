# TASK-020 — Add URL-encoded form requests

Status: todo
Dependencies: TASK-019

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/ui-flows.md](../ui-flows.md)

## Goal and scope

Implement form row editor and main serializer using URLSearchParams. Resolve enabled field keys/values; preserve duplicate keys/order; enforce Content-Type rule.

## Acceptance criteria

Empty values, repeated keys, Unicode and literal percent characters reach fixture correctly; disabled/missing variables ignored as specified; saved forms reopen.

## Verification

Local form echo wire tests and editor save/send smoke.

## Excluded from this task

No multipart or file picker.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-020.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
