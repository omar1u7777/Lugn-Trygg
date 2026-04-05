"""
Proactive Intervention Service - AI-initiated check-ins based on detected patterns.
Reaches out to users before they reach out for help.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

import numpy as np

from ..config.firebase_config import db

try:
    from ..ml.mood_predictor import MoodPrediction, get_mood_predictor
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

logger = logging.getLogger(__name__)


class InterventionType(Enum):
    """Types of proactive interventions."""
    MORNING_CHECK_IN = "morning_check_in"
    GROUNDING_OFFER = "grounding_offer"
    MOOD_PROMPT = "mood_prompt"
    VALUES_REMINDER = "values_reminder"
    CRISIS_PREVENTION = "crisis_prevention"
    CELEBRATION = "celebration"


@dataclass
class Intervention:
    """A proactive intervention to send to a user."""
    user_id: str
    type: InterventionType
    message: str
    action: str
    priority: int  # 1-5, higher = more urgent
    suggested_time: datetime
    expires_at: datetime
    context: dict[str, any]


@dataclass
class AtRiskUser:
    """User identified as needing intervention."""
    user_id: str
    risk_score: float
    risk_factors: list[str]
    last_mood_log: datetime | None
    last_chat: datetime | None
    predicted_mood: float | None
    recommended_intervention: InterventionType


class ProactiveInterventionService:
    """
    Monitors all users for concerning patterns and initiates proactive outreach.
    """

    def __init__(self):
        logger.info("🔔 Initializing Proactive Intervention Service...")

        self.mood_predictor = get_mood_predictor() if ML_AVAILABLE else None
        self.notification_service = None  # Initialized on first use

        # Risk thresholds
        self.risk_thresholds = {
            'declining_trend': -0.1,  # Mood declining by 0.1 per day
            'high_volatility': 0.5,
            'consecutive_negative_days': 3,
            'predicted_low_mood': -0.4,
            'days_since_log': 2,
            'days_since_chat': 7
        }

        logger.info("✅ Proactive Intervention Service initialized")

    async def run_intervention_check(self):
        """
        Main scheduled job - runs every 4 hours.
        Checks all active users for intervention triggers.
        """
        logger.info("🔍 Running proactive intervention check...")

        try:
            # Get all active users
            active_users = await self._get_active_users()

            at_risk_users = []

            for user_id in active_users:
                try:
                    risk_assessment = await self._assess_user_risk(user_id)

                    if risk_assessment and risk_assessment.risk_score > 0.5:
                        at_risk_users.append(risk_assessment)

                except Exception as e:
                    logger.warning(f"Risk assessment failed for {user_id[:8]}...: {e}")
                    continue

            # Sort by risk score
            at_risk_users.sort(key=lambda x: x.risk_score, reverse=True)

            # Generate interventions
            interventions = []
            for user in at_risk_users[:50]:  # Limit to top 50 per run
                intervention = await self._generate_intervention(user)
                if intervention:
                    interventions.append(intervention)

            # Send interventions
            for intervention in interventions:
                await self._send_intervention(intervention)

            logger.info(
                f"✅ Proactive check complete: {len(at_risk_users)} at-risk, "
                f"{len(interventions)} interventions sent"
            )

        except Exception as e:
            logger.exception(f"Proactive intervention check failed: {e}")

    async def _get_active_users(self) -> list[str]:
        """Get list of users active in last 30 days."""
        try:
            cutoff = datetime.now() - timedelta(days=30)

            # Query users with recent activity
            users = db.collection('users')\
                .where('last_active', '>=', cutoff.isoformat())\
                .limit(1000)\
                .get()

            return [u.id for u in users]

        except Exception as e:
            logger.error(f"Failed to get active users: {e}")
            return []

    async def _assess_user_risk(self, user_id: str) -> AtRiskUser | None:
        """
        Assess risk level for a specific user.
        """
        risk_factors = []
        risk_score = 0.0

        try:
            # 1. Check mood data
            mood_data = await self._get_recent_mood(user_id, days=7)

            if len(mood_data) >= 3:
                mood_scores = [m.get('score', 0) for m in mood_data]

                # Check declining trend
                if len(mood_scores) >= 3:
                    trend = (mood_scores[-1] - mood_scores[0]) / len(mood_scores)
                    if trend < self.risk_thresholds['declining_trend']:
                        risk_factors.append('declining_trend')
                        risk_score += 0.3

                # Check volatility
                volatility = np.std(mood_scores) if len(mood_scores) > 1 else 0
                if volatility > self.risk_thresholds['high_volatility']:
                    risk_factors.append('high_volatility')
                    risk_score += 0.2

                # Check consecutive negative days
                negative_streak = 0
                for score in reversed(mood_scores):
                    if score < -0.3:
                        negative_streak += 1
                    else:
                        break

                if negative_streak >= self.risk_thresholds['consecutive_negative_days']:
                    risk_factors.append('consecutive_negative_days')
                    risk_score += 0.3

            # 2. Check ML prediction (if available)
            predicted_mood = None
            if self.mood_predictor:
                try:
                    prediction = self.mood_predictor.predict_next_week(user_id)
                    if prediction:
                        predicted_mood = prediction.predicted_mood

                        if predicted_mood < self.risk_thresholds['predicted_low_mood']:
                            risk_factors.append('predicted_low_mood')
                            risk_score += 0.25

                        # Add prediction-based risk factors
                        for rf in prediction.risk_factors:
                            if rf not in risk_factors:
                                risk_factors.append(rf)
                                risk_score += 0.15

                except Exception as e:
                    logger.warning(f"ML prediction failed for {user_id[:8]}...: {e}")

            # 3. Check engagement
            last_log = mood_data[-1].get('timestamp') if mood_data else None
            last_chat = await self._get_last_chat(user_id)

            if last_log:
                last_log_dt = datetime.fromisoformat(last_log.replace('Z', '+00:00'))
                days_since_log = (datetime.now() - last_log_dt).days

                if days_since_log >= self.risk_thresholds['days_since_log']:
                    risk_factors.append('days_since_log')
                    risk_score += 0.1

            if last_chat:
                days_since_chat = (datetime.now() - last_chat).days
                if days_since_chat >= self.risk_thresholds['days_since_chat']:
                    risk_factors.append('days_since_chat')
                    risk_score += 0.1

            # 4. Determine recommended intervention type
            intervention_type = self._select_intervention_type(
                risk_factors, predicted_mood
            )

            if risk_score > 0.4:
                return AtRiskUser(
                    user_id=user_id,
                    risk_score=min(risk_score, 1.0),
                    risk_factors=risk_factors,
                    last_mood_log=last_log,
                    last_chat=last_chat,
                    predicted_mood=predicted_mood,
                    recommended_intervention=intervention_type
                )

            return None

        except Exception as e:
            logger.error(f"Risk assessment failed for {user_id[:8]}...: {e}")
            return None

    def _select_intervention_type(self, risk_factors: list[str],
                                   predicted_mood: float | None) -> InterventionType:
        """Select appropriate intervention based on risk profile."""

        if 'predicted_low_mood' in risk_factors or predicted_mood and predicted_mood < -0.5:
            return InterventionType.CRISIS_PREVENTION

        if 'consecutive_negative_days' in risk_factors:
            return InterventionType.MOOD_PROMPT

        if 'high_volatility' in risk_factors:
            return InterventionType.GROUNDING_OFFER

        if 'declining_trend' in risk_factors:
            return InterventionType.MORNING_CHECK_IN

        if 'days_since_log' in risk_factors:
            return InterventionType.MOOD_PROMPT

        if predicted_mood and predicted_mood > 0.3:
            return InterventionType.CELEBRATION

        return InterventionType.VALUES_REMINDER

    async def _generate_intervention(self, user: AtRiskUser) -> Intervention | None:
        """Generate specific intervention for at-risk user."""

        # Get user context for personalization
        user_context = await self._get_user_context(user.user_id)

        # Generate message based on intervention type
        messages = {
            InterventionType.MORNING_CHECK_IN: {
                'message': self._generate_morning_message(user, user_context),
                'action': 'open_morning_routine',
                'priority': 3
            },
            InterventionType.GROUNDING_OFFER: {
                'message': self._generate_grounding_message(user, user_context),
                'action': 'start_grounding',
                'priority': 4
            },
            InterventionType.MOOD_PROMPT: {
                'message': self._generate_mood_prompt(user, user_context),
                'action': 'open_mood_logger',
                'priority': 2
            },
            InterventionType.VALUES_REMINDER: {
                'message': self._generate_values_message(user, user_context),
                'action': 'open_values_exercise',
                'priority': 1
            },
            InterventionType.CRISIS_PREVENTION: {
                'message': self._generate_crisis_prevention_message(user, user_context),
                'action': 'open_crisis_support',
                'priority': 5
            },
            InterventionType.CELEBRATION: {
                'message': self._generate_celebration_message(user, user_context),
                'action': 'open_celebration',
                'priority': 1
            }
        }

        intervention_data = messages.get(user.recommended_intervention)

        if not intervention_data:
            return None

        return Intervention(
            user_id=user.user_id,
            type=user.recommended_intervention,
            message=intervention_data['message'],
            action=intervention_data['action'],
            priority=intervention_data['priority'],
            suggested_time=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=24),
            context={
                'risk_factors': user.risk_factors,
                'predicted_mood': user.predicted_mood,
                'user_context': user_context
            }
        )

    def _generate_morning_message(self, user: AtRiskUser, context: dict) -> str:
        """Generate morning check-in message."""
        name = context.get('name', 'du')

        if 'declining_trend' in user.risk_factors:
            return (
                "God morgon! Jag ser att du har haft det tufft. "
                "Vill du göra en snabb check-in och se hur du mår idag? "
                "Små steg framåt räknas."
            )

        return (
            f"God morgon {name}! Dagen börjar med nya möjligheter. "
            f"Vill du logga ditt humör och sätta en liten intention för dagen?"
        )

    def _generate_grounding_message(self, user: AtRiskUser, context: dict) -> str:
        """Generate grounding offer message."""
        if 'high_volatility' in user.risk_factors:
            return (
                "Jag märker att du upplever stora svängningar i humöret. "
                "Det kan vara utmattande. Vill du prova en 2-minuters grounding-övning "
                "för att skapa lite stabilitet?"
            )

        return (
            "Hej! Jag har en känsla av att du kanske behöver lite lugn just nu. "
            "Vill du prova en snabb grounding-teknik?"
        )

    def _generate_mood_prompt(self, user: AtRiskUser, context: dict) -> str:
        """Generate mood logging prompt."""
        if 'consecutive_negative_days' in user.risk_factors:
            return (
                "Det har gått några dagar sedan du loggade ditt humör. "
                "Jag tänker att det kan vara värdefullt att checka in - "
                "oavsett hur du mår. Vill du ta 30 sekunder nu?"
            )

        return (
            "Hej! Det var ett tag sedan du loggade ditt humör. "
            "Vill du göra en snabb check-in? Det hjälper oss att följa dina mönster."
        )

    def _generate_values_message(self, user: AtRiskUser, context: dict) -> str:
        """Generate values reminder message."""
        values = context.get('values', [])

        if values:
            return (
                f"Påminnelse: Du har sagt att {values[0]} är viktigt för dig. "
                f"Hur kan du ta ett litet steg mot detta idag?"
            )

        return (
            "Hej! Ibland kan det hjälpa att påminna sig om vad som verkligen "
            "är viktigt för oss. Vill du göra en kort övning om dina värderingar?"
        )

    def _generate_crisis_prevention_message(self, user: AtRiskUser, context: dict) -> str:
        """Generate crisis prevention message."""
        return (
            "Jag ser att du har haft det svårt, och jag vill nå ut för att du "
            "inte ska känna dig ensam. Det finns strategier som kan hjälpa. "
            "Vill du öppna appen och titta på dina säkerhetsresurser?"
        )

    def _generate_celebration_message(self, user: AtRiskUser, context: dict) -> str:
        """Generate celebration message for positive trends."""
        return (
            "Fantastiskt! Jag ser att du har haft en positiv trend i ditt humör. "
            "Vad tror du har bidragit? Vill du spara detta i din framgångsjournal?"
        )

    async def _send_intervention(self, intervention: Intervention):
        """Send intervention to user via push notification or in-app message."""
        try:
            from ..services.crisis_escalation import get_crisis_escalation_service

            # Get notification service
            escalation_service = get_crisis_escalation_service()

            # Send push notification
            await escalation_service._send_push_notification(
                alert=None,  # Not a crisis alert
                user_data={
                    'fcm_token': await self._get_fcm_token(intervention.user_id)
                },
                title="Lugn & Trygg",
                body=intervention.message,
                data={
                    'type': 'proactive_intervention',
                    'action': intervention.action,
                    'intervention_type': intervention.type.value
                }
            )

            # Log intervention
            db.collection('proactive_interventions').add({
                'user_id': intervention.user_id,
                'type': intervention.type.value,
                'message': intervention.message,
                'action': intervention.action,
                'sent_at': datetime.now().isoformat(),
                'context': intervention.context,
                'responded': False
            })

            logger.info(
                f"📤 Proactive intervention sent to {intervention.user_id[:8]}...: "
                f"{intervention.type.value}"
            )

        except Exception as e:
            logger.error(f"Failed to send intervention: {e}")

    async def _get_recent_mood(self, user_id: str, days: int) -> list[dict]:
        """Fetch recent mood logs."""
        try:
            cutoff = datetime.now() - timedelta(days=days)

            moods = db.collection('users').document(user_id)\
                .collection('moods')\
                .where('timestamp', '>=', cutoff.isoformat())\
                .order_by('timestamp')\
                .get()

            return [m.to_dict() for m in moods]

        except Exception as e:
            logger.warning(f"Failed to fetch mood data: {e}")
            return []

    async def _get_last_chat(self, user_id: str) -> datetime | None:
        """Get timestamp of last chat message."""
        try:
            last_chat = db.collection('users').document(user_id)\
                .collection('conversations')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(1)\
                .get()

            if last_chat:
                timestamp = last_chat[0].to_dict().get('timestamp')
                if timestamp:
                    return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

            return None

        except Exception as e:
            logger.warning(f"Failed to get last chat: {e}")
            return None

    async def _get_user_context(self, user_id: str) -> dict:
        """Get user-specific context for personalization."""
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return {}

            data = user_doc.to_dict()

            return {
                'name': data.get('display_name', 'du'),
                'values': data.get('values', []),
                'goals': data.get('goals', []),
                'effective_techniques': data.get('effective_techniques', [])
            }

        except Exception as e:
            logger.warning(f"Failed to get user context: {e}")
            return {}

    async def _get_fcm_token(self, user_id: str) -> str | None:
        """Get FCM token for push notifications."""
        try:
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                return user_doc.to_dict().get('fcm_token')
            return None
        except Exception:
            return None


# Singleton
_proactive_service: ProactiveInterventionService | None = None


def get_proactive_intervention_service() -> ProactiveInterventionService:
    """Get or create proactive intervention service."""
    global _proactive_service
    if _proactive_service is None:
        _proactive_service = ProactiveInterventionService()
    return _proactive_service
