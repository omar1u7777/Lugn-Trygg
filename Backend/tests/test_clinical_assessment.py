"""Tests for the PHQ-9 / GAD-7 clinical risk stratification logic.

ClinicalRiskStratification.assess_comprehensive_risk() combines a user's
PHQ-9 and GAD-7 results into one composite risk level. This is pure,
Firestore-free logic, so it's tested directly against the dataclasses
rather than through the Flask routes.
"""
from src.services.clinical_assessment import (
    ClinicalRiskStratification,
    GAD7Result,
    PHQ9Assessment,
    PHQ9Result,
    RiskLevel,
)


def _phq9(score, severity, risk, suicidal=False, self_harm=0):
    return PHQ9Result(
        total_score=score, severity=severity, risk_level=risk,
        item_scores={}, suicidal_ideation_flag=suicidal, self_harm_score=self_harm,
        interpretation="", recommendations=[], follow_up_timeframe="",
    )


def _gad7(score, severity, risk):
    return GAD7Result(
        total_score=score, severity=severity, risk_level=risk,
        item_scores={}, interpretation="", recommendations=[], follow_up_timeframe="",
    )


class TestCompositeRiskSeverityCombination:
    """The composite risk must reflect the *more* severe of PHQ-9/GAD-7,
    not the less severe one -- a SEVERE depression score with no anxiety
    screening taken must not silently report as NONE."""

    def test_severe_phq9_alone_is_not_diluted_to_none(self):
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u", phq9_result=_phq9(17, "moderately_severe", RiskLevel.SEVERE),
            gad7_result=None, recent_moods=None,
        )
        assert result.composite_risk == RiskLevel.SEVERE

    def test_takes_the_more_severe_of_the_two_scales(self):
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u",
            phq9_result=_phq9(6, "mild", RiskLevel.MILD),
            gad7_result=_gad7(17, "severe", RiskLevel.SEVERE),
            recent_moods=None,
        )
        assert result.composite_risk == RiskLevel.SEVERE

    def test_both_minimal_is_none(self):
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u",
            phq9_result=_phq9(2, "minimal", RiskLevel.NONE),
            gad7_result=_gad7(2, "minimal", RiskLevel.NONE),
            recent_moods=None,
        )
        assert result.composite_risk == RiskLevel.NONE

    def test_suicidal_ideation_forces_crisis_regardless_of_other_scores(self):
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u",
            phq9_result=_phq9(6, "mild", RiskLevel.MILD, suicidal=True, self_harm=1),
            gad7_result=None,
            recent_moods=None,
        )
        assert result.composite_risk == RiskLevel.CRISIS


class TestRiskFactorEscalation:
    def test_four_or_more_risk_factors_escalates_moderate_toward_severe(self):
        moods = [{"valence": -0.6}] * 10
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u",
            phq9_result=_phq9(12, "moderate", RiskLevel.MODERATE),
            gad7_result=_gad7(12, "moderate", RiskLevel.MODERATE),
            recent_moods=moods,
            contextual_factors={"sleep_hours": 3, "days_since_social_contact": 5},
        )
        assert len(result.risk_factors) >= 4
        assert result.composite_risk == RiskLevel.SEVERE

    def test_escalation_never_reaches_crisis_without_an_immediate_concern(self):
        moods = [{"valence": -0.6}] * 10
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u",
            phq9_result=_phq9(12, "moderate", RiskLevel.MODERATE),
            gad7_result=_gad7(12, "moderate", RiskLevel.MODERATE),
            recent_moods=moods,
            contextual_factors={"sleep_hours": 3, "days_since_social_contact": 5, "recent_crisis": True},
        )
        # recent_crisis adds a 5th risk factor and an immediate concern that is
        # NOT suicidal_ideation/severe_*, so escalation should still cap at SEVERE.
        assert result.composite_risk in (RiskLevel.SEVERE, RiskLevel.MODERATE)
        assert result.composite_risk != RiskLevel.CRISIS


class TestConsecutiveNegativeDaysGuard:
    def test_negative_streak_concern_is_detected_by_suffix_not_exact_match(self):
        # immediate_concerns stores "<N>_consecutive_negative_days", never the
        # bare "consecutive_negative_days" -- the guard must match on suffix.
        moods = [{"valence": -0.6}] * 10
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u",
            phq9_result=_phq9(3, "minimal", RiskLevel.NONE),
            gad7_result=_gad7(3, "minimal", RiskLevel.NONE),
            recent_moods=moods,
        )
        assert any(c.endswith("_consecutive_negative_days") for c in result.immediate_concerns)


class TestPHQ9SelfHarmRecommendationSeverity:
    """A Q9 score of 1 ("several days") must not get the same "call 112 now"
    emergency-services text as a score of 3 ("nearly every day") -- that
    threshold must match _follow_up_timeframe's and the frontend's own
    self_harm_score >= 2 cutoff for the most urgent framing."""

    def test_low_self_harm_score_gets_calibrated_not_emergency_text(self):
        responses = {
            "little_interest": 0, "feeling_down": 0, "sleep_problems": 0,
            "feeling_tired": 0, "appetite": 0, "feeling_bad": 0,
            "concentration": 0, "moving_slowly": 0, "self_harm": 1,
        }
        result = PHQ9Assessment.calculate(responses)
        assert result.suicidal_ideation_flag is True
        assert result.self_harm_score == 1
        assert not any("ring 112" in r for r in result.recommendations)
        assert any("90101" in r for r in result.recommendations)

    def test_high_self_harm_score_gets_emergency_text(self):
        responses = {
            "little_interest": 0, "feeling_down": 0, "sleep_problems": 0,
            "feeling_tired": 0, "appetite": 0, "feeling_bad": 0,
            "concentration": 0, "moving_slowly": 0, "self_harm": 3,
        }
        result = PHQ9Assessment.calculate(responses)
        assert result.self_harm_score == 3
        assert any("ring 112" in r for r in result.recommendations)
        assert result.follow_up_timeframe == "24_hours"
