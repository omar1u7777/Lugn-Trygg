---
description: "Use when code is modified in this repository. Requires a minimum level of test verification and explicit reporting per change."
name: "Minimum Test Coverage Verification"
---
# Minimum Test Verification per Change

Every code change must include explicit test verification proportional to risk.

## Minimum Required Verification
1. Small low-risk change: run at least targeted tests for touched module or feature.
2. Medium-risk change: run targeted tests plus one broader suite for impacted layer.
3. High-risk or cross-layer change: run backend and frontend relevant suites plus build/type checks.

## Coverage Intent
- Tests must validate both expected success path and at least one failure path.
- For bug fixes, include a regression test when feasible.
- For contract changes, verify producer and consumer behavior.

## Evidence in Delivery
- Report exactly which tests were run and pass/fail outcome.
- If a test could not be run, provide reason, risk impact, and next verification step.

## Non-Compliance Rule
- Do not mark the task complete without a minimum verification report.
