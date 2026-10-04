# TASK-011 — Build JSON/raw body editing

Status: done
Dependencies: TASK-010

## Read first

- [AGENTS.md](../../AGENTS.md)
- [docs/request-engine.md](../request-engine.md)
- [docs/ui-flows.md](../ui-flows.md)

## Goal and scope

Add None/JSON/Raw selectors and text/media-type inputs. Retain inactive mode drafts during the editor session; persist active mode only. Implement size/method validation messages without resolving variables yet.

## Acceptance criteria

JSON source text stays unchanged; empty JSON differs from no body; raw Unicode persists; inactive drafts cannot accidentally enter saved active config.

## Verification

Mode switching/save/reopen and size/schema cases; renderer build.

## Excluded from this task

No forms/files or wire serialization.

## Completion procedure

Record actual changes, commands/results, environment, evidence and blockers in `docs/task-reports/TASK-011.md`. Update this status and the index together. Mark `done` only when acceptance is verified; otherwise `in_progress` or `blocked`. Stop at this task boundary.
