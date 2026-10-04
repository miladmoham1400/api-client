# TASK-018 — Implement overall timeout and cancellation

Status: todo
Dependencies: TASK-017

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/architecture.md](../architecture.md)
- [docs/ui-flows.md](../ui-flows.md)

## Goal and scope

Add full-lifecycle deadline and idempotent cancel through IPC. Track owned execution and close/workspace cleanup. Destroy sockets/streams/decoders; guard completion races; wire Send/Cancel button states.

## Acceptance criteria

Cancel/timeout terminal event exactly once; delayed/DNS/connect/upload/response covered by deadline; busy guard effective; next send succeeds; no leaked listeners/timers.

## Verification

Delayed/streaming fixture tests, timeout across redirects and completion/cancel race tests; UI cancel smoke.

## Excluded from this task

No infinite timeout or automatic retry.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-018.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
