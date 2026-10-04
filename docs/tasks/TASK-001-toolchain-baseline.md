# TASK-001 — Establish compatible toolchain and build skeleton

Status: done
Dependencies: None

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/decisions.md](../decisions.md)
- [docs/setup.md](../setup.md)

## Goal and scope

Verify exact compatible stable versions. Create minimal Electron/React/TypeScript/Chakra v3 build skeleton, lockfile, gitignore and dev/typecheck/lint/test/build scripts. Record versions, developer Node versus embedded Node, and OS prerequisites in docs/toolchain-lock.md.

## Acceptance criteria

Minimal local window opens with a Chakra control; strict typecheck/build pass; no remote assets or unrelated scaffolding; exact versions and installation commands recorded. Native driver/packager may be pinned now but verified by their later tasks.

## Verification

Run clean install, typecheck and production build; inspect bundle for remote assets. Record which OS was actually exercised.

## Excluded from this task

No workspace/database feature, request engine or installer.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-001.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

## Evidence

Completed 2026-10-04 on Ubuntu 24.04.3 x64. Clean npm install, strict typecheck, lint, production build and sandbox-enabled local Electron/Chakra smoke pass. See [task report](../task-reports/TASK-001.md) and [exact toolchain](../toolchain-lock.md). Windows, native SQLite and installers remain unverified in their later tasks.
