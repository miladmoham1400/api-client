# TASK-031 — Verify and repair multi-request creation and selection

Status: todo
Dependencies: TASK-009, TASK-023
Priority: highest — approved API-library milestone

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Inspect current source and the released multi-request flow; reproduce the user's apparent single-request limitation if possible. Make creation/Save/sidebar refresh/selection reliable without folders. Resolve the existing Save-before-collection-delete navigation regression if it prevents those guards. Do not invent a database one-request cap or claim a non-reproduced defect fixed.

## Acceptance criteria

- Create and explicitly save at least 20 distinct requests across two collections and workspace root; all remain selectable and survive normal close/reopen.
- Select first/middle/last and send to a local fixture; method, URL/body and received response belong to the chosen request, not a previous draft.
- Creation/selection never sends. Save/Discard/Cancel during dirty navigation and active-send handling preserve the current guards; cancelled creation creates no extra saved request.
- Add meaningful regression coverage for the actual failure (or record non-reproduction and verified flow); the documented deletion-dialog regression has passing evidence if touched/required.
- Existing drafts, secret references, selections and old saved rows remain intact.

## Verification

Focused request/service and Electron creation/navigation/execution checks; relevant typecheck/lint/unit checks. Report exact reproducer, whether a defect was found, and actual close/reopen results.

## Excluded from this task

No folders, schema migration, search, tabs, bulk/concurrent sending or transfer v2.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-031.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.
