# TASK-013 — Implement secure and session-only secret store

Status: done
Dependencies: TASK-005

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/secrets.md](../secrets.md)
- [docs/data-model.md](../data-model.md)
- [docs/architecture.md](../architecture.md)

## Goal and scope

Integrate Electron safeStorage capability checks and secret repository. Secure backend encrypts marked values; unavailable/basic_text backend is session-only. Implement unresolved/reveal/decrypt failure behavior and independent secret duplication.

## Acceptance criteria

Synthetic secrets absent in plaintext DB/logs; session-only values not persisted; sensitive/auth records use owned secret handles; decryption failure explicit; record cleanup transactional.

## Verification

Inject secure/unavailable/basic_text capability tests and real Electron capability smoke; record environment.

## Excluded from this task

No master password, blanket database encryption or secure-storage login requirement.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-013.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
