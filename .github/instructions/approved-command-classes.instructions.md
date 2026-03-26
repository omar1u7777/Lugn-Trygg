---
description: "Use when planning or running terminal commands in Lugn & Trygg. Defines approved command classes, required safeguards, and onboarding policy for safe execution."
name: "Approved Command Classes Policy"
---
# Approved Command Classes (Team Onboarding)

This policy defines which terminal command classes are approved by default when working in this repository.

## Allowed by Default
- Read-only inspection: listing files, searching code, reading logs, viewing git status and diffs.
- Build and test commands: project test suites, type checks, linting, local build validation.
- Non-destructive tooling: formatters, dependency graph checks, static analysis.
- Scoped runtime commands: local development server start/stop and health checks.

## Allowed with Explicit Intent
- Dependency changes: package add/remove/update when tied to the task.
- Environment setup: virtual environment setup, package installation, lockfile updates.
- Data migration scripts: only with rollback plan and impact explanation.

## Restricted (Require Human Approval)
- Git history rewrites, branch force operations, hard resets.
- Mass delete operations and recursive forced deletion.
- Secrets handling operations (viewing/exporting sensitive material).
- Production-impacting deployment or infrastructure mutation commands.

## Forbidden in Normal Task Flow
- Destructive cleanup commands that can remove uncommitted work.
- Any command that bypasses repository safeguards without explicit authorization.

## Execution Checklist
1. State command purpose before execution.
2. Prefer least-privilege, least-destructive variant.
3. Confirm command scope (file/folder/environment) is minimal.
4. After execution, summarize effect and validation outcome.

## Examples by Class
- Read-only: git status, git diff, search/list operations.
- Validation: pytest, vitest, eslint, type checks.
- Setup: pip install, npm install, lockfile regeneration.

## Notes for New Team Members
- If unsure whether a command is destructive, treat it as restricted and request approval.
- Prefer reproducible scripted commands over one-off shell mutations.
