"""Per-user ML model/forecast caching.

The cache dict and TTL live on the facade (svc._ml_model_cache /
svc._model_cache_ttl) so tests inspecting or clearing them keep working.
"""

import logging
import time

logger = logging.getLogger(__name__)


class ModelCacheManager:
    """Single responsibility: cache trained ML forecast results per user."""

    def __init__(self, svc):
        self._svc = svc

    @staticmethod
    def _data_hash(mood_history: list[dict]) -> int:
        return hash(str(sorted(
            [entry.get('timestamp', '') + str(entry.get('score', 0)) for entry in mood_history[-20:]]
        )))

    def get_cached_ml_model(self, user_id: str, mood_history: list[dict]) -> dict | None:
        """Get cached ML model if still valid"""
        svc = self._svc
        cache_key = f"ml_forecast_{user_id}"
        cached = svc._ml_model_cache.get(cache_key)

        if cached:
            cache_time, model_data, data_hash = cached
            # Check if cache is still valid (1 hour TTL)
            if time.time() - cache_time < svc._model_cache_ttl:
                # Check if data has changed significantly
                current_data_hash = self._data_hash(mood_history)
                if current_data_hash == data_hash:
                    logger.info(f"✅ Using cached ML model for user {user_id}")
                    return model_data

        return None

    def cache_ml_model(self, user_id: str, model_data: dict, mood_history: list[dict]):
        """Cache trained ML model"""
        svc = self._svc
        cache_key = f"ml_forecast_{user_id}"
        data_hash = self._data_hash(mood_history)
        svc._ml_model_cache[cache_key] = (time.time(), model_data, data_hash)

        # Clean up old cache entries (keep last 50 users)
        if len(svc._ml_model_cache) > 50:
            oldest_key = min(svc._ml_model_cache.keys(), key=lambda k: svc._ml_model_cache[k][0])
            del svc._ml_model_cache[oldest_key]
