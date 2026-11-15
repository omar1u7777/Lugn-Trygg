"""Sentiment analysis of a mood entry's text, after the entry is saved.

POST /mood/log used to wait for one model call, about 1.5 s, before it
answered. Nothing in the answer needs it, so the route saves the entry with
the sentiment its score gives it and hands the text to this module. The
analysis is written onto the saved entry when it is done.

This is enrichment, not safety: the crisis check reads the score and the text
in the request and does not pass through here. If the process dies before an
analysis finishes, the entry keeps what it was saved with, which is what an
entry without a note has always had.

The work runs on a small pool owned by the worker process. Pool threads are
joined at interpreter exit, so a graceful worker recycle lets running analyses
finish. The number waiting is capped: past the cap a new analysis is skipped,
not queued, so a slow model cannot grow a backlog in a 512 MB worker.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

POOL_THREADS = 2
MAX_WAITING = 50

_pool: ThreadPoolExecutor | None = None
_pool_lock = threading.Lock()
_waiting = 0


def _get_db():
    from src.firebase_config import db
    return db


def _invalidate_caches(user_id: str) -> None:
    """Drop what was cached before the analysis was written."""
    from src.routes.mood_routes import invalidate_mood_cache
    from src.utils.context_cache import invalidate_user_context

    invalidate_mood_cache(user_id)
    invalidate_user_context(user_id)


def analyse_saved_mood(user_id: str, mood_id: str, text: str) -> None:
    """Analyse `text` and write the result onto the saved mood entry.

    Never raises: there is nobody to raise to. The user's own score is not
    touched.
    """
    try:
        from src.services.ai_service import ai_services

        analysis = ai_services.analyze_sentiment(text)
        if not isinstance(analysis, dict):
            return

        entry = _get_db().collection('users').document(user_id).collection('moods').document(mood_id)
        snapshot = entry.get()
        if not snapshot.exists:
            return  # deleted while the analysis ran
        if (snapshot.to_dict() or {}).get('sentiment_analysis'):
            return  # edited and analysed again while this one ran

        entry.update({
            'sentiment': analysis.get('sentiment', 'NEUTRAL'),
            'sentiment_score': analysis.get('score', 0),
            'emotions_detected': analysis.get('emotions', []),
            'sentiment_analysis': analysis,
            'ai_analysis': analysis,
        })
        _invalidate_caches(user_id)
    except Exception as error:
        logger.warning("Mood sentiment analysis after save failed: %s", type(error).__name__)


def _run(user_id: str, mood_id: str, text: str) -> None:
    global _waiting
    try:
        analyse_saved_mood(user_id, mood_id, text)
    finally:
        with _pool_lock:
            _waiting -= 1


def schedule_sentiment_analysis(user_id: str, mood_id: str, text: str) -> bool:
    """Queue the analysis of a saved entry. False if it was skipped."""
    global _pool, _waiting
    with _pool_lock:
        if _waiting >= MAX_WAITING:
            logger.warning("Mood sentiment analysis skipped: %d already waiting", _waiting)
            return False
        if _pool is None:
            _pool = ThreadPoolExecutor(max_workers=POOL_THREADS, thread_name_prefix='mood-sentiment')
        _waiting += 1
    try:
        _pool.submit(_run, user_id, mood_id, text)
    except RuntimeError:  # interpreter shutting down
        with _pool_lock:
            _waiting -= 1
        return False
    return True
