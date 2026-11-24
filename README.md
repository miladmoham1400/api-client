# Offline API Client

An offline desktop HTTP client for Linux and Windows, built with Electron, React, TypeScript, SQLite and Chakra UI v3.

Create, save and send HTTP requests; organize APIs in collections and nested folders; search requests; use workspaces, environments and variables. The app includes a dark glass interface, automatic saving, collapsible Pretty JSON, isolated static HTML previews, distinct HTTP method colors and adjustable side-by-side request/response panels. One request editor is active at a time.

Version 0.4.0 introduced named selectable request bodies, variable-name highlighting/completion, JSON blur formatting and diagnostics, exact-response copy and Postman Collection v2.1 JSON transfer. Postman scripts, OAuth and unsupported modes are not executed/imported; transfer dialogs explain omissions.

Version 0.4.1 adds themed tooltips, compact library rows, retained readable Bearer drafts after autosave, JSON line numbers/inline diagnostics, automatic transfer-dialog dismissal and complete folder duplication.

Version 0.5.0 adds per-body expected JSON response tests, readable collapsed differences, request tabs, polished glass dropdowns/editor tabs and smaller installers.

Version 0.6.0 adds drag-and-drop library organization, a resizable sidebar, CodeMirror JSON editing, automatic expected-response saves and per-request response views. The request address bar stays accessible while scrolling.

Installed startup and local data operations require no account, cloud service or developer Node/npm. Sending requests requires access to the target API. Data stays on your computer; no automatic updates are provided.

## Download v0.6.0

| Platform | Installer | Size |
|---|---|---|
| Ubuntu 24.04 x64 | [Download .deb](https://github.com/miladmoham1400/api-client/releases/download/v0.6.0/offline-api-client-0.6.0-amd64.deb) | 88.2 MB |
| Windows x64 | [Download .exe](https://github.com/miladmoham1400/api-client/releases/download/v0.6.0/offline-api-client-0.6.0-x64-setup.exe) | 94.1 MB |
| Linux x64 | [Download AppImage](https://github.com/miladmoham1400/api-client/releases/download/v0.6.0/offline-api-client-0.6.0-x86_64.AppImage) | 99.2 MB |

Sizes use decimal MB. Verify downloads with [SHA256SUMS.txt](https://github.com/miladmoham1400/api-client/releases/download/v0.6.0/SHA256SUMS.txt). See [release notes and verification limits](https://github.com/miladmoham1400/api-client/releases/tag/v0.6.0).

These unsigned pre-release installers passed 27 installed-app tests on each of Ubuntu 24.04 and Windows Server 2022. The publisher verified the source commit and all three installer checksums. Hosted installed checks cover the deb and exe. The AppImage was built and checksummed. [Native builds](https://github.com/miladmoham1400/api-client/actions/runs/45415835058) · [Verified publication](https://github.com/miladmoham1400/api-client/actions/runs/45417942647).

### Install and use

- Ubuntu: download the `.deb`, then run `sudo apt install ./offline-api-client-0.6.0-amd64.deb` from its directory.
- Windows: run the downloaded `.exe` installer. Windows may show an unsigned-app reputation prompt.
- AppImage: make it executable with `chmod +x offline-api-client-0.6.0-x86_64.AppImage`. If FUSE is unavailable, run it with `--appimage-extract-and-run`.

Open the app, create a workspace and request, enter a method and URL, then select **Send**. Valid edits save automatically; **Ctrl+S** flushes or retries immediately. Requests send only when explicitly requested. Responses support text, collapsible JSON and an isolated static HTML preview. Response scripts and external assets remain blocked. Mark sensitive variables appropriately; if secure OS storage is unavailable, secrets remain session-only. Workspace exports omit credential values and local upload paths by default.

## Body variants and Postman collections

In Body, use **+ Body variant** to add named payloads and select the one to send. JSON formats when you leave the input; source line numbers stay visible, and invalid text stays unchanged with line/column hints directly below the editor. Type `{{` for variable-name suggestions. The response copy button copies original text.

Use **Import** for Postman Collection **v2.1 JSON** or native workspace JSON. Import creates a new workspace after preview. **Export** writes one selected collection for Postman, including nested folders and Body examples. Read the omission/unsupported-feature notes; credentials and file selections must be supplied again. Scripts/OAuth and unsupported formats/modes are outside this subset. Native files containing Body profiles require 0.4.0 or newer readers.

Use a folder menu → **Duplicate folder** to copy its complete saved subtree, including nested requests and empty folders. Typed Bearer values remain readable after autosave in the active editor and support variable completion; stored credentials remain protected on navigation/restart. Successful transfers close their dialog and import cancellation stays silent.

In the current source, drag a saved request onto a folder in the library to move it. Drag a folder onto another folder or a collection to move its entire subtree. The **Move request** and **Move folder** menus also support keyboard use.

## Request tabs

Open requests appear in tabs above the editor and response. Select a tab to return to that API, then Send; closing a tab keeps the saved request. Switching flushes valid edits and guards active requests. Tabs and response snapshots stay in the current workspace session. Body/Response corners now match.

## Body response tests

In the current source, enter literal **Expected response JSON** in **Body → Response test**. Valid JSON saves automatically for the selected Body variant. Clear the field to remove the test. Each Send checks the captured expectation and shows **Test passed**, **Response changed**, or **Test unavailable**. Differences show field/array paths and expected/received values. Object-key order and whitespace are ignored; array order and types are significant. Expectations persist locally and duplicate with requests. Default exports omit them.

Each JSON input is limited to 256 KiB, 20,000 syntax-tree nodes and depth 128. The first 100 differences use readable paths such as `data.scores_headers`. Each value starts collapsed and expands to complete, colored pretty JSON with readable Unicode text. Non-JSON, binary, transport failures and over-limit responses show unavailable. Included in version 0.5.0.

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

Build each installer on its target OS; independently verify the installed application before publishing. Packaging uses a runtime-only payload and maximum installer compression; `npm run test:package` verifies payload filters and native binary selection. Published 0.6.0 downloads are 88.2 MB for deb, 94.1 MB for Windows and 99.2 MB for AppImage.

```sh
# Linux x64: dist/linux/
npm run package:linux

# Windows x64: dist/windows/
npm.cmd run package:win
```

The manually dispatched **Native installer builds** GitHub workflow builds and checks both targets. **Publish verified pre-release** accepts a successful build run ID, verifies its artifact hashes and provenance, and publishes assets using the matching `docs/releases/v<version>.md` notes. Windows Server CI checks do not substitute for Windows 11 acceptance. Existing releases are not overwritten.

Internal specifications, task reports, assistant instructions and optional Graphify tooling are kept locally and ignored by Git. Release notes remain tracked because publication depends on them. Application source, assets, tests, lockfile, build scripts and workflows remain available for reproducible development.

ARM, older OS baselines, cloud sync, scripting and OAuth are outside the implemented scope. The project currently declares `UNLICENSED`.

### Local disk use

`node_modules/` contains development dependencies and Electron. `out/` contains compiled code; `dist/` contains installers and unpacked application copies from builds. Optional `.tools/` and `graphify-out/` hold local developer tooling. These directories are ignored by Git and are not uploaded with source pushes. Installer downloads belong in GitHub Releases, not commits. Multiple retained native build directories can consume several gigabytes even though the source repository is small.
