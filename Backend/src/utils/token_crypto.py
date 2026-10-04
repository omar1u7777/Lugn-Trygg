"""Encryption at rest for third-party OAuth tokens.

oauth_tokens held each user's Google Fit / Fitbit / Samsung access and
refresh tokens in plaintext. Firestore rules keep clients out, but anything
with database access — a console session, an export, a backup — got refresh
tokens that read people's health data for as long as the grant lasts.

Sealed values are Fernet tokens prefixed with "enc:v1:". Values without the
prefix are legacy plaintext: they are returned as-is so nothing breaks, and
are sealed the next time the document is written.

Keys: API_KEY_ENCRYPTION_KEY seals when set, otherwise HIPAA_ENCRYPTION_KEY,
which production already requires. API_KEY_ENCRYPTION_KEY_PREVIOUS and
HIPAA_ENCRYPTION_KEY stay accepted for unsealing, so either key can be
rotated without stranding stored tokens.
"""

from __future__ import annotations

import logging
import os

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

logger = logging.getLogger(__name__)

PREFIX = 'enc:v1:'


class TokenCryptoError(RuntimeError):
    """A sealed value could not be unsealed with any configured key."""


def _fernets() -> list[Fernet]:
    keys: list[str] = []
    for name in ('API_KEY_ENCRYPTION_KEY', 'HIPAA_ENCRYPTION_KEY', 'API_KEY_ENCRYPTION_KEY_PREVIOUS'):
        value = (os.getenv(name) or '').strip()
        if value and value not in keys:
            keys.append(value)
    fernets = []
    for key in keys:
        try:
            fernets.append(Fernet(key.encode()))
        except (ValueError, TypeError):
            logger.error("Ignoring an encryption key that is not a valid Fernet key")
    return fernets


def seal(value: str | None) -> str | None:
    """Encrypt `value` for storage. None stays None.

    Without any valid key the value is stored as-is, with an error logged:
    refusing would break OAuth sign-in outright, and production cannot start
    without HIPAA_ENCRYPTION_KEY anyway.
    """
    if value is None or value.startswith(PREFIX):
        return value
    fernets = _fernets()
    if not fernets:
        logger.error("No encryption key configured; OAuth token stored unencrypted")
        return value
    return PREFIX + MultiFernet(fernets).encrypt(value.encode()).decode()


def unseal(value: str | None) -> str | None:
    """Decrypt a stored value. Legacy plaintext is returned unchanged."""
    if value is None or not value.startswith(PREFIX):
        return value
    fernets = _fernets()
    if not fernets:
        raise TokenCryptoError("Sealed token found but no encryption key is configured")
    try:
        return MultiFernet(fernets).decrypt(value[len(PREFIX):].encode()).decode()
    except InvalidToken as e:
        raise TokenCryptoError("Sealed token does not decrypt with any configured key") from e


def is_sealed(value: str | None) -> bool:
    return bool(value) and value.startswith(PREFIX)
