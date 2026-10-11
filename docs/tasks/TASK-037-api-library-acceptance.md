# TASK-037 — Verify and document nested-library packaged acceptance

Status: blocked
Dependencies: TASK-036
Priority: highest — approved API-library milestone

## Read first

- [AGENTS.md](../../AGENTS.md)
- [Product](../product.md) and [decisions](../decisions.md)
- [API library specification](../api-library.md) — authoritative new behavior
- [Data model](../data-model.md), [architecture](../architecture.md), [IPC contract](../ipc-contract.md)
- [UI flows](../ui-flows.md), [transfer](../import-export.md), [testing](../testing.md)
- [Task index](../task-index.md), [known limitations](../known-limitations.md), [public 0.1.1 evidence](../tooling-reports/public-release.md)

## Goal and scope

Run the integrated nested-library story, close defects within this milestone, build and independently verify fresh target-native Linux/Windows installers. Record hashes/OS/performance/upgrade/offline/manual results and update user guide/limitations/acceptance. Do not reuse 0.1.1 evidence for new bytes.

## Acceptance criteria

- Synthetic phase-1 database upgrades without loss; nested example plus 1,000-request/1,000-folder library survives normal close/reopen and stays workspace-isolated.
- Browse/search/select/send first/middle/last with correct wire method/URL/body; preserve all dirty/active-send/security/TLS/secret/file/response behavior and no auto-send.
- V1 import and v2 export/import restore structure and exclusions; actual native chooser behavior independently recorded per OS.
- Linux and Windows packages rebuilt natively with SQLite, hashed, installed and exercised offline with loopback available; Windows 11 baseline checks recorded separately from Server CI smoke.
- Actual migration, performance, offline, dialogs and installer preservation checks have evidence or explicit not-run blockers; never mark this task done with required platform criteria missing.
- User guide/known limitations/acceptance describe actual shipped behavior, exact artifact hashes and remaining defects. No inherited green result from historical tasks/releases.

## Verification

Appropriate full unit/type/lint/build and desktop/offline suites, independent packaged upgrade/restart/native dialog/uninstall-preservation checks, recorded performance samples. Stop if platform access is missing: complete independent work and report the exact unfinished criterion.

## Excluded from this task

No automatic release publication/version/tag change, signing setup, updater, unrelated next-phase features or production sandbox/TLS bypass.

## Completion procedure

Inspect current source/user changes and dependency evidence before edits. Execute only this task. Record actual changes, commands/exit codes, environment, evidence, limitations and blockers in `docs/task-reports/TASK-037.md` when execution begins; planning is not execution evidence. Update task status and index together. Mark done only with all criteria verified; otherwise in_progress/blocked. Never count untested platforms or skipped checks as passed. Stop at this task boundary.

## Execution status — 2026-10-12

Independent Linux build/hash and extracted-payload acceptance evidence is recorded in [TASK-037 report](../task-reports/TASK-037.md). Required actual Linux install/manual upgrade/removal/reinstall preservation needs sudo authentication through the OS prompt. Current native Windows build and installed Windows 11 offline/native-dialog/legacy-upgrade/performance/preservation checks need an accessible authorized Windows runner. No required platform result is inherited from previous artifacts. Task remains unfinished; resume this task before declaring the nested-library milestone accepted.
