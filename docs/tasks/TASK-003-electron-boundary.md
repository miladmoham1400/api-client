# TASK-003 — Secure Electron lifecycle and preload boundary

Status: done
Dependencies: TASK-002

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/architecture.md](../architecture.md)
- [docs/ipc-contract.md](../ipc-contract.md)

## Goal and scope

Implement owned window, local assets/CSP, single-instance lifecycle and explicit preload API skeleton. Validate sender/frame and block unapproved navigation/windows/permissions. Add listener unsubscribe mechanics.

## Acceptance criteria

Renderer has no Node/raw IPC; untrusted frame/sender rejected; production sandbox/security flags enabled; local startup works; only implemented operations are exposed, pending operations are not fake successes.

## Verification

Electron smoke/inspection of production window configuration and an invalid-sender handler test.

## Excluded from this task

No data features or HTTP sends; database initialization is connected later.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-003.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

## Evidence

Completed 2026-10-04 on Linux. Strict typecheck, lint, production build, 83 unit tests and 2 sandbox-enabled Electron smoke tests pass, including live invalid-sender and single-instance checks. See [TASK-003 report](../task-reports/TASK-003.md). Windows and packaged-app acceptance remain untested.
