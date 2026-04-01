"""
Frictionless Micro-Journaling Service
Smart, context-aware mood logging with AI-powered suggestions
"""

import logging
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from ..config.firebase_config import db

try:
    from .mood_nlp_service import MoodAnalysis, get_mood_nlp
    NLP_AVAILABLE = True
except ImportError:
    NLP_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class SmartSuggestion:
    """AI-powered journaling suggestion."""
    type: str  # 'prompt', 'tag', 'technique', 'insight'
    content: str
    context: str
    confidence: float
    action: str | None = None


@dataclass
class JournalEntry:
    """A micro-journal entry with rich metadata."""
    timestamp: datetime
    mood_valence: float
    mood_arousal: float
    intensity: int
    note: str
    tags: list[str]
    triggers: list[str]
    techniques_used: list[str]
    location: str | None
    social_context: str | None
    sleep_quality: int | None
    energy_level: int | None


class MicroJournalingService:
    """
    Intelligent micro-journaling that reduces friction and increases insights.
    
    Features:
    - Smart prompts based on time, context, and history
    - One-tap mood logging with emoji + AI expansion
    - Automatic tag suggestions
    - Context-aware technique recommendations
    - Streak gamification with psychological principles
    """

    # Evidence-based journaling prompts by context
    SMART_PROMPTS = {
        'morning': [
            "Hur känner du dig inför dagen?",
            "Vad är en liten intention för idag?",
            "Hur sov du inatt (1-10)?",
            "Vad ser du fram emot idag?"
        ],
        'afternoon': [
            "Hur har dagen känts hittills?",
            "Vad har påverkat dig mest idag?",
            "Behöver du en paus?",
            "Vad gick bra idag?"
        ],
        'evening': [
            "Hur var din dag totalt?",
            "Vad tar du med dig från idag?",
            "Vad behöver du släppa?",
            "Hur kan du ta hand om dig själv ikväll?"
        ],
        'night': [
            "Vad känner du just nu?",
            "Är det något som oroar dig?",
            "Vad behöver du för att kunna vila?"
        ],
        'post_negative': [
            "Vad hjälper när du känner såhär?",
            "Har du någon att prata med?",
            "Vad behöver du just nu?",
            "Kom ihåg: detta är tillfälligt"
        ],
        'post_positive': [
            "Vad bidrog till detta?",
            "Hur kan du bära med dig detta?",
            "Vem kan du dela detta med?"
        ],
        'streak_at_risk': [
            "Du har inte loggat på ett tag - hur mår du?",
            "Vi saknar dig! Hur är läget?",
            "Bara 30 sekunder - hur känns det just nu?"
        ]
    }

    # Technique recommendations by mood state
    TECHNIQUE_SUGGESTIONS = {
        'high_anxiety': [
            {'name': 'Grounding 5-4-3-2-1', 'duration': 2, 'type': 'immediate'},
            {'name': 'Box Breathing', 'duration': 3, 'type': 'immediate'},
            {'name': 'PMR (Progressive Muscle Relaxation)', 'duration': 10, 'type': 'deeper'}
        ],
        'low_mood': [
            {'name': 'Behavioral Activation', 'duration': 5, 'type': 'action'},
            {'name': 'Gratitude Practice', 'duration': 3, 'type': 'cognitive'},
            {'name': 'Self-Compassion Break', 'duration': 5, 'type': 'emotional'}
        ],
        'irritability': [
            {'name': 'STOP Technique', 'duration': 1, 'type': 'immediate'},
            {'name': 'Cool Down Breathing', 'duration': 3, 'type': 'immediate'},
            {'name': 'Physical Release', 'duration': 5, 'type': 'action'}
        ],
        'low_energy': [
            {'name': 'Energy Booster', 'duration': 5, 'type': 'action'},
            {'name': 'Micro-Movement', 'duration': 2, 'type': 'immediate'},
            {'name': 'Power Nap Guide', 'duration': 10, 'type': 'deeper'}
        ]
    }

    # Tag suggestions by context
    TAG_CATEGORIES = {
        'context': ['jobb', 'hemma', 'socialt', 'ensam', 'pendling', 'sovrum'],
        'activity': ['arbete', 'studier', 'träning', 'vila', 'måltid', 'skärm'],
        'social': ['familj', 'partner', 'vänner', 'kollegor', 'konflikt', 'stöd'],
        'physical': ['sömn', 'hunger', 'trött', 'energi', 'smärta', 'sjuk'],
        'emotional': ['stress', 'oro', 'glädje', 'trist', 'ilska', 'lugn'],
        'external': ['väder', 'nyheter', 'ekonomi', 'hälsa', 'tidsbrist']
    }

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.nlp = get_mood_nlp() if NLP_AVAILABLE else None
        self.user_patterns = {}
        self._load_user_patterns()

    def _load_user_patterns(self):
        """Load user's historical patterns for personalization."""
        try:
            # Get recent mood entries
            mood_docs = db.collection('users').document(self.user_id)\
                .collection('moods')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(30)\
                .get()

            entries = [doc.to_dict() for doc in mood_docs]

            if entries:
                # Calculate common tags
                tag_counts = {}
                for entry in entries:
                    for tag in entry.get('tags', []):
                        tag_counts[tag] = tag_counts.get(tag, 0) + 1
                self.user_patterns['common_tags'] = sorted(
                    tag_counts.items(), key=lambda x: x[1], reverse=True
                )[:5]

                # Calculate typical times
                hours = []
                for entry in entries:
                    ts = entry.get('timestamp', datetime.now())
                    if isinstance(ts, str):
                        ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                    hours.append(ts.hour)

                self.user_patterns['typical_hours'] = list(set(hours))

                # Detect patterns
                self.user_patterns['weekend_differs'] = self._check_weekend_pattern(entries)

        except Exception as e:
            logger.warning(f"Could not load user patterns: {e}")

    def _check_weekend_pattern(self, entries: list[dict]) -> bool:
        """Check if mood differs significantly on weekends."""
        weekday_moods = []
        weekend_moods = []

        for entry in entries:
            ts = entry.get('timestamp', datetime.now())
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))

            valence = entry.get('valence', 0)
            if ts.weekday() >= 5:  # Weekend
                weekend_moods.append(valence)
            else:
                weekday_moods.append(valence)

        if len(weekday_moods) >= 3 and len(weekend_moods) >= 2:
            weekend_avg = sum(weekend_moods) / len(weekend_moods)
            weekday_avg = sum(weekday_moods) / len(weekday_moods)
            return abs(weekend_avg - weekday_avg) > 0.3

        return False

    def get_smart_prompts(self, n: int = 3) -> list[SmartSuggestion]:
        """Get personalized journaling prompts based on context."""
        suggestions = []

        # Determine time context
        hour = datetime.now().hour
        if 5 <= hour < 12:
            time_context = 'morning'
        elif 12 <= hour < 17:
            time_context = 'afternoon'
        elif 17 <= hour < 22:
            time_context = 'evening'
        else:
            time_context = 'night'

        # Check for streak at risk
        days_since_last = self._days_since_last_entry()
        if days_since_last >= 2:
            prompts = self.SMART_PROMPTS['streak_at_risk']
        else:
            # Get recent mood to determine context
            recent_mood = self._get_recent_mood()
            if recent_mood and recent_mood.get('valence', 0) < -0.4:
                prompts = self.SMART_PROMPTS['post_negative']
            elif recent_mood and recent_mood.get('valence', 0) > 0.4:
                prompts = self.SMART_PROMPTS['post_positive']
            else:
                prompts = self.SMART_PROMPTS[time_context]

        # Select random prompts
        selected = random.sample(prompts, min(n, len(prompts)))

        for prompt in selected:
            suggestions.append(SmartSuggestion(
                type='prompt',
                content=prompt,
                context=time_context,
                confidence=0.8
            ))

        return suggestions

    def get_quick_log_options(self) -> list[dict]:
        """Get one-tap mood logging options with emojis."""
        return [
            {
                'emoji': '😢',
                'label': 'Mycket svårt',
                'valence': -0.9,
                'arousal': 0.3,
                'suggested_note': 'Det är okej att må dåligt ibland',
                'color': 'rose'
            },
            {
                'emoji': '😔',
                'label': 'Nedstämd',
                'valence': -0.6,
                'arousal': 0.2,
                'suggested_note': 'Var snäll mot dig själv',
                'color': 'orange'
            },
            {
                'emoji': '😐',
                'label': 'Neutral',
                'valence': 0.0,
                'arousal': 0.5,
                'suggested_note': 'En dag i taget',
                'color': 'slate'
            },
            {
                'emoji': '🙂',
                'label': 'Okej',
                'valence': 0.4,
                'arousal': 0.5,
                'suggested_note': 'Bra att du checkar in',
                'color': 'teal'
            },
            {
                'emoji': '😊',
                'label': 'Bra',
                'valence': 0.7,
                'arousal': 0.6,
                'suggested_note': 'Vad bidrog till detta?',
                'color': 'emerald'
            },
            {
                'emoji': '🤩',
                'label': 'Fantastiskt',
                'valence': 0.95,
                'arousal': 0.8,
                'suggested_note': 'Fira denna känsla!',
                'color': 'amber'
            }
        ]

    def suggest_tags(self, note: str, current_tags: list[str] = None) -> list[SmartSuggestion]:
        """AI-powered tag suggestions based on note content."""
        suggestions = []
        current_tags = current_tags or []
        note_lower = note.lower()

        # Check each tag category
        for category, tags in self.TAG_CATEGORIES.items():
            for tag in tags:
                if tag not in current_tags and tag in note_lower:
                    suggestions.append(SmartSuggestion(
                        type='tag',
                        content=tag,
                        context=category,
                        confidence=0.9
                    ))

        # Add user's common tags if relevant
        if 'common_tags' in self.user_patterns:
            for tag, count in self.user_patterns['common_tags']:
                if tag not in current_tags:
                    suggestions.append(SmartSuggestion(
                        type='tag',
                        content=tag,
                        context='personal_history',
                        confidence=min(0.5 + count * 0.1, 0.8)
                    ))

        return suggestions[:5]  # Top 5 suggestions

    def suggest_techniques(self, mood_analysis: MoodAnalysis | None = None) -> list[SmartSuggestion]:
        """Suggest evidence-based techniques based on current mood."""
        suggestions = []

        # Determine mood category
        if mood_analysis:
            if mood_analysis.arousal > 0.7 and mood_analysis.valence < -0.3:
                category = 'high_anxiety'
            elif mood_analysis.valence < -0.5:
                category = 'low_mood'
            elif mood_analysis.arousal > 0.7 and mood_analysis.valence < 0:
                category = 'irritability'
            elif mood_analysis.arousal < 0.3:
                category = 'low_energy'
            else:
                return suggestions  # No specific technique needed
        else:
            # Default based on time of day
            hour = datetime.now().hour
            if hour < 10:
                category = 'low_energy'
            else:
                return suggestions

        # Get techniques for category
        techniques = self.TECHNIQUE_SUGGESTIONS.get(category, [])

        for tech in techniques:
            suggestions.append(SmartSuggestion(
                type='technique',
                content=tech['name'],
                context=f"{tech['duration']} min - {tech['type']}",
                confidence=0.85,
                action=f'start_exercise:{tech["name"]}'
            ))

        return suggestions

    def generate_insight(self, entries: list[JournalEntry]) -> SmartSuggestion | None:
        """Generate personalized insight from journal entries."""
        if len(entries) < 5:
            return None

        # Analyze patterns
        valences = [e.mood_valence for e in entries]
        avg_valence = sum(valences) / len(valences)
        trend = (valences[-1] - valences[0]) / len(valences)

        # Generate insight
        if trend < -0.05:
            return SmartSuggestion(
                type='insight',
                content=f"Ditt humör har varit på väg nedåt de senaste {len(entries)} dagarna. Det kan vara värt att prata med någon om hur du har det.",
                context='declining_trend',
                confidence=0.75
            )
        elif trend > 0.05:
            return SmartSuggestion(
                type='insight',
                content="Bra jobbat! Ditt humör har förbättrats. Vad tror du bidrar till detta?",
                context='improving_trend',
                confidence=0.75
            )
        elif avg_valence < -0.3:
            return SmartSuggestion(
                type='insight',
                content="Du verkar ha haft det tufft ett tag. Kom ihåg att det finns hjälp tillgänglig.",
                context='persistent_low_mood',
                confidence=0.7
            )

        # Check for weekend pattern
        if self.user_patterns.get('weekend_differs'):
            return SmartSuggestion(
                type='insight',
                content="Ditt humör verkar förändras på helgerna. Vad är annorlunda då?",
                context='weekend_pattern',
                confidence=0.7
            )

        return None

    def _days_since_last_entry(self) -> int:
        """Calculate days since last mood entry."""
        try:
            last_entry = db.collection('users').document(self.user_id)\
                .collection('moods')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(1)\
                .get()

            if last_entry:
                data = last_entry[0].to_dict()
                ts = data.get('timestamp', datetime.now())
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))

                return (datetime.now() - ts).days

        except Exception as e:
            logger.warning(f"Could not calculate days since last entry: {e}")

        return 0

    def _get_recent_mood(self) -> dict | None:
        """Get the most recent mood entry."""
        try:
            last_entry = db.collection('users').document(self.user_id)\
                .collection('moods')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(1)\
                .get()

            if last_entry:
                return last_entry[0].to_dict()

        except Exception as e:
            logger.warning(f"Could not get recent mood: {e}")

        return None


class StreakGamification:
    """
    Psychologically-informed streak gamification.
    Focuses on consistency over perfection to avoid shame spirals.
    """

    def __init__(self, user_id: str):
        self.user_id = user_id

    def calculate_streak(self) -> dict[str, Any]:
        """Calculate current streak with psychological support messaging."""
        try:
            # Get all mood entries
            mood_docs = db.collection('users').document(self.user_id)\
                .collection('moods')\
                .order_by('timestamp', direction='DESCENDING')\
                .get()

            entries = []
            for doc in mood_docs:
                data = doc.to_dict()
                ts = data.get('timestamp')
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                entries.append(ts.date())

            # Calculate unique days
            unique_days = sorted(set(entries), reverse=True)

            # Calculate current streak
            current_streak = 0
            today = datetime.now().date()

            # Check if logged today or yesterday (allow 1 day grace)
            if len(unique_days) > 0:
                last_entry = unique_days[0]
                days_since = (today - last_entry).days

                if days_since <= 1:  # Logged today or yesterday
                    # Count consecutive days
                    current_streak = 1
                    for i in range(1, len(unique_days)):
                        expected = unique_days[i-1] - timedelta(days=1)
                        if unique_days[i] == expected:
                            current_streak += 1
                        else:
                            break

            # Determine milestone and message
            milestone, message = self._get_milestone_message(current_streak, days_since if len(unique_days) > 0 else 999)

            return {
                'current_streak': current_streak,
                'days_since_last': days_since if len(unique_days) > 0 else None,
                'milestone': milestone,
                'message': message,
                'next_milestone': self._next_milestone(current_streak),
                'grace_period_used': days_since == 1 if len(unique_days) > 0 else False
            }

        except Exception as e:
            logger.error(f"Could not calculate streak: {e}")
            return {'current_streak': 0, 'message': 'Börja din streak idag!'}

    def _get_milestone_message(self, streak: int, days_since: int) -> tuple:
        """Get encouraging message based on streak status."""
        if days_since > 1:
            return None, "Ingen fara - börja om idag utan skuld!"

        milestones = {
            1: ("🌱", "Bra början! En dag i taget."),
            3: ("🌿", "3 dagar! Du bygger en vana."),
            7: ("🌳", "En vecka! Fantastiskt jobbat."),
            14: ("⭐", "Två veckor! Du investerar i dig själv."),
            21: ("🌟", "21 dagar - vanan är etablerad!"),
            30: ("🏆", "En månad! Du är fantastisk."),
            60: ("💎", "60 dagar! Ett mästerverk i konsistens."),
            90: ("👑", "90 dagar! Du är en inspiration."),
            180: ("🌈", "6 månader! Livsförändrande dedikation."),
            365: ("🦄", "Ett år! Otroligt. Du har bevisat att förändring är möjlig.")
        }

        return milestones.get(streak, (None, f"{streak} dagar! Fortsätt så."))

    def _next_milestone(self, current: int) -> int | None:
        """Get next milestone."""
        milestones = [3, 7, 14, 21, 30, 60, 90, 180, 365]
        for m in milestones:
            if m > current:
                return m
        return None


def get_micro_journaling_service(user_id: str) -> MicroJournalingService:
    """Factory function for micro-journaling service."""
    return MicroJournalingService(user_id)


def get_streak_gamification(user_id: str) -> StreakGamification:
    """Factory function for streak gamification."""
    return StreakGamification(user_id)
