# TASK-030 — User guide and release acceptance record

Date: **2026-10-10**. Status: done.

## Selection, dependencies and scope

Read AGENTS, product, decisions, task index, TASK-030 and its release/testing references. TASK-001 through TASK-029 were done in both the index and selected dependency task files; TASK-030 was the earliest unfinished task. The initial working tree was clean. Reviewed the final TASK-028/TASK-029 reports and committed Windows build, automated, manual, firewall, export and preservation evidence. Earlier failed Windows attempts were read as history, not as the final result.

Only documentation was changed. No application code, test harness, dependencies, lockfile, package artifact, runtime settings, release upload or phase-2 feature was changed. Existing user and TASK-029 work was preserved.

## Changes

- `docs/user-guide.md`: versioned install/launch steps, local/offline semantics, workspace and collection operations, explicit Save/draft guards, all body/auth modes, environment precedence, sensitive/session-only storage, upload reselection and limits, responses/cancel/timeout, transfer exclusions/preview and data/removal paths.
- `docs/known-limitations.md`: observed Windows uninstall retry and shortcut timing issue; FUSE/platform/stability/prompt coverage not run; unsigned internal metadata, recorded tooling advisories, storage/file/transport limits and deferred scope.
- `docs/release-acceptance.md`: exact three artifact hashes, independent target environments, all 11 required matrix rows with their automated/manual evidence, actual uninstall/reinstall results, authorized Windows deviations and explicit not-run coverage. Acceptance is bounded to the tested unsigned internal packages; no public release or universal OS support is claimed.
- README now describes the implemented app and links these guides, replacing stale planning-only/no-app statements. Release documentation points to current Linux/Windows evidence and removes contradictory Windows-unverified/install-not-claimed wording. Task and index status are updated together.

## Guide cross-check

Used the project-local Graphify skill/wrapper for source discovery, then inspected authoritative specifications and source. The query was truncated; graph output is not acceptance evidence. Inspected workspace/collection controls, request editor/controller, body/auth/fields/multipart controls, variables/environment dialog, transfer dialogs, response viewer/formatter, theme provider and shared limits. Guide labels match actual controls, including top-level `Import workspace JSON` (not a workspace-menu import command), `Choose save location`, `Import as new workspace`, `Variable scope` and `Choose file`.

Checked installed behavior against the Linux targeted checks below and the independent final Windows package report/manual checks. TASK-030 did not operate the Windows machine or independently rehash its installer. No unknown OS check was promoted to pass. Public metadata/licensing, default FUSE mode and other platforms are not established by this documentation task.

## Current environment and actual checks

Host: Ubuntu 24.04.3 LTS x64/X11, Linux `7.0.0-34-generic`; developer Node `v22.18.0`, npm `11.6.2`. Installed Linux executable `/opt/offline-api-client/offline-api-client`; observed embedded Electron `44.5.1`, Node `24.21.0`, Chromium `152.0.7977.130`, ABI `149`.

| Command/check | Actual result | Limits |
|---|---|---|
| `git status --short` before changes | Exit 0, empty | Clean starting tree |
| `python3 scripts/graphify.py query "Which UI controls handle request Save, variables, secrets, uploads and workspace import export?"` | Exit 0; existing graph 982 nodes, query truncated | Source discovery only; no rebuild needed for documentation-only changes |
| `API_CLIENT_EXECUTABLE=/opt/offline-api-client/offline-api-client npm exec --no -- playwright test tests/baseline.spec.ts tests/requests.spec.ts tests/variables.spec.ts tests/export.spec.ts tests/import.spec.ts` | **Exit 0; 5 passed, no skips, 40.5 s** | Real installed Linux package, temporary synthetic userData, local/native chooser tests; this run did not block egress and is not a new full offline acceptance run |

The five checks establish installed startup/local UI resources, explicit Save/Ctrl+S/draft/duplicate/delete behavior, environment/variable isolation/masking/restart and native export/import preview/omissions/invalid input/cancellation. No real user database was read or removed. No sandbox or TLS workaround was used.

Full unit/full offline/platform suites were not rerun because only docs changed. Release matrices cite the exact historical package evidence rather than relabeling it as a new run: Linux installed suite 26 passed (2026-10-05); Windows unit suite 319 passed and final installed suite 21 passed/5 Linux-only skips, with independent manual A–Q and preservation (2026-10-10). Windows skips count only as skips; manual observations supply product coverage.

## Completion

| Final documentation check | Actual result |
|---|---|
| Python local Markdown link/heading-anchor validation across README, AGENTS and all docs Markdown | Exit 0; initial **234**, final **242 links/anchors in 83 documents resolve** after adding completion references |
| Artifact/version consistency against package metadata, original TASK-028 report and Windows build transcript | Exit 0; all **three SHA-256 values** match their recorded originals; version **0.1.0** matches package.json |
| Windows evidence consistency | Exit 0; **17 manual A–Q PASS entries**, automated summary **21 passed / 5 skipped**, and **37/37 file hashes identical** before/after the completed uninstall |
| `git diff --check` | Exit 0, no whitespace errors; repeated after final status edits |
| Task/index synchronization and scope review | TASK-030 `done` in both; TASK-028/TASK-029 remain `done`; Git changes restricted to eight Markdown files |

Acceptance criteria are met: independent OS results and limits are recorded, unknown checks stay not-run, the guide matches source controls and installed behavior/evidence, observed issues are listed, and readiness is restricted to the recorded internal package paths. No remaining TASK-030 blocker is known. Untested coverage and observed issues remain explicitly documented, without expanding the task into fixes or publication. Work stops at TASK-030.
