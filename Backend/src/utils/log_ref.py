"""Pseudonymous user references for log lines.

Logs are kept by the hosting provider, read by whoever operates the service,
and outlive the data they describe: an account erased under GDPR Art. 17
still appears in last month's logs. Lines about crisis assessments, sign-ins
and audit events used to carry the Firebase uid, sometimes in full. A uid
is a stable identifier of a person, and next to a risk level it is health
data about that person.

log_ref() gives a short reference derived from the uid with a keyed hash:
- the same user has the same reference on every line, so an incident can
  still be followed through the logs;
- without the server secret it cannot be turned back into the uid, nor
  matched against one.

To find a known user's lines, compute their reference on the server:
    python -c "from src.utils.log_ref import log_ref; print(log_ref('<uid>'))"
"""

import hashlib
import hmac
import os

# Separates this derivation from every other use of the secret, so a log
# reference never equals a public alias or a token derived from it.
_CONTEXT = b'lugn-trygg/log-ref/v1'


def _key() -> bytes:
    secret = os.getenv('JWT_SECRET_KEY') or 'development-only-log-ref-key'
    return hmac.new(secret.encode(), _CONTEXT, hashlib.sha256).digest()


def log_ref(user_id: object) -> str:
    """'u:3f9a1c0b7e2d'-style reference for `user_id`; 'u:-' if there is none."""
    if not user_id:
        return 'u:-'
    digest = hmac.new(_key(), str(user_id).encode(), hashlib.sha256).hexdigest()
    return f'u:{digest[:12]}'
