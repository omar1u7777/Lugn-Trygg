---
name: production-hardening-security-observability
description: 'Harden production readiness with security and observability checks. Use for high-risk changes to enforce threat controls, safe rollout, monitoring, and alert readiness.'
argument-hint: 'Describe the production change and risk profile.'
user-invocable: true
disable-model-invocation: false
---

# Production Hardening: Security and Observability

Use this skill before finalizing production-impacting changes.

## Outcomes
- Security controls are explicitly reviewed and strengthened.
- Observability coverage is sufficient for safe rollout and fast detection.
- Release notes include risk, rollback, and monitoring plan.

## Security Checklist
- Authn/Authz:
Verify route protection, permission checks, and least-privilege behavior.
- Input/Data safety:
Validate inputs, avoid sensitive data leaks, and sanitize external payloads.
- Secret handling:
No secrets in code/logs; use secure configuration paths.
- Failure behavior:
No raw internal errors exposed to end users.

## Observability Checklist
- Logging:
Structured logs for critical flows, without sensitive fields.
- Metrics:
Define success/error/latency signals for changed paths.
- Alerts:
Ensure actionable thresholds and ownership are clear.
- Tracing/Correlation:
Add request correlation context where available.

## Procedure
1. Classify risk and blast radius.
2. Apply security checks to changed surfaces.
3. Apply observability checks for detection and diagnosis.
4. Define rollout and rollback guardrails.
5. Verify with targeted tests and smoke checks.
6. Produce release-readiness summary.

## Decision Gates
- If high-risk change lacks rollback path, do not mark release-ready.
- If key alert or metric is missing, block readiness until covered.
- If security control regression is found, prioritize fix before release.

## Completion Checks
- Security and observability checklist completed with evidence.
- Rollout/rollback plan documented.
- Residual risks explicitly listed.

## Output Format
- Risk summary
- Security findings and fixes
- Observability coverage and gaps
- Rollout/rollback plan
- Residual risks and follow-up actions
