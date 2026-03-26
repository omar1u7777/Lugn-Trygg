---
name: api-contract-sync-flask-typescript
description: 'Synchronize API contracts between Flask backend and TypeScript frontend. Use when endpoints, request/response shapes, or auth semantics change and cross-layer consistency must be enforced.'
argument-hint: 'Describe endpoint changes and which backend/frontend modules are affected.'
user-invocable: true
disable-model-invocation: false
---

# API Contract Sync: Flask and TypeScript

Use this skill when backend API behavior changes and frontend contract safety must stay aligned.

## Outcomes
- Backend and frontend share consistent contract semantics.
- Type definitions and runtime behavior match.
- Error handling stays user-safe and predictable.

## Procedure
1. Detect contract deltas:
List changed routes, request fields, response fields, status codes, and auth requirements.
2. Backend alignment:
Update Flask handlers, schema/validation logic, and error payload stability.
3. Frontend alignment:
Update TypeScript interfaces/types, API service methods, and consuming UI components.
4. Negative-path alignment:
Ensure error codes/messages map to user-friendly UI states.
5. Verification:
Run targeted backend tests, frontend type checks, and affected integration tests.
6. Compatibility note:
Document any breaking changes and migration path.

## Decision Points
- Backward compatibility:
If consumers outside current frontend exist, prefer additive changes and deprecation window.
- Auth boundary changes:
If auth policy changed, verify token/permission assumptions in all consumers.
- Error contract drift:
If response errors changed, update both parsing and UI fallback behavior.

## Completion Checks
- All changed endpoints have synced TS contract updates.
- Call sites compile and handle new/changed error paths.
- Validation evidence is included for backend and frontend.

## Output Format
- Contract delta table (endpoint, request, response, auth)
- Files updated in backend and frontend
- Verification commands and outcomes
- Breaking change notes and next steps
