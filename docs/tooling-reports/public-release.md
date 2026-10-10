# Public release preparation — 0.1.1

Date: 2026-10-10. Status: in progress; no upload or new Windows build is yet verified.

## Scope and changes

User-authorized installer build and GitHub publication, outside the completed TASK-001–030 sequence. Existing task acceptance/history remains unchanged. Initial tree was clean at commit `4b4ebd1` (`finished phase 1`), branch `master`, origin `https://github.com/miladmoham1400/api-client.git`.

- Bumped package and lockfile to 0.1.1, preserving all pinned runtime/tool versions.
- Replaced internal placeholder homepage/maintainer with repository URL and existing Git author name/email. License remains `UNLICENSED`.
- Added manual target-native GitHub Actions builds with installed-app focused smoke checks, checksums and artifact handoff; no automatic release publishing.
- Ignored local environment/database files in addition to existing generated-output exclusions. A tracked-path check found no `.env`, SQLite/database or credential-named files; this is not a complete history/security audit.
- Added public release procedure and explicit new-version acceptance limits.

## Actual checks

Environment: local Ubuntu 24.04 x64, developer Node 22.18.0/npm 11.6.2, Electron 44.5.1, electron-builder 26.15.3. Embedded/native Electron ABI is checked by packaged smoke tests, not inferred from developer Node.

| Command/check | Actual result |
|---|---|
| `npm run lint` | Exit 0 |
| `npm run test:unit` (sandbox) | Exit 1: 255 passed / 69 failed; loopback `listen EPERM` blocked HTTP fixtures |
| `npm run test:unit` (outside sandbox) | Exit 1: 323 passed / 1 failed; variable repository test exceeded its 5000 ms timeout |
| `npm run test:unit -- --maxWorkers=1` (outside sandbox) | Exit 0: all 324 tests, 29 files passed, 35.69 s; no test timeout threshold was changed |
| `npm run package:linux` (sandbox) | Production typecheck/bundling and native rebuild ran; packaging failed downloading from GitHub with `EAI_AGAIN` |
| `npm run package:linux` (outside sandbox) | Exit 0: AppImage and deb built; production typecheck/bundling and target-native SQLite rebuild succeeded |
| GitHub authentication | Initial keyring timeouts; after second user login, `gh repo view` succeeded: ADMIN, default branch master, currently PRIVATE |
| Windows native build / workflow execution | Not run yet; repository authentication blocks pushing/dispatching the workflow |
| Public Release upload | Not run yet |

## Limits and remaining work

Finish local Linux build, inspect exact payload/hash and run packaged checks; validate workflow syntax, commit/push the prepared release changes, execute Windows build and inspect its actual results before publishing. Never substitute the old 0.1.0 `.exe`. New 0.1.1 Windows 11 full offline/manual/uninstall acceptance remains unverified. The existing navigation deletion-dialog test failure is documented in [panel-layout report](panel-layout.md). No stable-release readiness claim is made.

The keyring timeout is an access blocker, not evidence that the repository or password is wrong. User was asked to run `gh auth status` in their terminal and unlock the keyring if necessary; no password/token was requested. Official workflow versions/runner labels are linked in [public release procedure](../public-release.md).

## Local package evidence

- Offline network namespace (`scripts/test-offline.sh`) against `dist/linux/linux-unpacked/offline-api-client`: all 5 focused desktop specs passed in 18.1 s (database persistence/corruption, JSON presentation, panel layout, response viewer, IPC security). This verifies the packaged payload, not an actual deb installation.
- deb metadata: version 0.1.1, amd64, maintainer Milad <milad1400@gmail.com>, real GitHub homepage.
- Local deb SHA-256: `b83d98644850ec20615ddc7a58fa1db279992aab3e668a5e7b3aaea9db51b81a`.
- Local AppImage SHA-256: `104759fc84abd340e7230f3fcf905c28c04d59145b0d2c48c4de35ed904bb3ca`.
- YAML parsed successfully with local PyYAML; `git diff --check` exit 0. Workflow execution remains required; parsing does not validate hosted behavior.
- Limited high-confidence token pattern scan of 657 unique Git-history blobs found no matches. No actual credential values were emitted. This is not a complete audit.
