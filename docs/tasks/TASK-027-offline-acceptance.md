# TASK-027 — Run integrated offline acceptance and close defects

Status: done
Dependencies: TASK-026

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/testing.md](../testing.md)
- [docs/product.md](../product.md)
- [docs/secrets.md](../secrets.md)

## Goal and scope

Complete fixture suite and local Electron integrated acceptance for currently available OS. Verify disabled egress with loopback enabled, isolation, secrets/export, persistence and negative network cases. Fix defects within documented scope; log blockers.

## Acceptance criteria

Acceptance evidence records actual OS/version and blocked-egress method; all run checks pass; not-run platforms remain explicit; no runtime external connections beyond user sends.

## Verification

Full relevant automated suite plus offline Electron story; sanitized report with actual results.

## Excluded from this task

Does not replace independent packaged OS acceptance or claim release readiness.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-027.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

## Completion evidence

See [TASK-027 report](../task-reports/TASK-027.md): 319 unit tests and all 26 source-built Linux Electron tests passed; desktop suite ran in an isolated loopback-only network with blocked non-loopback egress. Lint, typecheck/build and native rebuilds passed. Windows, Wayland, packaged acceptance and real secure-backend integration remain untested; no release-readiness claim.
