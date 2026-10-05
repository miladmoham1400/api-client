# Developer prerequisites and setup

This is a plan; do not run guessed installation commands before TASK-001 has verified a compatible toolchain.

## Software to install

| Required | Purpose |
|---|---|
| Git | Repository/version control |
| Supported Node.js LTS + npm | Development/build/test; exact version selected in TASK-001 |
| VS Code + Codex or Codex CLI | Optional coding workflow, not shipped with app |
| Linux native compiler toolchain/Python | SQLite rebuild if prebuilt artifacts unavailable |
| Windows Visual Studio C++ Build Tools/Python | SQLite rebuild if prebuilt artifacts unavailable |
| Linux desktop runtime libraries | Electron GUI; package dependencies validated on baseline distro |

No MySQL server, SQLite server, PHP, Go or Rust toolchain is required by the selected design. The app bundles its SQLite binding; a SQLite command-line utility is optional for diagnostics. A Windows machine or Windows build/test runner is needed to verify Windows packages.

Package dependencies: Electron, React/React DOM, Chakra v3 and its documented peers, better-sqlite3, Zod, a maintained Node multipart streaming encoder. Build/dev dependencies: electron-vite/Vite, TypeScript/types, electron-builder, ESLint, Vitest, React Testing Library and Playwright. Verify required versions and compatibility; avoid unused libraries.

## Installation versus offline use

Initial dependency downloads/build tooling require available internet or a prepared offline cache. A fresh uncached `npm ci` is not promised to work offline. Once packaged and installed, startup and local features must work without internet. User HTTP traffic goes only to targets they send to.

## Scripts to establish

`npm run dev`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run package:linux`, `npm run package:win`, and focused smoke-test scripts. Avoid shell syntax that works only on Bash; npm scripts must run under Windows too. Use `npm ci` with lockfile in clean verification.

`npm run package:win` is now configured for native Windows x64 only; its NSIS build and installation remain unverified until TASK-029 runs on Windows. See `docs/release.md` for the pending PowerShell procedure. `test:offline` remains a Linux-only acceptance runner and must not be used as Windows evidence.

## Native SQLite check

Rebuild for Electron's ABI and each target OS/architecture, ensure binding is packaged/unpacked appropriately, and exercise an actual write/reopen in packaged app. A successful Node-only test does not verify Electron native loading. Refer to exact selected electron-builder version's rebuild configuration rather than mixing config fields from different majors.

## Generated baseline

TASK-001 creates `docs/toolchain-lock.md` recording exact versions, source links, chosen OS/architecture baselines, install commands for both systems, native-build fallback and tested commands. This file cannot honestly contain verified versions until the task is executed.
