"""
Personalization Engine for Lugn & Trygg
Creates personalized coping strategies and recommendations based on user patterns
"""

import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class UserProfile:
    """User's psychological profile"""
    user_id: str
    preferred_strategies: List[str]
    effective_times: Dict[str, float]  # Time of day effectiveness
    seasonal_patterns: Dict[str, float]  # Seasonal mood patterns
    trigger_words: List[str]
    coping_history: List[Dict[str, Any]]
    mood_patterns: Dict[str, Any]

@dataclass
class CopingStrategy:
    """Personalized coping strategy"""
    strategy_id: str
    name: str
    description: str
    category: str  # 'immediate', 'short_term', 'long_term'
    effectiveness_score: float
    recommended_time: str
    duration_minutes: int
    difficulty_level: str  # 'easy', 'medium', 'hard'
    prerequisites: List[str]
    swedish_instructions: str

@dataclass
class PersonalizedRecommendation:
    """Personalized recommendation for user"""
    strategies: List[CopingStrategy]
    rationale: str
    confidence_score: float
    expected_improvement: float
    alternative_options: List[CopingStrategy]

class PersonalizationEngine:
    """Engine for creating personalized mental health recommendations"""

    def __init__(self):
        # Predefined coping strategies database
        self.coping_strategies = self._initialize_coping_strategies()

        # Strategy effectiveness patterns
        self.effectiveness_patterns = {
            'morning': {
                'physical_activity': 0.9,
                'meditation': 0.8,
                'social_connection': 0.6,
                'creative_expression': 0.7
            },
            'afternoon': {
                'physical_activity': 0.8,
                'meditation': 0.7,
                'social_connection': 0.8,
                'creative_expression': 0.9
            },
            'evening': {
                'physical_activity': 0.6,
                'meditation': 0.9,
                'social_connection': 0.7,
                'creative_expression': 0.8
            },
            'night': {
                'physical_activity': 0.4,
                'meditation': 0.8,
                'social_connection': 0.5,
                'creative_expression': 0.6
            }
        }

    def _initialize_coping_strategies(self) -> Dict[str, CopingStrategy]:
        """Initialize the coping strategies database"""
        strategies = {}

        # Immediate relief strategies
        strategies['deep_breathing'] = CopingStrategy(
            strategy_id='deep_breathing',
            name='Djupandning',
            description='4-7-8 andningsövning för omedelbar avslappning',
            category='immediate',
            effectiveness_score=0.85,
            recommended_time='any',
            duration_minutes=5,
            difficulty_level='easy',
            prerequisites=[],
            swedish_instructions='Andas in genom näsan i 4 sekunder, håll andan i 7 sekunder, andas ut genom munnen i 8 sekunder. Upprepa 4 gånger.'
        )

        strategies['progressive_muscle_relaxation'] = CopingStrategy(
            strategy_id='progressive_muscle_relaxation',
            name='Progressiv muskelavslappning',
            description='Systematisk avslappning av muskelgrupper',
            category='immediate',
            effectiveness_score=0.80,
            recommended_time='evening',
            duration_minutes=10,
            difficulty_level='medium',
            prerequisites=[],
            swedish_instructions='Spänn en muskelgrupp hårt i 5 sekunder, släpp sedan spänningen och känn avslappningen. Börja med fötterna och arbeta uppåt.'
        )

        strategies['grounding_technique'] = CopingStrategy(
            strategy_id='grounding_technique',
            name='Markningsövning',
            description='5-4-3-2-1 tekniken för att återvända till nuet',
            category='immediate',
            effectiveness_score=0.90,
            recommended_time='any',
            duration_minutes=3,
            difficulty_level='easy',
            prerequisites=[],
            swedish_instructions='Namnge 5 saker du kan se, 4 saker du kan röra, 3 saker du kan höra, 2 saker du kan lukta, 1 sak du kan smaka.'
        )

        # Short-term strategies
        strategies['walk_in_nature'] = CopingStrategy(
            strategy_id='walk_in_nature',
            name='Promenad i naturen',
            description='Kort promenad utomhus för perspektiv och frisk luft',
            category='short_term',
            effectiveness_score=0.75,
            recommended_time='morning',
            duration_minutes=20,
            difficulty_level='easy',
            prerequisites=['outdoor_access'],
            swedish_instructions='Ta en lugn promenad i en park eller skog. Fokusera på omgivningen - fåglar, träd, ljud.'
        )

        strategies['creative_writing'] = CopingStrategy(
            strategy_id='creative_writing',
            name='Kreativt skrivande',
            description='Skriv fritt om känslor och tankar',
            category='short_term',
            effectiveness_score=0.70,
            recommended_time='afternoon',
            duration_minutes=15,
            difficulty_level='easy',
            prerequisites=[],
            swedish_instructions='Skriv fritt i 15 minuter utan att censurera dig själv. Vad känns viktigt att uttrycka just nu?'
        )

        strategies['music_therapy'] = CopingStrategy(
            strategy_id='music_therapy',
            name='Musikterapi',
            description='Lyssna på lugn musik eller skapa en spellista',
            category='short_term',
            effectiveness_score=0.65,
            recommended_time='evening',
            duration_minutes=30,
            difficulty_level='easy',
            prerequisites=[],
            swedish_instructions='Skapa en spellista med lugn musik som får dig att känna dig trygg och avslappnad.'
        )

        # Long-term strategies
        strategies['mindfulness_practice'] = CopingStrategy(
            strategy_id='mindfulness_practice',
            name='Medveten närvaro',
            description='Daglig mindfulnessövning för bättre känsloreglering',
            category='long_term',
            effectiveness_score=0.85,
            recommended_time='morning',
            duration_minutes=10,
            difficulty_level='medium',
            prerequisites=[],
            swedish_instructions='Sitt bekvämt och fokusera på andningen. När tankar kommer, notera dem utan att döma och återvänd till andningen.'
        )

        strategies['gratitude_journal'] = CopingStrategy(
            strategy_id='gratitude_journal',
            name='Tacksamhetsdagbok',
            description='Daglig reflektion över positiva aspekter',
            category='long_term',
            effectiveness_score=0.80,
            recommended_time='evening',
            duration_minutes=5,
            difficulty_level='easy',
            prerequisites=[],
            swedish_instructions='Skriv ner tre saker du är tacksam för idag. Var specifika och reflektera över varför de betyder något.'
        )

        strategies['social_connection'] = CopingStrategy(
            strategy_id='social_connection',
            name='Social kontakt',
            description='Planera regelbunden kontakt med nära och kära',
            category='long_term',
            effectiveness_score=0.75,
            recommended_time='afternoon',
            duration_minutes=60,
            difficulty_level='medium',
            prerequisites=['social_network'],
            swedish_instructions='Ring en vän, träffa familj, eller delta i en hobbygrupp. Människlig kontakt är viktigt för välmåendet.'
        )

        return strategies

    def generate_personalized_recommendations(
        self,
        user_profile: UserProfile,
        current_mood: str,
        context: Dict[str, Any]
    ) -> PersonalizedRecommendation:
        """
        Generate personalized coping strategies based on user profile and context

        Args:
            user_profile: User's psychological profile
            current_mood: Current mood state ('low', 'medium', 'high')
            context: Current context (time, season, triggers, etc.)

        Returns:
            PersonalizedRecommendation with tailored strategies
        """
        logger.info(f"Generating personalized recommendations for user {user_profile.user_id}")

        # Get current time effectiveness
        current_time = context.get('time_of_day', 'morning')
        time_effectiveness = self.effectiveness_patterns.get(current_time, {})

        # Filter and score strategies
        scored_strategies = self._score_strategies_for_user(
            user_profile, current_mood, context, time_effectiveness
        )

        # Select top strategies
        top_strategies = sorted(
            scored_strategies.items(),
            key=lambda x: x[1]['total_score'],
            reverse=True
        )[:3]

        # Convert to CopingStrategy objects
        recommended_strategies = []
        for strategy_id, scores in top_strategies:
            strategy = self.coping_strategies[strategy_id]
            recommended_strategies.append(strategy)

        # Generate rationale
        rationale = self._generate_recommendation_rationale(
            recommended_strategies, user_profile, current_mood, context
        )

        # Calculate confidence and expected improvement
        confidence = self._calculate_recommendation_confidence(
            recommended_strategies, user_profile
        )

        expected_improvement = self._estimate_mood_improvement(
            recommended_strategies, current_mood
        )

        # Get alternative options
        alternative_strategies = self._get_alternative_strategies(
            recommended_strategies, scored_strategies
        )

        return PersonalizedRecommendation(
            strategies=recommended_strategies,
            rationale=rationale,
            confidence_score=confidence,
            expected_improvement=expected_improvement,
            alternative_options=alternative_strategies
        )

    def _score_strategies_for_user(
        self,
        user_profile: UserProfile,
        current_mood: str,
        context: Dict[str, Any],
        time_effectiveness: Dict[str, float]
    ) -> Dict[str, Dict[str, float]]:
        """Score all strategies for the user"""
        scored_strategies = {}

        for strategy_id, strategy in self.coping_strategies.items():
            scores = {
                'base_effectiveness': strategy.effectiveness_score,
                'time_score': 1.0,
                'mood_relevance': 1.0,
                'user_preference': 1.0,
                'prerequisites_met': 1.0,
                'total_score': 0.0
            }

            # Time effectiveness
            if strategy.recommended_time != 'any':
                if strategy.recommended_time == context.get('time_of_day'):
                    scores['time_score'] = 1.2
                else:
                    scores['time_score'] = 0.8

            # Apply time-based effectiveness patterns
            strategy_category = self._get_strategy_category(strategy)
            if strategy_category in time_effectiveness:
                scores['time_score'] *= time_effectiveness[strategy_category]

            # Mood relevance
            scores['mood_relevance'] = self._calculate_mood_relevance(
                strategy, current_mood
            )

            # User preference (based on past effectiveness)
            if strategy_id in user_profile.preferred_strategies:
                scores['user_preference'] = 1.3
            elif user_profile.coping_history:
                # Check historical effectiveness
                historical_scores = [
                    h.get('effectiveness', 1.0)
                    for h in user_profile.coping_history
                    if h.get('strategy_id') == strategy_id
                ]
                if historical_scores:
                    avg_historical = np.mean(historical_scores)
                    scores['user_preference'] = 0.8 + (avg_historical * 0.4)

            # Prerequisites check
            unmet_prereqs = [
                prereq for prereq in strategy.prerequisites
                if prereq not in context.get('available_resources', [])
            ]
            if unmet_prereqs:
                scores['prerequisites_met'] = 0.3  # Significant penalty

            # Calculate total score
            scores['total_score'] = (
                scores['base_effectiveness'] * 0.3 +
                scores['time_score'] * 0.2 +
                scores['mood_relevance'] * 0.25 +
                scores['user_preference'] * 0.15 +
                scores['prerequisites_met'] * 0.1
            )

            scored_strategies[strategy_id] = scores

        return scored_strategies

    def _calculate_mood_relevance(self, strategy: CopingStrategy, current_mood: str) -> float:
        """Calculate how relevant a strategy is for current mood"""
        mood_relevance_map = {
            'low': {
                'immediate': 1.3,  # Immediate relief most important
                'short_term': 1.1,
                'long_term': 0.8
            },
            'medium': {
                'immediate': 1.0,
                'short_term': 1.2,  # Building resilience
                'long_term': 1.1
            },
            'high': {
                'immediate': 0.8,
                'short_term': 1.0,
                'long_term': 1.3  # Maintenance and growth
            }
        }

        return mood_relevance_map.get(current_mood, {}).get(strategy.category, 1.0)

    def _get_strategy_category(self, strategy: CopingStrategy) -> str:
        """Map strategy to broader category for effectiveness patterns"""
        category_map = {
            'deep_breathing': 'meditation',
            'progressive_muscle_relaxation': 'meditation',
            'grounding_technique': 'meditation',
            'walk_in_nature': 'physical_activity',
            'creative_writing': 'creative_expression',
            'music_therapy': 'creative_expression',
            'mindfulness_practice': 'meditation',
            'gratitude_journal': 'creative_expression',
            'social_connection': 'social_connection'
        }

        return category_map.get(strategy.strategy_id, 'meditation')

    def _generate_recommendation_rationale(
        self,
        strategies: List[CopingStrategy],
        user_profile: UserProfile,
        current_mood: str,
        context: Dict[str, Any]
    ) -> str:
        """Generate explanation for recommendations"""
        time_of_day = context.get('time_of_day', 'morning')
        season = context.get('season', 'spring')

        rationale_parts = []

        # Time-based rationale
        if time_of_day == 'morning':
            rationale_parts.append("På morgonen rekommenderar vi aktiviteter som kan ge energi och fokus för dagen.")
        elif time_of_day == 'evening':
            rationale_parts.append("På kvällen fokuserar vi på avslappning och återhämtning inför natten.")
        elif time_of_day == 'afternoon':
            rationale_parts.append("På eftermiddagen passar aktiviteter som kan hjälpa till att behålla balansen.")

        # Mood-based rationale
        if current_mood == 'low':
            rationale_parts.append("Vid lågt humör prioriterar vi snabba tekniker för omedelbar lättnad.")
        elif current_mood == 'high':
            rationale_parts.append("Vid högt humör rekommenderar vi strategier för att bibehålla och stärka det positiva.")

        # Personalization rationale
        if user_profile.preferred_strategies:
            rationale_parts.append("Vi har också tagit hänsyn till strategier som fungerat bra för dig tidigare.")

        return " ".join(rationale_parts)

    def _calculate_recommendation_confidence(
        self,
        strategies: List[CopingStrategy],
        user_profile: UserProfile
    ) -> float:
        """Calculate confidence in recommendations"""
        confidence = 0.7  # Base confidence

        # Higher confidence if user has history
        if user_profile.coping_history:
            confidence += 0.1

        # Higher confidence for well-established strategies
        avg_effectiveness = np.mean([s.effectiveness_score for s in strategies])
        confidence += (avg_effectiveness - 0.7) * 0.2

        return min(0.95, confidence)

    def _estimate_mood_improvement(
        self,
        strategies: List[CopingStrategy],
        current_mood: str
    ) -> float:
        """Estimate expected mood improvement"""
        mood_improvement_map = {
            'low': {'immediate': 0.4, 'short_term': 0.6, 'long_term': 0.8},
            'medium': {'immediate': 0.2, 'short_term': 0.4, 'long_term': 0.6},
            'high': {'immediate': 0.1, 'short_term': 0.2, 'long_term': 0.3}
        }

        total_improvement = 0
        for strategy in strategies:
            base_improvement = mood_improvement_map.get(current_mood, {}).get(strategy.category, 0.2)
            total_improvement += base_improvement * strategy.effectiveness_score

        return min(1.0, total_improvement / len(strategies))

    def _get_alternative_strategies(
        self,
        recommended: List[CopingStrategy],
        all_scored: Dict[str, Dict[str, float]]
    ) -> List[CopingStrategy]:
        """Get alternative strategy options"""
        recommended_ids = {s.strategy_id for s in recommended}

        # Get next best strategies not already recommended
        alternatives = []
        for strategy_id, scores in sorted(
            all_scored.items(),
            key=lambda x: x[1]['total_score'],
            reverse=True
        ):
            if strategy_id not in recommended_ids and len(alternatives) < 2:
                alternatives.append(self.coping_strategies[strategy_id])

        return alternatives

    def update_user_effectiveness(
        self,
        user_id: str,
        strategy_id: str,
        effectiveness_rating: float,
        mood_improvement: float
    ):
        """Update user's strategy effectiveness history"""
        logger.info(f"Updating effectiveness for user {user_id}, strategy {strategy_id}")

        # In a real implementation, this would update a database
        # For now, we'll log the update
        logger.info(f"Strategy {strategy_id} effectiveness: {effectiveness_rating}, mood improvement: {mood_improvement}")

    def get_user_insights(self, user_profile: UserProfile) -> Dict[str, Any]:
        """Generate insights about user's coping patterns"""
        insights = {
            'most_effective_time': self._find_most_effective_time(user_profile),
            'preferred_categories': self._find_preferred_categories(user_profile),
            'improvement_trends': self._analyze_improvement_trends(user_profile),
            'recommendations': []
        }

        # Generate personalized insights
        if insights['most_effective_time']:
            insights['recommendations'].append(
                f"Du verkar må bäst på {insights['most_effective_time']} - "
                "överväg att schemalägga viktiga coping-aktiviteter då."
            )

        return insights

    def _find_most_effective_time(self, user_profile: UserProfile) -> Optional[str]:
        """Find user's most effective time for coping strategies"""
        if not user_profile.effective_times:
            return None

        return max(user_profile.effective_times.items(), key=lambda x: x[1])[0]

    def _find_preferred_categories(self, user_profile: UserProfile) -> List[str]:
        """Find user's preferred coping categories"""
        category_counts = {}
        for strategy_id in user_profile.preferred_strategies:
            if strategy_id in self.coping_strategies:
                category = self.coping_strategies[strategy_id].category
                category_counts[category] = category_counts.get(category, 0) + 1

        return sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:2]

    def _analyze_improvement_trends(self, user_profile: UserProfile) -> str:
        """Analyze user's mood improvement trends"""
        if not user_profile.coping_history:
            return 'insufficient_data'

        # Simple trend analysis
        recent_history = user_profile.coping_history[-10:]  # Last 10 entries
        improvements = [h.get('mood_improvement', 0) for h in recent_history]

        if len(improvements) < 3:
            return 'insufficient_data'

        avg_improvement = np.mean(improvements)
        if avg_improvement > 0.3:
            return 'improving'
        elif avg_improvement > 0.1:
            return 'stable'
        else:
            return 'needs_attention'


# Singleton instance
personalization_engine = PersonalizationEngine()