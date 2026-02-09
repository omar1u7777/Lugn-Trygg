"""
Predictive Crisis Intervention Service for Lugn & Trygg
Early detection and intervention for mental health crises
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

@dataclass
class CrisisIndicator:
    """Indicator of potential crisis"""
    indicator_id: str
    name: str
    category: str  # 'behavioral', 'emotional', 'cognitive', 'physical'
    severity_level: str  # 'low', 'medium', 'high', 'critical'
    detection_rules: dict[str, Any]
    intervention_triggers: list[str]
    swedish_description: str
    risk_weight: float

@dataclass
class CrisisAssessment:
    """Assessment of user's crisis risk"""
    user_id: str
    overall_risk_level: str
    risk_score: float
    active_indicators: list[CrisisIndicator]
    risk_trends: dict[str, Any]
    intervention_recommendations: list[str]
    assessment_timestamp: datetime
    confidence_score: float

@dataclass
class InterventionProtocol:
    """Protocol for crisis intervention"""
    protocol_id: str
    name: str
    risk_level: str
    immediate_actions: list[str]
    support_resources: list[dict[str, str]]
    follow_up_steps: list[str]
    escalation_criteria: dict[str, Any]
    swedish_guidance: str

class CrisisInterventionService:
    """Intelligent crisis detection and intervention system"""

    def __init__(self):
        self.crisis_indicators = self._initialize_crisis_indicators()
        self.intervention_protocols = self._initialize_intervention_protocols()

        # Risk thresholds
        self.risk_thresholds = {
            'low': 0.3,
            'medium': 0.6,
            'high': 0.8,
            'critical': 0.95
        }

    def _initialize_crisis_indicators(self) -> dict[str, CrisisIndicator]:
        """Initialize comprehensive crisis indicators database"""
        indicators = {}

        # Behavioral Indicators
        indicators['social_withdrawal'] = CrisisIndicator(
            indicator_id='social_withdrawal',
            name='Social Isolering',
            category='behavioral',
            severity_level='medium',
            detection_rules={
                'no_social_interaction_days': 7,
                'declining_social_activity': 0.5,  # 50% reduction
                'avoidance_patterns': ['social_events', 'phone_calls', 'messages']
            },
            intervention_triggers=['immediate_support_check', 'social_connection_reminder'],
            swedish_description='Minskad social interaktion och isolering från andra',
            risk_weight=0.7
        )

        indicators['sleep_disturbance'] = CrisisIndicator(
            indicator_id='sleep_disturbance',
            name='Sömnstörningar',
            category='physical',
            severity_level='medium',
            detection_rules={
                'insomnia_nights': 5,
                'sleep_duration_change': -0.4,  # 40% reduction
                'sleep_quality_score': 2.0  # Below 3/10
            },
            intervention_triggers=['sleep_hygiene_reminder', 'relaxation_techniques'],
            swedish_description='Allvarliga sömnproblem som påverkar återhämtning',
            risk_weight=0.6
        )

        indicators['appetite_changes'] = CrisisIndicator(
            indicator_id='appetite_changes',
            name='Aptitförändringar',
            category='physical',
            severity_level='medium',
            detection_rules={
                'no_meals_days': 3,
                'appetite_change_percentage': 0.6,  # 60% change
                'weight_change_kg': 3.0
            },
            intervention_triggers=['nutrition_support', 'eating_pattern_monitoring'],
            swedish_description='Signifikanta förändringar i ätande och aptit',
            risk_weight=0.5
        )

        # Emotional Indicators
        indicators['severe_mood_decline'] = CrisisIndicator(
            indicator_id='severe_mood_decline',
            name='Svår Sinnesstämningsförsämring',
            category='emotional',
            severity_level='high',
            detection_rules={
                'mood_score_drop': 3.0,  # Drop of 3+ points
                'persistent_low_mood_days': 14,
                'emotional_numbing': True
            },
            intervention_triggers=['crisis_hotline_referral', 'immediate_professional_help'],
            swedish_description='Allvarlig och ihållande nedstämdhet eller depression',
            risk_weight=0.9
        )

        indicators['anxiety_spike'] = CrisisIndicator(
            indicator_id='anxiety_spike',
            name='Ångestattack',
            category='emotional',
            severity_level='high',
            detection_rules={
                'anxiety_score': 8.0,  # Above 8/10
                'panic_attack_frequency': 3,  # 3+ per week
                'avoidance_behaviors': ['work', 'social', 'daily_activities']
            },
            intervention_triggers=['anxiety_coping_techniques', 'professional_referral'],
            swedish_description='Svåra ångestattacker eller panikångest',
            risk_weight=0.8
        )

        indicators['emotional_instability'] = CrisisIndicator(
            indicator_id='emotional_instability',
            name='Emotionell Instabilitet',
            category='emotional',
            severity_level='medium',
            detection_rules={
                'mood_swings_per_day': 5,
                'emotional_intensity_score': 4.0,  # Above 7/10
                'irritability_incidents': 10  # Per week
            },
            intervention_triggers=['emotional_regulation_techniques', 'mood_stabilization_plan'],
            swedish_description='Snabbt växlande känslor och emotionell instabilitet',
            risk_weight=0.6
        )

        # Cognitive Indicators
        indicators['suicidal_ideation'] = CrisisIndicator(
            indicator_id='suicidal_ideation',
            name='Självmordstankar',
            category='cognitive',
            severity_level='critical',
            detection_rules={
                'suicidal_keywords': ['suicide', 'end_it', 'not_worth_living', 'better_off_dead'],
                'hopelessness_score': 9.0,  # Above 9/10
                'self_harm_ideation': True
            },
            intervention_triggers=['emergency_services', 'crisis_hotline_immediate', 'safety_plan_activation'],
            swedish_description='Tankar på självmord eller självskada - KRITISKT',
            risk_weight=1.0
        )

        indicators['cognitive_distortion_extreme'] = CrisisIndicator(
            indicator_id='cognitive_distortion_extreme',
            name='Extrema Kognitiva Förvrängningar',
            category='cognitive',
            severity_level='high',
            detection_rules={
                'all_or_nothing_thinking': 0.9,  # 90% of thoughts
                'worthlessness_intensity': 5.0,  # Above 8/10
                'catastrophic_thinking': True
            },
            intervention_triggers=['cognitive_restructuring_urgent', 'professional_intervention'],
            swedish_description='Extrema negativa tankeprocesser som hotar välbefinnandet',
            risk_weight=0.8
        )

        indicators['concentration_problems'] = CrisisIndicator(
            indicator_id='concentration_problems',
            name='Koncentrationssvårigheter',
            category='cognitive',
            severity_level='medium',
            detection_rules={
                'concentration_score': 2.0,  # Below 3/10
                'task_completion_failure_rate': 0.8,  # 80% failure rate
                'memory_problems_reported': True
            },
            intervention_triggers=['focus_techniques', 'cognitive_assessment'],
            swedish_description='Allvarliga svårigheter att koncentrera sig eller minnas',
            risk_weight=0.5
        )

        # Pattern-based Indicators
        indicators['rapid_deterioration'] = CrisisIndicator(
            indicator_id='rapid_deterioration',
            name='Snabb Försämring',
            category='behavioral',
            severity_level='high',
            detection_rules={
                'mood_decline_rate': 1.0,  # 1+ point per day decline
                'functioning_drop_days': 3,
                'sudden_change_indicators': ['job_loss', 'relationship_breakup', 'trauma']
            },
            intervention_triggers=['immediate_support', 'crisis_monitoring', 'professional_help'],
            swedish_description='Snabb försämring av psykiskt tillstånd och funktion',
            risk_weight=0.9
        )

        indicators['chronic_stress_burnout'] = CrisisIndicator(
            indicator_id='chronic_stress_burnout',
            name='Kronisk Stress/Utmattning',
            category='physical',
            severity_level='medium',
            detection_rules={
                'chronic_stress_months': 3,
                'burnout_symptoms': ['exhaustion', 'cynicism', 'reduced_efficacy'],
                'cortisol_disruption': True
            },
            intervention_triggers=['stress_management_plan', 'work_life_balance', 'recovery_program'],
            swedish_description='Långvarig stress som leder till utmattning',
            risk_weight=0.7
        )

        return indicators

    def _initialize_intervention_protocols(self) -> dict[str, InterventionProtocol]:
        """Initialize intervention protocols for different risk levels"""
        protocols = {}

        # Low Risk Protocol
        protocols['low_risk_support'] = InterventionProtocol(
            protocol_id='low_risk_support',
            name='Stöd vid Låg Risk',
            risk_level='low',
            immediate_actions=[
                'Skicka uppmuntrande meddelande',
                'Föreslå lätta coping-strategier',
                'Påminn om dagliga rutiner'
            ],
            support_resources=[
                {'name': 'Mindfulness-app', 'type': 'app', 'url': 'internal://mindfulness'},
                {'name': 'Vänner och familj', 'type': 'social', 'description': 'Prata med nära och kära'},
                {'name': 'Daglig promenad', 'type': 'activity', 'description': '30 minuters promenad utomhus'}
            ],
            follow_up_steps=[
                'Daglig check-in under en vecka',
                'Uppföljning av coping-strategier',
                'Utvärdering av förbättring'
            ],
            escalation_criteria={
                'no_improvement_days': 5,
                'worsening_symptoms': True,
                'new_crisis_indicators': 2
            },
            swedish_guidance="""
            Du visar tecken på mild stress eller nedstämdhet. Detta är vanligt och hanterbart.
            Fokusera på självvård och positiva aktiviteter. Om symtomen kvarstår eller förvärras,
            överväg att söka professionell hjälp.
            """
        )

        # Medium Risk Protocol
        protocols['medium_risk_intervention'] = InterventionProtocol(
            protocol_id='medium_risk_intervention',
            name='Intervention vid Medelhög Risk',
            risk_level='medium',
            immediate_actions=[
                'Skicka personligt stödmeddelande',
                'Aktivera dagliga påminnelser om coping-strategier',
                'Föreslå professionell konsultation',
                'Öka frekvens av mood-tracking'
            ],
            support_resources=[
                {'name': '1177 Vårdguiden', 'type': 'hotline', 'phone': '1177', 'description': 'Sjukvårdsrådgivning'},
                {'name': 'Psykologisk behandling', 'type': 'professional', 'description': 'KBT eller annan terapi'},
                {'name': 'Stödgrupper', 'type': 'community', 'description': 'Lokala eller online stödgrupper'},
                {'name': 'Krisjouren', 'type': 'hotline', 'phone': '90101', 'description': 'Dygnet runt stöd'}
            ],
            follow_up_steps=[
                'Dagliga check-ins under två veckor',
                'Veckovis uppföljning med professionell',
                'Utvärdering av interventions-effektivitet',
                'Justering av behandlingsplan'
            ],
            escalation_criteria={
                'no_improvement_days': 3,
                'symptom_worsening': True,
                'suicidal_ideation': True,
                'functional_impairment': 'severe'
            },
            swedish_guidance="""
            Vi har upptäckt flera indikationer som tyder på måttlig psykisk påfrestning.
            Det är viktigt att du får stöd nu. Kontakta en professionell vårdgivare eller
            ring 1177 för rådgivning. Du är inte ensam i detta.
            """
        )

        # High Risk Protocol
        protocols['high_risk_crisis'] = InterventionProtocol(
            protocol_id='high_risk_crisis',
            name='Krisintervention vid Hög Risk',
            risk_level='high',
            immediate_actions=[
                'Omedelbar varning till användaren',
                'Automatisk kontakt med nödkontakt',
                'Aktivering av säkerhetsplan',
                'Skicka professionell hjälpresurs-info',
                'Öka övervakningsfrekvens'
            ],
            support_resources=[
                {'name': 'Rädda Livet', 'type': 'emergency', 'phone': '112', 'description': 'Omedelbar hjälp'},
                {'name': 'Krisjouren', 'type': 'hotline', 'phone': '90101', 'description': 'Dygnet runt krisstöd'},
                {'name': 'Akut psykiatrisk vård', 'type': 'emergency', 'description': 'Sök närmaste akutmottagning'},
                {'name': 'Självmordslinjen', 'type': 'hotline', 'phone': '90101', 'description': 'Specialiserat stöd'}
            ],
            follow_up_steps=[
                'Omedelbar professionell bedömning',
                'Daglig uppföljning under krisperiod',
                'Säkerhetsplan-utvärdering',
                'Långsiktig behandlingsplan',
                'Stöd till familj/nära'
            ],
            escalation_criteria={
                'immediate_danger': True,
                'suicidal_ideation': 'active',
                'self_harm_risk': 'high',
                'psychotic_symptoms': True
            },
            swedish_guidance="""
            KRITISKT: Vi har upptäckt allvarliga tecken på psykisk kris som kräver omedelbar uppmärksamhet.
            Ring 112 om du känner att du är i fara eller har självmordstankar.
            Kontakta Krisjouren på 90101 för omedelbart stöd.
            Du kommer att få hjälp - håll ut.
            """
        )

        # Critical Risk Protocol
        protocols['critical_risk_emergency'] = InterventionProtocol(
            protocol_id='critical_risk_emergency',
            name='Nödsituation - Kritisk Risk',
            risk_level='critical',
            immediate_actions=[
                'AKUTVARNING: Omedelbar åtgärd krävs',
                'Automatisk larm till nödcentral',
                'Kontakt med alla registrerade nödkontakter',
                'Aktivering av alla säkerhetsprotokoll',
                'Skicka platsinformation till räddningstjänst'
            ],
            support_resources=[
                {'name': '112 - Rädda Livet', 'type': 'emergency', 'phone': '112', 'description': 'Omedelbar räddning'},
                {'name': 'Akut psykiatrisk vård', 'type': 'emergency', 'description': 'Sök närmaste akutmottagning NU'},
                {'name': 'Självmordslinjen', 'type': 'hotline', 'phone': '90101', 'description': 'Specialiserat akutstöd'}
            ],
            follow_up_steps=[
                'Omedelbar professionell intervention',
                'Psykiatrisk bedömning inom timmar',
                'Skyddad miljö om nödvändigt',
                'Krisinterventionsteam',
                'Familje- och anhörigstöd'
            ],
            escalation_criteria={
                'immediate_suicidal_risk': True,
                'active_self_harm': True,
                'psychotic_break': True,
                'complete_functional_breakdown': True
            },
            swedish_guidance="""
            KRITISKT NÖDLÄGE: Vi har upptäckt omedelbar fara för liv eller hälsa.
            Ring 112 NU och begär psykiatrisk akutvård.
            Hjälp är på väg. Håll ut - du är inte ensam.
            """
        )

        return protocols

    def assess_crisis_risk(self, user_context: dict[str, Any]) -> CrisisAssessment:
        """
        Assess user's current crisis risk based on comprehensive data analysis

        Args:
            user_context: Comprehensive user context including mood, behavior, etc.

        Returns:
            CrisisAssessment with risk level and intervention recommendations
        """
        logger.info(f"Assessing crisis risk for user {user_context.get('user_id', 'unknown')}")

        active_indicators = []
        total_risk_score = 0.0

        # Evaluate each crisis indicator
        for indicator in self.crisis_indicators.values():
            if self._evaluate_indicator(indicator, user_context):
                active_indicators.append(indicator)
                total_risk_score += indicator.risk_weight

        # Normalize risk score
        risk_score = min(1.0, total_risk_score / len(active_indicators)) if active_indicators else 0.0

        # Determine risk level
        risk_level = self._calculate_risk_level(risk_score)

        # Generate intervention recommendations
        intervention_recommendations = self._generate_interventions(risk_level, active_indicators, user_context)

        # Calculate confidence score
        confidence_score = self._calculate_assessment_confidence(active_indicators, user_context)

        # Analyze risk trends
        risk_trends = self._analyze_risk_trends(user_context)

        assessment = CrisisAssessment(
            user_id=user_context.get('user_id', 'unknown'),
            overall_risk_level=risk_level,
            risk_score=risk_score,
            active_indicators=active_indicators,
            risk_trends=risk_trends,
            intervention_recommendations=intervention_recommendations,
            assessment_timestamp=datetime.now(),
            confidence_score=confidence_score
        )

        logger.info(f"Crisis assessment complete: {risk_level} risk (score: {risk_score:.2f})")

        return assessment

    def _evaluate_indicator(self, indicator: CrisisIndicator, user_context: dict[str, Any]) -> bool:
        """Evaluate if a crisis indicator is active"""

        rules = indicator.detection_rules

        for rule_key, rule_value in rules.items():
            if rule_key == 'no_social_interaction_days':
                social_days = user_context.get('days_without_social_interaction', 0)
                if social_days >= rule_value:
                    return True

            elif rule_key == 'declining_social_activity':
                social_trend = user_context.get('social_activity_trend', 0)
                if social_trend <= (1 - rule_value):  # Reduction threshold
                    return True

            elif rule_key == 'avoidance_patterns':
                user_avoidance = user_context.get('avoidance_patterns', [])
                if any(pattern in user_avoidance for pattern in rule_value):
                    return True

            elif rule_key == 'insomnia_nights':
                insomnia_nights = user_context.get('insomnia_nights_last_week', 0)
                if insomnia_nights >= rule_value:
                    return True

            elif rule_key == 'sleep_duration_change':
                sleep_change = user_context.get('sleep_duration_change_percent', 0)
                if sleep_change <= rule_value:  # Negative change
                    return True

            elif rule_key == 'mood_score_drop':
                mood_drop = user_context.get('mood_score_drop_last_week', 0)
                if mood_drop >= rule_value:
                    return True

            elif rule_key == 'persistent_low_mood_days':
                low_mood_days = user_context.get('consecutive_low_mood_days', 0)
                if low_mood_days >= rule_value:
                    return True

            elif rule_key == 'anxiety_score':
                current_anxiety = user_context.get('current_anxiety_score', 0)
                if current_anxiety >= rule_value:
                    return True

            elif rule_key == 'suicidal_keywords':
                recent_text = user_context.get('recent_text_content', '').lower()
                if any(keyword in recent_text for keyword in rule_value):
                    return True

            elif rule_key == 'mood_decline_rate':
                decline_rate = user_context.get('mood_decline_points_per_day', 0)
                if decline_rate >= rule_value:
                    return True

        return False

    def _calculate_risk_level(self, risk_score: float) -> str:
        """Calculate risk level from score"""

        if risk_score >= self.risk_thresholds['critical']:
            return 'critical'
        elif risk_score >= self.risk_thresholds['high']:
            return 'high'
        elif risk_score >= self.risk_thresholds['medium']:
            return 'medium'
        elif risk_score >= self.risk_thresholds['low']:
            return 'low'
        else:
            return 'minimal'

    def _generate_interventions(
        self,
        risk_level: str,
        active_indicators: list[CrisisIndicator],
        user_context: dict[str, Any]
    ) -> list[str]:
        """Generate intervention recommendations"""

        protocol = self.intervention_protocols.get(f'{risk_level}_risk_protocol') or \
                  self.intervention_protocols.get(f'{risk_level}_risk_intervention') or \
                  self.intervention_protocols.get(f'{risk_level}_risk_crisis') or \
                  self.intervention_protocols.get(f'{risk_level}_risk_emergency')

        if not protocol:
            return ['Kontakta professionell hjälp om symtomen kvarstår']

        interventions = protocol.immediate_actions.copy()

        # Add indicator-specific interventions
        for indicator in active_indicators:
            interventions.extend(indicator.intervention_triggers)

        # Add resource recommendations
        for resource in protocol.support_resources:
            if resource['type'] in ['hotline', 'emergency']:
                interventions.append(f"Ring {resource['name']}: {resource.get('phone', 'N/A')}")

        # Remove duplicates and prioritize
        interventions = list(set(interventions))

        # Add Swedish guidance
        interventions.insert(0, protocol.swedish_guidance.strip())

        return interventions[:10]  # Limit to top 10

    def _calculate_assessment_confidence(
        self,
        active_indicators: list[CrisisIndicator],
        user_context: dict[str, Any]
    ) -> float:
        """Calculate confidence in the crisis assessment"""

        confidence = 0.5  # Base confidence

        # More indicators = higher confidence
        indicator_factor = min(0.3, len(active_indicators) * 0.1)
        confidence += indicator_factor

        # Recent data availability
        recent_data_days = user_context.get('recent_data_days', 0)
        data_factor = min(0.2, recent_data_days * 0.05)
        confidence += data_factor

        # Multiple data sources
        data_sources = sum([
            1 for key in ['mood_history', 'text_content', 'voice_analysis', 'behavior_patterns']
            if user_context.get(key) is not None
        ])
        source_factor = min(0.2, data_sources * 0.05)
        confidence += source_factor

        return min(0.95, confidence)

    def _analyze_risk_trends(self, user_context: dict[str, Any]) -> dict[str, Any]:
        """Analyze trends in crisis risk over time"""

        trends = {
            'risk_trajectory': 'stable',
            'change_rate': 0.0,
            'prediction_days': 7,
            'concerning_patterns': []
        }

        # Analyze mood trajectory
        mood_history = user_context.get('mood_history', [])
        if len(mood_history) >= 7:
            recent_moods = mood_history[-7:]
            older_moods = mood_history[-14:-7] if len(mood_history) >= 14 else mood_history[:-7]

            if older_moods:
                recent_avg = sum(recent_moods) / len(recent_moods)
                older_avg = sum(older_moods) / len(older_moods)
                change_rate = recent_avg - older_avg

                if change_rate < -1.0:
                    trends['risk_trajectory'] = 'deteriorating'
                    trends['concerning_patterns'].append('signifikant_mood_försämring')
                elif change_rate > 1.0:
                    trends['risk_trajectory'] = 'improving'
                    trends['concerning_patterns'].append('mood_förbättring')
                else:
                    trends['risk_trajectory'] = 'stable'

                trends['change_rate'] = change_rate

        # Check for concerning patterns
        if user_context.get('social_isolation_days', 0) >= 5:
            trends['concerning_patterns'].append('social_isolation')

        if user_context.get('sleep_problems_weeks', 0) >= 2:
            trends['concerning_patterns'].append('chronic_sleep_problems')

        return trends

    def get_emergency_protocol(self, risk_level: str) -> InterventionProtocol | None:
        """Get emergency intervention protocol for risk level"""
        protocol_key = f'{risk_level}_risk_emergency' if risk_level == 'critical' else f'{risk_level}_risk_crisis'
        return self.intervention_protocols.get(protocol_key)

    def should_escalate_crisis(self, assessment: CrisisAssessment, new_context: dict[str, Any]) -> bool:
        """Determine if crisis situation requires escalation"""

        # Check escalation criteria from protocol
        protocol = self.get_emergency_protocol(assessment.overall_risk_level)
        if not protocol:
            return False

        criteria = protocol.escalation_criteria

        for criterion_key, criterion_value in criteria.items():
            if criterion_key == 'no_improvement_days':
                # Check if symptoms persist without improvement
                last_assessment_days = (datetime.now() - assessment.assessment_timestamp).days
                if last_assessment_days >= criterion_value:
                    return True

            elif criterion_key == 'worsening_symptoms':
                # Check if new indicators have appeared
                new_assessment = self.assess_crisis_risk(new_context)
                if new_assessment.risk_score > assessment.risk_score:
                    return True

            elif criterion_key == 'immediate_danger':
                # Check for immediate danger indicators
                danger_indicators = new_context.get('immediate_danger_indicators', [])
                if danger_indicators:
                    return True

        return False

    def generate_safety_plan(self, user_context: dict[str, Any]) -> dict[str, Any]:
        """Generate a personalized safety plan for crisis prevention"""

        safety_plan = {
            'warning_signs': [],
            'coping_strategies': [],
            'support_contacts': [],
            'professional_help': [],
            'environmental_safety': [],
            'created_date': datetime.now().isoformat()
        }

        # Identify personal warning signs from history
        mood_patterns = user_context.get('mood_patterns', {})
        if mood_patterns.get('common_triggers'):
            safety_plan['warning_signs'].extend(mood_patterns['common_triggers'])

        # Add coping strategies
        effective_strategies = user_context.get('effective_coping_strategies', [])
        safety_plan['coping_strategies'].extend(effective_strategies[:5])

        # Add support contacts
        emergency_contacts = user_context.get('emergency_contacts', [])
        safety_plan['support_contacts'].extend(emergency_contacts)

        # Add professional resources
        safety_plan['professional_help'] = [
            {'name': 'Krisjouren', 'phone': '90101', 'description': 'Dygnet runt stöd'},
            {'name': '1177 Vårdguiden', 'phone': '1177', 'description': 'Medicinsk rådgivning'},
            {'name': 'Självmordslinjen', 'phone': '90101', 'description': 'Specialiserat stöd'}
        ]

        # Environmental safety measures
        safety_plan['environmental_safety'] = [
            'Ta bort skadliga föremål från hemmet',
            'Skapa en säker zon i hemmet',
            'Informera nära och kära om säkerhetsplanen',
            'Ha viktiga telefonnummer lätt tillgängliga'
        ]

        return safety_plan


# Singleton instance
crisis_intervention_service = CrisisInterventionService()
