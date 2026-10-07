"""Permanent erasure of accounts whose deletion grace period has passed.

DELETE /auth/delete-account closes an account at once (sign-in disabled,
profile anonymised, session ended) and writes `hard_delete_after`, 30 days
out. The response and the UI both promise that the data is then permanently
removed. Nothing ever read `hard_delete_after`: no job existed, so every
"deleted" account kept its moods, journal, transcripts and crisis records
indefinitely. GDPR Art. 17 makes that promise a legal obligation.

erase_due_accounts() is the missing job; the insight scheduler runs it nightly.
restore_account() is the other half of the grace period: the UI tells people
that support can reopen the account within those 30 days, and this is how.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

try:
    from google.cloud.firestore import FieldFilter
except ImportError:  # pragma: no cover - the client library is a hard dependency in production
    FieldFilter = None

logger = logging.getLogger(__name__)

DELETION_MARKER_FIELDS = ('deleted_at', 'deletion_reason', 'hard_delete_after')


def _parse_timestamp(value: Any) -> datetime | None:
    """`hard_delete_after` is written as an ISO string; tolerate datetimes too."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _closed_accounts(db):
    query = db.collection('users')
    if FieldFilter is not None:
        return query.where(filter=FieldFilter('is_active', '==', False)).stream()
    return query.where('is_active', '==', False).stream()  # pragma: no cover


def find_due_accounts(db, now: datetime | None = None) -> list[str]:
    """IDs of accounts closed by their owner whose grace period has ended.

    Only accounts carrying the marker the delete route writes qualify. An
    account that is inactive for any other reason, or whose date cannot be
    read, is left alone: erasing on a guess cannot be undone.
    """
    now = now or datetime.now(UTC)
    due: list[str] = []
    for doc in _closed_accounts(db):
        data = doc.to_dict() or {}
        if data.get('deletion_reason') != 'user_requested':
            continue
        erase_after = _parse_timestamp(data.get('hard_delete_after'))
        if erase_after is None:
            logger.error("Closed account %s has an unreadable hard_delete_after; not erasing", doc.id[:8])
            continue
        if erase_after <= now:
            due.append(doc.id)
    return due


def _delete_auth_user(auth, user_id: str) -> None:
    """Delete the sign-in record. Already gone counts as done."""
    if auth is None:
        raise RuntimeError('Firebase Auth is not initialised')
    try:
        auth.delete_user(user_id)
    except Exception as exc:
        if type(exc).__name__ == 'UserNotFoundError':
            return
        raise


def erase_due_accounts(now: datetime | None = None) -> dict[str, Any]:
    """Erase every account whose grace period has ended.

    The sign-in record goes first. purge_user_data also deletes it, but only
    after the profile document and without failing on an error, so a failure
    there would leave the e-mail address in Firebase Auth with nothing left to
    find it by on the next run. Deleting it first, and skipping the account if
    that fails, keeps the profile and its marker for the next night's retry.

    Returns a summary in the shape the retention job reports, with `success`
    False when any account could not be erased.
    """
    from src.firebase_config import auth, db

    if db is None:
        return {'success': False, 'error': 'Database not initialised', 'erased': 0, 'failed': 0}

    from src.routes.privacy_routes import purge_user_data

    try:
        due = find_due_accounts(db, now)
    except Exception as exc:
        logger.exception("Could not list accounts due for erasure")
        return {'success': False, 'error': str(exc), 'erased': 0, 'failed': 0}

    erased = 0
    failed: list[str] = []
    for user_id in due:
        try:
            _delete_auth_user(auth, user_id)
            purge_user_data(user_id)
            erased += 1
        except Exception:
            logger.exception("Erasure failed for account %s; it stays queued", user_id[:8])
            failed.append(user_id[:8])

    result: dict[str, Any] = {'success': not failed, 'erased': erased, 'failed': len(failed)}
    if failed:
        result['error'] = f"{len(failed)} account(s) could not be erased: {', '.join(failed)}"
    return result


def restore_account(user_id: str) -> dict[str, Any]:
    """Reopen an account closed by its owner, within the grace period.

    For support, on a request from the owner's registered address. Sign-in is
    re-enabled and the profile e-mail is put back from the sign-in record (the
    delete route anonymised it). The display name and emergency contacts were
    cleared at deletion and stay cleared; the owner re-enters them.
    """
    from src.firebase_config import auth, db

    if db is None or auth is None:
        raise RuntimeError('Firebase is not initialised')

    ref = db.collection('users').document(user_id)
    snap = ref.get()
    if not snap.exists:
        raise LookupError('No such account, or it has already been erased')
    data = snap.to_dict() or {}
    if data.get('is_active') is not False or data.get('deletion_reason') != 'user_requested':
        raise ValueError('This account was not closed by its owner')

    erase_after = _parse_timestamp(data.get('hard_delete_after'))
    if erase_after is not None and erase_after <= datetime.now(UTC):
        raise ValueError('The grace period has ended; the account is queued for erasure')

    record = auth.update_user(user_id, disabled=False)

    from google.cloud.firestore import DELETE_FIELD

    update: dict[str, Any] = {'is_active': True, 'restored_at': datetime.now(UTC).isoformat()}
    update.update(dict.fromkeys(DELETION_MARKER_FIELDS, DELETE_FIELD))
    email = getattr(record, 'email', None)
    if email:
        update['email'] = email
    ref.update(update)

    from src.services.audit_service import audit_log
    audit_log('account_restored', user_id, {'method': 'support'})
    return {'user_id': user_id, 'email': email}
