---
name: backend-route-audit
description: 'Live-audit one or more Flask backend route files in Lugn & Trygg against the real production API (https://lugn-trygg-backend.onrender.com), find and fix real bugs, and produce a lasting Postman regression collection under Backend/postman/collections/. Use whenever the user asks to test, audit, verify, check, or "make sure X works" for any backend route/endpoint/domain in this repo -- including phrasing like "test the referral routes", "does the voice endpoint actually work", "write Postman tests for subscription", "audit the backend", or "find bugs in X" -- even if they never say "Postman" or "audit" explicitly. Also use this after making a nontrivial change to an existing route file, to confirm nothing broke against the live API.'
argument-hint: 'Name the route file(s)/domain(s) to audit, e.g. "Backend/src/routes/mood_routes.py" or "the mood and journal domains".'
user-invocable: true
disable-model-invocation: false
---

# Backend Route Live Audit

Test a backend route file for real, against the live production API, not
just by reading the code. Unit tests in this repo mock Firestore and never
send malformed HTTP input, so several real bug classes (see
`references/known-bug-patterns.md`) only ever show up when something actually
calls the endpoint over the network. This skill turns that live check into a
lasting artifact (a Postman collection) instead of a one-off curl session, so
the next person who touches this route gets a regression suite for free.

## Outcomes
- Every route in the target file has been exercised live: happy path plus the
  negative paths that matter (missing auth, wrong owner, invalid input,
  malformed body, not-found).
- Real bugs found are root-caused, fixed, verified (lint + compile + targeted
  tests), and committed -- not just reported.
- A Postman collection exists at
  `Backend/postman/collections/<domain>.postman_collection.json` that
  reproduces the audit and will catch a regression next time it's run.

## Procedure

1. **Read the route file(s).**
   Understand what each endpoint does, what it requires (auth, ownership,
   request body shape), and what Firestore collections/queries it touches.
   Grep for each pattern in `references/known-bug-patterns.md` before writing
   a single test request -- fixing an obvious bug by inspection is cheaper
   than discovering it by trial and error against production, and lets you
   write the Postman assertion for the *fixed* behavior from the start.

2. **Generate the Postman collection.**
   Write a small `gen_<domain>.py` script (to a scratchpad/temp directory, not
   the repo) that imports `scripts/postman_helpers.py` from this skill for the
   auth-setup folder and `req()` helper, and defines the domain-specific
   folders. One folder per concern/endpoint group; within each, the happy
   path plus whichever negative paths actually apply to that endpoint (not
   every endpoint needs every negative path -- a public GET doesn't need a
   401 test). Run the generator, writing the collection JSON directly to
   `Backend/postman/collections/<domain>.postman_collection.json`. Writing a
   generator script is much cheaper (in tokens and in errors) than hand-authoring
   the JSON.

3. **Run it live.**
   ```bash
   MSYS_NO_PATHCONV=1 "/c/Users/OMAL0013/AppData/Roaming/npm/postman" collection run \
     "Backend/postman/collections/<domain>.postman_collection.json" \
     --env-var "base_url=https://lugn-trygg-backend.onrender.com" --reporters cli
   ```
   (Postman CLI isn't on PATH -- use the full path above, or locate it first
   with `where postman` / `Get-Command postman` if it's moved.)

4. **Triage every failure before touching any code.** Each one is exactly one
   of:
   - **A real bug.** Root-cause it (read the source, check
     `firestore.indexes.json`, check Render logs if the cause isn't obvious
     from the code alone) before writing a fix.
   - **Already fixed in the current source, just not deployed yet.** Confirm
     by re-reading the relevant lines of the file on disk -- if the fix is
     already there, the live failure just means this branch hasn't shipped.
     Leave the assertion as the *correct* expected behavior (it's a real
     regression test for once this deploys) and move on.
   - **A mistake in the test itself**, not the backend. Common ones: a script
     that mutates `pm.request.headers` inside the `test` event instead of
     `prerequest` (too late -- the request already went out); Postman's
     cookie jar carrying a cookie over from an earlier request in the same
     run when you meant to test the no-cookie case; Postman auto-following a
     redirect and masking the real 3xx response (use `curl -D -` without `-L`
     to see the raw response when a redirect is in play). Fix the test, not
     the code.
   - **An infrastructure/config issue outside the code** (an expired API key,
     a placeholder value that was never replaced with a real one, a billing
     account in a bad state). Confirm via Render logs, then flag it to the
     user directly and clearly -- don't try to "fix" it by changing code, and
     don't let it block the rest of the audit.

5. **Fix real bugs, then verify before moving on.**
   ```bash
   cd Backend
   python -m ruff check src/routes/<file>.py
   python -c "import py_compile; py_compile.compile('src/routes/<file>.py', doraise=True)"
   python -m pytest tests/ -k <domain> -q
   ```
   Re-run the Postman collection to confirm the fix actually resolves the
   live failure (or accept it as expected-pending-deploy if the deploy hasn't
   shipped yet -- see step 4).

6. **Commit and push per domain**, not in one giant batch at the end. A
   commit message that explains the *mechanism* of the bug (not just "fix
   bug") is worth the extra sentence -- it's what makes the fix reviewable
   and stops the same class of bug from recurring silently elsewhere.

## Safety boundaries -- do not skip this section

- **Never execute a real destructive or irreversible action**, even against a
  disposable e2e test account you created for this audit: permanent account
  deletion, system/admin-wide data cleanup, a real payment capture, disabling
  another service's live credentials. For these endpoints, test only that the
  access-control gate correctly rejects unauthorized/malformed attempts
  (401/403/400) -- confirm the *guard* works without ever letting the
  destructive path execute. If a request like this gets blocked by a safety
  mechanism outside your control, accept that boundary; don't look for a way
  around it.
- **Never automate testing of endpoints that can list, view, or modify real
  patients'/users' PII, or that can escalate privileges** (e.g. admin-only
  data-listing endpoints), even read-only. If a route file is entirely in
  this category, exclude it from the automated audit and say so explicitly
  rather than silently skipping it.
- For endpoints gated by `@require_admin` or similar that aren't in the
  excluded category above, it's fine to verify the gate itself (a non-admin
  test account gets 403), but never obtain or fake admin privileges to test
  past it.
- If a domain touches a feature that's already known to be broken for
  infrastructure reasons unrelated to this audit (e.g. a storage bucket that
  doesn't exist because of a billing issue), scope that part of the
  collection to avoid re-triggering the same known failure, and say so in the
  collection's own description field so the next reader isn't confused by
  reduced coverage.

## Decision Points
- **New bug pattern found that isn't in `references/known-bug-patterns.md`?**
  Add it there once fixed -- that file is what makes each subsequent audit
  faster than the last.
- **Fix requires touching shared test infrastructure** (e.g. a fake/mock used
  by many tests) or is large enough to risk destabilizing an unrelated area
  under real time pressure? It's fine to flag it as a follow-up task instead
  of forcing it into this pass, as long as the finding itself is reported,
  not silently dropped.
- **Ambiguous whether a live 500/403/etc. is a real bug or expected?** Default
  to investigating (read the source, check logs) over guessing from the
  status code alone -- the same HTTP status can mean very different things
  depending on which layer produced it (see pattern #6 in
  `references/known-bug-patterns.md` for a concrete example of this).

## Completion Checks
- Every endpoint in the target file has at least one live request in the
  collection.
- Every collection failure has been explicitly triaged into one of the four
  categories in step 4 -- none left unexplained.
- Real bugs are fixed, lint/compile/tests pass, and the fix is committed with
  a message that explains the mechanism, not just the symptom.
- The collection is committed alongside the fix (or on its own, if the domain
  was already clean).

## Output Format
For each domain audited, report:
- Pass/fail counts from the live Postman run (requests and assertions).
- Any real bugs found, with a one-line root cause and what was changed.
- Any findings triaged as pending-deploy / test-script mistake / infra issue,
  named as such so they aren't mistaken for unresolved bugs.
- Anything explicitly excluded from live testing and why (safety boundary).
