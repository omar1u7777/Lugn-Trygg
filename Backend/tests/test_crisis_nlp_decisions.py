"""Tests for the semantic crisis detector's decisions.

crisis_nlp decides whether a user is in crisis and at what level, and had 0%
coverage across 178 statements — the least-tested module in the app while
being the most safety-critical. subscription_service sat at 85% by contrast.

These test the decision (does this text produce the right risk level, does the
output carry what consumers read) rather than the implementation, so they stay
valid if the model behind it changes.

The detector falls back to keyword matching whenever transformers is
unavailable, which is the likely reality on a CPU-only starter instance — so
the fallback path is treated here as a production path, not a degraded one.
"""

import importlib.util
from pathlib import Path
from unittest.mock import patch

import pytest

# conftest replaces sys.modules['src.services.crisis_nlp'] with a stub whose
# detect() always returns risk_level='none'. That stub is why this module shows
# 0% coverage, and it also means every other test touching crisis paths runs
# against a detector that never reports a crisis. Load the real implementation
# straight from disk so these tests exercise the actual decisions.
_REAL_PATH = Path(__file__).resolve().parents[1] / 'src' / 'services' / 'crisis_nlp.py'
_spec = importlib.util.spec_from_file_location('_real_crisis_nlp', _REAL_PATH)
crisis_nlp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(crisis_nlp)
SemanticCrisisDetector = crisis_nlp.SemanticCrisisDetector


@pytest.fixture
def detector():
    """A detector in keyword-fallback mode.

    torch/transformers/sentence-transformers are not in requirements.txt, so
    TRANSFORMERS_AVAILABLE is False in production too and this fallback is the
    path that actually runs — not a degraded mode worth skipping.
    """
    with patch.object(crisis_nlp, 'TRANSFORMERS_AVAILABLE', False):
        return SemanticCrisisDetector()


class TestRiskLevelThresholds:
    """_score_to_level is the final decision: a number becomes 'critical' or
    'none'. Boundary values are exactly where a misjudged user slips a band."""

    @pytest.mark.parametrize("score,expected", [
        (1.00, 'critical'),
        (0.85, 'critical'),   # boundary
        (0.84, 'high'),
        (0.70, 'high'),       # boundary
        (0.69, 'medium'),
        (0.50, 'medium'),     # boundary
        (0.49, 'low'),
        (0.30, 'low'),        # boundary
        (0.29, 'none'),
        (0.00, 'none'),
    ])
    def test_boundaries(self, detector, score, expected):
        assert detector._score_to_level(score) == expected

    def test_levels_never_decrease_as_score_rises(self, detector):
        order = ['none', 'low', 'medium', 'high', 'critical']
        seen = [detector._score_to_level(i / 100) for i in range(0, 101)]
        idx = [order.index(s) for s in seen]
        assert idx == sorted(idx), "risk level must be monotonic in the score"


class TestSemanticRiskScore:
    def test_urgency_raises_the_score(self, detector):
        base = detector._calculate_semantic_risk({'a': 0.4}, urgency=False, context_score=0.0)
        urgent = detector._calculate_semantic_risk({'a': 0.4}, urgency=True, context_score=0.0)
        assert urgent > base

    def test_score_never_exceeds_one(self, detector):
        # Both boosts applied on top of an already-maximal concept score must
        # stay in range; a score above 1.0 would still map to 'critical' but
        # makes confidence and any downstream arithmetic meaningless.
        score = detector._calculate_semantic_risk({'a': 1.0}, urgency=True, context_score=0.9)
        assert score <= 1.0

    def test_no_concepts_is_not_a_crisis(self, detector):
        assert detector._calculate_semantic_risk({}, urgency=False, context_score=0.0) == 0.0

    def test_conversation_context_can_escalate(self, detector):
        plain = detector._calculate_semantic_risk({'a': 0.5}, urgency=False, context_score=0.0)
        escalated = detector._calculate_semantic_risk({'a': 0.5}, urgency=False, context_score=0.2)
        assert escalated > plain


class TestDetectedConceptContract:
    """crisis_intervention builds CrisisIndicator straight from these dicts.
    It previously did concept['description'] and raised KeyError in production,
    so the shape of this output is a contract, not an implementation detail."""

    REQUIRED_KEYS = {'name', 'category', 'score', 'description', 'weight'}

    def test_every_detected_concept_carries_the_keys_consumers_read(self, detector):
        scores = {c.name: 0.9 for c in detector.CRISIS_CONCEPTS}
        for concept in detector._get_detected_concepts(scores):
            assert self.REQUIRED_KEYS <= set(concept), f"missing {self.REQUIRED_KEYS - set(concept)}"
            assert isinstance(concept['description'], str) and concept['description']

    def test_low_scoring_concepts_are_not_reported(self, detector):
        scores = {c.name: 0.1 for c in detector.CRISIS_CONCEPTS}
        assert detector._get_detected_concepts(scores) == []

    def test_concepts_are_ordered_most_severe_first(self, detector):
        names = [c.name for c in detector.CRISIS_CONCEPTS][:3]
        scores = dict(zip(names, [0.5, 0.95, 0.7], strict=True))
        out = detector._get_detected_concepts(scores)
        assert [c['score'] for c in out] == sorted([c['score'] for c in out], reverse=True)


class TestKeywordFallbackDetection:
    """The path that runs whenever the transformer model is unavailable."""

    @pytest.mark.parametrize("text", [
        "jag vill dö",
        "jag orkar inte mer",
        "jag tänker ta livet av mig",
        "allt är meningslöst",
    ])
    def test_swedish_crisis_phrasing_is_not_missed(self, detector, text):
        result = detector.detect(text)
        assert result.risk_level != 'none', f"missed crisis phrasing: {text!r}"

    def test_ordinary_text_is_not_flagged(self, detector):
        result = detector.detect("Jag åt lunch med en vän och det var trevligt.")
        assert result.risk_level in ('none', 'low')

    def test_empty_text_does_not_raise(self, detector):
        assert detector.detect("").risk_level == 'none'

    def test_result_always_exposes_the_fields_callers_read(self, detector):
        # assess_text_crisis_risk reads all of these unconditionally.
        result = detector.detect("jag vill dö")
        for attr in ('risk_level', 'semantic_score', 'confidence', 'detected_concepts'):
            assert hasattr(result, attr), f"missing {attr}"
        assert isinstance(result.detected_concepts, list)


class TestConfidence:
    """Confidence is surfaced to the user and to clinicians, so a wrong value
    misrepresents how sure the system is — separate from the risk level."""

    def test_confidence_rises_with_the_score(self, detector):
        weak = detector._calculate_confidence({}, 0.2)
        mid = detector._calculate_confidence({}, 0.6)
        strong = detector._calculate_confidence({}, 0.9)
        assert weak < mid < strong

    def test_supporting_concepts_raise_confidence(self, detector):
        alone = detector._calculate_confidence({'a': 0.9}, 0.9)
        corroborated = detector._calculate_confidence({'a': 0.9, 'b': 0.9, 'c': 0.9}, 0.9)
        assert corroborated > alone

    def test_confidence_is_never_certainty(self, detector):
        # Nothing here justifies claiming 100%; the cap exists so the UI never
        # tells a user the assessment is beyond doubt.
        many = {str(i): 1.0 for i in range(50)}
        assert detector._calculate_confidence(many, 1.0) <= 0.98


class TestUrgencyDetection:
    """Urgency adds +0.2 to severity, which is enough to move a user up a band."""

    @pytest.mark.parametrize("text", [
        "jag behöver hjälp nu",
        "det är akut",
        "jag orkar inte mer",
        "jag vill dö",
        "jag tänker ta livet av mig",
    ])
    def test_urgent_phrasing_is_caught(self, detector, text):
        assert detector._detect_urgency(text) is True

    def test_calm_reflection_is_not_urgent(self, detector):
        assert detector._detect_urgency("förra året mådde jag dåligt men det är bättre nu") is False

    def test_a_stated_timeframe_is_not_recognised_as_urgency(self, detector):
        # URGENCY_PATTERNS match crisis wording, not immediacy: no pattern
        # covers ikväll/inatt/idag. A stated timeframe is one of the strongest
        # clinical signals of imminent risk, and it scores nothing here.
        # Documented rather than silently patched — widening the pattern list
        # shifts crisis thresholds and is a clinical decision, not a test fix.
        assert detector._detect_urgency("jag gör det ikväll") is False


class TestSemanticIndicators:
    """These strings are shown to the user and attached to escalation records."""

    def test_high_scoring_concepts_become_readable_indicators(self, detector):
        name = detector.CRISIS_CONCEPTS[0].name
        out = detector._extract_semantic_indicators({name: 0.9}, "text")
        assert len(out) == 1 and 'konfidens' in out[0]

    def test_low_scoring_concepts_produce_nothing(self, detector):
        name = detector.CRISIS_CONCEPTS[0].name
        assert detector._extract_semantic_indicators({name: 0.2}, "text") == []

    def test_unknown_concept_name_raises_rather_than_silently_dropping(self, detector):
        # next() with no default: a concept_scores key absent from
        # CRISIS_CONCEPTS crashes the assessment. Pinning it so a future
        # refactor that renames a concept fails here, not in front of a user.
        with pytest.raises(StopIteration):
            detector._extract_semantic_indicators({'not_a_real_concept': 0.9}, "text")


class TestKeywordSeverityBands:
    """Each category maps to a different severity, so each needs its own case."""

    @pytest.mark.parametrize("text,expected", [
        ("jag vill ta livet av mig", 'critical'),   # suicidal -> 0.9
        ("jag vill skada mig själv", 'critical'),   # self_harm -> 0.85
        ("allt känns hopplöst", 'high'),            # hopelessness -> 0.7
        ("jag håller på att bryta ihop", 'medium'),  # severe_distress -> 0.6
    ])
    def test_category_maps_to_its_band(self, detector, text, expected):
        assert detector.detect(text).risk_level == expected

    def test_the_most_severe_match_wins(self, detector):
        both = detector.detect("allt känns hopplöst och jag vill ta livet av mig")
        assert both.risk_level == 'critical'


class TestDetectorSingleton:
    def test_callers_share_one_detector(self):
        with patch.object(crisis_nlp, 'TRANSFORMERS_AVAILABLE', False):
            crisis_nlp._semantic_detector = None
            first = crisis_nlp.get_semantic_crisis_detector()
            assert crisis_nlp.get_semantic_crisis_detector() is first
        crisis_nlp._semantic_detector = None


class TestConversationContextIsIgnoredInFallback:
    """Characterises real production behaviour, and is not an endorsement of it.

    torch is absent from requirements.txt, so detect() takes the fallback branch
    and _fallback_detection accepts conversation_context and never reads it.
    _analyze_context is likewise inert because it needs self.embedding_model,
    which _init_fallback sets to None. Escalation across a conversation
    therefore contributes nothing to the score in production. If that changes,
    these tests should fail and be rewritten — that is the point of them.
    """

    ESCALATING = [
        {'role': 'user', 'content': 'jag har haft en tung vecka'},
        {'role': 'assistant', 'content': 'berätta mer'},
        {'role': 'user', 'content': 'det blir bara värre'},
        {'role': 'assistant', 'content': 'jag lyssnar'},
        {'role': 'user', 'content': 'jag vet inte hur länge jag klarar det'},
    ]

    def test_analyze_context_scores_nothing_without_an_embedding_model(self, detector):
        assert detector.embedding_model is None
        assert detector._analyze_context(self.ESCALATING) == 0.0

    def test_short_history_scores_nothing(self, detector):
        assert detector._analyze_context([{'role': 'user', 'content': 'hej'}]) == 0.0
        assert detector._analyze_context([]) == 0.0

    def test_escalating_conversation_does_not_change_the_verdict(self, detector):
        text = "jag vet inte hur länge jag klarar det"
        without = detector.detect(text)
        with_history = detector.detect(text, conversation_context=self.ESCALATING)
        assert with_history.risk_level == without.risk_level
        assert with_history.semantic_score == without.semantic_score
