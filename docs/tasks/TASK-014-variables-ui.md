# TASK-014 — Build environments and variables management

Status: todo
Dependencies: TASK-007, TASK-012, TASK-013

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/variables.md](../variables.md)
- [docs/ui-flows.md](../ui-flows.md)
- [docs/ipc-contract.md](../ipc-contract.md)

## Goal and scope

Implement environment CRUD/selection and workspace/environment variable CRUD UI, validation and masking/reveal. Main loads only owned scope; preserve last environment per workspace.

## Acceptance criteria

Environment override works; active deletion selects None; duplicate scope key rejected; list values masked; session-only/missing sensitive state visible; restart restores secure values when supported.

## Verification

Scope/repository/IPC tests and two-workspace variable UI smoke.

## Excluded from this task

No global variables, automatic response token extraction or scripts.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-014.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
