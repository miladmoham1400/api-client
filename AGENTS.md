# Repository instructions for Codex

Build the Offline API Client described in this repository. Preserve documented behavior and keep tasks small.

## Task execution

1. Read this file, `docs/product.md`, `docs/decisions.md`, `docs/task-index.md`, the selected task and its referenced documents.
2. Work on exactly the task requested. Do not silently implement subsequent tasks.
3. Inspect existing files and current task status first. Do not overwrite unrelated work.
4. Verify dependencies are complete. If blocked, report the exact dependency; perform only independent work within the task.
5. Use the documented architecture; keep reusable HTTP logic separate from Electron and UI. TypeScript strict mode; runtime validation at IPC/import boundaries; no `any` to bypass validation.
6. Add focused tests where they establish meaningful behavior: variable precedence, HTTP wire behavior, isolation, cancellation, import transactionality and migrations. Do not add tests that simply mirror component markup.
7. Run relevant checks. Never invent test output, claim a skipped check passed, or claim another OS was tested.
8. Update the task file and task-index status together. Mark `done` only when its acceptance criteria have evidence. Use `blocked` or `in_progress` for partial results.
9. Add `docs/task-reports/TASK-NNN.md` with changes, commands/results, evidence, limitations and remaining blockers. The directory is created when the first task is executed.
10. Report the result concisely and stop at the task boundary unless the user explicitly requests multiple tasks.

## Non-negotiable product rules

- Local workspace/request/variable operations and installed startup require no internet, login, API key, telemetry or cloud service.
- Do not use a renderer HTTP proxy/server or browser fetch to send user requests.
- No remote scripts, fonts, assets or mandatory update checks. Bundle all UI assets.
- No generic IPC command runner, arbitrary file path read, or Node access from renderer.
- Enforce workspace ownership in main-process repositories and command handlers.
- Responses, errors and templates are untrusted text. Never render response HTML as executable HTML.
- No credentials in logs, reports, tests, source control or exports by default.
- No `--no-sandbox` production workaround; no globally disabled TLS verification.
- Keep phase-2 features out of phase 1: cloud sync, teamwork, scripts, OAuth, WebSockets, cookie jar, GraphQL-specific tools, Postman-format interoperability and multiple tabs.

## Decisions and changes

`docs/product.md` defines scope; feature specifications define behavior; architecture defines boundaries; task files define execution slices. If they conflict, stop the affected part and state the exact contradiction rather than choose a hidden behavior. Routine implementation choices within these rules do not require permission. A behavior/scope change must be documented and authorized by the user.

## Versions and release

Verify compatible maintained stable packages in TASK-001 and record exact versions. Use Chakra v3 APIs only. Commit a lockfile and reproducible scripts. Distinguish developer Node from Electron's embedded Node. Rebuild native SQLite dependencies for each selected Electron/OS target. Linux and Windows require independent packaged-app smoke tests.

## Graphify developer workflow

- Project skill: `.agents/skills/graphify/SKILL.md`; project configuration and evidence: `docs/graphify.md` and `docs/tooling-reports/graphify.md`.
- Read required task/specification documents first. For architecture, call-chain or change-impact questions, consult `python3 scripts/graphify.py query "<question>"` when the graph exists, then inspect the relevant source. Source and specifications take precedence over inferred graph edges; absence of an edge is not evidence of absence of behavior.
- For this repository, the local-only wrapper replaces the upstream full extraction/install workflow: use `python3 scripts/graphify.py build` initially and `python3 scripts/graphify.py update` after source changes. It uses pinned project-local Python tooling, code-only extraction, no model labeling and bundled visualization assets. Do not auto-upgrade packages, use semantic/cloud extraction, install global settings, enable multi-agent features or install Git/tool hooks as part of a normal task.
- Generated `graphify-out/` is ignored and must be regenerated locally. Exclude application databases, secrets, environment files, dependencies and build output using `.graphifyignore`. Do not copy user workspace data or credential values into graphs/reports.
- Graphify is optional developer tooling, not an application/runtime dependency or a task gate. If unavailable or incomplete, use source inspection and record the limitation. Graph output never counts as test evidence and never authorizes implementing a later task.
