# Graphify developer guide

Graphify is optional project-local developer tooling for exploring source relationships. It is not bundled into Electron and is not required for installed startup, local editing, HTTP execution, npm builds or tests. Product behavior and task statuses remain defined by the existing specifications and task index.

## Installed configuration

- Official package: `graphifyy==0.9.76` (the command is `graphify`). Python 3.12; pinned transitive packages and artifact hashes in `tools/graphify/requirements.lock`.
- Environment: `.tools/graphify/`, ignored by Git. No global Python/Codex configuration changed.
- Skill: `.agents/skills/graphify/SKILL.md`, its bundled references and version stamp. Codex can discover the project skill on the next turn. Repository AGENTS.md defines the local workflow and takes precedence over the upstream full-pipeline examples.
- Visualization dependency: the upstream HTML template's exact `vis-network` 9.1.6 artifact, verified against the official npm integrity in `tools/graphify/assets.json`. Setup downloads it once; builds copy its JS and licenses beside the generated HTML. No CDN is needed to open the graph.
- Output: ignored `graphify-out/graph.json`, `GRAPH_REPORT.md`, `graph.html` and incremental/cache sidecars. Generated output is rebuilt locally rather than committed as permanent evidence.

## Setup on another checkout

Install Python 3.12 and [uv](https://docs.astral.sh/uv/getting-started/installation/), then run from the repository:

```bash
python3 scripts/setup-graphify.py
python3 scripts/graphify.py version
python3 scripts/graphify.py build
```

Setup needs internet to download pinned Python packages and the integrity-checked visualization archive. It installs the official project Agent Skill using the package's native installer, including its reference sidecars. It does not install Git hooks, background services, cloud/model backends or global assistant settings. The script supports Windows path conventions, but this setup has only been verified on Linux; use `python` in place of `python3` where appropriate.

The setup script synchronizes the lock rather than selecting newer packages. Upgrades require deliberately changing the package pin, regenerating/reviewing the hash lock, checking the skill and visualization template, then rerunning setup and the tooling checks. Do not follow upstream automatic upgrade examples during an application task.

## Build, browse and ask questions

```bash
# Full local source rebuild, including after extractor/settings changes:
python3 scripts/graphify.py build

# Refresh after code changes; handles changed and deleted sources:
python3 scripts/graphify.py update

# Examples verified against this project's graph:
python3 scripts/graphify.py query "ExecutionService MaterializationService materialize"
python3 scripts/graphify.py explain ExecutionService
python3 scripts/graphify.py path ExecutionService materialize
```

Open `graphify-out/graph.html` in your browser for search, zoom, node details and community filters. Read `graphify-out/GRAPH_REPORT.md` for an overview. Queries use a default 1,500-token output budget; narrow the query or pass `--budget 3000` when the CLI reports truncation. Prefer actual code identifiers; Graphify's matching does not automatically translate Persian or infer synonyms.

With the project skill loaded, `$graphify` can be used in Codex. Ask for the local-only profile in this guide; the wrapper is also available directly without relying on skill discovery. For example: “Use Graphify to locate the cancellation flow, then verify it in source.”

## Local-only profile and exclusions

The wrapper always builds with `--code-only --no-dedup` and clusters with `--no-label`. Code parsing, queries and reports require no API key/model backend. It removes provider/backend environment settings and blocks Python socket DNS/connect/bind operations in the tool process. This is a developer guard, not an OS-wide network sandbox; the HTML was additionally checked with remote requests blocked.

Markdown specifications are deliberately not semantically indexed. Read them directly before task work. No automatic agent dispatch, external model labeling, document upload, remote repository fetch, live database introspection or graph publishing is part of this configuration. The upstream skill documents these optional capabilities; they are not enabled here.

`.graphifyignore` excludes dependencies, environments, generated output, assistant/tooling files, lockfile noise, databases, environment files, certificates/keys and logs. Do not place real credentials in source or add user workspaces/databases to the graph. Generated graph output should stay local.

## Use during the task workflow

1. Read AGENTS.md, the task index, selected task and referenced specifications; verify dependencies and inspect existing user changes.
2. Use a scoped graph query for architecture or change-impact discovery, then inspect the referenced source. Graph paths can describe imports/containment rather than actual runtime call order. `INFERRED` edges need verification; even `EXTRACTED` edges are only parser findings.
3. Implement only the authorized task and run its relevant checks. Graph output never proves behavior, ownership, cancellation correctness or platform acceptance.
4. Refresh after source changes. If the graph is missing, stale, truncated or incomplete, use normal source searches and record the limitation; do not let optional tooling block a task.

Current known limitations: 70 documents were skipped intentionally; the extractor reported partial parsing of `tests/cancel-timeout.spec.ts` and 23 code files with no symbols, including configurations, barrel exports and callback-based desktop tests. `.npmrc` and `docs/secrets.md` were additionally skipped by upstream sensitive-name detection. These are graph coverage limitations, not failed application tests. Details and actual setup evidence are in [the tooling report](tooling-reports/graphify.md).

## Remove or disable

Stop invoking the wrapper to disable Graphify; application commands continue to work. For full removal, remove only the Graphify developer files/environment/output, its AGENTS.md section, documentation links and its generated-directory ignore entries. Preserve unrelated `.agents` skills and existing configuration. No global uninstall or Git-hook cleanup is needed for this setup.

Sources: [official repository](https://github.com/Graphify-Labs/graphify), [official PyPI package](https://pypi.org/project/graphifyy/0.9.76/), [official visualization package](https://www.npmjs.com/package/vis-network/v/9.1.6). Upstream license/notice copies are in `tools/graphify/`; visualization license copies accompany the generated asset.
