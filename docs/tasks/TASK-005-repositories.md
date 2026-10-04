# TASK-005 — Implement workspace-scoped repositories

Status: todo
Dependencies: TASK-004

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/data-model.md](../data-model.md)
- [docs/ipc-contract.md](../ipc-contract.md)

## Goal and scope

Add parameterized repositories for workspaces, collections, requests, environments, variables/state and secret records. Implement transactional deletion/move/duplication metadata logic, leaving encryption integration to TASK-013.

## Acceptance criteria

Cross-workspace IDs never read/update another workspace; partial unique keys enforced; collection deletion preserves requests at root; selected IDs cleared safely; rollback leaves consistent data.

## Verification

Temporary-db ownership/deletion/selection/unique-key tests, including injected write failure.

## Excluded from this task

No HTTP, UI, or plaintext secret fallback.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-005.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
