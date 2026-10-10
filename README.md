# Offline API Client

An offline desktop HTTP client for Linux and Windows, built with Electron, React, TypeScript, SQLite and Chakra UI v3. Version 0.1.0 has independent unsigned internal-package acceptance on Ubuntu 24.04 x64 and Windows 11 Pro x64. AppImage acceptance uses extraction-and-run mode; default FUSE launch remains unverified. See the [release acceptance record](docs/release-acceptance.md) for hashes, exact environments and limits.

## Download v0.1.1

| Platform | Installer |
|---|---|
| Ubuntu / Debian x64 | [Download .deb](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/offline-api-client-0.1.1-amd64.deb) |
| Windows x64 | [Download .exe](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/offline-api-client-0.1.1-x64-setup.exe) |
| Linux x64 | [Download AppImage](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/offline-api-client-0.1.1-x86_64.AppImage) |

Verify downloads with [SHA256SUMS.txt](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/SHA256SUMS.txt). See [release notes](https://github.com/miladmoham1400/api-client/releases/tag/v0.1.1) and the [installation guide](docs/user-guide.md). These installers are unsigned pre-release builds; Ubuntu 24.04 and Windows Server 2022 passed focused installed-app checks, while full Windows 11 acceptance for this version remains unverified.

## Confirmed decisions

- Desktop app for Linux and Windows.
- Electron + React + TypeScript + SQLite + Chakra UI.
- Create, save and send HTTP requests; variables; separate project workspaces.
- No account, cloud service or runtime internet dependency for local operations.

## Phase-1 defaults

Chakra UI v3, English UI, x64 builds, Ubuntu 24.04 and Windows 11 verification baselines, npm, one application window, one active request editor, light/dark/system theme preference. ARM, older OS support, localization and multiple request tabs are deferred.

A network connection to the target is still required to reach remote APIs. Offline means the installed app and its local data work without external services; localhost and accessible LAN endpoints remain usable.

## How to use

Download Linux `.deb`/AppImage and Windows `.exe` from [GitHub Release v0.1.1](https://github.com/miladmoham1400/api-client/releases/tag/v0.1.1). Compare downloads with its `SHA256SUMS.txt`, then follow the [user guide](docs/user-guide.md). This is an unsigned pre-release; read [known limitations](docs/known-limitations.md) before installation. No automatic updates are provided.

The [public release procedure](docs/public-release.md) and [execution report](docs/tooling-reports/public-release.md) record native builds, installed-app checks, publication and exact hashes. Both platforms passed focused packaged smoke tests; new Windows 11 full offline/manual/uninstall acceptance remains unverified.

For development, use the pinned Node/npm in [toolchain lock](docs/toolchain-lock.md) and [setup](docs/setup.md), then from the repository root:

```text
npm ci
npm exec --no -- install-electron
npm run dev
```

On Windows PowerShell, invoke `npm.cmd` instead of `npm` if script policy blocks `npm.ps1`. Initial downloads require internet or prepared caches; installed startup/local work do not. `npm run dev` rebuilds SQLite for Electron. See [release](docs/release.md) for target-native packaging and [testing](docs/testing.md) for sequential native rebuild/acceptance procedures.

On Linux, `npm run dev` and `npm run start` also register a per-user **Offline API Client (Development)** launcher with the checkout's icon in `${XDG_DATA_HOME:-~/.local/share}/applications/offline-api-client-dev.desktop`. It has a separate desktop identity so an older installed package cannot supply its dock icon; application data stays in the existing directory. No sudo is needed. `npm run desktop:install-dev` refreshes this entry after moving the checkout. Close an already running instance before restarting to apply the new identity. Windows skips this registration.

The specifications remain the behavioral contract. Follow [AGENTS.md](AGENTS.md), task dependencies and actual evidence when changing the project; untested platform checks must not be marked passed.

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
| [User guide](docs/user-guide.md) | Install, save, send, variables, secrets and transfer |
| [Known limitations](docs/known-limitations.md) | Observed issues, untested targets and deferred features |
| [Release acceptance](docs/release-acceptance.md) | Per-platform results, package hashes and evidence |
| [Sources](docs/sources.md) | Official references checked for this plan |
| [Task index](docs/task-index.md) | Ordered, dependency-linked tasks |
| [Graphify](docs/graphify.md) | Optional local source graph, setup and developer workflow |

The task index and task reports record progress and verification evidence. No public-release, signing or update-service claim follows from internal acceptance.

## Optional developer graph

Graphify is installed as a project skill with pinned tooling separate from the desktop app. Run `python3 scripts/graphify.py build` and open `graphify-out/graph.html`; use `python3 scripts/graphify.py update` after source changes. See [setup and usage](docs/graphify.md) and [actual verification](docs/tooling-reports/graphify.md). This tooling setup does not advance a product task or change the app's offline runtime requirements.
