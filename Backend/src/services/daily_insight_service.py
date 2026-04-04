"""
Daily Insight Generator - The Proactive Loop Closer
Analyzes multimodal memory patterns to generate personalized therapeutic insights.
Runs daily to detect contrasts, trends, and opportunities for intervention.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

from src.firebase_config import db
from src.services.audit_service import audit_log

logger = logging.getLogger(__name__)


class InsightType(Enum):
    """Types of insights that can be generated."""
    CONTRAST_DETECTED = "contrast"  # Mismatch between modalities
    POSITIVE_PATTERN = "positive_pattern"  # Successful coping detected
    DECLINE_PATTERN = "decline"  # Negative trend detected
    OPPORTUNITY = "opportunity"  # Chance to repeat positive behavior
    MILESTONE = "milestone"  # Achievements worth celebrating
    CHECKIN_NEEDED = "checkin"  # Proactive support needed


@dataclass
class MemoryPattern:
    """Detected pattern in user's memory data."""
    pattern_type: str  # 'calm_photos', 'stress_text', 'social_connection', etc.
    confidence: float
    evidence: list[dict]  # Memory IDs and supporting data
    trend_direction: str  # 'improving', 'declining', 'stable'


@dataclass
class TherapeuticInsight:
    """Generated insight for user support."""
    insight_id: str
    user_id: str
    insight_type: InsightType
    title: str  # Short, engaging title
    message: str  # Personalized message
    recommendation: str  # Specific action suggestion
    evidence: dict  # Data supporting this insight
    urgency: str  # 'low', 'medium', 'high'
    suggested_action: str | None = None
    related_memories: list[str] | None = None
    created_at: datetime | None = None


class DailyInsightGenerator:
    """
    Generates daily therapeutic insights from multimodal memory analysis.
    
    Key capabilities:
    - Detects modality contrasts (e.g., calm photos + stressed text)
    - Identifies positive coping patterns
    - Spots decline patterns early
    - Suggests opportunities to repeat successful behaviors
    """

    # Swedish insight templates
    INSIGHT_TEMPLATES = {
        'contrast_calm_stress': {
            'title': 'Märker du skillnaden?',
            'message': (
                'Vi ser att dina bilder från {location} visade lugn och ro, '
                'men dina ord idag uttrycker stress. Det är vanligt att kroppen '
                'och tanken känns olika - vill du utforska detta?'
            ),
            'action': 'Försök en kort andningsövning eller gå en promenad'
        },
        'positive_nature_pattern': {
            'title': 'Naturens kraft märks!',
            'message': (
                'Dina bilder från skogspromenader har visat ett tydligt mönster: '
                'du känner dig mer {emotion} efter tid i naturen. '
                'Kanske dags för en ny runda?'
            ),
            'action': 'Planera 20 minuter utomhus idag'
        },
        'social_connection_boost': {
            'title': 'Vänner ger energi',
            'message': (
                'Vi noterar att minnen med {people} ofta har högre '
                'positivt sentiment. Social kontakt verkar vara viktigt för dig!'
            ),
            'action': 'Skicka ett meddelande till någon du tycker om'
        },
        'stress_trend_detected': {
            'title': 'Vi ser att du har det tufft',
            'message': (
                'Dina senaste inlägg visar ett mönster av ökad stress. '
                'Det är modigt att dela med sig. Finns det något vi kan hjälpa med?'
            ),
            'action': 'Öppna appen och prova en guidad övning'
        },
        'mood_improvement': {
            'title': 'Framsteg!',
            'message': (
                'Dina minnen från senaste veckan visar en fin förbättring '
                'jämfört med föregående vecka. Du är på rätt väg!'
            ),
            'action': 'Fira med något litet som gör dig glad'
        },
        'creative_outlet': {
            'title': 'Kreativitet ger kraft',
            'message': (
                'Bilder från dina kreativa aktiviteter (matlagning, konst, etc.) '
                'knyter an till positiva känslor. Kanske dags att skapa igen?'
            ),
            'action': 'Gör något kreativt i 15 minuter'
        }
    }

    def __init__(self):
        self.min_memories_for_analysis = 3
        self.analysis_window_days = 7

    def generate_daily_insights(self, user_id: str) -> list[TherapeuticInsight]:
        """
        Generate personalized insights for a user based on recent memories.
        
        Args:
            user_id: User to analyze
        
        Returns:
            List of therapeutic insights sorted by priority
        """
        insights = []

        try:
            # 1. Fetch recent memories
            memories = self._fetch_recent_memories(user_id, days=self.analysis_window_days)

            if len(memories) < self.min_memories_for_analysis:
                logger.info(f"Not enough memories for {user_id} (need {self.min_memories_for_analysis})")
                return insights

            # 2. Detect patterns
            patterns = self._detect_patterns(memories)

            # 3. Generate insights from patterns
            for pattern in patterns:
                insight = self._pattern_to_insight(pattern, user_id, memories)
                if insight:
                    insights.append(insight)

            # 4. Check for contrasts
            contrast_insight = self._detect_modality_contrasts(memories, user_id)
            if contrast_insight:
                insights.append(contrast_insight)

            # 5. Check for trends
            trend_insight = self._analyze_trends(memories, user_id)
            if trend_insight:
                insights.append(trend_insight)

            # 6. Save insights to Firestore
            for insight in insights:
                self._save_insight(insight)

            # 7. Audit log
            audit_log(
                event_type="DAILY_INSIGHTS_GENERATED",
                user_id=user_id,
                details={
                    "insight_count": len(insights),
                    "memory_count": len(memories),
                    "patterns_detected": [p.pattern_type for p in patterns]
                }
            )

            logger.info(f"Generated {len(insights)} insights for {user_id}")

        except Exception as e:
            logger.error(f"Failed to generate insights for {user_id}: {e}")

        # Sort by urgency
        urgency_order = {'high': 0, 'medium': 1, 'low': 2}
        insights.sort(key=lambda i: urgency_order.get(i.urgency, 3))

        return insights[:3]  # Return top 3

    def _fetch_recent_memories(self, user_id: str, days: int = 7) -> list[dict]:
        """Fetch user's recent multimodal memories."""
        try:
            from google.cloud.firestore import FieldFilter

            cutoff_date = datetime.now() - timedelta(days=days)

            memories_query = db.collection('memories').where(
                filter=FieldFilter('user_id', '==', user_id)
            ).where(
                filter=FieldFilter('created_at', '>=', cutoff_date)
            ).order_by('created_at', direction='DESCENDING')

            memories = []
            for doc in memories_query.stream():
                data = doc.to_dict()
                data['id'] = doc.id
                memories.append(data)

            return memories

        except Exception as e:
            logger.error(f"Failed to fetch memories: {e}")
            return []

    def _detect_patterns(self, memories: list[dict]) -> list[MemoryPattern]:
        """Detect meaningful patterns in memory data."""
        patterns = []

        # Pattern 1: Nature/calm photo correlation
        nature_memories = [m for m in memories
                        if m.get('ai_analysis', {}).get('photo_analysis', {}).get('scene') in
                        ['nature', 'outdoor', 'park', 'forest']]

        if len(nature_memories) >= 2:
            calm_count = sum(1 for m in nature_memories
                           if m.get('ai_analysis', {}).get('photo_analysis', {}).get('emotion') == 'calm')

            if calm_count / len(nature_memories) > 0.6:
                patterns.append(MemoryPattern(
                    pattern_type='nature_calm_correlation',
                    confidence=calm_count / len(nature_memories),
                    evidence=nature_memories,
                    trend_direction='stable'
                ))

        # Pattern 2: Social connection boost
        social_memories = [m for m in memories
                         if m.get('ai_analysis', {}).get('photo_analysis', {}).get('has_faces', False)]

        if len(social_memories) >= 2:
            positive_count = sum(1 for m in social_memories
                               if m.get('ai_analysis', {}).get('sentiment_score', 0) > 0.3)

            if positive_count / len(social_memories) > 0.7:
                patterns.append(MemoryPattern(
                    pattern_type='social_positive_correlation',
                    confidence=positive_count / len(social_memories),
                    evidence=social_memories,
                    trend_direction='improving'
                ))

        # Pattern 3: Creative activities
        creative_keywords = ['mat', 'matlagning', 'konst', 'måla', 'skapa', 'creative']
        creative_memories = [m for m in memories
                           if any(kw in m.get('content', '').lower() for kw in creative_keywords)]

        if len(creative_memories) >= 2:
            patterns.append(MemoryPattern(
                pattern_type='creative_positive_pattern',
                confidence=0.7,
                evidence=creative_memories,
                trend_direction='stable'
            ))

        return patterns

    def _pattern_to_insight(self, pattern: MemoryPattern, user_id: str,
                          memories: list[dict]) -> TherapeuticInsight | None:
        """Convert detected pattern to therapeutic insight."""

        template_key = None

        if pattern.pattern_type == 'nature_calm_correlation':
            template_key = 'positive_nature_pattern'
        elif pattern.pattern_type == 'social_positive_correlation':
            template_key = 'social_connection_boost'
        elif pattern.pattern_type == 'creative_positive_pattern':
            template_key = 'creative_outlet'

        if not template_key or template_key not in self.INSIGHT_TEMPLATES:
            return None

        template = self.INSIGHT_TEMPLATES[template_key]

        # Personalize message
        recent_memory = pattern.evidence[0] if pattern.evidence else memories[0]
        location = recent_memory.get('location', 'ditt favoritställe')
        emotion = recent_memory.get('ai_analysis', {}).get('photo_analysis', {}).get('emotion', 'lugn')

        message = template['message'].format(
            location=location,
            emotion=emotion,
            people='dina nära'
        )

        return TherapeuticInsight(
            insight_id=f"{user_id}_{datetime.now().strftime('%Y%m%d')}_{template_key}",
            user_id=user_id,
            insight_type=InsightType.POSITIVE_PATTERN,
            title=template['title'],
            message=message,
            recommendation=template['action'],
            evidence={
                'pattern_type': pattern.pattern_type,
                'confidence': pattern.confidence,
                'evidence_count': len(pattern.evidence)
            },
            urgency='low',
            suggested_action=template['action'],
            related_memories=[m.get('id') for m in pattern.evidence[:3]],
            created_at=datetime.now()
        )

    def _detect_modality_contrasts(self, memories: list[dict], user_id: str) -> TherapeuticInsight | None:
        """Detect when modalities show contrasting emotions."""

        if not memories:
            return None

        # Check most recent memory
        recent = memories[0]

        photo_emotion = recent.get('ai_analysis', {}).get('photo_analysis', {}).get('emotion', 'neutral')
        text_emotion = recent.get('ai_analysis', {}).get('primary_emotion', 'neutral')
        text_sentiment = recent.get('ai_analysis', {}).get('sentiment_score', 0)

        # Contrast: Calm photo + Stressed text
        calm_photos = ['calm', 'peace', 'joy']
        stressed_texts = ['stress', 'anxiety', 'sadness', 'anger']

        photo_calm = any(e in photo_emotion.lower() for e in calm_photos)
        text_stressed = any(e in text_emotion.lower() for e in stressed_texts) or text_sentiment < -0.2

        if photo_calm and text_stressed:
            template = self.INSIGHT_TEMPLATES['contrast_calm_stress']
            location = recent.get('location', 'naturen')

            return TherapeuticInsight(
                insight_id=f"{user_id}_{datetime.now().strftime('%Y%m%d')}_contrast",
                user_id=user_id,
                insight_type=InsightType.CONTRAST_DETECTED,
                title=template['title'],
                message=template['message'].format(location=location),
                recommendation=template['action'],
                evidence={
                    'photo_emotion': photo_emotion,
                    'text_emotion': text_emotion,
                    'contrast_type': 'calm_vs_stress'
                },
                urgency='medium',
                suggested_action=template['action'],
                related_memories=[recent.get('id')],
                created_at=datetime.now()
            )

        return None

    def _analyze_trends(self, memories: list[dict], user_id: str) -> TherapeuticInsight | None:
        """Analyze trends across memory history."""

        if len(memories) < 5:
            return None

        # Split into two halves
        mid = len(memories) // 2
        recent = memories[:mid]
        older = memories[mid:]

        # Calculate average sentiment
        recent_sentiment = sum(m.get('ai_analysis', {}).get('sentiment_score', 0) for m in recent) / len(recent)
        older_sentiment = sum(m.get('ai_analysis', {}).get('sentiment_score', 0) for m in older) / len(older)

        # Detect improvement
        if recent_sentiment > older_sentiment + 0.3:
            template = self.INSIGHT_TEMPLATES['mood_improvement']

            return TherapeuticInsight(
                insight_id=f"{user_id}_{datetime.now().strftime('%Y%m%d')}_trend",
                user_id=user_id,
                insight_type=InsightType.MILESTONE,
                title=template['title'],
                message=template['message'],
                recommendation=template['action'],
                evidence={
                    'trend': 'improving',
                    'recent_sentiment': recent_sentiment,
                    'older_sentiment': older_sentiment,
                    'improvement': recent_sentiment - older_sentiment
                },
                urgency='low',
                suggested_action=template['action'],
                related_memories=[m.get('id') for m in recent[:3]],
                created_at=datetime.now()
            )

        # Detect decline
        if recent_sentiment < older_sentiment - 0.3:
            template = self.INSIGHT_TEMPLATES['stress_trend_detected']

            return TherapeuticInsight(
                insight_id=f"{user_id}_{datetime.now().strftime('%Y%m%d')}_decline",
                user_id=user_id,
                insight_type=InsightType.DECLINE_PATTERN,
                title=template['title'],
                message=template['message'],
                recommendation=template['action'],
                evidence={
                    'trend': 'declining',
                    'recent_sentiment': recent_sentiment,
                    'older_sentiment': older_sentiment,
                    'decline': older_sentiment - recent_sentiment
                },
                urgency='high',
                suggested_action=template['action'],
                related_memories=[m.get('id') for m in recent[:3]],
                created_at=datetime.now()
            )

        return None

    def _save_insight(self, insight: TherapeuticInsight):
        """Save generated insight to Firestore."""
        try:
            doc_data = {
                'insight_id': insight.insight_id,
                'user_id': insight.user_id,
                'insight_type': insight.insight_type.value,
                'title': insight.title,
                'message': insight.message,
                'recommendation': insight.recommendation,
                'evidence': insight.evidence,
                'urgency': insight.urgency,
                'suggested_action': insight.suggested_action,
                'related_memories': insight.related_memories,
                'created_at': insight.created_at or datetime.now(),
                'status': 'pending',  # pending, sent, dismissed
                'notification_sent': False
            }

            db.collection('insights').document(insight.insight_id).set(doc_data)

        except Exception as e:
            logger.error(f"Failed to save insight: {e}")

    def get_pending_insights(self, user_id: str) -> list[dict]:
        """Get pending insights for a user."""
        try:
            from google.cloud.firestore import FieldFilter

            insights_query = db.collection('insights').where(
                filter=FieldFilter('user_id', '==', user_id)
            ).where(
                filter=FieldFilter('status', '==', 'pending')
            ).order_by('created_at', direction='DESCENDING')

            return [doc.to_dict() for doc in insights_query.stream()]

        except Exception as e:
            logger.error(f"Failed to fetch pending insights: {e}")
            return []

    def mark_insight_sent(self, insight_id: str):
        """Mark insight as notification sent."""
        try:
            db.collection('insights').document(insight_id).update({
                'status': 'sent',
                'notification_sent': True,
                'sent_at': datetime.now()
            })
        except Exception as e:
            logger.error(f"Failed to mark insight sent: {e}")


# Global instance
_insight_generator: DailyInsightGenerator | None = None


def get_insight_generator() -> DailyInsightGenerator:
    """Get singleton instance of insight generator."""
    global _insight_generator
    if _insight_generator is None:
        _insight_generator = DailyInsightGenerator()
    return _insight_generator


def generate_daily_insights(user_id: str) -> list[TherapeuticInsight]:
    """
    Convenience function for generating daily insights.
    
    Example usage:
        insights = generate_daily_insights('user_123')
        for insight in insights:
            logger.info("%s: %s", insight.title, insight.message)
    """
    generator = get_insight_generator()
    return generator.generate_daily_insights(user_id)
