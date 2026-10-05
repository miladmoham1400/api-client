# TASK-022 — Add multipart text/file requests

Status: done
Dependencies: TASK-020, TASK-021, TASK-017, TASK-018

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/ui-flows.md](../ui-flows.md)

## Goal and scope

Implement ordered text/file multipart editor and maintained streaming encoder. Resolve text/field keys, preflight files, enforce totals and boundary ownership, and reopen streams for allowed redirects.

## Acceptance criteria

Fixture receives exact duplicate fields, Unicode names and file bytes; Content-Type includes correct generated boundary; cancel releases handles/streams; redirect body replay works; no renderer full-file buffering.

## Verification

Multipart parser fixture tests, limit/missing-file tests, streaming cancellation and 307 file replay.

## Excluded from this task

No handcrafted multipart encoding or file variable paths.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-022.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

## Evidence

See [TASK-022 report](../task-reports/TASK-022.md) for parsed multipart wire/limit tests, streaming cancellation/timeout and 307/308 replay, real Linux editor/native-dialog/restart smoke, commands and limitations. Windows and packaged-app acceptance remain untested. TASK-023 was not implemented.
