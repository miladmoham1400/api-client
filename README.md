# Offline API Client — Phase 1 implementation pack

Planning baseline: 2026-10-03. This pack contains specifications and tasks, not implemented application code.

## Confirmed decisions

- Desktop app for Linux and Windows.
- Electron + React + TypeScript + SQLite + Chakra UI.
- Create, save and send HTTP requests; variables; separate project workspaces.
- No account, cloud service or runtime internet dependency for local operations.

## Defaults selected for this plan

These are implementation defaults, not additional user commitments: Chakra UI v3, English UI, x64 builds, Ubuntu 24.04 and Windows 11 as initial verification baselines, npm, one application window, one active request editor, light/dark themes. Product name is a placeholder. ARM, older OS support, localization and multiple request tabs are deferred.

A network connection to the target is still required to reach remote APIs. Offline means the installed app and its local data work without external services; localhost and accessible LAN endpoints remain usable.

## How to use

1. Create an empty repository directory on your computer.
2. Copy the CONTENTS of this folder into the repository root so `AGENTS.md` is at its root.
3. Open that directory in VS Code and start Codex, or launch Codex CLI there.
4. Read `docs/product.md` and `docs/decisions.md` before implementation.
5. Give Codex the first prompt in `START-CODEX.md`. It begins with TASK-001 only.
6. Use the next-task prompt for subsequent tasks, following `docs/task-index.md`.
7. Review each task's evidence. A Windows build or smoke test cannot be marked passed based only on Linux results.

Do not copy a task into a chat without its referenced specifications. The complete pack supplies the behavioral contract.

## Documents

| Document | Purpose |
|---|---|
| [Product](docs/product.md) | Scope, defaults and acceptance |
| [Decisions](docs/decisions.md) | Technology choices and compatibility policy |
| [Architecture](docs/architecture.md) | Boundaries, source layout and lifecycle |
| [Data model](docs/data-model.md) | Schema, ownership and migrations |
| [IPC contract](docs/ipc-contract.md) | Typed commands and errors |
| [Request engine](docs/request-engine.md) | HTTP behavior and limits |
| [Variables](docs/variables.md) | Resolution and validation rules |
| [UI flows](docs/ui-flows.md) | Screens and interaction states |
| [Secrets](docs/secrets.md) | Encryption, masking and limitations |
| [Import/export](docs/import-export.md) | Portable format and validation |
| [Testing](docs/testing.md) | Local fixtures and release acceptance |
| [Setup](docs/setup.md) | Required software and installation workflow |
| [Release](docs/release.md) | Linux/Windows packages and evidence |
| [Sources](docs/sources.md) | Official references checked for this plan |
| [Task index](docs/task-index.md) | Ordered, dependency-linked tasks |

The task index is the progress source of truth; individual tasks initially have `todo` status. No application has been built or tested by this planning pack.
