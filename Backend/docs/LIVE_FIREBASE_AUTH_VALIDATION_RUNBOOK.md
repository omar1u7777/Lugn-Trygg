# Live Firebase Auth Validation Runbook

## Purpose

This runbook defines the formal gate for validating backend authentication
against real Firebase users in a staging or production-like environment.

## Scope

The gate verifies:

- email/password login against live Firebase
- refresh cookie security attributes
- CSRF enforcement on state-changing auth endpoints
- refresh token rotation behavior
- logout invalidation of refresh session

## Required Inputs

Set the following environment variables before execution:

- LIVE_FIREBASE_E2E=1
- LIVE_BASE_URL=https://<staging-or-prod-like-backend>
- LIVE_FIREBASE_EMAIL=<dedicated-test-account>
- LIVE_FIREBASE_PASSWORD=<dedicated-test-account-password>

Optional output paths:

- LIVE_AUTH_REPORT_PATH (default: live_tests/reports/live-auth-validation-report.json)
- LIVE_AUTH_JUNIT_PATH (default: live_tests/reports/live-auth-validation.junit.xml)

## Local Execution

Run from Backend:

```bash
python scripts/run_live_auth_validation.py
```

Expected result:

- exit code 0
- report file generated
- junit xml generated

## CI Execution

Workflow: .github/workflows/live-auth-validation.yml

Triggers:

- manual: workflow_dispatch
- scheduled: daily cron

Required GitHub secrets:

- LIVE_BASE_URL
- LIVE_FIREBASE_EMAIL
- LIVE_FIREBASE_PASSWORD

## Evidence to Attach for Sign-off

For each release candidate, attach:

- workflow run URL
- artifact: live-auth-validation-report.json
- artifact: live-auth-validation.junit.xml
- screenshot or exported logs showing pass status

## Pass Criteria

A release candidate passes only if all are true:

- script exit code is 0
- report status is "passed"
- all checks in report are pass
- refresh-after-logout is denied (401 or 403)

## Fail/Block Criteria

Block release if any of the following occurs:

- missing required env vars or secrets
- backend health probe fails
- pytest live auth suite fails
- report file not generated

## Incident Response Notes

If gate fails unexpectedly:

1. Verify staging backend URL and deployment health.
2. Verify dedicated Firebase test account status and password.
3. Check rate limiting and temporary lockout behavior.
4. Re-run once after cooldown if 429 or lockout side effects occurred.
5. If still failing, block release and open a security incident ticket.
