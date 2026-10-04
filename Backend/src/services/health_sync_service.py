"""Fetch a user's data from a connected health provider and store it.

One implementation for the manual sync endpoint and the scheduled auto-sync.
The integrations page has told users "Din data synkroniseras automatiskt var
24:e timme" and offered an auto-sync toggle that was saved and never read:
nothing ran a sync unless the user pressed the button.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from src.utils.timestamp_utils import parse_iso_timestamp
from src.utils.token_crypto import is_sealed, seal, unseal

logger = logging.getLogger(__name__)

SYNC_PROVIDERS = ('google_fit', 'fitbit', 'samsung')


class NotConnected(Exception):
    """The user has no stored grant for this provider."""


class TokenUnusable(Exception):
    """A grant exists but holds no usable access token."""


def _db():
    from src.firebase_config import db
    return db


def _fetch(provider: str, access_token: str, start: datetime, end: datetime) -> dict[str, Any]:
    from src.services.health_data_service import health_data_service
    fetchers = {
        'google_fit': health_data_service.fetch_google_fit_data,
        'fitbit': health_data_service.fetch_fitbit_data,
        'samsung': health_data_service.fetch_samsung_health_data,
    }
    return fetchers[provider](access_token, start, end) or {}


def _usable_access_token(token_ref, token_data: dict, provider: str) -> str:
    """The access token, refreshed first if it has expired.

    Whenever the stored grant holds a plaintext token (written before tokens
    were encrypted) or a refresh changes it, the document is rewritten with
    sealed values.
    """
    stored_access = token_data.get('access_token')
    stored_refresh = token_data.get('refresh_token')
    access_token = unseal(stored_access)
    refresh_token = unseal(stored_refresh)
    if not access_token:
        raise TokenUnusable(provider)

    update: dict[str, Any] = {}
    now = datetime.now(UTC)
    expires_at = parse_iso_timestamp(token_data.get('expires_at'), default_to_now=True)
    if now > expires_at and refresh_token:
        from src.services.oauth_service import oauth_service
        refreshed = oauth_service.refresh_access_token(provider, refresh_token)
        access_token = refreshed.get('access_token') or access_token
        # Providers that rotate refresh tokens return a new one; keeping the
        # old one would make the next refresh fail.
        refresh_token = refreshed.get('refresh_token') or refresh_token
        expires_in = refreshed.get('expires_in', 3600)
        update.update({
            'access_token': seal(access_token),
            'refresh_token': seal(refresh_token),
            'expires_in': expires_in,
            'refreshed_at': now.isoformat(),
            'expires_at': (now + timedelta(seconds=expires_in)).isoformat(),
        })
    else:
        if not is_sealed(stored_access):
            update['access_token'] = seal(access_token)
        if refresh_token and not is_sealed(stored_refresh):
            update['refresh_token'] = seal(refresh_token)
    if update:
        token_ref.update(update)
    return access_token


def sync_provider(user_id: str, provider: str, days_back: int = 7) -> dict[str, Any]:
    """Fetch the last `days_back` days from `provider` and store one sync record.

    Raises NotConnected, TokenUnusable, or whatever the provider call raises.
    """
    if provider not in SYNC_PROVIDERS:
        raise ValueError(f'Unsupported provider: {provider}')

    db = _db()
    token_ref = db.collection('oauth_tokens').document(f'{user_id}_{provider}')
    token_doc = token_ref.get()
    if not token_doc.exists:
        raise NotConnected(provider)

    access_token = _usable_access_token(token_ref, token_doc.to_dict() or {}, provider)

    end = datetime.now(UTC)
    start = end - timedelta(days=days_back)
    health_data = _fetch(provider, access_token, start, end)

    synced_at = datetime.now(UTC).isoformat()
    db.collection('health_data').document(user_id).collection(provider).document().set({
        'user_id': user_id,
        'provider': provider,
        'data': health_data,
        'synced_at': synced_at,
        'date_range': {'start': start.isoformat(), 'end': end.isoformat()},
    })
    return {'provider': provider, 'data': health_data, 'synced_at': synced_at}


# A nightly run covers one day; two leaves overlap if a run is late or missed.
AUTO_SYNC_DAYS_BACK = 2
AUTO_SYNC_BUDGET_SECONDS = 15 * 60


def run_auto_sync(budget_seconds: float = AUTO_SYNC_BUDGET_SECONDS,
                  clock=time.monotonic) -> dict[str, int]:
    """Sync every provider a user has enabled auto-sync for.

    Reads integrations/{uid}.auto_sync, written by the toggle on the
    integrations page. One user's failure is logged and skipped. Stops at
    the budget rather than running into a worker recycle; whatever is left
    is picked up the next night.
    """
    started = clock()
    stats = {'users': 0, 'synced': 0, 'failed': 0, 'disconnected': 0, 'stopped_early': 0}
    db = _db()
    for doc in db.collection('integrations').select(['auto_sync']).stream():
        enabled = [
            provider for provider, setting in ((doc.to_dict() or {}).get('auto_sync') or {}).items()
            if provider in SYNC_PROVIDERS and isinstance(setting, dict) and setting.get('enabled')
        ]
        if not enabled:
            continue
        if clock() - started > budget_seconds:
            stats['stopped_early'] = 1
            break
        stats['users'] += 1
        for provider in enabled:
            try:
                sync_provider(doc.id, provider, days_back=AUTO_SYNC_DAYS_BACK)
                stats['synced'] += 1
                doc.reference.set({'auto_sync': {provider: {
                    'lastSync': datetime.now(UTC).isoformat(),
                    'nextSync': (datetime.now(UTC) + timedelta(days=1)).isoformat(),
                }}}, merge=True)
            except (NotConnected, TokenUnusable):
                # Auto-sync on, grant gone (disconnected or revoked): nothing
                # to do until they reconnect.
                stats['disconnected'] += 1
            except Exception as e:
                stats['failed'] += 1
                logger.warning("Auto-sync %s failed for %s: %s", provider, doc.id[:8], e)
    return stats
