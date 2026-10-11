# TASK-033 — Implement validated folder operations and request destinations

Status: todo
Dependencies: TASK-032
Priority: highest — approved API-library milestone

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Implement workspace-owned folder list/create/rename/move/delete services, explicit IPC/preload functions and folder-aware request create/duplicate/move. Implement transactional preserve-on-delete rules, cycles/depth checks and the temporary no-loss export gate.

## Acceptance criteria

- Folder CRUD and request destinations work at collection root and nested depth 16; depth 17, self/descendant parent, foreign IDs and inconsistent destination reject without partial changes.
- Moving a folder between collections in the same workspace updates descendants atomically, preserving request/folder IDs, config and auth ownership; cross-workspace moves reject.
- Deleting a folder promotes direct requests/child folders while retaining subtrees; deleting a collection moves all nested requests to workspace root before removing folders. Selected surviving request remains valid.
- Partial config saves do not reset folder placement; duplication keeps destination and independent secret copies.
- Sender and workspace ownership validated for reads and writes; shared inputs/output DTOs validated without generic IPC.
- Until TASK-036, folder-containing workspace export fails explicitly before dialog/write; folder-free v1 transfer still works. No silent flattening/export loss.

## Verification

Focused repository transactions/rollback/ownership/cycle/depth tests, handler/preload schema tests, request/secret and export-gate regressions; relevant typecheck/lint/unit checks.

## Excluded from this task

No sidebar tree, search UI, drag-and-drop, destructive subtree-delete option, inherited auth or v2 transfer.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-033.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.
