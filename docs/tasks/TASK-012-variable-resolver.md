# TASK-012 — Implement pure variable resolution

Status: todo
Dependencies: TASK-002

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/variables.md](../variables.md)
- [docs/request-engine.md](../request-engine.md)

## Goal and scope

Implement case-sensitive scope merge and single-pass interpolation with field paths. Resolve all supported enabled locations; preserve templates; post-substitution JSON/URL/header validation hooks.

## Acceptance criteria

All cases in variables.md pass, including empty override, inactive/other workspace exclusion, disabled missing variable, nested-looking output and JSON quoting failure.

## Verification

Pure deterministic unit tests; no network access in tests.

## Excluded from this task

No variables UI, persistence encryption or sockets.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-012.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
