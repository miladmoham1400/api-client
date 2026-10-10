# Public release — 0.1.1

Date: 2026-10-10. **Completed: public unsigned pre-release published**, with all three installers and SHA-256 download asset. Full new-version Windows 11 acceptance remains unverified; pre-release completion is not stable-release readiness.

- [Public Release v0.1.1](https://github.com/miladmoham1400/api-client/releases/tag/v0.1.1)
- [Final native build run 38054460266](https://github.com/miladmoham1400/api-client/actions/runs/38054460266)
- [Successful publication run 38055186643](https://github.com/miladmoham1400/api-client/actions/runs/38055186643)
- Installer source/build commit: `cbf33cb644d57cc2c8ddbb48c1a12f5ab7dec5b7`; release tag targets that commit. Publisher workflow commit: `925e77791f9e1bbb3b3923a39a0c4819bd012ead`.

## Scope and changes

User explicitly requested installer builds and repository publication, outside the completed TASK-001–030 sequence. Initial tree was clean at `4b4ebd1` (`finished phase 1`), branch `master`, origin `https://github.com/miladmoham1400/api-client.git`. Existing task status and 0.1.0 full acceptance remain historical, not new-version passes.

- Bumped package and lockfile to 0.1.1 without changing pinned dependencies. Packages include the previously committed icon, JSON highlighting and panel layout enhancements.
- Replaced internal placeholder homepage/maintainer with repository URL and existing Git author name/email. License remains `UNLICENSED`; public visibility is not an open-source license grant.
- Added manually dispatched native Linux/Windows builds, installation checks, focused packaged smoke tests, checksums and artifact handoff. No automatic push-triggered publication, signing, updater or application cloud dependency.
- Added a separate manually dispatched publisher that checks successful native-build provenance, package version and all three installer hashes, then publishes a pre-release. Its short-lived job token has contents-write/actions-read; no personal token is written into source.
- Added a checksum verifier and release notes; updated README, installation/release guides, known limitations and task-index publication note without changing task statuses.
- Ignored local environment/database files in addition to generated outputs. No tracked `.env`, database or credential-named files were found. A limited scan of 657 unique historical Git blobs found no high-confidence token-pattern matches; this is not a complete secret audit. No credential values were emitted.
- Corrected upload-test evidence for elevated runners: probe whether fixture permissions actually prevent opening; explicitly skip native denial when they do not. A separate deterministic `EACCES` test verifies redacted `FILE_CHANGED` and the row field. No production file-access logic or permissions were changed.

## Actual local checks and failed attempts

Local Ubuntu 24.04 x64/X11, developer Node 22.18.0/npm 11.6.2; Electron 44.5.1, builder 26.15.3, better-sqlite3 13.0.3. Unit tests rebuild SQLite for developer Node; native packaging rebuilds it for Electron. Packaged database tests asserted ABI 149 and normal close/reopen.

| Check | Actual result |
|---|---|
| Initial `npm run lint` | Exit 0 |
| `npm run test:unit` inside sandbox | Exit 1: 255 passed / 69 failed; loopback `listen EPERM` blocked HTTP fixtures |
| Same command outside sandbox | Exit 1: 323 passed / 1 failed; variable repository test exceeded its 5000 ms timeout |
| `npm run test:unit -- --maxWorkers=1` outside sandbox | Exit 0: initial 324 passed, 29 files, 35.69 s; timeout threshold unchanged |
| `npm run package:linux` inside sandbox | Typecheck/bundling/native rebuild ran; packaging failed downloading from GitHub with `EAI_AGAIN` |
| Same packaging command outside sandbox | Exit 0: local AppImage/deb built; production typecheck/bundling and Electron native rebuild succeeded |
| Local packaged-unpacked offline focused specs | Exit 0: all 5 passed, 18.1 s; payload test, not an actual deb installation |
| Local AppImage extraction-and-run offline focused specs | Exit 0: all 5 passed, 33.9 s |
| Local AppImage integrated offline story | Exit 0: 1 passed, 19.6 s; only loopback/no IPv4 routes, non-root sandboxed Electron, external probe `ENETUNREACH`; persistence/isolation/failure/transfer exercised; secure storage available locally |
| Focused upload tests after correction | Exit 0: 15/15 locally |
| Final full local unit tests | Exit 0: 325/325, 29 files, 36.30 s |
| Final typecheck/lint/whitespace | Exit 0; the first test edit used an unsupported `it.each` context and failed typecheck, corrected to `it.for`; the verifier initially lacked explicit process/console imports and failed lint, corrected before committing |
| Checksum verifier synthetic checks | Complete three-file set accepted; tampered file and missing platform rejected |
| Workflow YAML | Both parsed locally with PyYAML; successful hosted executions supply actual workflow evidence |
| Local Graphify update | Exit 0: final 1030 nodes / 3198 edges; optional graph output is not test evidence |

Local artifact hashes (different bytes from published hosted builds): deb `b83d98644850ec20615ddc7a58fa1db279992aab3e668a5e7b3aaea9db51b81a`, AppImage `104759fc84abd340e7230f3fcf905c28c04d59145b0d2c48c4de35ed904bb3ca`. Metadata inspection confirmed 0.1.1/amd64, real repository homepage and maintainer.

Initial GitHub authentication timed out in keyring, including after the first reported login. After the second login, `gh repo view` returned ADMIN, default branch master. Repository visibility was PRIVATE and was changed to PUBLIC as explicitly requested. No password/token was requested in chat. Changes were committed and pushed without rewriting history.

First [hosted run 38053826114](https://github.com/miladmoham1400/api-client/actions/runs/38053826114), source `2bfecb4bc70e9942e37ed60efe490e0122655e87`: Linux succeeded (324 unit tests; actual deb install and 5 installed-app tests, 32.0 s). Windows stopped before packaging (323 passed / 1 failed) because its unreadable ACL fixture remained readable. No Windows installer was accepted/uploaded by that failed job. The test correction above led to the final successful run.

## Final native build and installation evidence

Both target jobs used the same lockfile/source commit, clean `npm ci`, pinned developer Node/npm and sequential native rebuild. Zod/Rollup annotation warnings did not stop production builds; no dependency changes were made to silence them.

| Target | Actual result |
|---|---|
| Ubuntu 24.04 hosted x64 | Lint and all 325 unit tests passed; native AppImage/deb built; actual deb installed with OS package manager; 5 focused installed-app specs passed in 13.5 s |
| Windows Server 2022 Datacenter 10.0.20348 hosted x64 | Lint and 324 unit tests passed; 1 native unreadable-file fixture skipped because read access remained; deterministic denied-open test passed; native NSIS installer built and silently installed; 5 focused installed-app specs passed in 19.1 s |

Focused specs: SQLite persistence/corruption, IPC/browser security, JSON presentation/wire bytes, panel toggling/resizing/draft preservation, response states/snapshots. The executable override selected the installed binary, with synthetic temporary userData. Windows rebuild/install/checks were performed on Windows, not cross-generated on Linux. Windows Server evidence is not Windows 11 evidence. Hosted focused tests did not isolate internet egress; local offline checks are separately identified above.

## Published assets and verification

The manual publisher downloaded the exact successful build's artifacts within GitHub, verified all three SHA-256 values, and created pre-release `v0.1.1` at the build commit. Slow local artifact downloads were stopped in favor of this remote transfer; no incomplete file or old 0.1.0 Windows installer was uploaded.

| Published asset | Bytes | SHA-256 |
|---|---|---|
| `offline-api-client-0.1.1-amd64.deb` | 112840564 | `aa1e90c482a93ca5a89701aff5547563e8a91e5331aefeb19e8eb8ea40784371` |
| `offline-api-client-0.1.1-x64-setup.exe` | 124680117 | `1d85d043e3faf637c4ae6143a97f3c4b8f86ece6cf72cf12a5cf78436ce71dc9` |
| `offline-api-client-0.1.1-x86_64.AppImage` | 143961922 | `690039b2a90dc1cf47879569291976e654b42b7b69b47a9cc59d5437e32a1b08` |
| `SHA256SUMS.txt` | 313 | Downloaded and matched to the three uploaded asset digests |

Actual final checks: `gh release view` confirmed uploaded asset states, pre-release status and exact target commit. Downloaded `SHA256SUMS.txt` and compared each digest to GitHub's uploaded asset `digest` via release API: all matched. Anonymous `curl --head --location` checks for `.deb`, `.exe` and AppImage each returned HTTP 200. The full large artifacts were not redownloaded locally; within-GitHub checksum verification and uploaded digest comparisons supply the transfer evidence. Installer bytes remain in Release assets, outside the Git source tree.

## Remaining coverage limits

- Full Windows 11 offline/manual native chooser/uninstall/reinstall preservation has not been repeated for 0.1.1.
- New deb uninstall/reinstall preservation and hosted artifact offline story were not rerun. Local offline evidence applies to the separately hashed local builds. Default AppImage FUSE mounting remains unverified.
- Native Windows ACL denial is unverified on the elevated hosted runner; its skip is not a pass.
- Existing navigation deletion-dialog test timeout reproduced before the panel enhancement and remains unresolved; full current desktop suite is not claimed green. See [panel layout report](panel-layout.md).
- Packages are unsigned. No runtime updater, universal OS support, complete security audit, open-source license or stable-release readiness is claimed.

Official workflow versions and runner labels are linked in [public release procedure](../public-release.md); download-artifact v8.0.1 inputs were additionally checked against its [official action definition](https://github.com/actions/download-artifact/blob/v8.0.1/action.yml). User-authorized public distribution is complete with the above limits documented in the Release notes.
