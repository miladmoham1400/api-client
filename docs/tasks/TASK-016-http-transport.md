# TASK-016 — Implement single-hop HTTP transport

Status: done
Dependencies: TASK-015, TASK-003

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/architecture.md](../architecture.md)
- [docs/ipc-contract.md](../ipc-contract.md)

## Goal and scope

Implement asynchronous Node http/https single-hop execution and send/completion API, owned execution ID and busy guard. Collect bounded encoded/decoded response, decompress supported encodings and map transport errors. Redirect option temporarily reports unsupported until TASK-017, never silently ignores ON.

## Acceptance criteria

HTTP status failures remain responses; native transport sends correct bytes; text/binary classification works; limits/decompression enforced; completion cannot race listener setup; slot cleared on all terminal paths.

## Verification

Local echo/status/encoding/binary/large/TLS tests and Electron send smoke.

## Excluded from this task

No retries, redirects, cookie jar or renderer fetch.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-016.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

Evidence: [TASK-016 report](../task-reports/TASK-016.md). Native unit and sandboxed Linux Electron checks passed; Windows and installed package acceptance remain untested.
