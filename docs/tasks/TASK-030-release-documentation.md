# TASK-030 — Write user guide and release acceptance record

Status: done
Dependencies: TASK-028, TASK-029

Completed 2026-10-10. Added [user guide](../user-guide.md), [known limitations](../known-limitations.md) and [release acceptance](../release-acceptance.md), with independent Linux/Windows package evidence and explicit untested coverage. Five targeted installed-Linux checks passed; local documentation links, artifact/evidence consistency and whitespace checks passed. See [TASK-030 report](../task-reports/TASK-030.md). No publishing or phase-2 work was performed.

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/release.md](../release.md)
- [docs/testing.md](../testing.md)
- [docs/product.md](../product.md)

## Goal and scope

Write user guide, known limitations and release-acceptance matrix based on collected evidence. Explain install/data paths/offline semantics/save/variables/session secrets/upload reselection/transfer. Include package version/hash references.

## Acceptance criteria

Both OS evidence independently recorded; no unknown test claimed passed; guide matches actual UI; outstanding issues listed; phase-1 release readiness follows required checks.

## Verification

Cross-check guide against installed builds and task reports; all local doc links resolve.

## Excluded from this task

No publishing, auto-update setup or phase-2 implementation.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-030.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
