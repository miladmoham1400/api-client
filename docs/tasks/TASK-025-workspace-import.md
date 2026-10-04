# TASK-025 — Implement previewed transactional workspace import

Status: todo
Dependencies: TASK-024

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/import-export.md](../import-export.md)
- [docs/data-model.md](../data-model.md)
- [docs/ui-flows.md](../ui-flows.md)

## Goal and scope

Implement native open/size limit, strict validation, main-owned preview token and confirmation. Regenerate/remap all IDs; create new workspace transactionally; mark missing credentials/files and selection defaults.

## Acceptance criteria

Valid round-trip imported with fresh IDs; existing workspace unchanged; unsupported/malicious/orphan/duplicate IDs rejected; injected write failure leaves no partial workspace; import never sends.

## Verification

Import validation/transaction/ID remap tests and preview/import/cancel UI smoke.

## Excluded from this task

No merging, Postman/OpenAPI import or arbitrary file references.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-025.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
