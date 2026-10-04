# TASK-009 — Implement saved requests and editor drafts

Status: todo
Dependencies: TASK-008, TASK-002

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/data-model.md](../data-model.md)
- [docs/ui-flows.md](../ui-flows.md)
- [docs/secrets.md](../secrets.md)

## Goal and scope

Add create/get/save/duplicate/delete requests and independent draft/saved state. Start with method/name/URL/default config; wire Ctrl+S and save errors. Prepare secret-handle interface without leaking credentials.

## Acceptance criteria

Save/restart preserves config; unsaved edits do not mutate database; duplicate has new ID and no response; missing IDs/ownership fail safely; failed Save retains draft.

## Verification

Persistence/default/duplicate tests and create/edit/save/reopen smoke.

## Excluded from this task

No HTTP send or final dirty-navigation guard (TASK-023).

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-009.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
