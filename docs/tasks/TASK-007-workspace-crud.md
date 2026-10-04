# TASK-007 — Connect workspace CRUD and selection

Status: done
Dependencies: TASK-005, TASK-006

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/product.md](../product.md)
- [docs/ui-flows.md](../ui-flows.md)
- [docs/ipc-contract.md](../ipc-contract.md)

## Goal and scope

Implement validated workspace IPC/service operations and UI create/rename/select/delete. Persist selection; restore valid selection on startup; add deletion consequence dialog.

## Acceptance criteria

CRUD persists after restart; separate workspaces display only owned metadata; invalid names rejected; deleting active workspace selects valid fallback/empty state.

## Verification

Repository/handler checks and create/select/delete/restart UI smoke.

## Excluded from this task

No automatic example data, request sends or dirty-draft flow yet.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-007.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

Evidence: [TASK-007 report](../task-reports/TASK-007.md). Linux source-app CRUD/restart verified; Windows and packaged-app acceptance remain unverified.
