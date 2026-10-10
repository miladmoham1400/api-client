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

## Reassessment — 2026-10-09

TASK-029 was again selected as the earliest unfinished task with completed dependencies (TASK-027 done; TASK-028 done; TASK-030 todo and depends on TASK-029). No application code, configuration, scripts or packages were changed in this pass. Only this report and the task file note were updated; the task-index status stays `blocked`.

### Environment observed

This session ran in a Linux cloud workspace that had file-level access (listing, copying and writing back) to the repository folder `G:\api-client-master` on a linked Windows computer. The device bridge reported: platform `win32`, arch `x64`, device name `solarstone-pc`. That `nodeVersion 24.21.0` belongs to the bridging desktop app's embedded runtime. It is not the developer Node required by `package.json` (`>=22.18.0 <23`), and it was not used for anything. The Windows edition/build (Windows 11 or otherwise) was not determined.

### Checks performed

| Check | Result |
|---|---|
| Recursive listing of `G:\api-client-master` via the device bridge | Succeeded. No `node_modules/`, `out/`, `dist/` or `.git/` entry is present, so no dependencies are installed and the copy cannot be verified as a clean checkout of a known commit |
| Read AGENTS.md, task index, TASK-029/TASK-030 task files, this report, `docs/release.md`, `package.json` | Done. Windows procedure in `docs/release.md` reconfirmed |
| Any command on the Windows machine (`npm ci`, lint, unit tests, `package:win`, `Get-FileHash`, install, launch) | **Not run.** The session had no command shell on the Windows computer: only file copy/list/write tools were available |

No lint, build or unit checks were rerun in the Linux workspace either, because nothing in the code changed and the Windows copy has no installed dependencies. No earlier result is restated here as new evidence.

### Exact blocker (updated)

1. **No command execution on Windows.** A Windows x64 machine is reachable for file transfer only. The native build, SQLite rebuild, installer hash, install and launch all need a PowerShell session on that machine (or an equivalent Windows runner). That was not available.
2. **The remaining steps need decisions or authentication by the owner.** Even with a shell, the documented procedure needs installing software (pinned Node 22.18.x/npm 11.6.2, and VS C++ Build Tools/Python if a source compile is needed) and installing and uninstalling the app. It also needs a **separate Windows account with synthetic data** for the uninstall-preservation check, and **disconnecting internet while keeping loopback**. Disconnecting would also cut this session's link to the machine. These are system changes the machine owner must perform or explicitly authorize. They were not attempted.
3. **Source provenance.** The Windows folder has no `.git` metadata. Before a build counts as evidence, the copy must be confirmed as the intended commit (or replaced by a clean checkout).

All Windows acceptance rows from the table above remain **Not run**. No Windows-specific acceptance is marked passed. TASK-029 remains `blocked` and continues to block TASK-030.

### To resume

On the Windows PC, as a regular user, in PowerShell from a clean checkout, follow `docs/release.md` → "Windows packaging preparation". Record the Windows version (`winver`/`Get-ComputerInfo`), `node --version`, `npm --version`, the Electron ABI and the native rebuild output. Also record the `Get-FileHash` SHA-256 of the installer, the installed executable path, and each Windows row from `docs/testing.md` run offline. Then run the uninstall/reinstall preservation check in a separate synthetic-data account. Attach that output so the evidence can be recorded here and acceptance reassessed.

## Windows attempt 1 and portability fixes — 2026-10-09

The user ran the `docs/release.md` procedure on their own Windows PC, following `task029-evidence/STEPS.md` and capturing a PowerShell transcript in `task029-evidence/1-build-log.txt`. The transcript is untracked and contains no credentials. Claude read the transcript and the npm debug log over the device bridge and made the fixes below in a Linux workspace. The status remains **blocked**: no installer has been produced yet.

### Windows environment (from transcript)

Windows 11 Pro, version 10.0.26300 (build 26300), 64-bit; Windows PowerShell 5.1.26100; developer Node `v22.18.0`; npm `11.6.2` (invoked as `npm.cmd`, because the default PowerShell execution policy blocks `npm.ps1`); Python 3.14.0; Visual Studio Build Tools 2022 (17.14).

### Actual Windows results

| Step | Result |
|---|---|
| First `npm ci` | Failed: `better-sqlite3` 13.0.3 compiled from source and node-gyp reported `missing any Windows SDK`. The user then added the "Desktop development with C++" workload to Build Tools |
| `npm.cmd ci` (retry) | Exit 0: 589 packages added; 8 moderate audit advisories reported |
| `npm.cmd audit fix --force` (run by the user; not part of the procedure) | Rewrote `package.json`/`package-lock.json` and **downgraded** electron-builder from 26.15.3 to 26.5.0 (npm reported it as a "SemVer major change") |
| `npm.cmd exec --no -- install-electron` | First attempt aborted mid-download (`TypeError: terminated`); the retry downloaded `electron-v44.5.1-win32-x64.zip` successfully |
| `npm.cmd run lint` | 6 `no-undef` errors, all in the untracked helper `task029-evidence/echo-server.mjs` (none in project source) |
| `npm.cmd run test:unit` | Native rebuild for developer Node succeeded on Windows. **317 passed, 2 failed** (`uploads.test.ts` "rejects unreadable"; `deadline.test.ts` "deadline aborts stalled upload") |
| `npm.cmd run package:win` | `tsc` and the three production bundles succeeded. electron-builder **26.5.0** then rejected the configuration (`linux.syncDesktopName`, `win.signExecutable` unknown), so no installer was built. This failure comes from the audit-fix downgrade, not from the pinned 26.15.3 configuration |

### Analysis of the two Windows unit failures

- **uploads "unreadable"**: the test makes a file unreadable with `chmodSync(path, 0)`. Windows maps this to the read-only attribute and the file stays readable, so `openForSend` correctly found nothing to reject. The same false failure occurs under Linux root. This is a test-environment assumption, not a product defect: the product maps any open failure to `FILE_CHANGED`.
- **deadline "stalled upload"**: the test relies on a paused loopback server filling the kernel buffers before 5 MiB is sent. Windows loopback buffered the whole body, so the request emitted `finish`. The `TIMEOUT` result and request destruction both passed on Windows, and only the "still uploading" assertion failed. This is also a test-environment assumption.

### Changes made

- `package.json`/`package-lock.json`: restored electron-builder to the pinned **26.15.3**. The lockfile was regenerated with npm 11.6.2 (`npm install --package-lock-only --ignore-scripts`). Both files now have exactly the original byte sizes (2183 and 318945 bytes), matching the pre-session directory listing. Post-restore SHA-256: package.json `cd1a2825…9cea`, package-lock.json `2e0bff1a…3b36`. Byte identity with the committed originals cannot be proven without Git metadata. No other dependency version was changed.
- `tests/main/uploads.test.ts`: on win32, the "unreadable" case denies read-data to Everyone (`icacls <file> /deny *S-1-1-0:(RD)`) instead of using `chmod`. POSIX behavior is unchanged.
- `tests/main/deadline.test.ts`: the "stalled upload" case now connects to the real paused server through a socket that never acknowledges writes. This makes the upload stall deterministic on every OS. The case also now waits for the server-side socket to close. A mutation check (making the socket acknowledge writes) reproduces exactly the Windows failure (`expected true to be false`), which confirms the assertion still detects completed uploads.
- `task029-evidence/echo-server.mjs` (untracked helper) now imports `URL`, `Buffer`, `setTimeout` and `console` from Node modules.
- Application source code and packaging configuration were not changed.

### Verification in the Linux workspace (Node 22.22.0, npm 11.6.2, non-root user)

| Command | Result |
|---|---|
| `npm ci` with the restored lockfile (`npm_config_nodedir` set to the local headers because nodejs.org is unreachable) | Exit 0 |
| Load and validate `electron-builder.windows.json` with installed electron-builder 26.15.3 | Valid. Resolved `win.signExecutable: false`, NSIS one-click, per-user, `deleteAppDataOnUninstall: false` |
| `npx tsc --noEmit` | Exit 0 |
| `npx eslint .` (also run with the helper present in `task029-evidence/`) | Exit 0 |
| `npx vitest run` | 28 files, **319/319 passed** |
| Focused uploads + deadline tests, 3 repeated runs | 22/22 each run |

The Windows `icacls` branch has **not yet executed on Windows**, and neither test change has passed on Windows yet. Both must be confirmed by rerunning `npm.cmd run test:unit` on the Windows PC.

### Remaining blocker

No Windows installer, hash, install, packaged launch, offline matrix or uninstall-preservation evidence exists yet. Every row in the acceptance table above is still **Not run**. Next step: on the Windows PC, rerun step 4 of `task029-evidence/STEPS.md` (starting with `npm.cmd ci`, which reinstalls electron-builder 26.15.3), then continue with parts 3–5.
