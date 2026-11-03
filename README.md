# Offline API Client

An offline desktop HTTP client for Linux and Windows, built with Electron, React, TypeScript, SQLite and Chakra UI v3.

Create, save and send HTTP requests; organize APIs in collections and nested folders; search requests; use workspaces, environments and variables. The current source includes a dark glass interface, automatic saving, collapsible Pretty JSON, isolated static HTML previews, distinct HTTP method colors and adjustable side-by-side request/response panels. One request editor is active at a time.

Version 0.4.0 adds named selectable request bodies, variable-name highlighting/completion, JSON blur formatting and diagnostics, exact-response copy and Postman Collection v2.1 JSON transfer. Postman scripts, OAuth and unsupported modes are not executed/imported; transfer dialogs explain omissions.

Version 0.4.1 source adds themed tooltips, compact library rows, retained readable Bearer drafts after autosave, JSON line numbers/inline diagnostics, automatic transfer-dialog dismissal and complete folder duplication.

Installed startup and local data operations require no account, cloud service or developer Node/npm. Sending requests requires access to the target API. Data stays on your computer; no automatic updates are provided.

## Download v0.4.0

| Platform | Installer |
|---|---|
| Ubuntu 24.04 x64 | [Download .deb](https://github.com/miladmoham1400/api-client/releases/download/v0.4.0/offline-api-client-0.4.0-amd64.deb) |
| Windows x64 | [Download .exe](https://github.com/miladmoham1400/api-client/releases/download/v0.4.0/offline-api-client-0.4.0-x64-setup.exe) |
| Linux x64 | [Download AppImage](https://github.com/miladmoham1400/api-client/releases/download/v0.4.0/offline-api-client-0.4.0-x86_64.AppImage) |

Verify downloads with [SHA256SUMS.txt](https://github.com/miladmoham1400/api-client/releases/download/v0.4.0/SHA256SUMS.txt). See [release notes and verification limits](https://github.com/miladmoham1400/api-client/releases/tag/v0.4.0).

These unsigned pre-release installers include the new Body variants, variable completion, JSON diagnostics and Postman transfer, along with the dark glass interface and autosave. [Native builds](https://github.com/miladmoham1400/api-client/actions/runs/41661787807) passed 384 Linux unit tests, 383 Windows unit tests (1 native permission fixture skipped), and 19 installed-app tests on each OS. Builds and installed checks ran on Ubuntu 24.04 and Windows Server 2022; full Windows 11, offline/manual chooser and uninstall/reinstall acceptance has not been repeated for these public package bytes. Hosted installed checks target the deb and exe; default AppImage FUSE launch remains unverified.

### Install and use

- Ubuntu: download the `.deb`, then run `sudo apt install ./offline-api-client-0.4.0-amd64.deb` from its directory.
- Windows: run the downloaded `.exe` installer. Windows may show an unsigned-app reputation prompt.
- AppImage: make it executable with `chmod +x offline-api-client-0.4.0-x86_64.AppImage`. If FUSE is unavailable, run it with `--appimage-extract-and-run`.

Open the app, create a workspace and request, enter a method and URL, then select **Send**. Valid edits save automatically; **Ctrl+S** flushes or retries immediately. Requests send only when explicitly requested. Responses support text, collapsible JSON and an isolated static HTML preview. Response scripts and external assets remain blocked. Mark sensitive variables appropriately; if secure OS storage is unavailable, secrets remain session-only. Workspace exports omit credential values and local upload paths by default.

## Body variants and Postman collections

In Body, use **+ Body variant** to add named payloads and select the one to send. JSON formats when you leave the input; invalid text stays unchanged with line/column hints. Type `{{` for variable-name suggestions. The response copy button copies original text.

Use **Import** for Postman Collection **v2.1 JSON** or native workspace JSON. Import creates a new workspace after preview. **Export** writes one selected collection for Postman, including nested folders and Body examples. Read the omission/unsupported-feature notes; credentials and file selections must be supplied again. Scripts/OAuth and unsupported formats/modes are outside this subset. Native files containing Body profiles require 0.4.0 or newer readers.

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

### Local disk use

`node_modules/` contains development dependencies and Electron. `out/` contains compiled code; `dist/` contains installers and unpacked application copies from builds. Optional `.tools/` and `graphify-out/` hold local developer tooling. These directories are ignored by Git and are not uploaded with source pushes. Installer downloads belong in GitHub Releases, not commits. Multiple retained native build directories can consume several gigabytes even though the source repository is small.
