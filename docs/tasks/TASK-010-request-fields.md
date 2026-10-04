# TASK-010 — Build query/header/settings editors

Status: done
Dependencies: TASK-009

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/ipc-contract.md](../ipc-contract.md)
- [docs/ui-flows.md](../ui-flows.md)
- [docs/request-engine.md](../request-engine.md)

## Goal and scope

Add ordered enabled key/value rows for Params/Headers and timeout/redirect settings. Preserve duplicates/order and disabled entries in saved config. Display field-path validation errors.

## Acceptance criteria

Add/edit/remove/toggle rows stable; duplicate query keys supported; timeout limits validated; default redirects OFF; state saves/reopens without loss.

## Verification

Focused state/schema tests and keyboard row-edit smoke.

## Excluded from this task

No network behavior or auth UI.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-010.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
