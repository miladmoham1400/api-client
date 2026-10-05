# TASK-028 — Linux packaging and verification

Status: done
Date: 2026-10-05

## Scope and inspection

Initial working tree clean. Read AGENTS.md, product.md, decisions.md, task-index.md, TASK-028, release.md, setup.md, testing.md and toolchain-lock.md. TASK-027 is done in both file/index. Consulted local Graphify then inspected main lifecycle/userData/build/test paths. No production behavior or Windows task implemented. Existing application direct versions preserved.

## Implementation

- Pinned electron-builder 26.15.3 in package.json/lockfile, rechecked against official npm stable metadata (Node >=14). Developer Node 22.18.0 meets its engine. Installed-version scheme/templates verify `npmRebuild: true`, `nativeRebuilder: sequential`, ASAR/unpack and Linux targets; builder logs confirm Electron 44.5.1 x64 native dependency rebuild.
- Linux-only configuration builds AppImage/deb, bundles out/main/preload/renderer and production dependencies, unpacks better-sqlite3, disables publishing and preserves application identity/userData as offline-api-client. No updater, telemetry, remote assets, sandbox/TLS bypass, signing or Windows packaging.
- Clean script deletes only generated out/dist/linux. Required internal homepage/author/maintainer fields use reserved .invalid placeholders; no claim of a public project homepage. Default Electron icon remains an internal-package limitation.
- Test-only `launchDesktop` executable override lets existing tests exercise an actual packaged executable, without changing production IPC/lifecycle. Existing source launch remains default; sandbox always enabled for package override. Integrated story asserts app.isPackaged. Suites must run sequentially on shared X11.
- Linux build/prerequisite/acceptance procedure added to release.md; toolchain-lock records actual builder. No TASK-030 user guide or final cross-platform release record authored.

## Environment and artifacts

Ubuntu 24.04.3 LTS x64/X11, kernel 7.0.0-34-generic. Node 22.18.0/npm 11.6.2. Packaged Electron 44.5.1 embeds Node 24.21.0, Chromium 152.0.7977.130 and native ABI 149. Builder 26.15.3. Unsigned internal packages; no publication. No /dev/fuse on this host, so AppImage extraction-and-run mode used; normal FUSE mount mode not tested.

Final artifacts in ignored dist/linux copied from the clean lockfile build; SHA256SUMS is alongside them:

| Artifact | SHA-256 |
|---|---|
| offline-api-client-0.1.0-x86_64.AppImage | `0fc016e359cbf62b7384162a46c6cd6e5e771c86c070f683b447f80b03166178` |
| offline-api-client-0.1.0-amd64.deb | `f03817791dec3cf874b84001a3020393dcb56a5e96a00f02fca192231486ac28` |

Approximate sizes: AppImage 137 MiB, deb 108 MiB. Earlier workspace build hashes differed; no bit-identical build claim. Clean verification copied tracked source plus new config/helpers to /tmp/api-client-task028-clean-7bncuh0t, with no node_modules/out/dist or user workspace database. Packages were then copied into the repository's ignored output for review; tests use those exact bytes.

Generated deb metadata: package offline-api-client, version 0.1.0, amd64. Declares libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0. Declared dependencies were satisfied during actual dpkg configuration on this Ubuntu baseline; no additional dependency downloads/upgrades were required. Runtime ldd found no missing direct libraries on this host. Inspected archive: main/preload/renderer present, no source/tests/docs/skill/scripts/graph included; 9739 archive entries. better-sqlite3 native prebuilds are unpacked including linux-x64.node; other upstream prebuild files are not evidence of other OS support. Initial check for build/Release path found no file: this pinned dependency packages prebuilds, and the actual native load/reopen test is authoritative.

## Commands and actual results

- `npm view electron-builder version engines --json` against official npm registry: 26.15.3, Node >=14.0.0. `npm install --save-dev --save-exact electron-builder@26.15.3`: exit 0, audited 590 packages, 0 reported vulnerabilities. Transitive deprecated tooling warnings recorded; no application package upgrades. `npm install --package-lock-only --ignore-scripts`: exit 0.
- First package attempt: failed at deb generation because required homepage metadata was absent. AppImage was generated. Added explicit reserved internal metadata and rebuilt both targets successfully (exit 0).
- Initial lint flagged missing URL import in clean helper; imported node:url URL. Final `npm run lint` and `npm run typecheck`: exit 0. `git diff --check`: exit 0, also repeated after final report/status edits. SHA256SUMS verification: both artifacts OK.
- Clean directory pipeline `npm ci && npm run lint && npm run test:unit && npm run package:linux`: **exit 0**. npm ci installed 589 packages; audit 0 vulnerabilities. Unit suite **319 passed/28 files (6.53 s)**. Package script typecheck/build and builder native rebuild passed; both targets generated. No native rebuilds shared the same node_modules concurrently.
- AppImage focused baseline + integrated offline story: **2 passed (17.6 s)** against the initial workspace artifact. app.isPackaged true; real Electron with normal sandbox, native data persistence and local HTTP/secret/transfer recovery. Actual storage mode secure in this run; no raw fixture credentials recorded here. Final deb capability check reports gnome_libsecret, available true, synthetic encryption/decryption round-trip true and plaintext absent from ciphertext true; these are real backend observations on this host, not other-OS claims.
- Initial full package suites overlapped on shared X11 and were stopped; no acceptance pass inferred from partial runs. A sequential AppImage run still timed out (auth/body), identifying a test teardown bug: SIGKILL targeted the AppImage runtime parent, leaving Electron alive while awaiting close. Changed test-only cleanup to forced Electron app.exit, allowing the launcher to clean up; never counted as normal-close evidence. Focused AppImage auth/body checks then **2 passed (11.6 s)**. Final whole suites run sequentially; no production guard changed.
- Exact clean deb payload: extracted with dpkg-deb -x into /tmp/task028-deb-extracted; **exit 0, 26 passed (2.4 min), no skips**. Native SQLite ABI/load/write/reopen, offline story and full matrix passed for this payload. This is packaged payload evidence, not installed-deb acceptance.
- Final teardown compatibility on deb payload (`tests/auth.spec.ts tests/database.spec.ts`): **exit 0, 2 passed (4.9 s)** after the helper change.
- Exact clean AppImage final isolated suite: **exit 0, 26 passed (3.5 min), no skips**, including normal close/reopen, native SQLite and complete offline matrix. APPIMAGE_EXTRACT_AND_RUN=1 is runtime extraction support, not a sandbox workaround.
- Graphify update: exit 0, 959 nodes/3050 edges/49 communities. Optional code-only discovery; syntax-extractor warning for cancel-timeout.spec.ts and 16 files with no extracted symbols. TypeScript checks passed; graph incompleteness is not source/test evidence. Generated graph ignored, no model/cloud/hooks.

Non-fatal builder output: default icon, duplicate dependency references and suggestion to use install-app-deps (existing explicit Node/Electron rebuild scripts intentionally retained). Existing Zod/Rollup PURE annotation and Playwright color warnings.

## Offline method and required Linux matrix

All package UI checks run through scripts/test-offline.sh: private user/network namespace, only lo up (127.0.0.1/::1), no external interfaces/routes, nested regular-user identity. App, Playwright and fixture servers share that network. Integrated story checks /proc network state and an RFC5737 TCP probe fails ENETUNREACH; real loopback sends succeed. Host interfaces/firewall untouched; no public test API or production --no-sandbox.

The required fixture/UI matrix is exercised by the complete suite: offline startup/local edits; saved data restart; two-workspace ownership/selection; environment precedence/missing values; native GET/JSON/form/file sends; cancel/timeout then success; 401/500 response display; safe transactional transfer/omissions and re-entry; TLS rejection/downgrade; native SQLite write/reopen; literal untrusted HTML/no remote resources. Deb payload and extraction-run AppImage: all 26 passed independently. Installed deb matrix now passed independently in the resumed verification below; prior extraction evidence was never treated as installation.

## Initial blocker (resolved during resumed verification)

`sudo -n true` outside the restricted sandbox exited 1: **sudo: a password is required**. At the initial stop, this session had no noninteractive administrative capability for apt/dpkg installation, install hooks, removal hooks or live AppArmor installation. No password was requested/read/stored, and no privilege/sandbox bypass attempted.

At the initial stop, actual deb installation, launch from the installed location and uninstall/reinstall preservation were **not run**; they are now verified below. Inspected generated postinst/postrm: standard application link and AppArmor management; postrm does not target home/userData. That inspection is not an executed uninstall. No real user database touched. These required acceptance criteria kept the initial attempt unfinished; the resumed verification resolved them.

The required unblocking procedure was executed below on this Ubuntu baseline using privately authenticated system prompts. Normal FUSE AppImage launch also remains not-run on this host. Windows, Wayland, other Linux distros and phase-1 release readiness are not claimed. TASK-029/TASK-030 untouched.

Initial task/index were set blocked together; the resumed evidence below permits marking TASK-028 done. No later task started.

## Resume: administrative installation acceptance (2026-10-05)

User explicitly authorized continuing TASK-028 and entering authentication privately in the system prompt. Existing task changes preserved; both exact artifact SHA256SUMS rechecked OK. No password captured or stored. `pkexec apt-get --no-download --assume-yes install <absolute local deb>` reached dependency planning (only the app, no dependency downloads/upgrades), then exited 100 with an internal local-file pathname error. `pkexec dpkg --install <same exact deb>` exited 0: installed/configured offline-api-client 0.1.0 amd64, desktop triggers and update-alternatives ran. `dpkg-query` reports install ok installed; `dpkg --verify offline-api-client` exit 0/no discrepancies; /usr/bin entry resolves to /opt/offline-api-client/offline-api-client. AppArmor profile installation observed. Earlier administrative blocker is historical and has been lifted; installed/removal checks are complete below.

Added a separate two-phase preservation verification config/test (not included in ordinary smoke suite). It uses only a dedicated /tmp synthetic XDG userData directory, explicitly checks packaged installed identity, creates saved workspace/environment/request/variable/theme, closes normally and records database SHA-256. After real package removal/reinstallation, verification checks bytes before app startup and reopens exactly the same stored configuration. No real user workspace is read/deleted. Forced fixture teardown does not count as normal-close evidence.

- `API_CLIENT_EXECUTABLE=/opt/offline-api-client/offline-api-client bash scripts/test-offline.sh`: **exit 0, 26 passed (2.5 min), no skips**. Actual installed app, native SQLite load/write/reopen, complete required Linux matrix and loopback-only blocked-egress story passed.
- Installed startup outside custom user/network namespaces (`tests/baseline.spec.ts`): **exit 0, 1 passed (1.1 s)**, normal Chromium sandbox, file/data resources only.
- Preservation seed through dedicated config: **exit 0, 1 passed (1.1 s)**, normal close. `pkexec dpkg --remove offline-api-client`: **exit 0**; executable absent, dpkg status deinstall ok config-files. Database survived actual removal byte-for-byte; SHA-256 `6dbe6b3d00428603a731b32c80d1fa797fc893acddb573dc4781ebadc51bac10`.
- `pkexec dpkg --install <same hashed deb>`: **exit 0**, configured 0.1.0 amd64. Preservation verify phase: **exit 0, 1 passed (1.2 s)**; hash identical before startup, same IDs/selected workspace/environment, saved request/template, plain variable and dark theme reopened, then normal close. Synthetic test directory was removed only after successful verification. App remains installed.
- Remove emitted non-fatal update-alternatives warnings about the just-removed executable/dangling link; reinstall restored the link. No userData deletion or unresolved install error. `dpkg --verify offline-api-client` after reinstall: exit 0/no discrepancies; final artifact hashes both OK.
- Final lint/typecheck and `git diff --check`: exit 0, including completion/status edits. Graphify refreshed after new test/config: exit 0, 963 nodes/3062 edges/49 communities; ignored discovery data, not verification evidence.

## Completion and remaining limits

TASK-028 is done with clean package build, independent AppImage extraction-run/deb payload suites, installed-deb full offline acceptance, normal installed startup and actual removal/reinstall preservation evidence. No task blocker remains. FUSE mount mode is not run because /dev/fuse is absent; supported extraction-run mode is tested, with no sandbox workaround. Windows, Wayland, other distributions, signing and overall phase-1 release readiness remain unverified. No TASK-029/TASK-030 work performed.
