# TASK-006 — Build Chakra desktop shell

Status: todo
Dependencies: TASK-003

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/ui-flows.md](../ui-flows.md)
- [docs/decisions.md](../decisions.md)

## Goal and scope

Create local Chakra v3 provider, top bar/sidebar/editor/response regions, accessible dialogs and empty/loading/error states. Establish minimal typed preload access without invented feature data.

## Acceptance criteria

Usable at 1280x720; keyboard focus/labels work; no remote fonts/assets; no v2 APIs; shell does not imply unimplemented features work.

## Verification

Renderer build/typecheck and manual layout/focus smoke.

## Excluded from this task

No request execution, variable management or full theme persistence.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-006.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
