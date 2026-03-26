---
description: "Use when preparing or implementing production-impacting changes. Enforces release-readiness checks for risk, rollback, and observability."
name: "Release Readiness Production"
---
# Release Readiness for Production Changes

Apply this instruction to all production-impacting work.

## Risk Assessment
- Classify change risk as low, medium, or high.
- Identify blast radius: affected services, user flows, and dependencies.
- List primary failure modes and operational signals to watch.

## Rollback Plan
- Define a concrete rollback path before finalizing implementation.
- Ensure rollback can be executed quickly without data corruption.
- For schema or contract changes, include compatibility strategy.

## Observability Requirements
- Ensure logs are meaningful and avoid sensitive data leakage.
- Identify metrics/alerts that confirm healthy rollout behavior.
- Add or verify error visibility for changed critical paths.

## Release Gate
- Summarize risk, rollback steps, and observability checks in delivery notes.
- If any readiness item is missing, mark release as not ready and state blocker.
