# Lugn & Trygg — Production Operations Runbook

This runbook covers the **operator (console/CLI) half of P0 production readiness**.
The code half (crisis delivery accounting, Gunicorn topology, durable crisis
queue, distributed locks, health-check contract, scheduled retention) is already
in the repo. The steps below are the parts that **cannot** live in code — they
are GCP / Render / GitHub / Sentry console actions that must be performed once
before the platform is safe to launch.

> Ordering: do **§1 (crisis channels)** and **§4 (alerting)** first — they are
> patient-safety-critical. Then §2 (backups), §3 (deploy gating), §5 (rollback).

---

## 1. Crisis escalation channels — email DONE, SMS still pending

The crisis pipeline is durable end-to-end in code, but it can only reach a human
if these providers are configured. `escalate()` now **hard-fails with a
telemetry CRITICAL** (`crisis_no_human_channel_configured`) if none is set, so a
missing config is loud rather than silent.

**Done — set directly on the live Render service (`srv-d3vvf97gi27c73f2ji9g`)
via the API, verified with a real `mail/send` call (HTTP 202 accepted):**

| Variable | Value | Status |
|---|---|---|
| `SENDGRID_API_KEY` | (set) | Verified against `/v3/user/account` |
| `SENDGRID_FROM_EMAIL` | `omaralhaek97@gmail.com` | **Verified sender** (SendGrid Single Sender Verification, confirmed via `/v3/verified_senders`: `"verified": true`) |
| `CARE_TEAM_EMAIL` | `omaralhaek97@gmail.com` | Set — currently the only team member; revisit when the team grows |
| `BREACH_NOTIFICATION_EMAIL` | `omaralhaek97@gmail.com` | Set (GDPR Art. 33 DPO inbox, same reasoning) |

Note: SendGrid account is on the **free trial** (ends 2026-09-24) — upgrade
before then or email sending stops. `RESEND_API_KEY` (used specifically by
`breach_notification_service.py`'s DPO email, a separate provider from
SendGrid) is **still not set** — separate task, not covered by this SendGrid
connection.

**Still required — SMS channel (Twilio not connected yet):**

| Variable | Purpose | Where to get it |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | SMS to user + emergency contacts | Twilio Console |
| `TWILIO_AUTH_TOKEN` | " | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Sending number (E.164, e.g. `+46…`) | Twilio Console |

Email alone already satisfies `has_any_human_channel_configured()` (see
`crisis_escalation.py`), so the crisis pipeline is no longer hard-failing —
but SMS is the faster, more reliable channel for urgent cases and should
still be added.

**Verification:** After deploy, trigger a test escalation in staging with a test
user that has a phone/emergency contact. Confirm the email arrives AND that
the `crisis_tasks` document reaches `status: "completed"`. If `escalate()` can't
reach a human, the task will retry 5× then land `status: "failed"` with a
`crisis_escalation_exhausted` CRITICAL — wire that to a pager (see §4).

**Clinician dashboard:** `dashboard_alerts` documents are written but the
consumer UI is out of scope here. Until it exists, `CARE_TEAM_EMAIL` is the
human path — make sure it stays a **monitored** inbox as the team grows, not
a shared alias nobody watches.

---

## 2. Backups & disaster recovery (GCP-native — do NOT rely on the Python tooling)

The in-repo `BackupService` streams only top-level collections and would miss
nearly all PHI (which lives in `users/{uid}/*` subcollections). Use Firestore's
native mechanisms instead — they cover subcollections automatically.

### 2a. Enable Point-in-Time Recovery (7-day continuous backup)
```bash
gcloud firestore databases update --database='(default)' \
  --project=lugn-trygg-53d75 \
  --enable-pitr
```
PITR gives a 7-day continuous recovery window (RPO ≈ minutes) with one command.

### 2b. Scheduled full export to a regional bucket (long-term / offsite)
```bash
# One-time: create an EU bucket (data residency — see §2d)
gsutil mb -l eur3 -p lugn-trygg-53d75 gs://lugn-trygg-firestore-backups

# One-time: let Firestore's service agent write to it
gcloud projects add-iam-policy-binding lugn-trygg-53d75 \
  --member="serviceAccount:service-<PROJECT_NUMBER>@gcp-sa-firestore.iam.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

# Schedule a daily export via Cloud Scheduler (covers ALL subcollections)
gcloud scheduler jobs create http firestore-daily-export \
  --project=lugn-trygg-53d75 --location=eur3 --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/lugn-trygg-53d75/databases/(default):exportDocuments" \
  --http-method=POST --oauth-service-account-email=<SCHEDULER_SA>@lugn-trygg-53d75.iam.gserviceaccount.com \
  --message-body='{"outputUriPrefix":"gs://lugn-trygg-firestore-backups"}'
```

### 2c. Restore fire-drill (do this once before trusting the backup)
```bash
# Import a chosen export into a STAGING database, never production first.
gcloud firestore import gs://lugn-trygg-firestore-backups/<TIMESTAMP> \
  --project=lugn-trygg-staging
```
Verify a known user's moods/journal/conversations are present. Document the
wall-clock restore time — that is your real RTO.

### 2d. Data residency
Confirm the Firestore location for `lugn-trygg-53d75` is an EU region
(`eur3` / `europe-west*`) in the Firebase console. If it is **not**, the GDPR
residency claim is false and a project migration is required before launch —
Firestore location is immutable, so this means a new project + data migration.

### 2e. Automated retention (already coded)
The daily 03:00 retention sweep (`_run_data_retention`, distributed-lock guarded)
runs inside the app now. Confirm in logs that `data_retention_completed`
telemetry appears daily. No console action required.

Retention is wired for the subcollection-based stores (moods, memories,
conversations, journal_entries, …) plus the root-level `feedback`,
`referrals`, and `insights` collections. It deliberately does **not**
auto-delete `oauth_tokens`, `refresh_sessions`, `webauthn_credentials`,
`webauthn_challenges`, `user_devices`, or `health_data` — those either have
their own expiry logic already (refresh/OAuth tokens, one-time WebAuthn
challenges) or are account-lifecycle data with no natural "expired" state
(long-lived credentials, device records, synced health data). All of them
are still fully erased on request via `purge_user_data` (GDPR Art. 17).

### 2f. Firestore composite indexes — DEPLOYED

```bash
firebase deploy --only firestore:indexes --project lugn-trygg-53d75
```

Run and confirmed live (production project `lugn-trygg-53d75`, 47 indexes from
`firestore.indexes.json`, deploy succeeded with no errors). These fixed
queries that would otherwise raise `FAILED_PRECONDITION` in production the
first time their query shape was hit (none of them show up against the
Firestore emulator/mocks used in tests, which is why CI never caught them):

- `crisis_tasks (status, created_at)` — crisis worker's oldest-pending-task query.
- `insights (user_id, created_at)` — GDPR retention sweep.
- `peer_chat_messages (room_id, timestamp)` — every peer-support chat room join.
- `content_reports (status, created_at)` — moderator content-report dashboard.
- `clinical_assessments (type, timestamp)` — PHQ-9/GAD-7 assessment history filter.
- `feedback (status, created_at)`, `feedback (category, created_at)`,
  `feedback (status, category, created_at)` — admin feedback moderation filters.
- `notifications (userId, sentAt)` — notification-history retention sweep.

**Note found during deploy:** the live project also has 5 legacy indexes not
present in `firestore.indexes.json` (old `userId`/camelCase-keyed indexes on
`moods`/`memories`/`chat_sessions`/`insights` from before those collections'
writers were standardized to `user_id` snake_case). `firebase deploy --only
firestore:indexes` reports these but does **not** delete them automatically —
only `--force` does. They're harmless dead weight (no current query uses the
old field name), left alone deliberately rather than risk deleting something
still in use. Confirm via the Firebase console before ever passing `--force`.

If `firestore.indexes.json` changes again, re-run the command above — it's
idempotent and only adds what's missing.

---

## 3. Deploy gating (deploy-on-green, not deploy-on-push) — DONE

`render.yaml` sets `autoDeploy: false`.

**Confirmed live** (checked directly via `gh api
repos/omar1u7777/Lugn-Trygg/branches/master/protection`):
- Required status checks: **`lint-and-test` AND `security`** (both from
  `backend-ci.yml`; `frontend-ci.yml` shares the same two job names, so a PR
  touching frontend code is covered by the same two required contexts —
  note this is GitHub classic branch-protection's known limitation: it
  matches by context *name*, not by workflow, so it can't distinguish "the
  backend's lint-and-test" from "the frontend's" if only one of a pair ran).
  This closes the gap where `security` (pip-audit/Trivy/Gitleaks) previously
  weren't required at all, and the rule instead pointed at
  `live-auth-validation` — a check from a workflow that was **disabled**
  and could never report success.
- `enforce_admins: true` — no bypass, even for repo admins.
- `allow_force_pushes: false`, `allow_deletions: false`.
- 1 required approving PR review (already correct, unchanged).
- Bandit (same `security` job) still runs `continue-on-error: true` and is
  informational-only by design — it doesn't gate the job's own exit code,
  so it also can't gate the merge check above regardless of branch-rule
  configuration; treat its findings as a report to review, not a blocker.

**Still manual (Render dashboard, not settable via the API key used so far):**
- **lugn-trygg-backend → Settings → Build & Deploy → Auto-Deploy:** confirm
  it's set to **"After CI Checks Pass"** (reads GitHub check status) rather
  than a plain on/off toggle.

---

## 4. Alerting path (so CRITICAL events reach a human) — DONE

`init_sentry()` now **refuses to boot in production without `SENTRY_DSN`**
(override only with `ALLOW_MISSING_SENTRY=true` for isolated staging).

**Done:**
- Dedicated backend Sentry project created: org `lugn-trygg`, project
  `lugn-trygg-backend` (platform: python-flask). The org's only prior project
  (`javascript-react`) was frontend-only — the backend needed its own.
- Alert rule created and live (rule id `739062`, name "Crisis CRITICAL -
  immediate page"): fires on event `level` equals `fatal` OR message contains
  `crisis_escalation_exhausted` / `crisis_no_human_channel_configured` /
  `crisis_queue_unavailable` (`filterMatch: any`), notifying the `lugn-trygg`
  team by email (falls back to all active members if team resolution fails).
  Verified end-to-end with a real test event (`sentry event send`) — the
  test correctly created a `fatal`-level issue, matched the rule, and the
  notification email arrived (confirmed by inspecting the actual inbox).
- `SENTRY_DSN` set directly on the live Render service (`srv-d3vvf97gi27c73f2ji9g`)
  via `PUT /v1/services/{id}/env-vars/SENTRY_DSN` — confirmed present
  alongside all 36 other existing env vars (nothing else was touched; this
  endpoint updates only the one named key). Value:
  `https://0eba74583a1ac88c51a2dd255e25c796@o4510267243298816.ingest.de.sentry.io/4511803441021008`.
  Takes effect on the next deploy/restart of that service.

**Optional follow-up:**
- If you want paging beyond email (PagerDuty/Slack), install that
  integration in Sentry (**Settings → Integrations**) and add it as an
  additional action on rule `739062` — email-only was used because no other
  integration was installed on this org yet.

Once a production deploy picks up the new env var, health check:
`/health` now returns **503 when Firestore is unreachable** (Render restarts
on non-2xx) and `degraded` (still 200) when only Redis is down. No action
needed beyond confirming `healthCheckPath: /health`.

---

## 5. Rollback

Render keeps every deploy. To roll back:

- **Dashboard:** lugn-trygg-backend → **Deploys** tab → pick the last-known-good
  deploy → **"Rollback to this deploy"**.
- **API:**
  ```bash
  curl -X POST "https://api.render.com/v1/services/<SERVICE_ID>/rollback" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"deployId":"<GOOD_DEPLOY_ID>"}'
  ```

**Rollback triggers (roll back immediately if, post-deploy):** `/health` returns
503 for >2 min · error rate >5% in Sentry · any `crisis_*` CRITICAL spike ·
worker restart loop in Render logs.

Do one practice rollback in staging so the procedure is muscle-memory before an
incident.

---

## 6b. Rotate the leaked e2e credential (do immediately)

The password `E2eTest123!Secure` for `e2e-verify@lugntrygg.se` was committed to
the repo (now removed from source; all scripts read `E2E_TEST_EMAIL` /
`E2E_TEST_PASSWORD` from the environment). It still lives in **git history**:

1. **Rotate now:** change (or delete) that Firebase account's password in the
   Firebase console — assume the old one is public.
2. Set the new value as a CI/Render secret (`E2E_TEST_EMAIL` /
   `E2E_TEST_PASSWORD`); scripts and `tests/test_live_e2e_auth.py` read it from
   there.
3. Optional history scrub: `git filter-repo --replace-text` to purge the string
   from history if the repo is or becomes public.

---

## 6c. P1/P2 hardening — operator follow-ups

The P1/P2 code changes introduced a few config/rollout dependencies:

- **Consent enforcement** (`/chatbot/chat`, `/voice/transcribe`,
  `/voice/analyze-emotion`) now returns **403 when a user has WITHDRAWN**
  `ai_processing` consent (non-strict: absent records are allowed so existing
  users aren't locked out). To move to strict "require explicit grant", backfill
  `ai_processing` consent for existing users, then flip `strict=True` on those
  decorators.
- **Breach notifications** need `BREACH_NOTIFICATION_EMAIL` (DPO inbox) and
  `RESEND_API_KEY` set, or the on-call email won't send (the telemetry CRITICAL
  still fires → Sentry alert). GDPR clock: **72h to IMY** (Art. 33).
- **HIPAA_ENCRYPTION_KEY** is now **required in production** — the app refuses to
  start without a valid Fernet key (audit logging must never silently disable).
- **Prometheus multi-worker**: set `PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc`
  (already in render.yaml) so `/api/v1/metrics/metrics` aggregates across workers;
  the gunicorn `child_exit` hook cleans up dead workers. Point the scraper at
  `/api/v1/metrics/metrics/business` for crisis-queue + degradation gauges.
- **CORS previews**: production now honors only exact allowlist origins. For
  Vercel preview CORS, set BOTH `VERCEL_PROJECT_SLUG` (e.g. `lugn-trygg`) and
  `VERCEL_TEAM_SLUG` (your exact Vercel team/org slug, visible in the Vercel
  dashboard URL) — Vercel team slugs are globally unique, so this cannot be
  spoofed by an attacker registering a similarly-named project. The single-var
  `VERCEL_PREVIEW_PREFIX` still works but only anchors the prefix, not the
  team, and permits a prefix-collision (e.g. a project named
  `lugn-trygg-evil`) — prefer the two-var form.
- **2FA**: login for a 2FA account returns `{requires2FA, pendingToken}` and no
  session; the client completes via `POST /verify-2fa` with the pending token.

---

## 7. Post-deploy smoke test (manual until automated)

After each production deploy, verify:
1. `GET /health` → 200 with `"firebase":"connected"`.
2. Log in as the e2e-verify account (rotate its committed password first!).
3. Send one AI chat message → 200 with a response.
4. Confirm in logs: no `DEGRADED_FALLBACK` for `ai_chat` (would mean OpenAI is
   down), and the crisis worker logged startup in each Gunicorn worker.

---

## 8. Boot-blocking config — VERIFIED already set in production

These are not optional hardening — `main.py` calls `sys.exit(1)` at import
time, before Gunicorn can bind a socket, if any of this is wrong. A fresh
deploy that skips this section is a total outage, not a degraded feature.

**Confirmed live** (checked directly via the Render API against service
`srv-d3vvf97gi27c73f2ji9g` — all 37 env vars listed, not just the paginated
first page):
- `WEBAUTHN_RP_ID` — set.
- `WEBAUTHN_ORIGIN` — set.
- `FRONTEND_URL` — set.

All three are declared as `sync:false` slots in `render.yaml`; the actual
values were already present in the Render dashboard by the time this was
checked, so this is not a live boot-crash risk. CI still never exercises this
validation branch (`backend-ci.yml` always runs with `FLASK_ENV=testing`), so
if any of these three is ever cleared or mistyped in the dashboard, nothing
in CI will catch it before a deploy — the only signal will be the service
failing to boot in production. Re-verify with:
```bash
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/srv-d3vvf97gi27c73f2ji9g/env-vars?limit=100"
```
(note `?limit=100` — the default page size is 20 and silently truncates.)

- **`PROMETHEUS_MULTIPROC_DIR`** — `gunicorn_config.py` now creates this
  directory itself at boot (it didn't before, which crashed the app on any
  fresh/ephemeral container the moment `metrics_routes.py` constructed its
  first Prometheus metric). No operator action needed as long as deploys go
  through `gunicorn -c gunicorn_config.py main:app` exactly as `render.yaml`
  specifies — don't bypass this entrypoint.
