# TASK-029 — Package and verify Windows build

Status: done
Dependencies: TASK-027

Done on 2026-10-10 on Windows 11 Pro x64 (build 26300). Evidence:
- **Build:** native build and unit tests (319/319). Unsigned NSIS installer `offline-api-client-0.1.0-x64-setup.exe`, SHA-256 `D8743C44C4B124361BF8B45C65E8EEB4CC6567C21ECA4A6BA74973D7D8E44A4B`.
- **Automated tests:** the installed-app desktop suite passed with the internet disconnected (21 passed, 0 failed, 5 Linux-only skips).
- **Manual checks A–Q:** all passed with the app's internet egress blocked, including the native file, save and open dialogs.
- **Uninstall preservation:** uninstall via Settings preserved all app data byte-for-byte, and the reinstall reopened it.

Authorized deviations (2026-10-10):
- Egress was blocked with a temporary firewall rule instead of disconnecting the network.
- The preservation check ran in the user's own account (no real data) instead of a separate account.
- The manual checks were performed by Claude through screen control.

See the [TASK-029 report](../task-reports/TASK-029.md).

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
