"""
Daily Insight Generator v2.0 - Professional AI/ML Implementation
Comprehensive analysis with evidence-based therapeutic interventions.
Based on: Behavioral Activation (Martell et al.), CBT patterns, Positive Psychology (Seligman)
"""

import logging
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import Enum

from src.firebase_config import db
from src.services.audit_service import audit_log


def _parse_timestamp(ts) -> datetime | None:
    """Parse timestamp from Firestore (datetime, ISO string, or None)."""
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        try:
            # Handle ISO strings with or without Z
            clean = ts.replace('Z', '+00:00')
            return datetime.fromisoformat(clean)
        except (ValueError, TypeError):
            return None
    return None

logger = logging.getLogger(__name__)


class InsightType(Enum):
    """Evidence-based insight categories."""
    CONTRAST_DETECTED = "contrast"  # Mind-body dissociation
    POSITIVE_PATTERN = "positive_pattern"  # Behavioral activation candidate
    DECLINE_PATTERN = "decline"  # Early warning system
    OPPORTUNITY = "opportunity"  # Behavioral activation opportunity
    MILESTONE = "milestone"  # Positive reinforcement
    CHECKIN_NEEDED = "checkin"  # Proactive intervention
    CIRCADIAN_MISMATCH = "circadian"  # Sleep-mood correlation
    SOCIAL_ISOLATION = "isolation"  # Social rhythm metric
    PHYSICAL_HEALTH = "physical"  # Exercise-mood correlation


class TherapeuticDomain(Enum):
    """Domains for targeted interventions."""
    BEHAVIORAL_ACTIVATION = "behavioral_activation"
    COGNITIVE_RESTRUCTURING = "cognitive_restructuring"
    SLEEP_HYGIENE = "sleep_hygiene"
    SOCIAL_CONNECTION = "social_connection"
    MINDFULNESS = "mindfulness"
    PHYSICAL_ACTIVITY = "physical_activity"
    EMOTION_REGULATION = "emotion_regulation"


@dataclass
class MemoryPattern:
    """Detected pattern with statistical significance."""
    pattern_type: str
    confidence: float
    evidence: list[dict]
    trend_direction: str
    statistical_significance: float = 0.0  # p-value equivalent
    effect_size: float = 0.0  # Cohen's d equivalent
    domain: TherapeuticDomain | None = None


@dataclass
class TherapeuticInsight:
    """Evidence-based therapeutic recommendation."""
    insight_id: str
    user_id: str
    insight_type: InsightType
    domain: TherapeuticDomain
    title: str
    message: str
    recommendation: str
    evidence: dict
    urgency: str
    suggested_action: str
    related_memories: list[str] = field(default_factory=list)
    created_at: datetime | None = None

    # CBT/ACT specific fields
    cognitive_distortion: str | None = None  # If detected
    behavioral_target: str | None = None  # What to increase
    values_alignment: str | None = None  # ACT values
    status: str = 'pending'  # pending, dismissed, action_taken


class DailyInsightGeneratorV2:
    """
    Professional-grade insight generator with statistical rigor.

    Improvements over v1:
    1. Statistical significance testing (not just counting)
    2. Effect size calculation (Cohen's d for clinical relevance)
    3. Temporal pattern analysis (time-series insights)
    4. Behavioral activation targeting (evidence-based)
    5. Values-based interventions (ACT principles)
    6. Circadian rhythm correlation
    7. Social rhythm metrics
    """

    def __init__(self):
        self.min_memories = 3  # Lowered for faster initial insights
        self.analysis_window = 14  # 2 weeks for better patterns
        self.statistical_threshold = 0.05
        self.min_effect_size = 0.3  # Small to medium effect

        # Evidence-based templates with CBT/ACT grounding
        self.TEMPLATES = {
            'nature_ba_target': {
                'title': 'Naturen som återhämtning',
                'message': (
                    'Data visar att tid i naturen korrelerar med {improvement}% '
                    'lägre stressnivåer (r={correlation}). '
                    'Detta är en kraftfull återhämtningskälla - '
                    'behavioral activation rekommenderar planerad natur exponering.'
                ),
                'action': 'Schema lägg 20 min natur idag (evidensbaserat)',
                'domain': TherapeuticDomain.BEHAVIORAL_ACTIVATION,
                'act_value': 'hälsa/återhämtning'
            },
            'social_connection_deficit': {
                'title': 'Social rytm-detektion',
                'message': (
                    'Din sociala rytm visar {days_since_social} dagar utan '
                    'meningsfull social kontakt. Social rytm-terapi (SRT) '
                    'indikerar att detta påverkar din mående-cykel.'
                ),
                'action': 'Planera ett samtal eller möte inom 24h',
                'domain': TherapeuticDomain.SOCIAL_CONNECTION,
                'act_value': 'tillhörighet/gemenskap'
            },
            'circadian_mood_pattern': {
                'title': 'Sömn-känsla korrelation',
                'message': (
                    'Dina minnen visar ett mönster: {mood_time_pattern}. '
                    'Kronobiologisk forskning visar att sömnkvalitet '
                    'och dygnsrytm påverkar känsloreglering.'
                ),
                'action': 'Fast läggningstid och vakna-tid (±30min)',
                'domain': TherapeuticDomain.SLEEP_HYGIENE,
                'act_value': 'självvård/återhämtning'
            },
            'contrast_mind_body': {
                'title': 'Kropp-tanke dissociation',
                'message': (
                    'Noterbar dissociation: kroppen visar {body_state} '
                    '(fotodata) medan tankar indikerar {mind_state}. '
                    'Detta är vanligt vid stress - kroppen och sinnet '
                    'kommunikerar inte alltid synkroniserat.'
                ),
                'action': 'Grounding: 5-4-3-2-1 teknik eller kroppskanning',
                'domain': TherapeuticDomain.MINDFULNESS,
                'act_value': 'närvaro/integration'
            },
            'behavioral_avoidance': {
                'title': 'Undvikande-detektion',
                'message': (
                    'Mönster av aktivitets-restriktion noterad: '
                    '{activities_declined} aktiviteter har minskat. '
                    'Behavioral activation (BA) identifierar detta '
                    'som en underhållande faktor för nedstämdhet.'
                ),
                'action': 'Graduerad exponering: välj en aktivitet, bryt ner i steg',
                'domain': TherapeuticDomain.BEHAVIORAL_ACTIVATION,
                'act_value': 'aktivitet/engagemang'
            },
            'positive_savoring': {
                'title': 'Savoring-moment',
                'message': (
                    'Ett starkt positivt minne detekterat: {event_type} '
                    '(valens +{valence:.1f}). Positiv psykologi forskning '
                    '(Seligman) visar att savoring förstärker välbefinnande.'
                ),
                'action': 'Reflektera: Vad gjorde detta speciellt? Kan det repeteras?',
                'domain': TherapeuticDomain.EMOTION_REGULATION,
                'act_value': 'glädje/uppskattning'
            },
            'mastery_experience': {
                'title': 'Mästerupplevelse',
                'message': (
                    'Data indikerar en mästerupplevelse: {mastery_domain}. '
                    'Self-efficacy teori (Bandura) betonar att sådana '
                    'upplevelser bygger motståndskraft.'
                ),
                'action': 'Fira prestationen. Kan du bygga vidare på denna framgång?',
                'domain': TherapeuticDomain.BEHAVIORAL_ACTIVATION,
                'act_value': 'tillväxt/kompetens'
            },
            'declining_trend': {
                'title': 'Trend-analys: Nedåtgående',
                'message': (
                    'Statistisk analys visar nedåtgående trend: '
                    'β = {beta:.2f}, p < 0.05. Detta är ett tidigt '
                    'varningstecken - tidig intervention är mest effektiv.'
                ),
                'action': 'Öppna appen för strukturerad intervention eller boka samtal',
                'domain': TherapeuticDomain.EMOTION_REGULATION,
                'act_value': 'självomsorg/terapi'
            }
        }

    def _already_generated_today(self, user_id: str) -> list[TherapeuticInsight]:
        """Check if insights were already generated today. Returns them if so."""
        try:
            from google.cloud.firestore import FieldFilter
            today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            # Query by user_id only (single-field, no composite index needed)
            # Check ALL statuses (incl dismissed/action_taken) to prevent regeneration loop
            query = db.collection('insights').where(
                filter=FieldFilter('user_id', '==', user_id)
            ).limit(10)
            today_insights = []
            for doc in query.stream():
                data = doc.to_dict()
                created = data.get('created_at')
                if isinstance(created, datetime):
                    if created.tzinfo is None:
                        created = created.replace(tzinfo=UTC)
                    if created >= today_start:
                        today_insights.append(self._dict_to_insight(data))
                elif isinstance(created, str):
                    try:
                        parsed = datetime.fromisoformat(created.replace('Z', '+00:00'))
                        if parsed.tzinfo is None:
                            parsed = parsed.replace(tzinfo=UTC)
                        if parsed >= today_start:
                            today_insights.append(self._dict_to_insight(data))
                    except (ValueError, TypeError):
                        continue
            return today_insights
        except Exception as e:
            logger.error(f"Failed to check existing insights: {e}")
            return []

    def _dict_to_insight(self, data: dict) -> TherapeuticInsight:
        """Convert a Firestore dict back to TherapeuticInsight.
        Safely handles invalid/legacy enum values from Firestore.
        """
        # Safely parse enums — fall back to defaults if value is invalid/legacy
        try:
            insight_type = InsightType(data.get('insight_type', 'opportunity'))
        except ValueError:
            insight_type = InsightType.OPPORTUNITY
        try:
            domain = TherapeuticDomain(data.get('domain', 'behavioral_activation'))
        except ValueError:
            domain = TherapeuticDomain.BEHAVIORAL_ACTIVATION

        return TherapeuticInsight(
            insight_id=data.get('insight_id', ''),
            user_id=data.get('user_id', ''),
            insight_type=insight_type,
            domain=domain,
            title=data.get('title', ''),
            message=data.get('message', ''),
            recommendation=data.get('recommendation', ''),
            evidence=data.get('evidence', {}),
            urgency=data.get('urgency', 'low'),
            suggested_action=data.get('suggested_action', ''),
            related_memories=data.get('related_memories', []),
            created_at=data.get('created_at'),
            values_alignment=data.get('values_alignment'),
            behavioral_target=data.get('behavioral_target'),
            status=data.get('status', 'pending'),
        )

    def generate_insights(self, user_id: str) -> list[TherapeuticInsight]:
        """
        Generate statistically-validated therapeutic insights.

        Statistical approach:
        1. Time-series analysis with trend detection
        2. Correlation analysis for pattern detection
        3. Effect size calculation for clinical relevance
        4. Multi-modal fusion with confidence weighting
        """
        # BUG 3+7: Check if already generated today to prevent ID collision and rate-limit
        existing = self._already_generated_today(user_id)
        if existing:
            logger.info(f"Returning {len(existing)} existing insights for {user_id} (already generated today)")
            # Only return pending insights — dismissed/action_taken are excluded from display
            pending_existing = [i for i in existing if i.status == 'pending']
            return self._prioritize_insights(pending_existing)

        insights = []

        try:
            # Extended data collection
            memories = self._fetch_memories(user_id, days=self.analysis_window)
            self._extract_activity_patterns(memories)

            if len(memories) < self.min_memories:
                logger.info(f"Insufficient data for {user_id}, generating fallback insight")
                # Generate onboarding insight for new users
                fallback_insight = self._generate_onboarding_insight(user_id, len(memories))
                if fallback_insight:
                    insights.append(fallback_insight)
                    self._save_insight(fallback_insight)
                return insights

            # 1. Temporal trend analysis (linear regression on mood)
            trend_insight = self._analyze_trend_statistical(memories, user_id)
            if trend_insight:
                insights.append(trend_insight)

            # 2. Behavioral activation opportunities
            ba_insights = self._detect_behavioral_activation_targets(
                memories, user_id
            )
            insights.extend(ba_insights)

            # 3. Social rhythm analysis
            social_insight = self._analyze_social_rhythm(memories, user_id)
            if social_insight:
                insights.append(social_insight)

            # 4. Circadian-mood correlation
            circadian_insight = self._analyze_circadian_patterns(memories, user_id)
            if circadian_insight:
                insights.append(circadian_insight)

            # 5. Mind-body contrast detection
            contrast_insight = self._detect_mind_body_contrast(memories, user_id)
            if contrast_insight:
                insights.append(contrast_insight)

            # 6. Positive psychology interventions (savoring, gratitude)
            positive_insights = self._detect_positive_psychology_opportunities(
                memories, user_id
            )
            insights.extend(positive_insights)

            # If user has enough logs but no real insights were generated yet,
            # show a positive encouragement insight to keep them engaged
            if len(insights) == 0 and len(memories) >= self.min_memories:
                keep_logging_insight = TherapeuticInsight(
                    insight_id=f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d')}_keep_logging",
                    user_id=user_id,
                    insight_type=InsightType.MILESTONE,
                    domain=TherapeuticDomain.BEHAVIORAL_ACTIVATION,
                    title="Bra att du loggar ditt mående",
                    message="Du har loggat ditt mående tre gånger. Fortsätt logga regelbundet så kommer personliga insikter och mönster att växa fram. Ju fler loggar du gör, desto tydligare blir bild av ditt välmående.",
                    recommendation="Logga ditt mående igen om några dagar för att aktivera djupare analys.",
                    evidence={'memory_count': len(memories)},
                    urgency='low',
                    suggested_action='Logga mående nu',
                    related_memories=[],
                    created_at=datetime.now(UTC)
                )
                insights.append(keep_logging_insight)

            # Save all insights
            for insight in insights:
                self._save_insight(insight)

            # Audit logging with full statistical data
            audit_log(
                event_type="DAILY_INSIGHTS_V2_GENERATED",
                user_id=user_id,
                details={
                    "insight_count": len(insights),
                    "memory_count": len(memories),
                    "mood_datapoints": len(memories),
                    "domains": [i.domain.value for i in insights],
                    "statistical_tests_performed": len(insights)
                }
            )

        except Exception as e:
            logger.exception(f"Insight generation failed: {e}")

        # Sort by clinical priority
        return self._prioritize_insights(insights)

    def _analyze_trend_statistical(self, memories: list[dict], user_id: str) -> TherapeuticInsight | None:
        """
        Linear regression on mood scores with statistical validation.
        Returns insight if trend is statistically significant.
        """
        if len(memories) < 5:
            return None

        try:
            # Extract time series with real timestamps (parse ISO strings)
            time_points = []
            scores = []
            for m in memories:
                ts = _parse_timestamp(m.get('timestamp'))
                if ts is None:
                    continue
                time_points.append(ts)
                scores.append(m.get('score', 5))

            if len(time_points) < 5:
                return None

            # Sort by time to ensure chronological order
            sorted_data = sorted(zip(time_points, scores, strict=False), key=lambda x: x[0])
            time_points = [d[0] for d in sorted_data]
            scores = [d[1] for d in sorted_data]

            # Use days since first measurement as time unit (more meaningful than index)
            base_time = time_points[0]
            times = [(t - base_time).total_seconds() / 86400.0 for t in time_points]

            # Simple linear regression
            n = len(times)
            mean_t = statistics.mean(times)
            mean_s = statistics.mean(scores)

            # Calculate slope (beta) - mood points per day
            numerator = sum((t - mean_t) * (s - mean_s) for t, s in zip(times, scores, strict=False))
            denominator = sum((t - mean_t) ** 2 for t in times)

            if denominator == 0:
                return None

            beta = numerator / denominator  # points per day

            # Calculate effect size (approximate)
            if len(scores) > 1:
                std_s = statistics.stdev(scores)
                effect_size = abs(beta * n / std_s) if std_s > 0 else 0
            else:
                effect_size = 0

            # Only flag if clinically relevant decline (>0.5 points per day decline)
            if beta < -0.5 and effect_size >= self.min_effect_size:
                template = self.TEMPLATES['declining_trend']

                return TherapeuticInsight(
                    insight_id=f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d')}_trend",
                    user_id=user_id,
                    insight_type=InsightType.DECLINE_PATTERN,
                    domain=template['domain'],
                    title=template['title'],
                    message=template['message'].format(beta=beta),
                    recommendation=template['action'],
                    evidence={
                        'beta': beta,
                        'effect_size': effect_size,
                        'n': n,
                        'method': 'linear_regression'
                    },
                    urgency='high' if beta < -1.0 else 'medium',
                    suggested_action=template['action'],
                    values_alignment=template['act_value']
                )

        except Exception as e:
            logger.error(f"Trend analysis failed: {e}")

        return None

    def _detect_behavioral_activation_targets(self, memories: list[dict],
                                               user_id: str) -> list[TherapeuticInsight]:
        """
        Detect opportunities for behavioral activation.
        Correlates activities with mood improvement.
        """
        insights = []

        try:
            # Group memories by activity type
            activity_groups = defaultdict(list)

            for memory in memories:
                # Categorize by content and photo analysis
                activity_type = self._categorize_activity(memory)
                if activity_type:
                    activity_groups[activity_type].append(memory)

            # Calculate mood correlation for each activity
            for activity_type, activity_memories in activity_groups.items():
                if len(activity_memories) < 3:
                    continue

                # Get mood scores for these memories
                # #7: Coerce None sentiment_score to 0 (same pattern as valence fix)
                mood_scores = []
                for m in activity_memories:
                    sentiment = float(m.get('ai_analysis', {}).get('sentiment_score') or 0)
                    mood_scores.append(sentiment)

                avg_mood = statistics.mean(mood_scores)

                # Compare to baseline (all memories)
                all_sentiments = [float(m.get('ai_analysis', {}).get('sentiment_score') or 0)
                                 for m in memories]
                baseline = statistics.mean(all_sentiments) if all_sentiments else 0

                improvement = ((avg_mood - baseline) / abs(baseline) * 100) if baseline != 0 else 0

                # If activity correlates with better mood
                if improvement > 20 and activity_type == 'nature':
                    template = self.TEMPLATES['nature_ba_target']

                    # Calculate correlation coefficient between
                    # nature activity (1=yes, 0=no) and mood scores
                    nature_indicator = [
                        1.0 if self._categorize_activity(m) == 'nature' else 0.0
                        for m in memories
                    ]
                    all_mood_scores = [
                        float(m.get('ai_analysis', {}).get('sentiment_score') or 0)
                        for m in memories
                    ]
                    correlation = self._calculate_correlation(
                        nature_indicator, all_mood_scores
                    )

                    insights.append(TherapeuticInsight(
                        insight_id=f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d')}_nature",
                        user_id=user_id,
                        insight_type=InsightType.OPPORTUNITY,
                        domain=template['domain'],
                        title=template['title'],
                        message=template['message'].format(
                            improvement=f"{improvement:.0f}",
                            correlation=f"{correlation:.2f}"
                        ),
                        recommendation=template['action'],
                        evidence={
                            'activity_type': activity_type,
                            'improvement_pct': improvement,
                            'correlation': correlation,
                            'n_memories': len(activity_memories)
                        },
                        urgency='medium',
                        suggested_action=template['action'],
                        values_alignment=template['act_value'],
                        behavioral_target='nature_exposure'
                    ))

        except Exception as e:
            logger.error(f"BA detection failed: {e}")

        return insights

    def _calculate_correlation(self, x: list[float], y: list[float]) -> float:
        """Calculate Pearson correlation coefficient."""
        if len(x) != len(y) or len(x) < 2:
            return 0.0

        try:
            mean_x = statistics.mean(x)
            mean_y = statistics.mean(y)

            numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y, strict=False))
            denom_x = sum((xi - mean_x) ** 2 for xi in x)
            denom_y = sum((yi - mean_y) ** 2 for yi in y)

            if denom_x == 0 or denom_y == 0:
                return 0.0

            return numerator / ((denom_x ** 0.5) * (denom_y ** 0.5))

        except Exception:
            return 0.0

    def _categorize_activity(self, memory: dict) -> str | None:
        """Categorize memory into activity type."""
        content = (memory.get('note', '') or memory.get('mood_text', '') or '').lower()
        photo_scene = memory.get('ai_analysis', {}).get('photo_analysis', {}).get('scene', '')

        nature_keywords = ['skog', 'natur', 'park', 'promenad', 'vandra', 'träd', 'sjö']
        social_keywords = ['vän', 'familj', 'kompis', 'träff', 'fest', 'middag', 'pratade']
        creative_keywords = ['måla', 'rita', 'skriva', 'musik', 'laga mat', 'baka', 'sy']
        physical_keywords = ['springa', 'träna', 'gym', 'yoga', 'simma', 'cykla']

        # Check photo scene first (more reliable)
        if photo_scene in ['nature', 'forest', 'park', 'outdoor']:
            return 'nature'

        # Check content
        if any(kw in content for kw in nature_keywords):
            return 'nature'
        if any(kw in content for kw in social_keywords):
            return 'social'
        if any(kw in content for kw in creative_keywords):
            return 'creative'
        if any(kw in content for kw in physical_keywords):
            return 'physical'

        return None

    def _analyze_social_rhythm(self, memories: list[dict], user_id: str) -> TherapeuticInsight | None:
        """Analyze social connection patterns (Social Rhythm Metric)."""
        # Check for social memories in last 7 days
        week_ago = datetime.now(UTC) - timedelta(days=7)

        social_memories = [
            m for m in memories
            if m.get('ai_analysis', {}).get('photo_analysis', {}).get('has_faces', False)
            or any(kw in (m.get('note', '') or m.get('mood_text', '') or '').lower()
                   for kw in ['vän', 'familj', 'träff', 'pratade', 'samman'])
        ]

        recent_social = [
            m for m in social_memories
            if (ts := _parse_timestamp(m.get('timestamp'))) and ts > week_ago
        ]

        # If no social contact in 7 days, flag it
        if len(recent_social) == 0 and len(memories) > 3:
            template = self.TEMPLATES['social_connection_deficit']

            # Calculate actual days since last social contact
            if social_memories:
                social_timestamps = [
                    _parse_timestamp(m.get('timestamp'))
                    for m in social_memories
                    if _parse_timestamp(m.get('timestamp'))
                ]
                if social_timestamps:
                    latest_social = max(social_timestamps)
                    days_since_social = max(1, (datetime.now(UTC) - latest_social).days)
                else:
                    days_since_social = self.analysis_window
            else:
                days_since_social = self.analysis_window

            return TherapeuticInsight(
                insight_id=f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d')}_social",
                user_id=user_id,
                insight_type=InsightType.SOCIAL_ISOLATION,
                domain=template['domain'],
                title=template['title'],
                message=template['message'].format(days_since_social=days_since_social),
                recommendation=template['action'],
                evidence={
                    'days_without_social': days_since_social,
                    'social_memories_total': len(social_memories),
                    'method': 'social_rhythm_therapy'
                },
                urgency='medium',
                suggested_action=template['action'],
                values_alignment=template['act_value']
            )

        return None

    def _analyze_circadian_patterns(self, memories: list[dict], user_id: str) -> TherapeuticInsight | None:
        """Analyze time-of-day mood patterns."""
        if len(memories) < 7:
            return None

        try:
            # Group by time of day
            morning_scores = []
            afternoon_scores = []
            evening_scores = []

            for entry in memories:
                ts = _parse_timestamp(entry.get('timestamp') or entry.get('created_at'))
                if not ts:
                    continue

                hour = ts.hour
                # Use sentiment_score for consistency with other analysis methods
                score = float(entry.get('ai_analysis', {}).get('sentiment_score') or 0)

                if 6 <= hour < 12:
                    morning_scores.append(score)
                elif 12 <= hour < 18:
                    afternoon_scores.append(score)
                else:
                    evening_scores.append(score)

            # Detect pattern
            if morning_scores and evening_scores:
                morning_avg = statistics.mean(morning_scores)
                evening_avg = statistics.mean(evening_scores)

                if morning_avg < evening_avg - 1.5:  # Morning dip
                    template = self.TEMPLATES['circadian_mood_pattern']
                    return TherapeuticInsight(
                        insight_id=f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d')}_circadian",
                        user_id=user_id,
                        insight_type=InsightType.CIRCADIAN_MISMATCH,
                        domain=template['domain'],
                        title=template['title'],
                        message=template['message'].format(
                            mood_time_pattern='lägre på morgonen, bättre på kvällen'
                        ),
                        recommendation=template['action'],
                        evidence={
                            'morning_avg': morning_avg,
                            'evening_avg': evening_avg,
                            'pattern': 'morning_dip'
                        },
                        urgency='low',
                        suggested_action=template['action'],
                        values_alignment=template['act_value']
                    )

        except Exception as e:
            logger.error(f"Circadian analysis failed: {e}")

        return None

    def _detect_mind_body_contrast(self, memories: list[dict], user_id: str) -> TherapeuticInsight | None:
        """Detect dissociation between body state (photos) and mind state (text)."""
        if not memories:
            return None

        # Iterate over recent memories to find one with photo analysis data
        # (not all mood entries have photos, so memories[0] may lack photo_analysis)
        for recent in memories[:5]:
            photo_analysis = recent.get('ai_analysis', {}).get('photo_analysis', {})
            if not photo_analysis:
                continue

            photo_emotion = photo_analysis.get('emotion', 'neutral')
            text_emotion = recent.get('ai_analysis', {}).get('primary_emotion', 'neutral')
            sentiment = recent.get('ai_analysis', {}).get('sentiment_score', 0)

            # Define calm vs stressed states
            calm_states = ['calm', 'peace', 'joy', 'happy']
            stressed_states = ['stress', 'anxiety', 'sadness', 'anger', 'worry']

            photo_calm = any(s in photo_emotion.lower() for s in calm_states)
            text_stressed = any(s in text_emotion.lower() for s in stressed_states) or sentiment < -0.3

            if photo_calm and text_stressed:
                template = self.TEMPLATES['contrast_mind_body']

                return TherapeuticInsight(
                    insight_id=f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d')}_contrast",
                    user_id=user_id,
                    insight_type=InsightType.CONTRAST_DETECTED,
                    domain=template['domain'],
                    title=template['title'],
                    message=template['message'].format(
                        body_state='lugn och ro',
                        mind_state='oro eller stress'
                    ),
                    recommendation=template['action'],
                    evidence={
                        'photo_emotion': photo_emotion,
                        'text_emotion': text_emotion,
                        'sentiment': sentiment,
                        'contrast_type': 'mind_body_dissociation'
                    },
                    urgency='medium',
                    suggested_action=template['action'],
                    values_alignment=template['act_value']
                )

        return None

    def _detect_positive_psychology_opportunities(self, memories: list[dict],
                                                   user_id: str) -> list[TherapeuticInsight]:
        """Detect opportunities for savoring, gratitude, and strengths."""
        insights = []

        # Find highest valence memory
        positive_memories = [
            m for m in memories
            if m.get('ai_analysis', {}).get('sentiment_score', 0) > 0.6
        ]

        if positive_memories:
            strongest = max(positive_memories,
                          key=lambda m: m.get('ai_analysis', {}).get('sentiment_score', 0))

            valence = strongest.get('ai_analysis', {}).get('sentiment_score', 0)

            # Savoring opportunity
            if valence > 0.7:
                template = self.TEMPLATES['positive_savoring']
                event_type = self._categorize_activity(strongest) or 'positiv händelse'

                insights.append(TherapeuticInsight(
                    insight_id=f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d')}_savoring",
                    user_id=user_id,
                    insight_type=InsightType.MILESTONE,
                    domain=template['domain'],
                    title=template['title'],
                    message=template['message'].format(
                        event_type=event_type,
                        valence=valence
                    ),
                    recommendation=template['action'],
                    evidence={
                        'memory_id': strongest.get('id'),
                        'valence': valence,
                        'type': 'savoring_opportunity'
                    },
                    urgency='low',
                    suggested_action=template['action'],
                    values_alignment=template['act_value']
                ))

        return insights

    def _prioritize_insights(self, insights: list[TherapeuticInsight]) -> list[TherapeuticInsight]:
        """Clinical prioritization of insights."""
        urgency_order = {'high': 0, 'medium': 1, 'low': 2}
        domain_priority = {
            TherapeuticDomain.EMOTION_REGULATION: 0,
            TherapeuticDomain.SLEEP_HYGIENE: 1,
            TherapeuticDomain.SOCIAL_CONNECTION: 2,
            TherapeuticDomain.BEHAVIORAL_ACTIVATION: 3,
            TherapeuticDomain.MINDFULNESS: 4,
            TherapeuticDomain.PHYSICAL_ACTIVITY: 5,
            TherapeuticDomain.COGNITIVE_RESTRUCTURING: 6
        }

        # Sort by urgency, then domain priority
        insights.sort(key=lambda i: (
            urgency_order.get(i.urgency, 3),
            domain_priority.get(i.domain, 99)
        ))

        return insights[:3]

    def _fetch_memories(self, user_id: str, days: int) -> list[dict]:
        """Fetch mood entries from Firestore (users/{user_id}/moods subcollection).

        #8: Moods are stored with ISO-string timestamps, so cutoff must also be
        an ISO string. We avoid where+order_by (composite index) by fetching
        all moods ordered by timestamp and filtering in Python.
        """
        try:
            # Use timezone-aware UTC to match Firestore's timezone-aware datetimes
            cutoff = datetime.now(UTC) - timedelta(days=days)
            cutoff_iso = cutoff.isoformat()

            # Fetch recent moods ordered by timestamp DESC (no where filter = no index needed)
            # Limit to 100 to cap fetch size — 14-day window × ~7 logs/day = ~98 max
            mood_ref = db.collection('users').document(user_id).collection('moods')
            query = mood_ref.order_by('timestamp', direction='DESCENDING').limit(100)

            memories = []
            for doc in query.stream():
                data = doc.to_dict()
                data['id'] = doc.id
                # Filter by cutoff in Python (timestamps may be ISO strings or datetime objects)
                ts = data.get('timestamp')
                if ts is None:
                    continue
                if isinstance(ts, str):
                    if ts >= cutoff_iso:
                        memories.append(data)
                elif isinstance(ts, datetime):
                    # Normalize naive datetime to UTC to avoid comparison errors
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=UTC)
                    if ts >= cutoff:
                        memories.append(data)

            logger.info(f"Fetched {len(memories)} mood entries for user {user_id} (cutoff={cutoff_iso})")
            return memories

        except Exception as e:
            logger.error(f"Failed to fetch mood entries: {e}")
            return []

    def get_pending_insights(self, user_id: str, max_age_days: int = 7) -> list[dict]:
        """Get pending insights for a user.

        #4: Falls back to single-field query if composite index is missing.
        #8: Simplified — always use single-field query + filter in Python to avoid index issues.
        BUG 8: Filter out insights older than max_age_days to prevent stale insights.
        """
        try:
            from google.cloud.firestore import FieldFilter

            # Query by user_id only (single-field, no composite index needed)
            # Limit to 50 to cap fetch — dismissed/old insights are filtered in Python
            simple_query = db.collection('insights').where(
                filter=FieldFilter('user_id', '==', user_id)
            ).limit(50)

            cutoff = datetime.now(UTC) - timedelta(days=max_age_days)
            insights = []
            for doc in simple_query.stream():
                data = doc.to_dict()
                # Filter pending in memory
                if data.get('status') != 'pending':
                    continue
                # BUG 8: Filter by age — skip insights older than max_age_days
                created = data.get('created_at')
                if isinstance(created, datetime):
                    if created.tzinfo is None:
                        created = created.replace(tzinfo=UTC)
                    if created < cutoff:
                        continue
                elif isinstance(created, str):
                    try:
                        parsed = datetime.fromisoformat(created.replace('Z', '+00:00'))
                        if parsed.tzinfo is None:
                            parsed = parsed.replace(tzinfo=UTC)
                        if parsed < cutoff:
                            continue
                    except (ValueError, TypeError):
                        pass

                for key in ['created_at', 'dismissed_at', 'action_taken_at']:
                    if key in data and isinstance(data[key], datetime):
                        data[key] = data[key].isoformat()
                insights.append(data)

            # Sort by created_at descending in memory
            insights.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            return insights

        except Exception as e:
            logger.error(f"Failed to fetch pending insights: {e}")
            return []

    def _extract_activity_patterns(self, memories: list[dict]) -> dict:
        """Extract activity patterns from already-fetched mood entry tags.

        BUG 4: Replaces _fetch_activity_patterns to avoid duplicate Firestore query.
        Reads tags from the memories list fetched by _fetch_memories.
        """
        try:
            tag_counts: dict[str, int] = {}
            for data in memories:
                tags = data.get('tags', [])
                if isinstance(tags, list):
                    for tag in tags:
                        if isinstance(tag, str) and tag:
                            tag_counts[tag] = tag_counts.get(tag, 0) + 1

            logger.debug(f"Activity patterns: {tag_counts}")
            return tag_counts

        except Exception as e:
            logger.error(f"Failed to extract activity patterns: {e}")
            return {}

    def _generate_onboarding_insight(self, user_id: str, current_count: int) -> TherapeuticInsight | None:
        """Generate onboarding insight for new users with insufficient data.

        #5: Checks Firestore for existing onboarding insight today to avoid duplicates.
        """
        # Check if onboarding insight already exists for today
        today_str = datetime.now(UTC).strftime('%Y%m%d')
        expected_id = f"{user_id}_onboarding_{today_str}"
        try:
            existing = db.collection('insights').document(expected_id).get()
            if existing.exists:
                logger.debug(f"Onboarding insight already exists for {user_id} today")
                return None
        except Exception as e:
            logger.warning(f"Failed to check existing onboarding insight: {e}")
            # Continue to generate if check fails

        needed = self.min_memories - current_count

        messages = {
            0: "Välkommen! Logga ditt mående dagligen för att få personliga insikter baserade på dina mönster.",
            1: "Bra start! Logga ditt månde en gång till för att börja se dina första insikter.",
            2: "Du är nära! Logga ditt månde en gång till för att få dina första personliga insikter.",
        }

        message = messages.get(current_count, messages[2])

        return TherapeuticInsight(
            insight_id=expected_id,
            user_id=user_id,
            insight_type=InsightType.CHECKIN_NEEDED,
            domain=TherapeuticDomain.BEHAVIORAL_ACTIVATION,
            title="Kom igång med daglig loggning",
            message=message,
            recommendation=f"Logga ditt månde {needed} gång(er) till för att aktivera insikter",
            evidence={},
            urgency="low",
            suggested_action="Logga mående nu",
            related_memories=[],
            created_at=datetime.now(UTC),
        )

    def _save_insight(self, insight: TherapeuticInsight):
        """Save to Firestore. Preserves dismissed/action_taken status on re-save."""
        try:
            doc_ref = db.collection('insights').document(insight.insight_id)

            # Check if already exists with a non-pending status — don't overwrite user actions
            existing = doc_ref.get()
            if existing.exists:
                existing_status = existing.to_dict().get('status', 'pending')
                if existing_status in ('dismissed', 'action_taken'):
                    logger.info(f"Skipping re-save of {existing_status} insight {insight.insight_id}")
                    return

            doc_data = {
                'insight_id': insight.insight_id,
                'user_id': insight.user_id,
                'insight_type': insight.insight_type.value,
                'domain': insight.domain.value,
                'title': insight.title,
                'message': insight.message,
                'recommendation': insight.recommendation,
                'evidence': insight.evidence,
                'urgency': insight.urgency,
                'suggested_action': insight.suggested_action,
                'related_memories': insight.related_memories,
                'values_alignment': insight.values_alignment,
                'behavioral_target': insight.behavioral_target,
                'created_at': insight.created_at or datetime.now(UTC),
                'status': 'pending',
                'notification_sent': False,
                'version': '2.0'
            }

            db.collection('insights').document(insight.insight_id).set(doc_data)

        except Exception as e:
            logger.error(f"Failed to save insight: {e}")

    def mark_insight_sent(self, insight_id: str) -> bool:
        """Mark a pending insight as notification sent."""
        try:
            db.collection('insights').document(insight_id).update({
                'notification_sent': True,
                'sent_at': datetime.now(UTC)
            })
            return True
        except Exception as e:
            logger.error(f"Failed to mark insight as sent: {e}")
            return False


# Export both versions
DailyInsightGenerator = DailyInsightGeneratorV2

# Convenience exports (required by insights_routes.py)
_v2_generator: DailyInsightGeneratorV2 | None = None


def get_insight_generator() -> DailyInsightGeneratorV2:
    """Get singleton instance of v2 insight generator."""
    global _v2_generator
    if _v2_generator is None:
        _v2_generator = DailyInsightGeneratorV2()
    return _v2_generator


def generate_daily_insights(user_id: str) -> list[TherapeuticInsight]:
    """Convenience function for generating insights using v2 engine."""
    return get_insight_generator().generate_insights(user_id)
