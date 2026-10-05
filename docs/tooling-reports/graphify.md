# Graphify installation and verification

Date: 2026-10-05 (client date, Asia/Tehran)
Status: installed and verified on Linux
Authorization: user explicitly requested project installation, documentation and preparation before the next product task.

## Changes and provenance

Initial working tree was clean. Read repository instructions, README, task index and architecture, the skill-installer instructions, official upstream installation/pipeline sources and the packaged skill. TASK-001 through TASK-020 remained done; TASK-021 and all subsequent tasks were not started or changed.

Verified PyPI ownership links and selected stable `graphifyy 0.9.76`, requiring Python >=3.10. Downloaded its official wheel and verified SHA-256 `68e09bc159628c4cc0d62ce76786993037266b74f3dbce3a40f498ed7cd9f129` before inspecting source. Compiled a 30-package, hash-locked dependency set from the official PyPI index. Installed in `.tools/graphify/` with Python 3.12.3. Initial uv interpreter selection resolved Python 3.13; recreated only the newly created tooling environment with explicit system Python 3.12 and verified the reproducible setup script's version check.

The generic GitHub skill helper expects an existing uppercase SKILL.md directory; this upstream package ships lowercase skill templates and reference bundles. Used the official package's project-only `install --project --platform agents` installer to register the complete skill in `.agents/skills/graphify/`. No global skills/settings, native tool hooks, Git hooks or multi-agent feature configuration changed. Included upstream licenses/notices alongside tool pins.

Added setup/local-command scripts, input exclusions, generated-directory Git/ESLint exclusions, repository workflow guidance and developer documentation. The local wrapper uses code-only extraction and no model labeling; no semantic API/document extraction was run. Exact upstream visualization version 9.1.6 was downloaded from the official npm registry and SHA-512 integrity checked; HTML references its local copy.

## Actual checks and outcomes

Environment: Ubuntu 24.04.3 x64, Python 3.12.3, developer Node 22.18.0/npm 11.6.2; visualization smoke used existing Electron 44.5.1 with Chromium sandbox enabled. SQLite/native Node bindings were not rebuilt or changed for this tooling work.

| Check | Actual result |
|---|---|
| `python3 scripts/setup-graphify.py` | Passed: checked 30 locked packages, verified visualization artifact, installed project skill/reference bundle. Re-running was successful. |
| `python3 scripts/graphify.py version` | `graphify 0.9.76` |
| `python3 scripts/graphify.py build` | Passed: 101 code files scanned; 715 nodes, 2,112 edges, 33 communities; JSON, report and local HTML generated. |
| Query / explain / path | Passed: found ExecutionService and related materialization symbols with source locations; dependency path to materialize was three hops through containment/import edges. 1,000-token test query explicitly reported truncation; not treated as complete coverage. |
| `python3 scripts/graphify.py update` | Passed with 101 unchanged code files. Additional temporary-probe exercise verified addition, renamed function replacement and deletion; probe removed and final graph returned to 715 nodes/2,112 edges. |
| Python compilation | `python3 -m py_compile scripts/graphify.py scripts/setup-graphify.py` passed. |
| Dependency consistency | `uv pip check --python .tools/graphify/bin/python` passed: all 30 installed packages compatible. |
| Skill interpreter sidecar | Initial check failed after resolving the virtualenv Python symlink to system Python. Preserved the absolute virtualenv path instead; rerun imported Graphify successfully. |
| Documentation | Local Markdown links verified; numbered task index unchanged. |
| Offline guard / graph integrity | DNS attempt raised the expected guard error before network resolution; all edge endpoints existed and generated/vendor sources were absent. |
| HTML desktop verification | Temporary standalone sandboxed Electron viewer loaded generated HTML with HTTP(S) requests blocked; canvas visible, zero remote requests, zero page errors. Screenshot `/tmp/api-client-graphify.png` visually inspected. Viewer did not load or modify application storage. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Initial failure: 3,604 errors because ESLint scanned minified generated visualization assets. Added only `.tools/**` and `graphify-out/**` global ignores; rerun passed. Application source lint rules unchanged. |
| `git diff --check` | Passed. |

No application unit/desktop suite rerun was needed for developer-only setup; no new claims about product behavior or release acceptance. The previous task reports remain their own evidence, not this installation's results.

## Coverage and limitations

- 70 Markdown documents skipped intentionally by code-only mode. No semantic links between specifications and code are claimed.
- Upstream tree-sitter parsing reported syntax/partial extraction in `tests/cancel-timeout.spec.ts` near its inline TypeScript import annotation; no symbols extracted there. 23 code files had no modeled symbols. Application typecheck still passed. Source was not rewritten to satisfy the graph parser.
- Upstream sensitive-name filtering skipped `.npmrc` and `docs/secrets.md`. The graph is an aid, not an exhaustive security/call-flow audit.
- Labels are model-free community numbers. No promises of token savings, complete runtime dependency resolution or automatic defect detection.
- Setup needs internet; subsequent wrapper operations and the bundled visualization were verified locally. Python audit hooks are not a system-wide isolation guarantee.
- Windows tooling setup, independent installed application smoke and package release acceptance were not tested. No OS-specific product task status was advanced.

No remaining blocker for this developer-tool installation. See [usage and maintenance](../graphify.md). Generated outputs/environment remain ignored; npm packages, application code, data schemas and numbered task statuses were preserved.
