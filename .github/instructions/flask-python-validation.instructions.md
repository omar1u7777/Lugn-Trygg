---
description: "Use when creating or modifying Flask and Python backend code in Lugn & Trygg. Enforces stack-specific backend validation and contract safety checks."
name: "Flask Python Validation"
applyTo: "Backend/**/*.py, Backend/tests/**/*.py"
---
# Flask and Python Validation Rules

Run these checks before completing tasks that change backend Python code.

## Minimum Validation
1. Syntax and import integrity: ensure changed Python files compile and imports resolve.
2. Test signal: run relevant backend tests for touched modules.
3. Lint and typing signal: run configured lint/type checks where available.
4. Error-path safety: confirm handled exceptions return stable API responses.

## Security and Data Handling
- Validate authn/authz logic on changed protected routes.
- Avoid returning internal stack traces or sensitive diagnostics in API responses.
- Preserve least-privilege access patterns for data operations.

## Contract Consistency
- If request or response shapes changed, update backend schemas/models and note required frontend sync.
- Do not merge contract changes without explicit compatibility note.

## Completion Gate
- Report tests/checks run for changed modules and whether they passed.
- If any backend check is skipped, explain why and list follow-up action.
