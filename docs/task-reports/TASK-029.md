# TASK-029 — Windows packaging

Status: **done** (2026-10-10). Originally blocked on 2026-10-05. The final evidence and decision are in the last section.

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

## Windows attempt 2: installer built, acceptance incomplete (2026-10-09/10)

The user reran the procedure on the same Windows PC with the restored lockfile and the test fixes. Evidence: `task029-evidence/1-build-log.txt` (start 2026-10-09 23:56:43, end 2026-10-10 00:02:56) and `task029-evidence/2-offline-tests-log.txt` (start 2026-10-10 00:05:58). Claude reviewed both on 2026-10-10.

### Environment

Windows 11 Pro 10.0.26300 x64; Windows PowerShell 5.1.26100; developer Node v22.18.0; npm 11.6.2; Visual Studio Build Tools 2022 with the C++ workload and Windows SDK; Python 3.14.0. Embedded runtime, as reported by `tests/baseline.spec.ts` against the installed app: Electron 44.5.1, Node 24.21.0, Chromium 152.0.7977.130, module ABI 149.

### Build results (actual)

| Command | Result |
|---|---|
| `npm.cmd ci` | Exit 0; 589 packages added, 590 audited. No audit fix was run |
| `npm.cmd exec --no -- install-electron` | Exit 0 |
| `npm.cmd run lint` | Exit 0, no findings |
| `npm.cmd run test:unit` | `npm rebuild better-sqlite3` succeeded; **28 files, 319/319 passed**. This includes the two Windows-portable fixes from attempt 1 (`uploads` icacls branch and `deadline` stalled-upload socket), now confirmed on Windows |
| `npm.cmd run package:win` | Exit 0. electron-builder **26.15.3** loaded `electron-builder.windows.json` and the parent config. `@electron/rebuild` rebuilt better-sqlite3 for Electron 44.5.1 x64 (`buildFromSource=false`) and packaged win32 x64. Signing was skipped by configuration for the app, uninstaller and installer. NSIS target: `oneClick=true perMachine=false`. A block map was generated. The default Electron icon is used. The builder downloaded its NSIS/7-Zip tooling during the build (build-time only) |
| `Get-FileHash … -Algorithm SHA256` | `D8743C44C4B124361BF8B45C65E8EEB4CC6567C21ECA4A6BA74973D7D8E44A4B` |

Artifact: `dist/windows/offline-api-client-0.1.0-x64-setup.exe`, 124,225,422 bytes, unsigned and not uploaded. `dist/windows/builder-effective-config.yaml` confirms `deleteAppDataOnUninstall: false`, `runAfterFinish: false`, `publish: null` and `electronVersion: 44.5.1`.

### Installation

The installer run itself was not captured in a transcript. The desktop suite launched `%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe` through `API_CLIENT_EXECUTABLE`, and 12 specs passed against it. That shows the per-user installation exists and the installed executable launches. The installer UI and SmartScreen behavior were not recorded.

### Offline desktop suite against the installed executable (actual)

Before the run, `Test-NetConnection 1.1.1.1 -Port 443` reported `TcpTestSucceeded: False` and `PingSucceeded: False`. The Wi-Fi interface still held a LAN address (192.168.0.172), so this proves external internet was unreachable, not that LAN egress was blocked. Then `npm.cmd exec --no -- playwright test` ran 26 specs: **12 passed, 9 failed, 5 skipped**, plus one worker-teardown timeout error.

- **Passed (12):** auth, baseline (local Chakra window without remote resources), body-editor, navigation dirty/close guards, redirects (including rejection of a verified HTTPS downgrade), request-fields, requests (save/Ctrl+S), response-viewer, secrets, theme/accessibility, urlencoded, variables (two-workspace scope, masking and restart). Secrets reported the real Windows capability `{ available: true, backend: 'platform', mode: 'secure', roundTrip: true, plaintextAbsent: true }`.
- **Skipped (5):** the Linux-only native chooser specs (export, import, multipart, uploads) and the Linux namespace offline story (`offline.spec.ts`). As documented, a skip is not evidence.
- **Failed (9):** cancel-timeout, collections, database, execution (30 s timeout plus worker teardown timeout), navigation deletion guards, navigation cancel-and-navigate, security, shell, workspaces.

**Root cause (harness defect, confirmed from the log):** every desktop spec isolates app data by setting `APPDATA`/`XDG_CONFIG_HOME` to a temporary directory. Electron on Windows ignores the `APPDATA` variable and resolves `userData` through the OS known-folder API. As a result:
- All specs shared one real profile, `%APPDATA%\offline-api-client` of the Windows user who ran them.
- Workspaces from earlier specs ("Auth workspace", "Body workspace", "Cancel fixture", …) appeared in later specs. The security and workspaces specs expected an empty store and failed for that reason.
- `database.spec.ts` failed its own guard (`userData` not under the temporary directory), and `collections.spec.ts` threw `Fixture database must be temporary`. Both guards stopped the specs before they wrote fixture data outside temporary storage.

The remaining failures (cancel-timeout, execution, shell, navigation) are consistent with this shared, pre-populated state, but each still needs to be confirmed after the harness is fixed. None is established as a product defect, and none is established as passing.

**Side effect:** that real profile now holds only synthetic workspaces created by the suite. No user workspace data existed there. It should be removed, or the suite rerun only in a dedicated account, before any manual Windows check relies on an empty first-run state.

### Manual checks and preservation

`task029-evidence/3-manual-checks.txt` is unchanged from the template: no manual results were recorded. No `4-preservation-log.txt` exists: the separate-account uninstall/reinstall check was not run.

### Acceptance status (Windows package)

| Check | Windows result |
|---|---|
| Native SQLite rebuild/build, installer artifact and SHA-256 | **Passed**: see build results above |
| Unit suite on Windows | **Passed**: 319/319 |
| Packaged app launches | Observed: the installed executable launched for 12 passing specs; `app.isPackaged` was not asserted, because that assertion lives in the skipped offline story |
| Start with internet disconnected | Partial: the automated launch happened with external TCP failing; the manual Start-menu launch was not recorded |
| Create/save/restart preserves data | Partial: requests, request-fields, body-editor and variables restart specs passed in a non-isolated profile; the workspaces spec failed (harness); manual check Q not run |
| Two workspaces cannot cross-read/update | Partial: the variables spec passed; the collections spec was stopped by its guard; manual check N not run |
| Environment precedence and missing variables | Observed pass in the variables spec (non-isolated run); manual D/E not run |
| Local GET/JSON/form/file sends | Partial: urlencoded, auth and requests specs passed; execution timed out; multipart/upload native dialog skipped; manual B/F/G/H not run |
| Cancel/timeout followed by successful send | **Not established**: cancel-timeout failed; manual I/J not run |
| 401/500 displayed as responses | Observed pass in response-viewer (non-isolated); manual K not run |
| Import/export exclusions and round-trip | **Not run**: specs skipped on Windows; manual O/P not run |
| TLS error remains enforced | Observed: redirects spec rejected a verified HTTPS downgrade; manual M not run |
| Native SQLite loads from packaged app | **Not established**: database spec stopped at the isolation guard; indirect evidence from passing persistence specs |
| Safe response text, no resource execution | Observed in response-viewer; the security spec failed (harness); manual L not run |
| Real Windows credential backend | Observed: secure platform backend available with a round trip |
| Uninstall preserves data; reinstall/reopen | **Not run** |
| Unsigned status documented | Yes: release/setup docs; signing skipped by config in the build log |

TASK-029 is **in_progress**, not done. The Windows machine is available, so the task is not externally blocked.

### Next steps to complete TASK-029

1. Fix the desktop harness so each spec gets its own user-data directory on Windows. Options: pass an explicit `--user-data-dir=<temp>` launch argument through `tests/fixtures/desktop.ts` for packaged executables, or set the path in a test-only way. Either fix must leave production startup and data paths unchanged. Then rerun the full suite against the installed executable, internet off, in a dedicated test Windows account.
2. Record manual checks A–Q in `task029-evidence/3-manual-checks.txt`. These cover the Windows-only native save, open and file dialogs and the Start-menu launch.
3. Run uninstall/reinstall preservation in the separate account (`task029-evidence/STEPS.md`, Part 5).
4. Reassess acceptance and update this report, the task file and the index together.

## Harness isolation fix (2026-10-10)

### Change (test-only)

- `tests/fixtures/desktop.ts` adds `isolationArgs(env)`. On `win32` it returns `--user-data-dir=<env.APPDATA>\offline-api-client`, the same location Electron would use if it honored `APPDATA`. It throws if a Windows spec does not set `APPDATA`, so a spec can no longer fall back to the real profile. On other platforms it returns no arguments.
- `launchDesktop` prepends these arguments to development launches (before `.`) and uses them as the only arguments for packaged launches (`API_CLIENT_EXECUTABLE`).
- `tests/security.spec.ts` gives the spawned second instance the same arguments. Electron's single-instance lock is per user-data directory, so the second instance must target the same isolated profile.
- On Linux the resulting launch options are identical to before, so the TASK-028 Linux evidence is unaffected. Application source, packaging configuration and the built installer are unchanged; the installer hash `D8743C44…4A4B` remains valid and no rebuild is needed.

All 24 desktop specs set a temporary `APPDATA` on every `launchDesktop` call (checked with grep: each spec file sets it, and every call passes `env`).

### Verification in the Linux workspace

| Check | Result |
|---|---|
| `npx tsc --noEmit` (non-root) | Exit 0 |
| `npx eslint .` | Exit 0 |
| Probe: Electron 44.5.1 started with `XDG_CONFIG_HOME=<a>` and no switch | `app.getPath('userData')` = `<a>/offline-api-client`, before and after `ready` |
| Probe: the same launch plus `--user-data-dir=<b>/offline-api-client` | `app.getPath('userData')` = `<b>/offline-api-client` before and after `ready`; the switch overrides the platform default |

The probe used a minimal throwaway app with `--no-sandbox` and was run only to observe path resolution in this container. Neither the probe nor that flag is part of the project, and the project's own launches keep the sandbox.

**Not run:** the desktop specs in this workspace. Rebuilding better-sqlite3 for Electron needs Electron headers from electronjs.org, which this environment's network policy blocks, and no prebuilt Electron binding exists for this release. The Windows behavior of the switch is therefore **not yet verified**. It must be confirmed by rerunning the suite on Windows, where `database.spec.ts` directly asserts that the database lies inside the spec's temporary directory.

### Next steps

1. **Before the rerun:** delete `%APPDATA%\offline-api-client` in the Windows account used for attempt 2. It holds only synthetic workspaces from that run.
2. Rerun `npm.cmd exec --no -- playwright test` against the installed executable with the internet off. No reinstall or rebuild is needed. Then record the results here.
3. Then run the manual checks A–Q and the separate-account uninstall preservation.

## Windows attempt 3: isolated desktop suite rerun (2026-10-10)

Evidence: `task029-evidence/2-offline-tests-log.txt`, transcript ending 2026-10-10 11:49:42. Before the rerun, the leftover synthetic profile from attempt 2 was deleted. No rebuild or reinstall was done; the installer hash is unchanged.

`Test-NetConnection 1.1.1.1 -Port 443` reported `TcpTestSucceeded: False`. Then `npm.cmd exec --no -- playwright test` ran against `%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe`: **20 passed, 1 failed, 5 skipped**, plus one worker-teardown timeout error.

- **Isolation fix confirmed on Windows:** `database.spec.ts` passed, including its assertion that the database path lies inside the spec's temporary directory, its write/reopen of the native SQLite binding in the packaged app, and its corrupt-startup check. `collections.spec.ts` also passed its temporary-database guard.
- **All 8 attempt-2 failures attributed to shared state now pass:** cancel-timeout, collections, database, navigation deletion guards, navigation cancel-and-navigate, security (including the second-instance lock), shell, workspaces.
- **Still failing:** `execution.spec.ts` › "sandboxed preload sends captured native requests…". It hit the 30 s test timeout, followed by a 30 s worker-teardown timeout. It also timed out in attempt 2. The error context records only the timeout, not the step. Many other specs close the app the same way and pass, so the stall appears specific to this spec's sequence. Its last steps are a held `/hold` request, a page reload, `application.close()`, and a forced shutdown in `finally`. This is **not yet diagnosed**: the next run captures Playwright API timing (`DEBUG=pw:api,pw:browser`) for this spec alone. Until then it is an open Windows failure, neither a product defect nor a test defect.
- **Skipped (5):** unchanged; Linux-only native chooser specs and the Linux namespace offline story.

Updated acceptance rows from this run (non-isolated caveats from attempt 2 are lifted):

| Check | Windows result |
|---|---|
| Native SQLite loads from packaged app | **Passed** (`database.spec.ts`: native binding write/reopen) |
| Create/save/restart preserves data | Automated pass (workspaces, requests, body-editor, request-fields, variables); manual check Q not run |
| Two workspaces cannot cross-read/update | Automated pass (collections, variables, workspaces); manual N not run |
| Cancel/timeout followed by successful send | Automated pass (`cancel-timeout.spec.ts`); manual I/J not run |
| Safe response text, no resource execution | Automated pass (response-viewer, security); manual L not run |
| Local GET/JSON/form/file sends | Partial: urlencoded, auth and requests passed; **execution spec failing**; multipart/native file dialog skipped; manual B/F/G/H not run |
| Import/export, manual checks A–Q, uninstall preservation | **Not run** |

TASK-029 remains **in_progress**.

## `execution.spec.ts` close timeout: diagnosis and test fix (2026-10-10)

### Diagnostic run

Evidence: `task029-evidence/5-execution-debug.txt`, transcript ending 11:54:11. This was a single-spec run against the installed executable with `DEBUG=pw:api,pw:browser`. A trailing `Remove-Item Env:DEBUG` error in that transcript comes from the line being pasted twice and is unrelated to the test.

- The launch line confirms the harness passed `--user-data-dir=C:\Users\…\AppData\Local\Temp\api-client-send-…\offline-api-client`.
- Every API call succeeded up to and including `page.reload` and the after-reload `page.evaluate`. These covered the saved send, status/gzip/binary/size-limit/corrupt-encoding responses, the TLS failure, the redirect, workspace-deletion cancellation, and the post-reload send.
- `electronApplication.close` started 4 ms after that evaluate and never completed. Playwright disconnected its Node inspector session, but the app process stayed alive until Playwright force-killed it at the worker-teardown timeout (`taskkill` of the process tree).

### Cause (inferred from source and timing)

- **How Playwright closes:** Playwright 1.63 closes an Electron app by evaluating `app.quit()` once, then waiting for process exit.
- **How the app responds:** the main process intercepts the window `close` event (`src/main/index.ts`) and asks the renderer for a decision. The renderer's close guard (`useNavigationGuard`) returns "not allowed" while the request controller is `busy`. `busy` is true while a selected workspace has not finished loading (`busy: currentWorkspace ? busy : workspace !== null` in `controller.ts`), and the editor then shows "Loading or saving…".
- **The race:** the spec closes immediately after `page.reload()`. On Windows the reloaded renderer was still loading the selected workspace, so the close was refused and the single `app.quit()` had no effect. On Linux the load finishes before the close request arrives.
- **Confidence:** this cause is inferred from the code path and the 4 ms timing. The step trace itself shows only that close hung. The fix below tests the inference.

### Test change

`tests/execution.spec.ts` now waits, just before `application.close()`, until the editor status reads exactly "Select or create a request", which is the editor's idle state with no request selected. This is the state a person would see before closing the window. No production code changed. Linux workspace checks: `tsc --noEmit` and `eslint .` exit 0. The spec itself was not run here (no Electron SQLite build is available).

### Product observation (not changed; outside this task)

A window close requested while the editor is loading or saving is refused **silently**: the window stays open, no message appears, and the user must close again. This matches the documented rule that operations stay blocked while busy. It is noted as a possible UX follow-up for TASK-030's known-limitations list, not as a TASK-029 defect.

### Next step

Rerun the full desktop suite against the installed executable with the internet off. If `execution.spec.ts` passes, the inferred cause is confirmed and the automated Windows run is clean apart from the documented Linux-only skips.

## Windows attempt 4: full suite after the execution fix (2026-10-10)

Evidence: `task029-evidence/2-offline-tests-log.txt` (this run replaced the previous log), with `TcpTestSucceeded: False`, run against the installed executable. Result: **20 passed, 1 failed, 5 skipped**, with no teardown errors.

- **`execution.spec.ts` now passes** (930 ms). This confirms the inferred cause from the previous section: closing while the reloaded editor was busy.
- **`theme.spec.ts` failed for the first time on Windows.** It passed in attempts 2 and 3. At line 60, `Response body text` never appeared after `Control+Enter`.

### `theme.spec.ts` diagnosis

At the failure, the page snapshot (`test-results/…/error-context.md`) shows the editor status `Saved`, the URL field focused, an enabled `Send` button, and the response panel reading "No response yet". So the shortcut was ignored and no request was sent; this was not a send failure.

The editor's Ctrl+Enter listener (`editor.tsx`) is registered in a passive `useEffect` and captures `c.busy`. After Ctrl+S completes, React commits the `Saved` status, and the focus restore runs in a layout effect before paint. The listener carrying the stale `busy = true` value stays attached until the passive effect runs after paint. The spec pressed Ctrl+Enter as soon as `Saved` and focus were observable, so it could land in that window. The intermittency (two passes, then one failure) fits a timing race.

### Test change

Before that `Control+Enter`, the spec now waits one animation frame plus one macrotask (`requestAnimationFrame` → `setTimeout(0)`), which lets the passive effect flush. No production code changed. `tsc --noEmit` and `eslint .` exit 0 in the Linux workspace. The spec was not run here.

`cancel-timeout.spec.ts` also uses a positive Ctrl+Enter, but only after several field edits, which give the effect time to flush. It has passed in every Windows run, so it was not changed.

### Product observation (not changed)

For a few milliseconds after a save completes, Ctrl+Enter can be ignored. This is far below human reaction time, and the Send button is unaffected. It is noted only for completeness: registering the shortcut through a ref (or a layout effect) would close the window if it is ever wanted.

### Next step

Rerun the full suite. A clean result is 21 passed and 5 skipped (Linux-only). Because `theme.spec.ts` was intermittent, a second consecutive clean run would strengthen the evidence.

## Windows attempt 5: clean automated run (2026-10-10)

Evidence: `task029-evidence/2-offline-tests-log.txt`, transcript from 12:05:43 to 12:08:08. It was run against `%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe` from the unchanged installer (SHA-256 `D8743C44…4A4B`).

- `Test-NetConnection 1.1.1.1 -Port 443` reported `TcpTestSucceeded: False` and the ping failed (external internet unreachable).
- `npm.cmd exec --no -- playwright test` ran 26 specs: **21 passed, 0 failed, 5 skipped**, with no teardown errors, in 1.2 minutes.
- `theme.spec.ts` passed (field-error contrast 8.37 light and 10.48 dark, both at least 4.5), as did `execution.spec.ts` and all specs that failed in attempt 2.
- The 5 skips are the documented Linux-only specs: the native export, import, multipart and upload chooser specs, and the Linux namespace offline story. A skip is not evidence for those rows.
- The user reported the result as all-passed, and the transcript confirms it. Only one clean run is recorded, because each run overwrites the transcript. A second consecutive clean run was suggested, given that `theme.spec.ts` had failed intermittently, but none is recorded.

### Test-only changes made during TASK-029 (cumulative)

| File | Change | Reason |
|---|---|---|
| `tests/main/uploads.test.ts` | On Windows, deny read-data via `icacls` instead of `chmod 0` | `chmod` cannot make a file unreadable on Windows |
| `tests/main/deadline.test.ts` | The stalled-upload case uses a socket that never acknowledges writes | Windows loopback buffered the whole 5 MiB body |
| `tests/fixtures/desktop.ts` | Pass `--user-data-dir=<APPDATA>\offline-api-client` on Windows; refuse to launch a Windows spec without a temporary `APPDATA` | Electron ignores the `APPDATA` variable on Windows |
| `tests/security.spec.ts` | The second instance gets the same isolation arguments | The single-instance lock is per user-data directory |
| `tests/execution.spec.ts` | Wait for the idle editor status before `application.close()` | The close guard refuses to close while the reloaded editor is busy |
| `tests/theme.spec.ts` | Wait one frame plus a macrotask before `Control+Enter` after a save | The shortcut listener is re-registered in a passive effect |

The project also needed `package.json`/`package-lock.json` restored to electron-builder 26.15.3 after an unrequested `npm audit fix --force`. No application source or packaging configuration changed in TASK-029 after the 2026-10-05 preparation. Linux launch arguments are unchanged, so the TASK-028 evidence still applies.

### Current Windows acceptance status

| Check | Windows result | Evidence |
|---|---|---|
| Native build, SQLite rebuild, installer and SHA-256 | **Passed** | Attempt 2 build log |
| Unit suite | **Passed**: 319/319 | Attempt 2 build log |
| Packaged app launches; native SQLite loads, writes and reopens | **Passed** (automated) | `baseline`, `database` specs |
| Start with internet disconnected | **Passed** (automated launch with external TCP failing); the manual Start-menu launch (A) is not recorded | Attempt 5 |
| Create/save/restart preserves data | **Passed** (automated); manual Q not recorded | workspaces, requests, body-editor, request-fields, variables, theme |
| Two workspaces cannot cross-read/update | **Passed** (automated); manual N not recorded | collections, variables, workspaces |
| Environment precedence and missing variables | **Passed** (automated); manual D/E not recorded | variables, auth |
| Local GET/JSON/form sends | **Passed** (automated) | execution, requests, urlencoded, auth |
| File sends through the native file dialog | **Not run on Windows** (spec Linux-only); manual H not recorded | — |
| Cancel/timeout followed by a successful send | **Passed** (automated); manual I/J not recorded | cancel-timeout, execution |
| 401/500 displayed as responses | **Passed** (automated); manual K not recorded | response-viewer, execution |
| Import/export exclusions and round-trip | **Not run on Windows** (specs Linux-only); manual O/P not recorded | — |
| TLS error remains enforced | **Passed** (automated) | execution (`TLS_FAILURE`), redirects (downgrade rejected) |
| Safe response text, no resource execution | **Passed** (automated); manual L not recorded | response-viewer, security, baseline |
| Real Windows credential backend | **Passed**: secure platform backend round trip | secrets |
| Uninstall preserves data; reinstall/reopen | **Not run** | — |
| Unsigned status documented; no security-disabling instructions | **Passed** | release/setup docs; build log shows signing skipped by config |

**Status: in_progress.** Automated Windows acceptance is complete. To finish TASK-029:
1. Complete manual checks A–Q (`task029-evidence/STEPS.md`, Part 4 step 9) and record PASS/FAIL in `3-manual-checks.txt`. These are the only Windows evidence for file upload and import/export.
2. Run uninstall/reinstall preservation in the separate account (`STEPS.md`, Part 5) and copy `4-preservation-log.txt` into `task029-evidence/`.
3. Reassess, then mark `done` in the task file and index together only if every row has evidence.
## Reassessment — 2026-10-10 12:12

TASK-029 was reselected as the earliest unfinished task (TASK-027 done; TASK-030 depends on TASK-029). The device listing of `task029-evidence/` shows no new evidence: `3-manual-checks.txt` is unchanged from the template (1507 bytes, original timestamp) and no `4-preservation-log.txt` exists. The 12:09 documentation update (the attempt 5 section here, plus the related `release.md` and task-file text) was found reverted on disk about one second after it was written: all three files had new timestamps but older content. A sync client or an open editor writing back an older copy is the likely cause, but this is not confirmed. The update was rewritten at 12:12. No other files were changed. Status remains **in_progress**.

**Exact blocker:** the two remaining acceptance items require actions by the machine owner, which this session cannot perform.
- **Manual checks A–Q:** these need the internet disconnected. That also disconnects this session's link to the PC, so they cannot be driven remotely.
- **Uninstall/reinstall preservation:** this needs signing in to a separate Windows account.

## Windows attempt 6: manual checks and uninstall preservation (2026-10-10 12:15–12:40)

At the user's request ("do it yourself"), Claude performed the remaining Windows checks by controlling the user's screen through the Claude desktop app. Commands that needed a shell ran from small helper scripts in `task029-evidence/`, double-clicked in File Explorer. Every app, dialog and Settings interaction was observed in screenshots. The user answered two decisions beforehand and approved both administrator prompts.

### Deviations from the documented procedure (authorized by the user on 2026-10-10)

1. **Offline method:** a temporary Windows Firewall outbound block rule for the installed executable, instead of disconnecting the network. Disconnecting would have cut Claude's link to the PC. `docs/testing.md` accepts "egress blocked … while loopback remains available". The rule was added at 12:18 and removed at 12:39 (`a-firewall-log.txt`). It is a test-environment restriction, not an app change.
2. **Preservation account:** the uninstall/reinstall check ran in the user's own account, not a separate Windows account, because Claude cannot operate another sign-in session. That account held no real workspaces for this app: the app started in a clean first-run state ("No workspace selected"), and only synthetic data was created.
3. **Manual checks performed by Claude** through screen control, not by a person. Results are based on what the screenshots showed, and are corroborated by the exported file and logs.

### Environment

- **Machine:** Windows 11 Pro 10.0.26300 x64, user `javad`.
- **App:** installed per-user at `C:\Users\javad\AppData\Local\Programs\offline-api-client\`, from installer SHA-256 `D8743C44C4B124361BF8B45C65E8EEB4CC6567C21ECA4A6BA74973D7D8E44A4B` (re-hashed by `record-state.ps1`).
- **App data:** `C:\Users\javad\AppData\Roaming\offline-api-client\`.
- **Windows Firewall:** ON for the Domain, Private and Public profiles.

### Manual checks A–Q (`task029-evidence/3-manual-checks.txt`): all PASS

- **Egress proof:** with the rule active, the app's `GET http://1.1.1.1/` failed with `NETWORK_FAILURE`, while loopback sends succeeded.
- **Requests and variables:**
  - Environment precedence and missing variables (`VARIABLE_MISSING`).
  - JSON, URL-encoded (duplicate keys kept in order) and multipart sends; the multipart file was chosen in the **native Windows file dialog**.
  - Cancel and timeout, each followed by a successful send.
  - 401 and 500 shown as responses.
  - HTML shown as literal text with no script execution.
  - TLS rejection (`TLS_FAILURE`).
  - Workspace isolation.
- **Export (native save dialog), `6-export-testA.json`:** no secret value (`synthetic-secret-123` occurs 0 times) and no local file path.
- **Import (native open dialog):** correct preview and omissions; imported as a new workspace.
- **Close and reopen with the window X:** theme, last workspace, environment, requests and the sensitive token persisted.

### Uninstall/reinstall preservation (`task029-evidence/4-preservation-log.txt`)

| Step | Time | Result |
|---|---|---|
| Record before uninstall (app closed) | 12:28:29 | Install folder present. 37 app-data files hashed; `offline-api-client.sqlite` 143,360 bytes, SHA-256 `2B7254D3…7EFB4` |
| Uninstall via Settings → Apps → Installed apps → offline-api-client → Uninstall (attempt 1) | ~12:31 | The uninstaller process (`un_a.exe`) showed a window briefly, which Claude could not see, then exited. At 12:33:19 the install folder **still existed**. The data was unchanged (37/37 identical). Cause not determined |
| Uninstall via Settings (attempt 2) | ~12:34 | The uninstaller (`un_b.exe`) ran. By 12:35:58 the install folder was empty and then gone. A diagnostic helper (`d-run-uninstaller.cmd`) found no uninstaller left to run and ran nothing (`d-uninstaller-log.txt`) |
| Record after uninstall | 12:36:41 | **Install folder absent; app-data folder present; all 37 files byte-identical to before, including the SQLite database** |
| Reinstall: same installer double-clicked in File Explorer | ~12:37 | Per-user install recreated. The app did not auto-launch (`runAfterFinish: false`). No SmartScreen prompt appeared (locally built file, no download mark) |
| Reopen | ~12:38 | Workspaces "Test A", "Test B" and "Test A (imported)", the Local environment, the Light theme and both requests were present. `Hello GET` returned 200 OK. The saved multipart file row correctly required reselection (`FILE_REQUIRED: Select a file again`), as documented |
| Record after reinstall and reopen (app closed) | 12:38:48 | Install folder present. The database and Chromium cache files changed after the app ran, which is expected; the logical state was verified in the UI above |

The uninstaller's explicit data-deletion option was never used. Electron's default data path was confirmed on this machine as `%APPDATA%\offline-api-client`.

**Observation for TASK-030 (known limitations):** the first Settings uninstall did not remove the app, and the second did. The first uninstaller window was not observed, so the cause is unknown. Data was preserved in both attempts.

### Cleanup

- **Firewall rule:** deleted ("Deleted 1 rule(s)"; no matching rule remains).
- **Test server:** the echo server's console window ("TASK-029 echo server") is still open for the user to close.
- **Synthetic data kept:** the workspaces Test A, Test B and Test A (imported) remain in the user's app data, and the app stays installed.
- **Evidence files added:** `3-manual-checks.txt`, `4-preservation-log.txt`, `6-export-testA.json`, `a-firewall-log.txt`, `d-uninstaller-log.txt`, `test-upload.txt` and the helper scripts. All are synthetic and contain no credentials.

### Final Windows acceptance

| Acceptance item | Result | Evidence |
|---|---|---|
| Actual Windows package launches | **Passed** | Desktop suite (attempt 5); manual A |
| SQLite write/reopen works | **Passed** | `database.spec.ts`; manual Q; reinstall reopen |
| Required Windows matrix | **Passed**: every `docs/testing.md` row has automated and/or manual Windows evidence with egress blocked | Attempt 5 table; checks A–Q, including native file, save and open dialogs |
| Uninstall preserves data; reinstall/reopen | **Passed** (deviations 2 and 3) | `4-preservation-log.txt` |
| Unsigned status documented accurately | **Passed** | release/setup docs; signing skipped in the build log |
| No security-disabling instructions | **Passed** | No sandbox, TLS or antivirus changes. The test-only firewall rule *restricted* the app and was removed |
| SHA-256 and exact environment recorded | **Passed** | Above, and attempt 2 |

**TASK-029 is done.** Task file and index updated together. TASK-030 is now unblocked but was not started.
