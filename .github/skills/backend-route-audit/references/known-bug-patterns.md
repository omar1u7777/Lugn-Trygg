# Known bug patterns in this backend

These six patterns accounted for nearly every real bug found across a full
audit of all 39 route files in `Backend/src/routes/`. They recur because
they're easy mistakes that unit tests don't catch (tests mock Firestore and
never send malformed HTTP bodies), so they only surface when you actually hit
the live endpoint. Grep for each one in the file(s) you're auditing before you
start writing requests — it's cheaper to fix a known pattern by inspection
than to discover it by trial and error against production.

## 1. `request.get_json()` without `silent=True`

**Symptom:** malformed or empty JSON body → unhandled `werkzeug.exceptions.BadRequest`
→ caught by the route's outer `except Exception` → 500, instead of the clean
400 the code clearly intends.

**Why it happens:** `request.get_json()` raises *before* the `or {}` fallback
on the same line ever runs. `silent=True` makes it return `None` instead of
raising, so `data = request.get_json(silent=True) or {}` actually reaches the
fallback.

**Find it:**
```bash
grep -n "request\.get_json()" Backend/src/routes/<file>.py
```
(Matches like `request.get_json(force=True)` without `silent=True` have the
same bug — `force=True` skips the Content-Type check but does nothing about
malformed bodies.)

**Fix:**
```python
data = request.get_json(silent=True) or {}
```

**Test it:** send a request with a body that isn't valid JSON (e.g.
`not valid json {{{`) to any POST/PUT endpoint and confirm 400, not 500.

## 2. Unguarded `int(request.args.get(...))`

**Symptom:** `?limit=notanumber` or `?days=abc` → unhandled `ValueError` → 500.

**Find it:**
```bash
grep -n "int(request\.args\.get" Backend/src/routes/<file>.py
```
Check each match has a `try/except (TypeError, ValueError)` around it — most
don't when first found.

**Fix:**
```python
try:
    limit = int(request.args.get('limit', 20))
except (TypeError, ValueError):
    return APIResponse.bad_request("limit must be an integer")
```

**Test it:** `GET /whatever?limit=notanumber` should be 400, not 500.

## 3. `APIResponse.bad_request(message, "SOME_CODE")` silently drops the code

**Symptom:** the response body always shows `"error": "BAD_REQUEST"` no matter
what specific code the route author clearly intended — any frontend logic
that branches on the error code breaks silently.

**Why it happens:** `APIResponse.bad_request`'s signature is
`bad_request(message, details=None)`. The second positional argument is
`details`, not an error code — and `details` is only ever included in the
response when `FLASK_DEBUG` is on, so in production it vanishes with no trace.

**Find it:**
```bash
grep -n 'bad_request([^)]*, "[A-Z_]*")' Backend/src/routes/<file>.py
```

**Fix:** use `APIResponse.error()` directly, which takes the code as its real
second argument:
```python
return APIResponse.error("session_id is required", "SESSION_ID_REQUIRED", 400)
```

**Test it:** trigger the validation error and assert
`pm.response.json().error === "THE_SPECIFIC_CODE"`, not just the status code.

## 4. Compound Firestore query without a matching composite index

**Symptom:** works perfectly in every test (tests use a mocked Firestore that
doesn't enforce indexes) and then raises `FailedPrecondition: 400 The query
requires an index` the first time it runs against real production data.

**Find it:** look for any `.where(...)` combined with either a second
`.where(...)` on a different field, or an `.order_by()` on a different field
than the equality filter:
```python
db.collection('x').where(filter=FieldFilter('user_id', '==', uid)).order_by('timestamp', direction='DESCENDING')
db.collection('x').where(filter=FieldFilter('room_id', '==', r)).where(filter=FieldFilter('last_seen', '>=', cutoff))
```
Then check whether `firestore.indexes.json` (repo root) already has a
matching `collectionGroup` entry with those exact field names in that order.
Field name typos (`createdAt` vs `created_at`) are a real trap — an index
with the wrong casing doesn't cover the query at all.

**Fix:** add the composite index and deploy it live (independent of any code
deploy):
```json
{
  "collectionGroup": "the_collection",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "user_id", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```
```bash
firebase deploy --only firestore:indexes --project lugn-trygg-53d75
```
If the same query shape appears elsewhere in the file already wrapped in a
`try/except` with a documented fallback (e.g. `# Compound query may fail if
composite index doesn't exist`), apply that exact same guard to the
unprotected occurrence too — it's a sign the original author knew about this
class of failure but missed a spot.

**Test it:** the index takes a few minutes to build after deploy; the live
Postman run may still show the failure immediately after deploying — that's
expected, not a sign the fix is wrong.

## 5. Non-atomic "read balance → check → deduct" (race condition)

**Symptom:** not visible in a single sequential test run — but two concurrent
requests can both read the same starting balance, both pass the sufficiency
check, and both deduct, letting a user redeem/claim more than they actually
have (XP, referral rewards, subscription quota, anything with a numeric
balance gated by a check).

**Find it:** look for a `.get()` read, a plain Python `if balance < cost`
check, and a separate `.update()`/`.set()` write as three unguarded steps
using the *service-layer* client (not already wrapped in a transaction).

**Fix:** wrap the whole read-check-write in a Firestore transaction:
```python
from google.cloud import firestore as gcfirestore

@gcfirestore.transactional
def _txn(transaction):
    snapshot = transaction.get(ref)
    data = snapshot.to_dict() or {}
    if data.get('balance', 0) < cost:
        raise ValueError("400:INSUFFICIENT_BALANCE")
    transaction.update(ref, {'balance': data['balance'] - cost})

try:
    _txn(db.transaction())
except ValueError as ve:
    ...  # translate back into the right APIResponse
```
This is higher-effort than the other patterns and touches test mocks (the
shared `_FakeFirestoreTransaction` in `Backend/tests/conftest.py` supports
this pattern already, but existing tests that patch a bare `MagicMock()`
instead of the `mock_db` fixture will need rewiring). If the effort doesn't
fit in the current pass, it's a legitimate candidate to flag as a follow-up
task rather than force through inline — but don't skip *finding* and
reporting it.

## 6. Server-to-server/webhook endpoint missing from the CSRF exempt list

**Symptom:** the endpoint's own auth (e.g. signature verification) never
actually runs in production — every real call from the external service
(Stripe, etc.) gets rejected with `403 {"error": "CSRF-token saknas"}` before
reaching the route at all.

**Why it happens:** `main.py`'s global CSRF middleware requires a CSRF cookie
+ header on any unauthenticated POST/PUT/PATCH/DELETE under `/api/`. It skips
the check when an `Authorization: Bearer` header is present — but a
server-to-server webhook caller never has a browser session and never sends
one, so unless the exact path is in `csrf_exempt_paths`, it's dead on arrival.

**Find it:** for any route with no `@AuthService.jwt_required` decorator that
receives POST calls from an external service, check whether its exact path is
in `csrf_exempt_paths` in `main.py`.

**Fix:** add the path to `csrf_exempt_paths`, with a comment explaining what
auth mechanism replaces CSRF for this endpoint (the signature check usually
already exists in the route and was just unreachable).

**Test it:** POST to the endpoint with no `Authorization` header and no CSRF
cookie/header — confirm you get the *route's own* validation response (e.g.
signature-missing), not a blanket 403 from the CSRF layer. cURL with `-D -`
is more reliable here than Postman, since Postman's own cookie jar can mask
what an actual first-contact caller (like Stripe) would experience.
