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


class TestALowTotalMadeOfSelfHarmIsNotProtective:
    """UI audit 2026-09-29 (S-2) saw "Suicidal ideation: PHQ-9 Q9=3" under risk
    factors and "Low PHQ-9: 3" under protective factors on the same card. Both
    came from one assessment: Q9 alone contributed all three points."""

    def test_self_harm_driven_minimal_total_is_not_listed_as_protective(self):
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u",
            phq9_result=_phq9(3, "minimal", RiskLevel.NONE, suicidal=True, self_harm=3),
            gad7_result=None, recent_moods=None,
        )
        assert not any(f.startswith("Low PHQ-9") for f in result.protective_factors)
        assert result.composite_risk == RiskLevel.CRISIS

    def test_a_low_total_without_self_harm_still_counts(self):
        result = ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u", phq9_result=_phq9(3, "minimal", RiskLevel.NONE),
            gad7_result=None, recent_moods=None,
        )
        assert "Low PHQ-9: 3" in result.protective_factors


def _mood(day, score=None, valence=None):
    m = {"timestamp": f"2026-09-{day:02d}T09:00:00+00:00"}
    if score is not None:
        m["score"] = score
    if valence is not None:
        m["valence"] = valence
    return m


class TestMoodTrajectoryReadsStoredMoods:
    """The route fetches moods newest-first and stores ratings on 1-10. The
    engine assumed oldest-first on [-1, 1], with a missing valence read as 0."""

    def _assess(self, moods):
        return ClinicalRiskStratification.assess_comprehensive_risk(
            user_id="u", phq9_result=None, gad7_result=None, recent_moods=moods)

    def test_an_improving_week_passed_newest_first_is_not_a_decline(self):
        improving = [_mood(d, score=s) for d, s in zip(range(1, 8), [2, 3, 4, 5, 6, 7, 9], strict=True)]
        result = self._assess(list(reversed(improving)))
        assert not any("declining" in f for f in result.risk_factors)

    def test_a_declining_week_passed_newest_first_is_caught(self):
        declining = [_mood(d, score=s) for d, s in zip(range(1, 8), [9, 8, 7, 5, 4, 3, 2], strict=True)]
        result = self._assess(list(reversed(declining)))
        assert any("declining" in f for f in result.risk_factors)

    def test_unrated_entries_do_not_fabricate_a_decline(self):
        # One advanced entry with valence 9, six basic logs without valence
        # but with an unchanged score: the old code saw 9 -> 0 = -1.29/entry.
        moods = [_mood(1, score=8, valence=9)] + [_mood(d, score=8) for d in range(2, 8)]
        result = self._assess(list(reversed(moods)))
        assert not any("declining" in f for f in result.risk_factors)

    def test_entries_with_no_rating_at_all_are_skipped(self):
        moods = [{"timestamp": f"2026-09-{d:02d}T09:00:00+00:00"} for d in range(1, 15)]
        result = self._assess(moods)
        assert result.risk_factors == []

    def test_the_negative_streak_counts_back_from_the_newest_entry(self):
        # Five low days at the START of the fortnight, fine since.
        moods = [_mood(d, score=2) for d in range(1, 6)] + [_mood(d, score=8) for d in range(6, 15)]
        result = self._assess(list(reversed(moods)))
        assert not any(c.endswith("_consecutive_negative_days") for c in result.immediate_concerns)

        recent_low = [_mood(d, score=8) for d in range(1, 10)] + [_mood(d, score=2) for d in range(10, 15)]
        result = self._assess(list(reversed(recent_low)))
        assert "5_consecutive_negative_days" in result.immediate_concerns


class TestMoodValence:
    def test_maps_the_stored_one_to_ten_scale(self):
        v = ClinicalRiskStratification._mood_valence
        assert v({"score": 1}) == -1.0
        assert v({"score": 10}) == 1.0
        assert abs(v({"score": 5.5})) < 1e-9

    def test_prefers_score_and_ignores_garbage(self):
        v = ClinicalRiskStratification._mood_valence
        assert v({"score": 10, "valence": 1}) == 1.0
        assert v({"score": "x", "valence": 10}) == 1.0
        assert v({"score": True}) is None
        assert v({}) is None
