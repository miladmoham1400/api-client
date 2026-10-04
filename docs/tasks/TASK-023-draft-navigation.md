# TASK-023 — Finish draft navigation and destructive-action guards

Status: todo
Dependencies: TASK-022, TASK-007, TASK-008, TASK-009

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/ui-flows.md](../ui-flows.md)
- [docs/architecture.md](../architecture.md)

## Goal and scope

Implement Save/Discard/Cancel on request/workspace switch and OS close; active-send Cancel/Stay guard. Coordinate deletion, failed saves and persisted selections without bypasses.

## Acceptance criteria

Dirty input never disappears silently; failed Save blocks transition; Stay/Cancel leaves editor/execution intact; deliberate discard works; active operation aborted before deleting workspace.

## Verification

Focused state-transition tests and manual close/switch/delete scenarios.

## Excluded from this task

No autosave, multiple tabs or recovery of unsaved drafts after crash.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-023.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
