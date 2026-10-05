# TASK-029 — Windows packaging preparation

Status: blocked. Date: 2026-10-05.

## Selection and scope

TASK-029 was the earliest unfinished task; its dependency TASK-027 is done. TASK-028 is done. The working tree was clean before this task. Read AGENTS, product, decisions, task index, selected task, release, setup and testing specifications. Only Windows packaging preparation and its documentation were changed; TASK-030 remains todo.

## Changes

- Added `electron-builder.windows.json`, extending existing configuration with separate `dist/windows` output, x64 NSIS target, unsigned executable/installer setting, per-user one-click installation, no launch after installation and explicit preservation of app data on uninstall.
- Added `scripts/package-windows.mjs` and `npm run package:win`. A native Windows x64 guard runs before cleanup. The script cleans only generated `out`/`dist/windows`, invokes installed JavaScript CLIs without Bash or Windows command-shell quoting, stops on failures and disables publishing. Inherited builder settings retain sequential Electron-native SQLite rebuild, ASAR and SQLite unpacking. Linux packaging configuration and application runtime behavior are unchanged.
- Documented pending Windows build/hash/install/offline/preservation procedures and existing platform-specific test gaps in release/setup. Task and index both record blocked.

No packages or lockfile versions changed. No installer was generated or uploaded. No signing promise, sandbox flag, TLS bypass or system security change was added.

## Environment and official configuration evidence

Available host: Ubuntu 24.04 Linux x64, kernel `7.0.0-34-generic`; developer Node `v22.18.0`, npm `11.6.2`. Pinned Electron `44.5.1`, electron-builder `26.15.3`, better-sqlite3 `13.0.3`. These package versions were retained; this task does not reclassify them as Windows-tested.

Consulted official [Windows options](https://www.electron.build/win/) and [NSIS options](https://www.electron.build/nsis/). The web reader returned no page text, so exact option verification used the installed pinned official package's `app-builder-lib/scheme.json`, `out/winPackager.js`, `out/targets/nsis/NsisTarget.js` and `templates/nsis/uninstaller.nsh`, rather than guessing fields. `signExecutable: false` skips signing while keeping resource editing. `deleteAppDataOnUninstall` applies to one-click installers; the generated deletion define is conditional. The template also supports explicit opt-in deletion, which ordinary uninstall verification must not request. This inspection is configuration evidence, not a Windows uninstall pass.

## Actual commands and results

| Command/check | Exit/result | Evidence and limits |
|---|---|---|
| `git status --short` before changes | 0, empty | Initial tree clean |
| Native environment inspection (`uname -sr`, `node --version`, `npm --version`) | 0 | Linux only; versions above |
| Load config with `getConfig(process.cwd(), 'electron-builder.windows.json', null)` then `validateConfiguration(config, new DebugLogger(false))` from installed `app-builder-lib/out/util/config/config.js` | 0 | Loaded parent and child; validated resolved config against builder schema. Output `dist/windows`, x64 NSIS, signing false, app-data deletion false, `npmRebuild: true`, sequential native rebuild, SQLite unpack, `publish: null` |
| `npm run lint` | 0 | ESLint passed, including new script |
| `npm run build` | 0 | Includes successful `tsc --noEmit`; production main/preload/renderer bundled. Existing Zod annotation warnings remain; Rollup removes those comments |
| `npm run package:win` on Linux | 1, expected refusal | Native Windows x64 requirement reported before cleanup; does not count as a successful Windows build |
| Sequential Python SHA-256 snapshot of every file in `out/` and `dist/linux/`, run guarded command, compare snapshot | 0 | Expected child exit 1; all 146 existing output files unchanged. Performed again after production build finished |
| `python3 scripts/graphify.py query "How do packaging configuration and scripts rebuild SQLite and preserve userData?"` | 0 | Discovery only; result truncated, source inspected directly |
| `python3 scripts/graphify.py update` | 0 | Local-only graph refreshed: 982 nodes, 3083 edges, 48 communities. Ignored generated files; no acceptance evidence |
| `git diff --check` | 0 | No whitespace errors |

Unit and GUI suites were not rerun: this task changes packaging tooling/configuration only. Their prior reports are not presented as new results. No Windows native CLI execution, binding rebuild or package test has run.

## Acceptance and exact blocker

**Blocker:** this session supplies only a Linux host, with no Windows 11 x64 machine or accessible Windows runner. Windows build/install execution cannot be established here. The repository has no existing Windows runner workflow. Linux cross-packaging would not satisfy this task and was not attempted.

| Required Windows evidence | Result |
|---|---|
| Clean native build, native SQLite rebuild, installer artifact and SHA-256 | Not run; no Windows artifact/hash |
| Installer install and actual packaged launch | Not run |
| Packaged SQLite write, normal close/reopen and persistence | Not run |
| Internet disconnected with loopback working; every Windows acceptance-matrix row | Not run |
| Real Windows credential-backend behavior | Not run |
| Actual uninstall preserves synthetic data; reinstall/reopen | Not run |
| Unsigned status and safe instructions | Configuration/documentation prepared; actual artifact remains unverified |

Existing upload/import/export native chooser checks are Linux/X11-only and skip Windows. The integrated offline story requires the Linux namespace runner. Those skipped checks must receive actual Windows automation or manual evidence; ordinary Playwright smoke success alone cannot close the task. No Windows-specific acceptance is marked passed.

Resume on Windows using the procedure in `docs/release.md`, record exact OS/runtime versions, installer hash and all matrix/preservation results, then reassess acceptance. TASK-029 stays unfinished and blocks TASK-030. Work stops at this task boundary.
