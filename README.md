# Offline API Client

An offline desktop HTTP client for Linux and Windows, built with Electron, React, TypeScript, SQLite and Chakra UI v3.

Create, save and send HTTP requests; organize APIs in collections and nested folders; search requests; use workspaces, environments and variables. The source includes JSON syntax highlighting, distinct HTTP method colors, light/dark themes and adjustable stacked or side-by-side request/response panels. One request editor is active at a time.

Installed startup and local data operations require no account, cloud service or developer Node/npm. Sending requests requires access to the target API. Data stays on your computer; no automatic updates are provided.

## Download v0.1.1

| Platform | Installer |
|---|---|
| Ubuntu 24.04 x64 | [Download .deb](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/offline-api-client-0.1.1-amd64.deb) |
| Windows x64 | [Download .exe](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/offline-api-client-0.1.1-x64-setup.exe) |
| Linux x64 | [Download AppImage](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/offline-api-client-0.1.1-x86_64.AppImage) |

Verify downloads with [SHA256SUMS.txt](https://github.com/miladmoham1400/api-client/releases/download/v0.1.1/SHA256SUMS.txt). See [release notes and verification limits](https://github.com/miladmoham1400/api-client/releases/tag/v0.1.1).

The public v0.1.1 installers are older than the current source: they do not include the nested API library or distinct HTTP method colors. They are unsigned pre-release builds. Focused installed checks passed on Ubuntu 24.04 and Windows Server 2022; full Windows 11 acceptance for those public package bytes remains unverified. AppImage extraction-and-run was tested; default FUSE launch remains unverified.

### Install and use

- Ubuntu: download the `.deb`, then run `sudo apt install ./offline-api-client-0.1.1-amd64.deb` from its directory.
- Windows: run the downloaded `.exe` installer. Windows may show an unsigned-app reputation prompt.
- AppImage: make it executable with `chmod +x offline-api-client-0.1.1-x86_64.AppImage`. If FUSE is unavailable, run it with `--appimage-extract-and-run`.

Open the app, create a workspace and request, enter a method and URL, then select **Send**. **Save** stores edits separately from sending. Responses are untrusted text; response HTML is never executed. Mark sensitive variables appropriately; if secure OS storage is unavailable, secrets remain session-only. Workspace exports omit credential values and local upload paths by default.

## Development

Use Node **22.18.0** and npm **11.6.2**, as pinned in the repository. Initial dependency downloads require internet or prepared caches.

```sh
npm ci
npm exec --no -- install-electron
npm run dev
```

In Windows PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`. Development startup rebuilds native SQLite for Electron. On Linux it also registers a per-user development launcher using the checkout's icon; no sudo is needed. Close an already running instance before restarting. After moving the checkout, refresh the launcher with `npm run desktop:install-dev`.

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run test:smoke
```

SQLite must be rebuilt for the runtime being tested: unit tests use developer Node, while desktop tests use Electron. Run these checks sequentially.

## Build installers

Build each installer on its target OS; independently verify the installed application before publishing.

```sh
# Linux x64: dist/linux/
npm run package:linux

# Windows x64: dist/windows/
npm.cmd run package:win
```

The manually dispatched **Native installer builds** GitHub workflow builds and checks both targets. **Publish verified pre-release** accepts a successful build run ID, verifies its artifact hashes and provenance, and publishes assets using the matching `docs/releases/v<version>.md` notes. Windows Server CI checks do not substitute for Windows 11 acceptance. Existing releases are not overwritten.

Internal specifications, task reports, assistant instructions and optional Graphify tooling are kept locally and ignored by Git. Release notes remain tracked because publication depends on them. Application source, assets, tests, lockfile, build scripts and workflows remain available for reproducible development.

ARM, older OS baselines, multiple tabs, cloud sync, scripting and OAuth are outside the implemented scope. The project currently declares `UNLICENSED`.
