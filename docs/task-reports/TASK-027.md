# TASK-027 — Integrated offline acceptance

Status: done
Date: 2026-10-05

## Inspection and scope

The initial working tree was clean. Read AGENTS.md, task-index.md, TASK-027, product.md, decisions.md, testing.md and secrets.md; also inspected request-engine.md/import-export.md, IPC/services and existing fixture/desktop coverage. TASK-026 was done in both task/index and TASK-027 was the earliest eligible unfinished task. Consulted the project-local Graphify skill/query, then source; the truncated graph was discovery only.

Implemented only acceptance tooling/tests/docs. No production behavior, package version, lockfile, phase-1 scope or later packaging task changed. No production defect was found in the exercised story. Existing ownership, duplicate-key and active-scope guards were retained.

## Changes

- `npm run test:offline` rebuilds native SQLite for Electron, builds and runs the entire desktop suite under `scripts/test-offline.sh`.
- Linux runner creates a private user/network namespace, raises only loopback and maps the invoking regular UID/GID into an inner user namespace. No host firewall/interface/route changes. No root Electron, sandbox bypass, TLS bypass or remote test APIs.
- New integrated Electron story creates Clinic API/Local, saves a template/query/Bearer request using sensitive environment variables, verifies explicit send and environment precedence, negative cases/recovery, independent workspaces, normal close/reopen, missing session-secret re-entry, native export/preview/import, omitted auth/file recovery and a multipart send. Checks marked values absent from DB/WAL files and captured application diagnostics; no raw diagnostics or fixture credential values are included here.
- Completed shared fixtures for 401/500, delayed responses and literal HTML; added exact PUT/PATCH/DELETE wire/body checks and fixture response/abort tests. Existing suites cover other methods, forms/files, compression/limits, redirects, TLS downgrade, cancellation races, ownership, transactionality, migrations and safe HTML display.
- Documented reproducible commands/prerequisites and the distinction between source-built acceptance and packaged OS acceptance in testing.md. Ordinary smoke intentionally skips the offline story; only the isolated runner counts as offline evidence.

## Environment and blocked-egress proof

Ubuntu 24.04.3 LTS, Linux x64/X11, kernel 7.0.0-34-generic. Developer Node 22.18.0/npm 11.6.2. Electron 44.5.1, Chromium 152.0.7977.130, embedded Node 24.21.0, native ABI 149. Native rebuilds were sequential.

Method: outer `unshare --user --map-root-user --net`, `ip link set lo up`, inner `unshare --user --map-user=<invoking uid> --map-group=<invoking gid>`. Playwright, Electron and loopback fixtures inherit this network. Actual interface output: only lo, 127.0.0.1/8 and ::1/128; no external interfaces or IPv4/IPv6 external routes. Focused story checks `/proc/net/dev`, empty IPv4 route table and TCP connect to RFC 5737 documentation address returns ENETUNREACH. Loopback HTTP/HTTPS fixture interaction is real, not online-status emulation. Descendant non-loopback network connections cannot succeed in this namespace. No renderer HTTP requests were observed; loaded renderer resources were file/data only. This proves blocked-egress operation, not a packet-trace claim about every attempted Chromium syscall or host service.

Sandboxed baseline startup in the same namespace: 1 passed (1.1 s). Namespace setup initially failed in the restricted tool sandbox (netlink denied); authorized execution outside that restriction succeeded without changing the host network. Mapping directly to the current UID could not configure lo; outer setup/inner regular-user mapping solved it. Chromium sandbox remained enabled throughout.

## Commands/results

- Initial `npm run typecheck`, `npm run lint`, `bash -n scripts/test-offline.sh`, `git diff --check`: exit 0.
- Initial `npm run test:unit`: exit 0, 315 passed/28 files (6.27 s), before the final four added transport cases.
- New-story development failures: incorrect active environment (NOT_FOUND, 1.1 s), reading an unselected imported workspace (8.0 s), re-entering an existing variable without its required ID (SECRET_UNAVAILABLE, 7.9 s), cleanup attempted on already disposed normal-close application (11.3 s). Fixed test setup/cleanup, not production guards. Temporary fixtures were isolated and synthetic.
- Final `npm run test:unit`: **exit 0, 319 passed/28 files (6.01 s)**, including all four added transport cases. Followed by `npm run rebuild:electron`: exit 0, rebuild complete; final bindings are Electron's.
- `npm run test:offline`: **exit 0, 26 passed (2.3 min), no skips**. Native Electron rebuild and typecheck/build passed. The integrated story passed in 11.3 s; every desktop test ran with real egress isolation. Source-built sandboxed Electron, not a package.
- Final `npm run lint`, `npm run typecheck`, `bash -n scripts/test-offline.sh` and `git diff --check`: exit 0. Diff check also repeated after completion/status documentation edits.
- Local Graphify update: final refresh passed (exit 0), 946 nodes/2987 edges/49 communities. Graph output is ignored and is not acceptance evidence. Code-only extraction, no models/cloud/global hooks; documents remain authoritative.

Build emitted existing non-fatal Zod/Rollup PURE-annotation warnings; Playwright emitted color-environment warnings.

## Acceptance evidence matrix

| Criterion | Actual local evidence |
|---|---|
| Start/edit without internet | Sandboxed file-based Electron starts with loopback only; workspace/environment/request operations succeed, no automatic fixture sends during setup. |
| Persistence and response lifetime | Normal close/relaunch retains workspace, selected environment and saved request; prior response body is absent. |
| Variables/isolation | Environment base_url overrides workspace value; second workspace resolves its own endpoint; foreign request/environment access fails; missing variable fails before send. |
| Secrets/export/import | Actual backend session-only; restart marks secret missing; explicit ID-based re-entry restores send. DB/WAL and diagnostics plaintext absence checked. Export omits marked values/literal auth; new imported IDs and unresolved auth/file state checked; credentials/file must be supplied explicitly. |
| Network errors/recovery | Cancel, 100 ms overall timeout, refusal, reset, TLS rejection and 401/500 are exercised; a subsequent successful send works. Full suites cover negative redirects/decompression/size limits and safe text rendering. |
| Local requests/assets/boundary | Native main-process loopback sends; zero renderer HTTP requests; file/data resources; all Electron launches request Chromium sandboxing. |
| No runtime external connections | Whole desktop suite restricted to lo/no external routes; explicit non-loopback TCP probe fails ENETUNREACH. No external user API required. |

## Build identity and limitations

Source-built Electron output, not an installable package. SHA-256 of tested output:

- out/main/index.js: `817b3bae4bf23c786a41e740b4fc5ce7c2348ddb30663a092e687ef585c91f42`
- out/preload/index.js: `136f2a97d0cb0ef63d6daf2096d3d4609f30364b77b8e0fb484b05d27fad0e68`
- out/renderer/index.html: `90b3d9e8a61891ab41d2c75f67250383496788e1cfe6b25f15f9e33870492119`

Windows, Wayland, LAN endpoints, physical cable disconnection and installed/packaged startup are not run. No Linux or Windows packaged acceptance/release-readiness claim. DNS error mapping was tested with injected error codes, not live public DNS. Actual secure credential-backend integration is unavailable here (session/basic_text); secure behavior is covered by unit doubles, not real OS encryption evidence. Native chooser automation requires Linux/X11. Test fixtures may be forcibly terminated during failure cleanup; only explicit normal close/relaunch counts as persistence evidence. No production --no-sandbox/global TLS workaround. TASK-028 onward untouched. All required local task checks passed; no TASK-027 blocker remains. Task and index marked done together. Independent packaged Linux/Windows acceptance remains for later tasks.
