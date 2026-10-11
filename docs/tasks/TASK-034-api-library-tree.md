# TASK-034 — Build accessible nested API tree and contextual creation

Status: done
Dependencies: TASK-033
Priority: highest — approved API-library milestone

Evidence: [TASK-034 report](../task-reports/TASK-034.md) — 346 unit tests and 11 Linux source-built Electron checks passed; build/typecheck/lint passed. Windows and newly packaged applications were not tested; packaged/platform acceptance remains TASK-037.

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Replace flat organization UI with expandable collection/folder/request navigation, contextual actions/destination chooser, method badges and breadcrumbs. Preserve one editor, explicit Save/Send, dirty/active-send guards and stable identity. Implement versioned per-workspace expansion persistence through main.

## Acceptance criteria

- User example Users/Admin and Users/Auth can be created, populated, browsed, selected and sent; empty folders and root requests remain usable.
- New request/folder actions target the chosen container; cancelled unsaved creation leaves no saved blank row. Rename/move/delete confirmations match preserve-on-delete behavior/counts.
- Selecting a node shows correct config/path; dirty Save/Discard/Cancel and active-send guards are used for every relevant action. No expansion/selection/mutation triggers sending.
- Expansion is workspace-scoped and survives restart; stale IDs pruned and selected request ancestors revealed. No draft/response persistence added.
- Keyboard tree navigation/focus/context actions, duplicate-name disambiguation, light/dark and 1000×700 layout are usable.
- No per-request move select permanently rendered for every item; metadata browsing does not load every body/config/secret.

## Verification

Focused Electron tree CRUD/selection/guard/restart tests with local APIs, light/dark and keyboard/manual checks; relevant typecheck/lint/unit checks. Re-run existing navigation and panel/JSON behavior when affected.

## Excluded from this task

No search feature yet, drag-and-drop, tabs, layout-ratio persistence or v2 transfer.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-034.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.
