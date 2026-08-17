# Eval 0 (without skill): referral_routes audit -- baseline

**Note on methodology:** this is not a fresh subagent run (the baseline
subagent for this eval also failed on the same session-limit error as the
with-skill run). Instead, this reconstructs what this session's orchestrating
Claude actually did on this exact file earlier in the same conversation,
before `backend-route-audit` existed as a skill -- i.e. genuinely without any
skill guidance, working from general judgment plus whatever had been learned
by that point from auditing other route files by hand.

## What was found and fixed (same session, pre-skill)
Across two separate passes (not one continuous audit):
1. The `int(request.args.get('limit', ...))` unguarded-crash pattern was
   found and fixed as part of a 12-file systemic sweep triggered by noticing
   the same bug shape in a different route file first (`mood_routes.py`),
   then grepping the whole `routes/` directory for the same call shape.
   `referral_routes.py`'s `get_leaderboard()` was one of the 12.
2. The `redeem_reward()` race condition was found later, during a dedicated
   live Postman audit of `referral_routes.py` specifically -- noticed by
   inspection while reading the endpoint (recognized as the same shape as an
   already-fixed subscription-quota race elsewhere in the codebase), not
   because a live test failed and pointed at it.

## Live testing
A Postman collection was hand-written for `referral_routes.py` (not using any
reusable generator script -- each collection across ~10 domains that session
was authored from scratch in its own `gen_<domain>.py`, independently
reinventing the same auth-setup/req() boilerplate each time). Run live
against production; the leaderboard bug was reproduced (500 on non-numeric
limit) before fixing, matching the with-skill run.

## Key differences from the with-skill run
- **No bundled fix template.** The transactional-redemption fix pattern was
  derived from first principles / recalling a similar fix elsewhere, not from
  a written reference -- took noticeably more back-and-forth to land on the
  right shape (`@firestore.transactional` + `db.transaction()` + a
  non-transactional fallback branch).
- **The `_FakeFirestoreTransaction.get()` gap was hit independently** the
  first time this transactional pattern was ever applied in the session (for
  an unrelated file, `challenges_routes.py`), and fixed then -- so by the time
  `referral_routes.py`'s redeem_reward() got the same treatment, the fix
  double already had `.get()` and no test broke. (In the with-skill run,
  starting from a clean `origin/master` worktree, this gap was hit again from
  scratch and had to be rediscovered.) This is a fair "no memory of past
  fixes" artifact of testing skill vs. no-skill in isolated worktrees, not a
  skill vs. no-skill capability difference per se.
- **No reusable collection-generation script** -- each domain's
  `gen_<domain>.py` duplicated the same ~40 lines of auth-setup boilerplate,
  which is exactly what motivated bundling `postman_helpers.py` into the
  skill in the first place.

## Assessment
The *outcome* (both bugs found and correctly fixed) was the same with or
without the skill in this specific case -- unsurprising, since the skill's
content was extracted from this exact session's own successful approach.
The skill's main value shown here is in *efficiency and completeness of
technique* (a ready fix template, a bundled generator script) rather than in
finding something that wouldn't otherwise have been found.
