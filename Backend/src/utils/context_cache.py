"""Redis-backed per-user context cache for the AI chat pipeline.

The therapeutic chat prompt is assembled from several per-user Firestore reads
(profile + up to 10 clinical assessments, recent journal entries, active goals,
session summaries, recent moods). At ~60-260 sequential reads per message with
zero cross-request caching, this dominated chat latency and Firestore cost.

These blocks change slowly relative to a chat turn, so we cache the COMPUTED
string per user with a short TTL. Contract:

- Cache miss / Redis down / any cache error -> compute directly and continue.
  The cache can never break or delay the feature it accelerates.
- While Redis is confirmed down, a cooldown skips reconnect attempts entirely
  (get_redis_client() would otherwise retry a 5s-timeout connect+ping on
  EVERY call — turning "fail open" into "fail slow" for the whole outage).
- Degradation is reported on every NEW outage transition (not just once ever),
  so a mid-session Redis failure is visible, not just a cold-start miss.
- Cached values are ENCRYPTED at rest in Redis (clinical assessment scores,
  suicidal-ideation indicators and verbatim journal/profile text would
  otherwise sit in shared Redis in plaintext). Uses the same HIPAA_ENCRYPTION_KEY
  Fernet key as the audit service; if unset, caching is skipped entirely rather
  than storing clinical data in plaintext.
- Never caches falsy/empty results: the wrapped compute functions return ""
  both for "no data" and for "read failed" (they swallow their own Firestore
  exceptions), so the cache cannot tell those apart. Caching "" would pin a
  transient Firestore blip as a real empty profile for the full TTL.
"""

import logging
import time

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)

# 5 minutes: long enough to collapse the burst of reads within a chat session,
# short enough that a new assessment/journal entry shows up promptly.
DEFAULT_TTL_SECONDS = 300
_KEY_PREFIX = "ctx"

# Cooldown window after a detected Redis failure: skip get_redis_client()
# entirely (which would otherwise attempt a fresh 5s-timeout connect+ping on
# every call) until this expires.
_REDIS_COOLDOWN_SECONDS = 30
_redis_unavailable_until = 0.0
_last_degraded_report = 0.0

_cipher = None
_cipher_checked = False


def _get_cipher():
    """Lazily build the Fernet cipher from HIPAA_ENCRYPTION_KEY.

    Returns None (encryption unavailable) if the key is unset or invalid —
    callers must then SKIP caching rather than store plaintext clinical data.
    """
    global _cipher, _cipher_checked
    if _cipher_checked:
        return _cipher
    _cipher_checked = True
    try:
        import os

        from cryptography.fernet import Fernet
        key = os.getenv("HIPAA_ENCRYPTION_KEY")
        if not key:
            return None
        _cipher = Fernet(key.encode())
    except Exception:
        _cipher = None
    return _cipher


def _get_redis():
    """Return a live Redis client, or None while in the failure cooldown."""
    now = time.time()
    if now < _redis_unavailable_until:
        return None
    try:
        from src.redis_config import get_redis_client
        client = get_redis_client()
        if client is None:
            _mark_unavailable()
        return client
    except Exception:
        _mark_unavailable()
        return None


def _mark_unavailable() -> None:
    """Start (or extend) the cooldown and report degradation, rate-limited to
    once per cooldown window so a sustained outage doesn't spam telemetry."""
    global _redis_unavailable_until, _last_degraded_report
    now = time.time()
    _redis_unavailable_until = now + _REDIS_COOLDOWN_SECONDS
    if now - _last_degraded_report > _REDIS_COOLDOWN_SECONDS:
        _last_degraded_report = now
        telemetry.degraded(
            feature="ai_chat_context_cache",
            reason="redis_unavailable",
            consequence="per-user context recomputed from Firestore every message",
        )


def cached_user_context(namespace: str, user_id: str, compute, ttl: int = DEFAULT_TTL_SECONDS) -> str:
    """Return `compute()` for this user, served from Redis when warm.

    Args:
        namespace: logical block name (e.g. "profile", "cross_source").
        user_id:   cache partition key.
        compute:   zero-arg callable returning the (string) block to cache.
        ttl:       seconds to keep the cached value.
    """
    if not user_id:
        return compute()

    redis_client = _get_redis()
    cipher = _get_cipher() if redis_client is not None else None

    key = f"{_KEY_PREFIX}:{namespace}:{user_id}"

    # Read-through
    if redis_client is not None:
        try:
            cached = redis_client.get(key)
            if cached is not None:
                raw = cached.decode("utf-8") if isinstance(cached, (bytes, bytearray)) else str(cached)
                if cipher is not None:
                    try:
                        return cipher.decrypt(raw.encode()).decode("utf-8")
                    except Exception:
                        # Undecryptable (key rotated, corrupt entry) — treat as
                        # a miss rather than surfacing garbage as clinical context.
                        pass
                else:
                    return raw
        except Exception as read_err:
            logger.debug("Context cache read failed (%s); computing directly: %s", key, read_err)
            _mark_unavailable()
            redis_client = None

    # Miss -> compute
    value = compute()

    # Never cache empty/falsy results: the compute functions return "" for
    # BOTH "genuinely no data" and "Firestore read failed" (they swallow their
    # own exceptions) — caching "" risks pinning a transient failure as a real
    # empty profile for the whole TTL. Only non-empty strings are cached, and
    # only when we can encrypt them (or explicitly accept plaintext is unsafe
    # for this data class, so we skip caching instead).
    if redis_client is not None and isinstance(value, str) and value:
        try:
            if cipher is not None:
                redis_client.setex(key, ttl, cipher.encrypt(value.encode()).decode("utf-8"))
            # else: no HIPAA_ENCRYPTION_KEY configured -> do not cache this
            # data class in plaintext. The feature still works, just uncached.
        except Exception as write_err:
            logger.debug("Context cache write failed (%s): %s", key, write_err)
            _mark_unavailable()

    return value


def invalidate_user_context(user_id: str) -> None:
    """Drop all cached context blocks for a user (call on writes that change
    profile/journal/goals/assessments so stale context can't linger a full TTL).
    """
    if not user_id:
        return
    redis_client = _get_redis()
    if redis_client is None:
        return
    try:
        keys = list(redis_client.scan_iter(match=f"{_KEY_PREFIX}:*:{user_id}"))
        if keys:
            redis_client.delete(*keys)
    except Exception as inval_err:
        logger.debug("Context cache invalidation failed for %s: %s", user_id, inval_err)
