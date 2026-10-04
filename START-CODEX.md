# Prompts to execute the plan

## First prompt

```text
Read AGENTS.md, README.md, docs/product.md, docs/decisions.md and docs/task-index.md.
This is a new offline desktop HTTP client for Linux and Windows. The selected stack is Electron, React, TypeScript, SQLite and Chakra UI v3.
Execute only docs/tasks/TASK-001-toolchain-baseline.md.
Inspect the repository before changing files. Follow that task's scope, dependencies and acceptance criteria. Verify current package compatibility from official sources; do not guess version numbers. Do not implement later tasks or expand phase 1.
Run the appropriate checks, record actual results and limitations in docs/task-reports/TASK-001.md, and update both task and task-index status honestly.
Stop when this task is complete and summarize what changed and what was verified.
```

## Next-task prompt

```text
Read AGENTS.md and docs/task-index.md. Identify the earliest unfinished task whose dependencies are done.
Read its task file and referenced specifications. State the selected task ID, then execute only that task.
Preserve all documented behavior, existing user changes and phase-1 boundaries.
Run relevant checks and record actual evidence in docs/task-reports/<TASK-ID>.md. Update the task file and task index together. Never mark untested platform-specific acceptance as passed.
If blocked, report the exact blocker and leave the task unfinished. Stop at the task boundary.
```

## Review prompt

```text
Review the completed task against its acceptance criteria and the referenced specifications.
Check for behavioral mismatches, workspace isolation failures, offline dependencies, renderer privilege leaks and missing evidence.
Do not modify application code during this review. Report concrete findings with file references, severity and a minimal reproduction. Distinguish confirmed findings from hypotheses. Do not expand scope.
```
