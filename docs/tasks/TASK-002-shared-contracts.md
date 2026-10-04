# TASK-002 — Define shared validated domain contracts

Status: todo
Dependencies: TASK-001

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/data-model.md](../data-model.md)
- [docs/ipc-contract.md](../ipc-contract.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/import-export.md](../import-export.md)

## Goal and scope

Create versioned discriminated DTOs and Zod schemas for rows, bodies, auth, errors, stored/runtime/export config and limits. Provide stable UUID/field-path handling and typed result envelopes.

## Acceptance criteria

Invalid timeout/name/body/type/row limits rejected; ordered duplicate query/form rows preserved; no any-based bypass; runtime/stored/export schemas are distinct.

## Verification

Focused schema tests for valid variants, disabled-row policy, unknown dangerous fields and invalid payloads.

## Excluded from this task

No IPC handlers or networking.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-002.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
