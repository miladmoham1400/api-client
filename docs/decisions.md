# Architecture decisions

## Accepted stack

| Layer | Choice | Reason / constraint |
|---|---|---|
| Desktop | Electron, maintained stable version | Node-capable main process and two target OS packages |
| UI | React + TypeScript strict | Typed reusable editor components |
| Components | Chakra UI v3 | User selected Chakra; this plan selects current-major v3 APIs |
| Tooling | Vite-based Electron build, preferably electron-vite | Separate main/preload/renderer builds |
| Persistence | SQLite with better-sqlite3 | Small local transactional database, no server |
| Transport | Node `http` / `https` in main | Explicit control over headers, bytes and redirects |
| Validation | Zod | IPC, stored JSON documents and import schemas |
| Tests | Vitest + React Testing Library; Electron-capable Playwright for smoke tests | Local fixtures and targeted integration checks |
| Packaging | electron-builder | Linux AppImage/deb; Windows NSIS |
| Package manager | npm | Lockfile and conventional scripts |

These are choices, not claims that unspecified latest versions are mutually compatible. TASK-001 must pin an actually compatible set from official documentation. Do not switch frameworks silently.

## Version policy

Choose a supported LTS development Node that meets all build-tool requirements. Electron embeds a different Node runtime; verify transport and SQLite against that runtime. Record exact Node, npm, Electron, React, Chakra, electron-vite, Vite, TypeScript, better-sqlite3 and builder versions in `docs/toolchain-lock.md`; generate it during TASK-001. Avoid prereleases and floating `latest` in saved scripts. Commit `package-lock.json`.

Chakra v3 is a deliberate default, not an explicit user selection of a major version. Do not reuse v2 `useColorMode`/provider patterns without checking v3 documentation. Bundle provider/theme helpers locally.

## Persistence and architecture choices

- Do not use MySQL, a Laravel service, an HTTP backend server or cloud database for this desktop product.
- Main owns database, network, encryption and file selection; renderer owns presentation and draft state.
- A small feature-oriented application is enough. No microservices, generic plugin engine or heavyweight abstraction framework.
- SQLite migrations and repository ownership checks are centralized.
- Native SQLite means target-platform rebuild and packaged execution must be validated on each OS.
- Sensitive marked values use Electron safeStorage when a secure backend is available; otherwise remain session-only. Never silently downgrade to plaintext secret persistence.

## UI state

React local state/context is sufficient initially. Avoid adding a global state library unless a concrete task needs it. Keep saved objects, draft objects and send snapshots separate.

## Change policy

Record material changes here with reason, user authorization if scope changes, and affected tasks. Routine internal choices do not require a new approval.

## Adjustable request/response layout — 2026-10-10

User authorized a stacked/side-by-side toggle with adjustable panel proportions. Use a local CSS grid and pointer/keyboard separator; keep both React subtrees mounted, separate session ratios, independent scrolling and existing Save/Send/snapshot behavior. No layout persistence, dependency, transport or phase-2 feature is added. The divider and axis-aware Smaller/Larger replace the old response-only native resize corner. This is a post-task UI enhancement; completed task statuses and historical installer acceptance remain unchanged. See [verification and known regression-test limitation](tooling-reports/panel-layout.md).

## JSON presentation — 2026-10-10

User requested readable colored JSON payload/response display, preferring no new package. Use a bounded local lexical tokenizer and React text spans, with a decorative layer over the existing native textarea for JSON editing. Preserve source/wire bytes, Raw defaults, explicit Pretty formatting and existing validation. No dependency, transport, persistence or phase-2 feature is added. This is a post-task presentation enhancement; completed task statuses and historical packaged release evidence remain unchanged. See [verification report](tooling-reports/json-display.md).

## Developer tooling — 2026-10-05

User authorized project-local Graphify installation and documentation before the next task. Use pinned Python tooling and a project Agent Skill, code-only local extraction, no model labeling and bundled graph visualization assets. Graphify assists source discovery; specifications, source and actual checks remain authoritative. It adds no application runtime dependency, product feature, global assistant settings or task-status change. See [configuration](graphify.md) and [evidence](tooling-reports/graphify.md).

## Multipart encoding — TASK-022, 2026-10-05

Use pinned form-data-encoder 4.1.0 for multipart delimiters, name escaping, FormData text normalization and exact content length. A small ordered FormDataLike adapter preserves interleaved duplicate fields; file adapters read asynchronously in bounded chunks from preflighted main-owned descriptors. Capture file selections independently from editable capabilities, reopen per allowed redirect and close all upload resources on terminal paths. This implements the existing TASK-022/request-engine scope; it adds no browser networking, persistent file paths or new product feature. Busboy is test-only fixture parsing.

## Nested API library priority — 2026-10-11

User explicitly authorized documenting this as the first next milestone: collections contain nested folders and many saved APIs, with fast selection and explicit sending. Keep one editor/one send; do not add tabs, history, scripts, inherited auth or cloud. Use a collection-owned adjacency hierarchy, owned destination validation and append-only SQLite migration. Preserve request IDs/config/secret ownership; delete folder by promoting direct contents and delete collection by moving all requests to workspace root. Add v2 transfer with v1 import compatibility, bounded metadata search and a 1,000-request/1,000-folder acceptance baseline. Full specification: [API library](api-library.md). Tasks: TASK-031–037; all are initially todo. Only documentation/planning was authorized for this turn, not implementation or a new release.


## HTTP method colors — 2026-10-12

User requested distinct request-type colors before the next release. Reuse bundled Chakra v3 semantic palettes consistently in tree/search badges and the native editor selector: GET green, POST yellow, PUT blue, PATCH orange, DELETE red, HEAD purple, OPTIONS cyan. Keep method text and native keyboard behavior; no package, request logic or persistence change. This is a post-TASK-037 source presentation enhancement, with [Linux visual/contrast evidence and platform limits](tooling-reports/http-method-colors.md). Existing accepted/public installers do not include it; fresh package verification is needed before publication.
