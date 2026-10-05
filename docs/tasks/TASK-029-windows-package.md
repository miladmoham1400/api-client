# TASK-029 — Package and verify Windows build

Status: blocked
Dependencies: TASK-027

Packaging configuration/scripts are prepared and locally checked. Actual Windows 11 x64 build, install, offline matrix and uninstall/reinstall preservation are blocked: this session provides only a Linux host and no Windows runner/machine. See [TASK-029 report](../task-reports/TASK-029.md). No Windows acceptance is marked passed.

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/release.md](../release.md)
- [docs/setup.md](../setup.md)
- [docs/testing.md](../testing.md)

## Goal and scope

Configure Windows x64 NSIS and Windows-compatible scripts/native rebuild. Build on Windows runner/machine, install and execute packaged offline story; record artifact/hash and uninstall preservation.

## Acceptance criteria

Actual Windows package launches; SQLite write/reopen works; required Windows matrix passed; unsigned status documented accurately; no security-disabling instructions.

## Verification

Clean Windows build/install/restart/offline smoke with SHA-256 and exact environment. If unavailable, leave blocked rather than done.

## Excluded from this task

No Windows success inferred from Linux cross-build; no automatic upload or signing promise.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-029.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
