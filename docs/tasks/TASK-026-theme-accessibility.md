# TASK-026 — Complete themes and accessibility polish

Status: done
Dependencies: TASK-025

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/ui-flows.md](../ui-flows.md)
- [docs/product.md](../product.md)

## Goal and scope

Persist Light/Dark/System locally with Chakra v3 patterns. Audit key flows, focus management, labels, dialogs, row keyboard editing, scroll/resizing and field-error readability.

## Acceptance criteria

Theme survives restart without draft loss; controls usable at baseline resolution; Ctrl+S/Ctrl+Enter respect states; dialogs restore focus; no remote UI assets.

## Verification

Manual keyboard/light-dark layout checklist plus relevant focused UI tests.

## Excluded from this task

No localization, custom themes or multi-tab redesign.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-026.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.

## Completion evidence

See [TASK-026 report](../task-reports/TASK-026.md) for the Linux keyboard/layout checklist, theme restart/draft evidence, 315 passing unit tests and 25 passing desktop tests. Lint, typecheck and build passed. Windows, Wayland, packaged startup, real OS theme switching and assistive-technology checks remain untested; no platform-specific pass is claimed.
