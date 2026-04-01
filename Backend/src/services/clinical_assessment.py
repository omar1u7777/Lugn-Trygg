"""
Evidence-Based Clinical Assessment Integration
PHQ-9 (Depression), GAD-7 (Anxiety), and risk stratification
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    """Clinical risk stratification levels."""
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRISIS = "crisis"


@dataclass
class PHQ9Result:
    """PHQ-9 Depression screening results."""
    total_score: int  # 0-27
    severity: str
    risk_level: RiskLevel
    item_scores: dict[str, int]
    suicidal_ideation_flag: bool
    interpretation: str
    recommendations: list[str]


@dataclass
class GAD7Result:
    """GAD-7 Anxiety screening results."""
    total_score: int  # 0-21
    severity: str
    risk_level: RiskLevel
    item_scores: dict[str, int]
    interpretation: str
    recommendations: list[str]


@dataclass
class ClinicalRiskAssessment:
    """Comprehensive clinical risk assessment."""
    timestamp: datetime
    phq9_result: PHQ9Result | None
    gad7_result: GAD7Result | None
    composite_risk: RiskLevel
    risk_factors: list[str]
    protective_factors: list[str]
    immediate_concerns: list[str]
    suggested_interventions: list[str]
    follow_up_recommended: bool
    follow_up_timeframe: str


class PHQ9Assessment:
    """
    Patient Health Questionnaire-9 (PHQ-9) 
    Validated depression screening tool (Kroenke et al., 2001)
    """

    QUESTIONS = {
        'little_interest': 'Litet intresse eller glädje av att göra saker',
        'feeling_down': 'Känt dig nedstämd, deprimerad eller hopplös',
        'sleep_problems': 'Svårt att somna eller sova för mycket',
        'feeling_tired': 'Känt dig trött eller haft för liten energi',
        'appetite': 'Dålig aptit eller ätit för mycket',
        'feeling_bad': 'Känt dig dålig om dig själv eller att du svikit',
        'concentration': 'Svårt att koncentrera dig',
        'moving_slowly': 'Rört dig eller talat långsamt, eller varit rastlös',
        'self_harm': 'Tankar att du hellre ville vara död eller skada dig själv'
    }

    SEVERITY_LEVELS = [
        (0, 4, 'minimal', RiskLevel.NONE, 'Inga eller minimala depressionssymptom'),
        (5, 9, 'mild', RiskLevel.MILD, 'Lindrig depression - övervaka'),
        (10, 14, 'moderate', RiskLevel.MODERATE, 'Medelsvår depression - behandling rekommenderas'),
        (15, 19, 'moderately_severe', RiskLevel.SEVERE, 'Medelsvår till svår depression - aktiv behandling nödvändig'),
        (20, 27, 'severe', RiskLevel.CRISIS, 'Svår depression - omedelbar behandling krävs')
    ]

    @classmethod
    def calculate(cls, responses: dict[str, int]) -> PHQ9Result:
        """
        Calculate PHQ-9 score from responses.
        
        Args:
            responses: Dict mapping question keys to scores (0-3)
                      0=Not at all, 1=Several days, 2=More than half the days, 3=Nearly every day
        
        Returns:
            PHQ9Result with severity and recommendations
        """
        # Validate responses
        valid_scores = {0, 1, 2, 3}
        item_scores = {}

        for key, score in responses.items():
            if key in cls.QUESTIONS and score in valid_scores:
                item_scores[key] = score

        # Calculate total (use 0 for missing items)
        total = sum(item_scores.get(k, 0) for k in cls.QUESTIONS.keys())

        # Determine severity
        severity, risk_level, interpretation = cls._get_severity(total)

        # Check suicidal ideation (question 9)
        suicidal_ideation = item_scores.get('self_harm', 0) > 0

        # Generate recommendations
        recommendations = cls._generate_recommendations(total, suicidal_ideation, risk_level)

        return PHQ9Result(
            total_score=total,
            severity=severity,
            risk_level=risk_level,
            item_scores=item_scores,
            suicidal_ideation_flag=suicidal_ideation,
            interpretation=interpretation,
            recommendations=recommendations
        )

    @classmethod
    def _get_severity(cls, total: int) -> tuple[str, RiskLevel, str]:
        """Get severity level for total score."""
        for min_score, max_score, severity, risk, interpretation in cls.SEVERITY_LEVELS:
            if min_score <= total <= max_score:
                return severity, risk, interpretation
        return 'severe', RiskLevel.CRISIS, 'Svår depression - omedelbar behandling krävs'

    @classmethod
    def _generate_recommendations(cls, total: int, suicidal: bool, risk: RiskLevel) -> list[str]:
        """Generate evidence-based recommendations."""
        recs = []

        if suicidal:
            recs.append('⚠️ Omedelbar risk: Kontakta psykiatrisk akutmottagning eller ring 112')
            recs.append('📞 Krisstöd: Jourtelefon 90101 (dygnet runt)')

        if risk in [RiskLevel.SEVERE, RiskLevel.CRISIS]:
            recs.append('🏥 Kontakta vårdcentral eller psykiatri inom 24 timmar')
            recs.append('💬 Överväg akut psykoterapi-kontakt')
        elif risk == RiskLevel.MODERATE:
            recs.append('📅 Boka tid hos vårdcentral inom 1-2 veckor')
            recs.append('🧠 KBT-självhjälpsprogram i appen kan vara till hjälp')
        elif risk == RiskLevel.MILD:
            recs.append('📊 Fortsätt monitorera med dagliga PHQ-9')
            recs.append('🏃 Öka fysisk aktivitet och social kontakt')

        # Always add self-care
        recs.extend([
            '😴 Prioritera sömn (7-9 timmar)',
            '🌳 Daglig promenad i dagsljus',
            '📱 Använd appens CBT-övningar dagligen'
        ])

        return recs


class GAD7Assessment:
    """
    Generalized Anxiety Disorder-7 (GAD-7)
    Validated anxiety screening tool (Spitzer et al., 2006)
    """

    QUESTIONS = {
        'feeling_nervous': 'Känt dig nervös, ängslig eller på helspänn',
        'cant_control_worry': 'Inte kunnat sluta oroa dig eller kontrollera oron',
        'worrying_too_much': 'Oroat dig för mycket för olika saker',
        'trouble_relaxing': 'Haft svårt att koppla av',
        'restless': 'Varit så rastlös att du haft svårt att sitta stilla',
        'easily_annoyed': 'Blivit lätt irriterad eller retlig',
        'afraid': 'Känt dig rädd som om något hemskt skulle hända'
    }

    SEVERITY_LEVELS = [
        (0, 4, 'minimal', RiskLevel.NONE, 'Ingen eller minimal ångest'),
        (5, 9, 'mild', RiskLevel.MILD, 'Lindrig ångest'),
        (10, 14, 'moderate', RiskLevel.MODERATE, 'Medelsvår ångest - behandling rekommenderas'),
        (15, 21, 'severe', RiskLevel.SEVERE, 'Svår ångest - aktiv behandling nödvändig')
    ]

    @classmethod
    def calculate(cls, responses: dict[str, int]) -> GAD7Result:
        """Calculate GAD-7 score from responses."""
        valid_scores = {0, 1, 2, 3}
        item_scores = {}

        for key, score in responses.items():
            if key in cls.QUESTIONS and score in valid_scores:
                item_scores[key] = score

        total = sum(item_scores.get(k, 0) for k in cls.QUESTIONS.keys())

        severity, risk_level, interpretation = cls._get_severity(total)
        recommendations = cls._generate_recommendations(total, risk_level)

        return GAD7Result(
            total_score=total,
            severity=severity,
            risk_level=risk_level,
            item_scores=item_scores,
            interpretation=interpretation,
            recommendations=recommendations
        )

    @classmethod
    def _get_severity(cls, total: int) -> tuple[str, RiskLevel, str]:
        """Get severity level for total score."""
        for min_score, max_score, severity, risk, interpretation in cls.SEVERITY_LEVELS:
            if min_score <= total <= max_score:
                return severity, risk, interpretation
        return 'severe', RiskLevel.SEVERE, 'Svår ångest - aktiv behandling nödvändig'

    @classmethod
    def _generate_recommendations(cls, total: int, risk: RiskLevel) -> list[str]:
        """Generate evidence-based recommendations."""
        recs = []

        if risk in [RiskLevel.SEVERE]:
            recs.append('🏥 Kontakta vårdcentral eller psykiatri inom 1 vecka')
            recs.append('💊 Överväg medicinsk utvärdering för ångestdämpande')
        elif risk == RiskLevel.MODERATE:
            recs.append('📅 Boka tid hos vårdcentral inom 2-3 veckor')
            recs.append('🧠 MBSR (mindfulness) eller KBT-rekommenderas')
        elif risk == RiskLevel.MILD:
            recs.append('🧘 Prova dagliga andningsövningar i appen')
            recs.append('🏃 Regelbunden motion minskar ångest')

        # Always add
        recs.extend([
            '😴 God sömn är avgörande för ångesthantering',
            '☕ Minska koffeinintag',
            '📱 Använd appens ångesthanteringsverktyg'
        ])

        return recs


class ClinicalRiskStratification:
    """
    Evidence-based clinical risk stratification combining multiple indicators.
    """

    # Risk thresholds based on clinical literature
    RISK_THRESHOLDS = {
        'phq9_crisis': 20,
        'phq9_severe': 15,
        'phq9_moderate': 10,
        'phq9_mild': 5,
        'gad7_severe': 15,
        'gad7_moderate': 10,
        'mood_decline_days': 7,
        'mood_decline_threshold': -0.5,
        'crisis_keywords': ['suicid', 'döda mig', 'vilja dö', 'inte orka', 'sluta leva'],
        'consecutive_negative_days': 5,
        'sleep_deprivation_days': 3,
        'social_withdrawal_days': 7
    }

    @classmethod
    def assess_comprehensive_risk(
        cls,
        user_id: str,
        phq9_result: PHQ9Result | None = None,
        gad7_result: GAD7Result | None = None,
        recent_moods: list[dict] | None = None,
        contextual_factors: dict | None = None
    ) -> ClinicalRiskAssessment:
        """
        Perform comprehensive clinical risk assessment.
        """
        timestamp = datetime.now()
        risk_factors = []
        protective_factors = []
        immediate_concerns = []

        # PHQ-9 risk assessment
        if phq9_result:
            if phq9_result.suicidal_ideation_flag:
                immediate_concerns.append('suicidal_ideation')
                risk_factors.append(f"Suicidal ideation: PHQ-9 Q9={phq9_result.item_scores.get('self_harm', 0)}")

            if phq9_result.total_score >= cls.RISK_THRESHOLDS['phq9_crisis']:
                immediate_concerns.append('severe_depression')

            if phq9_result.total_score >= 10:
                risk_factors.append(f"PHQ-9 score: {phq9_result.total_score} ({phq9_result.severity})")
            else:
                protective_factors.append(f"Low PHQ-9: {phq9_result.total_score}")

        # GAD-7 risk assessment
        if gad7_result:
            if gad7_result.total_score >= 15:
                immediate_concerns.append('severe_anxiety')

            if gad7_result.total_score >= 10:
                risk_factors.append(f"GAD-7 score: {gad7_result.total_score} ({gad7_result.severity})")
            else:
                protective_factors.append(f"Low GAD-7: {gad7_result.total_score}")

        # Mood trajectory analysis
        if recent_moods and len(recent_moods) >= 7:
            # Check for rapid decline
            recent_valences = [m.get('valence', 0) for m in recent_moods[-7:]]
            if len(recent_valences) >= 3:
                trend = (recent_valences[-1] - recent_valences[0]) / len(recent_valences)
                if trend < -0.1:  # Declining more than 0.1 per entry
                    risk_factors.append(f"Mood declining trend: {trend:.2f}/entry")

            # Check consecutive negative days
            negative_streak = 0
            for mood in reversed(recent_moods):
                if mood.get('valence', 0) < -0.3:
                    negative_streak += 1
                else:
                    break
            if negative_streak >= cls.RISK_THRESHOLDS['consecutive_negative_days']:
                immediate_concerns.append(f'{negative_streak}_consecutive_negative_days')
                risk_factors.append(f"{negative_streak} consecutive negative days")

        # Contextual factors
        if contextual_factors:
            if contextual_factors.get('sleep_hours', 7) < 5:
                risk_factors.append("Sleep deprivation (<5 hours)")

            if contextual_factors.get('days_since_social_contact', 0) > 3:
                risk_factors.append("Social isolation >3 days")

            if contextual_factors.get('recent_crisis', False):
                immediate_concerns.append('recent_life_crisis')

        # Determine composite risk level
        composite_risk = cls._calculate_composite_risk(
            phq9_result, gad7_result, immediate_concerns, risk_factors, protective_factors
        )

        # Generate interventions
        interventions = cls._generate_interventions(
            composite_risk, immediate_concerns, phq9_result, gad7_result
        )

        # Determine follow-up
        follow_up_recommended = composite_risk in [
            RiskLevel.MODERATE, RiskLevel.SEVERE, RiskLevel.CRISIS
        ]

        follow_up_timeframe = {
            RiskLevel.CRISIS: '24_hours',
            RiskLevel.SEVERE: '1_week',
            RiskLevel.MODERATE: '2_weeks',
            RiskLevel.MILD: '1_month',
            RiskLevel.NONE: 'routine'
        }.get(composite_risk, 'routine')

        return ClinicalRiskAssessment(
            timestamp=timestamp,
            phq9_result=phq9_result,
            gad7_result=gad7_result,
            composite_risk=composite_risk,
            risk_factors=risk_factors,
            protective_factors=protective_factors,
            immediate_concerns=immediate_concerns,
            suggested_interventions=interventions,
            follow_up_recommended=follow_up_recommended,
            follow_up_timeframe=follow_up_timeframe
        )

    @classmethod
    def _calculate_composite_risk(
        cls,
        phq9: PHQ9Result | None,
        gad7: GAD7Result | None,
        immediate: list[str],
        risk_factors: list[str],
        protective: list[str]
    ) -> RiskLevel:
        """Calculate composite risk level."""
        # Immediate concerns override everything
        if 'suicidal_ideation' in immediate:
            return RiskLevel.CRISIS

        if any(c in immediate for c in ['severe_depression', 'severe_anxiety']):
            return RiskLevel.SEVERE

        # Combine scale scores
        phq9_level = phq9.risk_level if phq9 else RiskLevel.NONE
        gad7_level = gad7.risk_level if gad7 else RiskLevel.NONE

        # Take maximum
        risk_priority = [
            RiskLevel.CRISIS, RiskLevel.SEVERE, RiskLevel.MODERATE,
            RiskLevel.MILD, RiskLevel.NONE
        ]

        max_risk_idx = max(
            risk_priority.index(phq9_level),
            risk_priority.index(gad7_level)
        )

        # Adjust based on number of risk factors
        if len(risk_factors) >= 4 and max_risk_idx < risk_priority.index(RiskLevel.SEVERE):
            max_risk_idx += 1

        # Protective factors can reduce risk (but not below MODERATE if any immediate concern)
        if len(protective) >= 3 and 'consecutive_negative_days' not in immediate:
            max_risk_idx = max(0, max_risk_idx - 1)

        return risk_priority[max_risk_idx]

    @classmethod
    def _generate_interventions(
        cls,
        risk: RiskLevel,
        immediate: list[str],
        phq9: PHQ9Result | None,
        gad7: GAD7Result | None
    ) -> list[str]:
        """Generate evidence-based interventions."""
        interventions = []

        if risk == RiskLevel.CRISIS or 'suicidal_ideation' in immediate:
            interventions.extend([
                'CREATE_SAFETY_PLAN',
                'IMMEDIATE_CRISIS_INTERVENTION',
                'URGENT_REFERRAL_PSYCHIATRY',
                'REMOVE_MEANS_SELF_HARM',
                'INVOLVE_FAMILY_SUPPORT'
            ])
        elif risk == RiskLevel.SEVERE:
            interventions.extend([
                'URGENT_THERAPY_REFERRAL',
                'MEDICATION_EVALUATION',
                'DAILY_MONITORING',
                'SLEEP_INTERVENTION',
                'BEHAVIORAL_ACTIVATION'
            ])
        elif risk == RiskLevel.MODERATE:
            interventions.extend([
                'CBT_THERAPY_REFERRAL',
                'DAILY_MOOD_TRACKING',
                'BEHAVIORAL_ACTIVATION',
                'SLEEP_HYGIENE_PROTOCOL',
                'SOCIAL_RECONNECTION'
            ])
        elif risk == RiskLevel.MILD:
            interventions.extend([
                'SELF_HELP_CBT_MODULES',
                'WEEKLY_MONITORING',
                'LIFESTYLE_INTERVENTIONS'
            ])
        else:
            interventions.append('PREVENTIVE_MAINTENANCE')

        return interventions


# Service functions
def calculate_phq9(responses: dict[str, int]) -> PHQ9Result:
    """Calculate PHQ-9 score."""
    return PHQ9Assessment.calculate(responses)


def calculate_gad7(responses: dict[str, int]) -> GAD7Result:
    """Calculate GAD-7 score."""
    return GAD7Assessment.calculate(responses)


def assess_clinical_risk(
    user_id: str,
    phq9_responses: dict[str, int] | None = None,
    gad7_responses: dict[str, int] | None = None,
    recent_moods: list[dict] | None = None
) -> ClinicalRiskAssessment:
    """
    Perform comprehensive clinical risk assessment.
    """
    phq9 = calculate_phq9(phq9_responses) if phq9_responses else None
    gad7 = calculate_gad7(gad7_responses) if gad7_responses else None

    return ClinicalRiskStratification.assess_comprehensive_risk(
        user_id=user_id,
        phq9_result=phq9,
        gad7_result=gad7,
        recent_moods=recent_moods
    )
