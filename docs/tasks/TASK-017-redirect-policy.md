# TASK-017 — Implement documented redirect policy

Status: done
Dependencies: TASK-016

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/request-engine.md](../request-engine.md)

## Goal and scope

Add optional max-five-hop redirect handling, relative URLs, specified method rewriting and immutable replay plan. Strip cross-origin credentials permanently; reject TLS downgrade/invalid target. Keep OFF original 3xx response.

## Acceptance criteria

OFF/ON, 303/301/302 POST changes, 307/308 replay, origin stripping, hop overflow and downgrade behavior match specification.

## Verification

Local two-origin and HTTPS fixtures; verify received credential absence and request bytes.

## Excluded from this task

No cookie jar or user-defined redirect scripts.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-017.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

Evidence: [TASK-017 report](../task-reports/TASK-017.md). Local two-origin and verified HTTPS checks passed on developer Node and sandboxed Linux Electron. Windows and installed package acceptance remain untested.
