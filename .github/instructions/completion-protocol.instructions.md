---
description: "Use when executing coding tasks in this repository. Enforces completion protocol, autonomous implementation, and mandatory task_complete signaling with summary."
name: "Completion Protocol"
---
# Completion Protocol

Apply this protocol for all implementation tasks.

## Core Rules
- Do not stop at planning when implementation is feasible.
- Continue autonomously until the request is fully resolved or genuinely blocked.
- Resolve errors directly when possible instead of handing work back prematurely.
- Do not leave partial results when remaining steps are actionable.

## Mandatory Finish Sequence
1. Ensure requested edits, checks, and validations are complete.
2. Provide a short plain-language summary of what was accomplished.
3. Call the task_complete tool with a concise completion summary.

## Quality Gate Before Completion
- Confirm there are no unresolved blockers under your control.
- Confirm there are no known syntax or schema errors introduced by your changes.
- Confirm the delivered result addresses all explicit user requirements.

## Anti-Patterns
- Ending after a draft without implementation.
- Ending with open action items that could have been completed in-session.
- Skipping task_complete after work is finished.
