# TASK-036 — Preserve nested libraries in safe v2 transfer

Status: done
Dependencies: TASK-035, TASK-024, TASK-025
Priority: highest — approved API-library milestone

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Implement strict workspace transfer v2 with flat folder parent references and request folder IDs; export v2 consistently and import both v1/v2. Validate hierarchy before preview/write and remap fresh IDs transactionally. Replace the temporary folder-export block only when safe v2 export is available.

## Acceptance criteria

- V2 round trip preserves empty/nested folders, request destinations/config/ordered rows/templates with fresh IDs; arbitrarily ordered valid folder arrays import correctly.
- V1 imports unchanged placements at collection/workspace roots and no folders; unsupported versions reject explicitly. Request config remains v1 independently of transfer v2.
- Reject cycles, missing/foreign parents, inconsistent collection/folder references, duplicate IDs and excess depth/folders/requests/bytes before any writes. Retain 10 MiB/100 collections/1,000 requests limits and add 1,000 folders.
- Preview shows counts/names/omissions only; cancel/expired/reused token/changed bytes are neutral; injected write failure leaves zero partial entities.
- No secret values/IDs, upload paths/capabilities, responses, selection/expansion state or credential literals leak into export by default; existing re-entry/reselection recovery works.
- Export validates a consistent snapshot and writes atomically; folder-containing exports no longer fail after v2 acceptance and never silently flatten.

## Verification

Focused v1/v2 schema, serializer/import transaction/remapping/redaction tests; desktop native save/open preview tests where available, large-library round trip within byte limits; relevant typecheck/lint/unit checks. Skipped OS dialogs are not passed.

## Excluded from this task

No Postman/OpenAPI format, merging imports, raw database backup export or runtime cloud service.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-036.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.

## Completion evidence

See [TASK-036 report](../task-reports/TASK-036.md): 369 unit tests passed with one worker, production build/typecheck/lint passed, and both native Ubuntu export/import dialog tests passed without skips. Large v2 round trip covers 100 collections/1,000 folders/1,000 requests at depth 16 below 10 MiB. Initial sandbox/default-timeout/default-worker failures and actual reruns are retained in the report. Windows dialogs and fresh Linux/Windows packaged acceptance were not run and remain TASK-037.
