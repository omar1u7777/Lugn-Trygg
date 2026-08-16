# Eval 0 (with skill): referral_routes audit

**Note on methodology:** this run was NOT executed by a blind independent
subagent — the 6 subagents launched for this iteration all failed
simultaneously on a session-limit error, so this run was executed directly
by the orchestrating session, which authored the skill and therefore already
knew the answers. It validates that the skill's instructions, when followed
literally, actually work end-to-end — not whether an independent Claude would
discover and use the skill correctly. The `without_skill` counterpart for
this same eval is filled by this session's own earlier (skill-free) pass over
this exact file, done before the skill existed.

## What was found
Two real, currently-live bugs in `Backend/src/routes/referral_routes.py`,
both from `references/known-bug-patterns.md`:

1. **Pattern #2 (unguarded int parsing):** `get_leaderboard()` called
   `int(request.args.get("limit", 10))` with no try/except.
   `GET /api/v1/referral/leaderboard?limit=notanumber` crashed with a live
   500. Reproduced against production before fixing (see below).
2. **Pattern #5 (non-atomic race condition):** `redeem_reward()` read
   `rewards_earned`, checked it against cost, then wrote the new balance as
   three separate unguarded Firestore calls. Two concurrent redeem requests
   could both pass the balance check and both deduct, letting a user redeem
   more premium rewards than they'd earned.

## What was fixed
- Wrapped the `int()` call in `try/except (TypeError, ValueError)`.
- Wrapped the read-check-deduct in a Firestore `@firestore.transactional`
  function, with a non-transactional fallback if `google.cloud.firestore`
  ever fails to import.
- **Not anticipated by the reference doc, found via just running the tests:**
  the shared `_FakeFirestoreTransaction` test double in `conftest.py` was
  missing a `.get()` method (it only had `set`/`update`/`delete`). The
  transactional fix broke 3 existing tests until `.get()` was added,
  delegating to the real reference's own `.get()`. This should be called out
  more explicitly in the skill's pattern #5 writeup for the next iteration --
  right now it's mentioned as a caveat but easy to skim past.

## Live Postman run
First run (before fix): 14/15 requests passed, 16/17 assertions -- the 1
failure was the leaderboard 500, reproduced live as predicted.

After fixing + committing locally in this isolated worktree (never pushed/
deployed anywhere): re-ran the same collection -- the leaderboard assertion
still fails live, because this worktree's commit was never deployed. This is
exactly the "already fixed in code, pending deploy" triage category the
skill's step 4 describes -- correctly recognized as such, not treated as a
failed fix.

## Files
- `referral_routes.postman_collection.json` -- the generated collection (15
  requests, 5 folders).
- `referral_routes.py` -- the fixed route file (diff: leaderboard try/except,
  transactional redeem_reward, gcfirestore import).
- Full test suite (2275 passed, 63 skipped, 1 xfailed) and targeted
  `pytest -k referral` (72 passed) both green after the fix.
