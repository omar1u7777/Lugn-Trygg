---
description: "Use when creating or modifying React and TypeScript code in Lugn & Trygg. Enforces lightweight stack-specific validation before completion."
name: "React TypeScript Validation"
applyTo: "src/**/*.ts, src/**/*.tsx, shared/**/*.ts, shared/**/*.tsx, tests/**/*.ts, tests/**/*.tsx"
---
# React and TypeScript Validation Rules

Run these checks before completing tasks that change frontend TypeScript code.

## Minimum Validation
1. Type safety: run project type checks and fix all new type errors in changed scope.
2. Lint quality: run linter for changed files or project lint command.
3. Build integrity: ensure frontend build passes if shared contracts or app entry paths changed.
4. Runtime safety: verify loading/error states for changed async UI flows.

## API Contract Sync
- If API payloads or endpoints changed, sync service types and UI call sites in the same task.
- Do not leave partially migrated interfaces between frontend and backend contracts.

## UX and Error Handling
- Do not surface raw technical errors to end users.
- Provide user-friendly Swedish feedback for failed requests in affected views.

## Completion Gate
- Include a brief list of validation commands run and their outcomes.
- If a check is intentionally skipped, state why and the residual risk.
