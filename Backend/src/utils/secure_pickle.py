"""HMAC-verified pickle load/dump (OWASP A08:2021 — insecure deserialization).

Why
---
``pickle.loads`` executes arbitrary code during deserialization. Anything that
can write to a model directory — a mounted volume, a shared cache path, a
compromised artifact bucket, a build step that fetches models — therefore gets
remote code execution in the app process, which holds Firestore credentials.

``MLSentimentService`` already defended against this with an HMAC-SHA256
signature appended to the file, but the mitigation lived inside that one class,
so ``MoodPredictor`` (which unpickles a RandomForest and a StandardScaler from
``MODEL_PATH``) had no protection at all. This module is that defence extracted
so every pickle consumer can share it rather than each re-implementing it.

Format
------
``<pickle payload bytes><32-byte HMAC-SHA256 of payload>``

Key
---
Derived from ``ENCRYPTION_KEY``. When that is unset a random per-process key is
generated, which means on-disk caches deliberately fail verification and get
rebuilt — a loud, safe default rather than a silent one.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import pickle  # noqa: S403 — every load here is HMAC-verified first
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SIGNATURE_BYTES = 32


class PickleIntegrityError(Exception):
    """Raised when a pickle file's signature is missing or does not match."""


_cached_key: bytes | None = None


def _hmac_key() -> bytes:
    """Derive the signing key from ENCRYPTION_KEY, warning loudly if absent."""
    global _cached_key
    if _cached_key is not None:
        return _cached_key

    raw = os.getenv("ENCRYPTION_KEY", "")
    if not raw:
        logger.warning(
            "ENCRYPTION_KEY is not set — signed-pickle verification will use an "
            "ephemeral random key, so any cached model on disk fails integrity "
            "verification and is rebuilt on every restart. Set ENCRYPTION_KEY in "
            "production."
        )
        _cached_key = os.urandom(32)
    else:
        _cached_key = raw.encode()
    return _cached_key


def reset_key_cache() -> None:
    """Drop the memoised key so tests can patch ENCRYPTION_KEY between cases."""
    global _cached_key
    _cached_key = None


def sign_bytes(payload: bytes) -> bytes:
    """Return ``payload`` with its HMAC-SHA256 signature appended."""
    return payload + hmac.new(_hmac_key(), payload, hashlib.sha256).digest()


def dump_signed(obj: Any, path: str | Path) -> None:
    """Pickle ``obj`` to ``path`` with a trailing HMAC signature."""
    payload = pickle.dumps(obj)
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(sign_bytes(payload))


def load_verified(path: str | Path) -> Any:
    """Load a signed pickle, verifying the signature BEFORE deserializing.

    Raises:
        PickleIntegrityError: file too small to carry a signature, or the
            signature does not match. The payload is never passed to
            ``pickle.loads`` in either case.
    """
    raw = Path(path).read_bytes()
    if len(raw) <= SIGNATURE_BYTES:
        raise PickleIntegrityError(f"{path}: too small to contain a signature")

    payload, stored_sig = raw[:-SIGNATURE_BYTES], raw[-SIGNATURE_BYTES:]
    expected_sig = hmac.new(_hmac_key(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(stored_sig, expected_sig):
        raise PickleIntegrityError(f"{path}: HMAC signature mismatch")

    return pickle.loads(payload)  # noqa: S301 — signature verified above
