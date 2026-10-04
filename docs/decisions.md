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

Record material changes here with reason, user authorization if scope changes, and affected tasks. Routine internal choices do not require a new approval. No changes are recorded yet.
