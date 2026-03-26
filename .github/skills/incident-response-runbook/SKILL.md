---
name: incident-response-runbook
description: 'Run incident response for production issues. Use for triage, impact assessment, mitigation, rollback decisions, and recovery communication with explicit go/no-go checkpoints.'
argument-hint: 'Describe symptoms, start time, affected services, and current severity.'
user-invocable: true
disable-model-invocation: false
---

# Incident Response Runbook

Use this skill for live or suspected production incidents.

## Outcomes
- Classify severity and blast radius.
- Stabilize service quickly with lowest-risk mitigation.
- Decide rollback vs forward-fix with explicit criteria.
- Capture timeline, decisions, and follow-up actions.

## Severity Model
- Sev 1: Major outage, critical user harm, or security exposure.
- Sev 2: Significant degradation in key journeys.
- Sev 3: Limited impact or workaround available.

## Procedure
1. Triage:
Collect symptoms, first-seen time, affected components, and latest deploy/config changes.
2. Impact:
Estimate affected users, critical flows, and data-integrity risk.
3. Containment:
Apply safest short-term mitigation that reduces user harm.
4. Decision:
Choose rollback when risk is high and recovery is fast.
Choose forward-fix when root cause is isolated and patch risk is low.
5. Verification:
Confirm recovery with health signals, error-rate drop, and user-flow checks.
6. Communication:
Provide concise status updates: impact, action, ETA, next update time.
7. Post-incident:
Record root cause hypothesis, missing guards, and preventive actions.

## Decision Gates
- If data integrity is uncertain, freeze risky writes and prioritize rollback.
- If security/privacy exposure is suspected, escalate severity and contain first.
- If mitigation fails twice, switch strategy and reassess assumptions.

## Completion Checks
- Incident status: stabilized, monitoring, or resolved.
- Clear owner for follow-up fixes and deadline.
- Action list includes prevention, detection, and response improvements.

## Output Format
- Incident summary
- Severity and impact
- Mitigation and rollback decision with rationale
- Verification evidence
- Follow-up actions and owners
