# TASK-024 — Implement safe workspace JSON export

Status: done
Dependencies: TASK-023, TASK-013

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/import-export.md](../import-export.md)
- [docs/secrets.md](../secrets.md)

## Goal and scope

Build strict allowlisted v1 export serializer from consistent workspace snapshot; exclude sensitive values/auth literals/credential headers/files/responses; implement native save dialog and atomic file write.

## Acceptance criteria

Format validates; non-secret configuration/order preserved; synthetic sensitive bytes/path/secret IDs absent; user sees remaining ordinary-field risk; cancelled dialog no mutation/file.

## Verification

Serializer omission/round-trip-shape tests and save-dialog smoke with synthetic credentials.

## Excluded from this task

No secrets-included mode or Postman format.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-024.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

Completion evidence: [TASK-024 report](../task-reports/TASK-024.md). Linux native save/cancel and full desktop regression checks passed; Windows/Wayland and packaged-app checks remain unverified.
