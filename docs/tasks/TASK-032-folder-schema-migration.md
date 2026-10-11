# TASK-032 — Add owned folder schema and preserve legacy data

Status: todo
Dependencies: TASK-031, TASK-004, TASK-005
Priority: highest — approved API-library milestone

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Add the specification's folder/destination/tree-state schema and validated shared DTOs through the next append-only migration. Preserve all existing phase-1 request placements/configuration and selections. Add repository reads/integrity primitives needed by later tasks; no user-facing folder CRUD.

## Acceptance criteria

- Synthetic legacy database migrates/reopens with all request IDs/config/auth references and workspace/environment/selected-request state unchanged; existing requests have folderId=null.
- Clean database and repeat reopen are valid; injected migration failure rolls back and retains recovery behavior without recreating/deleting the database.
- Composite ownership and request destination checks reject cross-workspace/cross-collection and folder-without-collection relationships; relevant indexes exist.
- Validated metadata types distinguish collection root, folder and workspace root; no full config/credentials in tree DTOs.
- Existing folder-free UI/transfer behavior continues working; no editing migration 1 or silently truncating legacy data.

## Verification

Focused migration/integrity tests on synthetic old and new databases, typecheck/lint and relevant unit checks. Inspect actual ledger; no real user profiles.

## Excluded from this task

No folder editing UI, writable folder IPC, search or v2 transfer.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-032.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.
