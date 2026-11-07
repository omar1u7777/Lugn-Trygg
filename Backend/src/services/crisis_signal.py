"""Crisis escalation from what a person writes about how they are.

Mood logs and memories both carry such text. The same words get the same
response wherever they are written, so both go through
escalate_if_in_crisis: a risk assessment and, at high or critical risk, a
crisis alert record plus the durable escalation queue that reaches a human
(the path chat and WebSocket crises use too).
"""

import logging
from datetime import UTC, datetime

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.utils.log_ref import log_ref

logger = logging.getLogger(__name__)

# Words that send text to a risk assessment whatever the mood score.
CRISIS_KEYWORDS = (
    'självmord', 'suicid', 'döda mig', 'döda', 'självskada',
    'hopplos', 'hopplös', 'vill inte leva', 'ta mitt liv',
    'hatar mig själv', 'värdelös', 'börda', 'får bättre utan mig', 'far bättre utan mig',
)
# A mood score (1-10) at or below this is assessed even without keywords.
LOW_MOOD_SCORE = 3


def has_crisis_keywords(text: str) -> bool:
    lowered = (text or '').lower()
    return any(keyword in lowered for keyword in CRISIS_KEYWORDS)


def escalate_if_in_crisis(user_id: str, text: str, source: str, mood_score: float | None = None) -> str | None:
    """Assess `text` and `mood_score`; at high or critical risk, escalate.

    `source` names where the text was written ('mood_log', 'memory') on the
    alert record. Returns the risk level when an escalation was made, else
    None. Never raises: the caller's own write has already happened.
    """
    try:
        keywords = has_crisis_keywords(text)
        low_mood = mood_score is not None and mood_score <= LOW_MOOD_SCORE
        if not (keywords or low_mood):
            return None

        # Looked up at call time, so tests can replace them on their modules.
        from src.services import crisis_intervention

        assessment = crisis_intervention.crisis_intervention_service.assess_crisis_risk({
            'user_id': user_id,
            'mood_history': [{'sentiment_score': mood_score}] if mood_score is not None else [],
            'recent_text_content': text if keywords else '',
            'consecutive_low_mood_days': 0,
            'mood_score_drop_last_week': 0,
        })
        if assessment.overall_risk_level not in ('critical', 'high'):
            return None

        logger.warning(
            "🚨 CRISIS DETECTED via %s: %s risk=%s score=%.2f",
            source, log_ref(user_id), assessment.overall_risk_level, assessment.risk_score,
        )
        snippet = text[:200] if text else ''
        _record_alert(user_id, source, assessment, snippet, mood_score)
        _enqueue(user_id, source, assessment, snippet)
        return assessment.overall_risk_level
    except Exception:
        logger.exception("Crisis detection failed for a %s (non-blocking)", source)
        return None


def _record_alert(user_id, source, assessment, snippet, mood_score) -> None:
    """The crisis_alerts record for care-team review and ML feature counts.

    Not the escalation itself, so a failed write must not stop the queue.
    """
    try:
        db.collection('crisis_alerts').add({
            'user_id': user_id,
            'risk_level': assessment.overall_risk_level,
            'risk_score': assessment.risk_score,
            'source': source,
            'mood_score': mood_score,
            'text_snippet': snippet,
            'created_at': datetime.now(UTC).isoformat(),
            'resolved': False,
        })
        audit_log('CRISIS_DETECTED', user_id, {
            'source': source,
            'risk_level': assessment.overall_risk_level,
            'risk_score': assessment.risk_score,
        })
    except Exception:
        logger.exception("Could not record the crisis alert for a %s", source)


def _enqueue(user_id, source, assessment, snippet) -> None:
    """Queue the escalation that reaches a human (SMS, contacts, push)."""
    from src.services import crisis_task_queue
    from src.services.crisis_escalation import CrisisAlert

    alert = CrisisAlert(
        user_id=user_id,
        risk_level=assessment.overall_risk_level,
        risk_score=assessment.risk_score,
        detected_indicators=[ind.swedish_description for ind in assessment.active_indicators],
        text_snippet=snippet,
        timestamp=datetime.now(UTC),
        requires_immediate_action=assessment.overall_risk_level == 'critical',
    )
    try:
        crisis_task_queue.enqueue_crisis_escalation(alert)
    except crisis_task_queue.CrisisQueueUnavailableError:
        logger.critical(
            "🚨 Crisis escalation from a %s could not be queued for %s. REQUIRES MANUAL REVIEW.",
            source, log_ref(user_id),
        )
