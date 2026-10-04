# TASK-008 — Connect collection CRUD and request grouping

Status: done
Dependencies: TASK-007

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/data-model.md](../data-model.md)
- [docs/ui-flows.md](../ui-flows.md)

## Goal and scope

Implement one-level collection UI and IPC create/rename/delete plus grouping/move support. Collection deletion moves existing requests to root transactionally.

## Acceptance criteria

Collections belong to active workspace; duplicate names are ID-distinct; root grouping valid; cannot move requests across workspace; delete semantics match specification.

## Verification

Ownership/move/delete tests; sidebar CRUD smoke using temporary saved request fixtures.

## Excluded from this task

No nested collections or drag-and-drop requirement.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-008.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

Evidence: [TASK-008 report](../task-reports/TASK-008.md). Linux source-app sidebar/move/delete verified; Windows and packaged-app acceptance remain unverified.
