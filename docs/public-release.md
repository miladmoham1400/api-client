# Public installer distribution

The user authorized building and publishing GitHub Release downloads on 2026-10-10. Version 0.1.1 includes the custom icon, JSON highlighting and resizable stacked/side-by-side panels added after the independently accepted 0.1.0 packages. Old package acceptance does not validate these new bytes.

Repository: https://github.com/miladmoham1400/api-client. Installers belong in Release assets, not the Git source tree. The package homepage and maintainer now use the repository and existing Git author metadata. No signing, runtime update service or telemetry is added. The existing `UNLICENSED` designation remains unchanged; a public repository does not grant an open-source license.

## Native builds

`.github/workflows/packages.yml` is manually dispatched on the selected commit/ref. It builds Linux on `ubuntu-24.04` and Windows on `windows-2022`, using developer Node 22.18.0, npm 11.6.2 and `npm ci`. Each target runs lint and all unit tests with one worker, then its existing native packaging command. Packaging rebuilds SQLite for Electron after the developer-Node tests.

The workflow installs each target's package and runs focused SQLite persistence/corruption, IPC security, JSON presentation, panel resizing and response checks against the installed executable. It uploads installers only after those checks succeed, plus SHA-256 files; failed jobs upload test diagnostics when available. It neither creates a Release nor uploads installers automatically on push. GitHub Actions artifacts expire after 14 days and are build handoff files, not permanent public downloads.

The Windows runner is Windows Server, not the documented Windows 11 baseline. These focused tests are not the full offline acceptance matrix: network-isolated startup, all native chooser dialogs and uninstall/reinstall preservation still require independent evidence on the new packages. No skipped or unexecuted check is a pass. A public pre-release must state these limits and the known navigation test failure recorded in [panel layout evidence](tooling-reports/panel-layout.md).

## Publish after verification

1. Commit the version, packaging metadata, workflow and documentation; push that commit without rewriting existing history.
2. Dispatch **Native installer builds** on that commit's ref. Confirm both jobs built the same `headSha`; inspect job results and download artifacts.
3. Check installer SHA-256 against each runner's checksum file. Combine checksums into one release asset and include source commit, OS/build evidence and remaining limits in release notes.
4. Create the matching version tag/Release with `.deb`, `.AppImage`, `.exe` and checksum assets. Use pre-release status while new platform acceptance remains incomplete. Do not rename/reuse the old 0.1.0 Windows installer as 0.1.1.
5. Verify the public asset list and download links after upload. Users install without developer Node/npm or a GitHub account. Unsigned Windows installers can trigger reputation prompts; do not disable security protections.

For example, after actual checks and preparing `dist/release/release-notes.md`:

```text
gh workflow run packages.yml --ref master
gh run view <run-id>
gh run download <run-id> --dir dist/release
gh release create v0.1.1 <verified-assets> --target <verified-commit> --prerelease --title "Offline API Client 0.1.1" --notes-file dist/release/release-notes.md
```

Publishing requires an authenticated GitHub account with repository write access and Actions enabled. Never put passwords or tokens in source, reports or chat.

When transferring large artifacts through a developer connection is slow, manually dispatch **Publish verified pre-release** (`publish-release.yml`) with the successful native build run ID. It validates the run's repository, workflow, completion, source SHA and package version, downloads only that run's installer artifacts and checks all three SHA-256 values with `scripts/verify-release-artifacts.mjs`. Missing, duplicate or mismatched assets stop publication. It then creates a pre-release and matching source tag with the documented release notes. Its short-lived GitHub job token has contents-write/actions-read access; no personal token is stored. This workflow only runs on manual dispatch and does not overwrite existing releases.

## Official configuration references

Verified 2026-10-10: [GitHub runner labels and OS limitations](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2), and [GitHub Release management](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository?tool=webui).

Current execution evidence and access blockers: [public release report](tooling-reports/public-release.md).
