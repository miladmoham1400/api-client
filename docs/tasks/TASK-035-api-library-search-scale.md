# TASK-035 — Add quick request search and verify large-library navigation

Status: todo
Dependencies: TASK-034
Priority: highest — approved API-library milestone

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Add main-owned bounded metadata search and result selection/path reveal. Make tree rendering and metadata mutation/navigation scale to the specification baseline, using measured optimizations and bounded live rows/paging. Preserve normal expansion state when searching.

## Acceptance criteria

- Query matches names/methods/ancestor paths under documented normalization and literal matching; collection filter and duplicate-name results work; bodies/credentials are excluded.
- Query length <=200 and result pages <=100; continuation/order are deterministic, no missing/duplicated rows or silent truncation. Reject foreign scope, stale IDs and malformed pagination.
- Selecting results uses existing guards and reveals correct ancestors; clearing search restores browsing; stale async results cannot leak another workspace or replace newer results.
- Synthetic dataset has 1,000 requests and 1,000 folders across <=100 collections, depth <=16, plus a separate workspace. First/middle/last requests are browsable/searchable and send correct wire data.
- Cold usable tree <=2 s; after warm-up, p95 over 20 distinct selections and 20 searches <=500 ms each on a documented reference machine. Record actual samples/OS/hardware/build and rendered row counts; failures remain unfinished.
- Bounded rendering and selected-config loading prevent mounting all editors or serializing all full configs on each mutation. No new arbitrary local request-count cap or legacy truncation.

## Verification

Focused search/pagination/isolation tests and Electron large-library fixture with actual timings/readiness, geometry and local-wire assertions; relevant typecheck/lint/unit checks. No timing claim based on Graphify or guessed CI speed.

## Excluded from this task

No history, tabs, URL/body/credential content indexing, generic full-text framework or v2 transfer.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-035.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.
