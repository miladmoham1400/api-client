# TASK-028 — Package and verify Linux build

Status: done
Dependencies: TASK-027

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/release.md](../release.md)
- [docs/setup.md](../setup.md)
- [docs/testing.md](../testing.md)

## Goal and scope

Configure Linux x64 AppImage/deb, native SQLite rebuild/unpack and clean build scripts. Install/launch on Ubuntu baseline; execute packaged offline story. Record artifacts/hashes and dependencies.

## Acceptance criteria

Both target package types built; installed app loads native SQLite and persists state; required Linux matrix passed; no remote assets or no-sandbox workaround; user data preserved on uninstall.

## Verification

Clean Linux build/install/restart/offline smoke with exact package SHA-256 and environment.

## Excluded from this task

No claim of Windows or every Linux distro support; unavailable environment is blocker.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-028.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

## Completion evidence and limitations

See [TASK-028 report](../task-reports/TASK-028.md): clean npm ci, 319 unit tests, both Linux package builds, independent 26-test AppImage/deb payload suites and the actual installed-deb 26-test offline suite passed. Normal installed startup passed; actual removal/reinstall preserved an identical synthetic database and reopened saved configuration. Lint/typecheck passed; exact package hashes recorded. Authentication was entered privately through system prompts. Default FUSE mount mode remains untested because /dev/fuse is absent; supported AppImage extraction-run mode passed. Windows/Wayland/other distro acceptance and release readiness are not claimed.
