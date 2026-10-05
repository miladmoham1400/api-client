# TASK-021 — Implement upload file capabilities

Status: done
Dependencies: TASK-013, TASK-019

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/architecture.md](../architecture.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/ipc-contract.md](../ipc-contract.md)

## Goal and scope

Add main native file selection and workspace-scoped opaque capabilities. Verify regular file/size/readability and session lifecycle; persist only display metadata. Reject arbitrary renderer/import paths.

## Acceptance criteria

Cross-workspace/forged handles rejected; restart needs reselection; missing/changed-size/oversized files fail before send; renderer gets no absolute file path.

## Verification

Temporary-file capability/validation tests plus native dialog smoke.

## Excluded from this task

No directory uploads, persistent paths or multipart transport yet.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-021.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

## Evidence

See [TASK-021 report](../task-reports/TASK-021.md) for temporary-file/SQLite tests, real Linux native selection/cancel and lifecycle smoke, commands and limitations. Windows and packaged-app acceptance were not tested. Multipart transport remains TASK-022.
