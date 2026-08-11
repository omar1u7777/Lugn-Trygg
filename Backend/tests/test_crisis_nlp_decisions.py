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

    @pytest.mark.parametrize("text", [
        "jag gör det ikväll",
        "jag gör det inatt",
        "imorgon är det över",
        "det kan hända när som helst",
    ])
    def test_a_stated_timeframe_counts_as_urgency(self, detector, text):
        # A stated timeframe is one of the strongest signals that a plan is
        # imminent, and no pattern used to cover it.
        assert detector._detect_urgency(text) is True

    @pytest.mark.parametrize("text", [
        "jag ska träffa kompisar ikväll",
        "vi ses imorgon",
        "jag har läkartid idag",
    ])
    def test_a_timeframe_alone_does_not_manufacture_a_crisis(self, detector, text):
        # Urgency only adds 0.2 to a score the crisis keywords already raised.
        # An ordinary plan mentions a time and must stay well below the 0.3
        # threshold — widening the urgency patterns must not start flagging
        # people for having an evening.
        result = detector.detect(text)
        assert result.risk_level == 'none'
        assert result.semantic_score <= 0.2


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


class TestFallbackConceptsReachTheInterventions:
    """crisis_intervention branches on concept['category'] to pick what to say
    to the user. The fallback used to emit one concept with category
    'fallback', which matches none of those branches — so in production, where
    transformers is not installed, someone flagged as suicidal received none of
    the interventions written for suicidal risk."""

    REQUIRED_KEYS = {'name', 'category', 'score', 'description', 'weight'}

    @pytest.mark.parametrize("text,category", [
        ("jag vill ta livet av mig", 'suicidal'),
        ("jag vill skada mig själv", 'self_harm'),
        ("allt känns hopplöst", 'hopelessness'),
        ("jag håller på att bryta ihop", 'severe_distress'),
    ])
    def test_the_matched_category_survives_to_the_consumer(self, detector, text, category):
        concepts = detector.detect(text).detected_concepts
        assert category in {c['category'] for c in concepts}

    def test_fallback_concepts_carry_the_same_keys_as_the_semantic_path(self, detector):
        for concept in detector.detect("jag vill ta livet av mig").detected_concepts:
            assert self.REQUIRED_KEYS <= set(concept), f"missing {self.REQUIRED_KEYS - set(concept)}"
            assert isinstance(concept['description'], str) and concept['description']

    def test_every_matched_category_is_reported_not_only_the_worst(self, detector):
        # Someone expressing several kinds of distress at once should get the
        # interventions for each, not only for the highest-scoring one.
        concepts = detector.detect("allt känns hopplöst och jag vill ta livet av mig").detected_concepts
        assert {'suicidal', 'hopelessness'} <= {c['category'] for c in concepts}

    def test_concepts_are_ordered_most_severe_first(self, detector):
        concepts = detector.detect("allt känns hopplöst och jag vill ta livet av mig").detected_concepts
        scores = [c['score'] for c in concepts]
        assert scores == sorted(scores, reverse=True)

    def test_ordinary_text_reports_no_concepts(self, detector):
        assert detector.detect("Jag åt lunch med en vän.").detected_concepts == []


class TestDetectorSingleton:
    def test_callers_share_one_detector(self):
        with patch.object(crisis_nlp, 'TRANSFORMERS_AVAILABLE', False):
            crisis_nlp._semantic_detector = None
            first = crisis_nlp.get_semantic_crisis_detector()
            assert crisis_nlp.get_semantic_crisis_detector() is first
        crisis_nlp._semantic_detector = None


class TestConversationContextInFallback:
    """conversation_context used to be accepted and never read, so someone
    whose last five messages showed mounting distress scored exactly as if
    they had said it once. Production runs this path, since transformers is
    not installed."""

    ESCALATING = [
        {'role': 'user', 'content': 'allt känns hopplöst'},
        {'role': 'assistant', 'content': 'berätta mer'},
        {'role': 'user', 'content': 'jag orkar inte mer'},
        {'role': 'assistant', 'content': 'jag lyssnar'},
        {'role': 'user', 'content': 'jag vet inte vad jag ska göra'},
    ]

    CALM = [
        {'role': 'user', 'content': 'jag var ute och gick idag'},
        {'role': 'assistant', 'content': 'vad fint'},
        {'role': 'user', 'content': 'det var skönt väder'},
    ]

    def test_a_history_of_distress_raises_the_score(self, detector):
        text = "allt känns hopplöst"
        alone = detector.detect(text)
        with_history = detector.detect(text, conversation_context=self.ESCALATING)
        assert with_history.semantic_score > alone.semantic_score

    def test_an_ordinary_history_changes_nothing(self, detector):
        text = "allt känns hopplöst"
        alone = detector.detect(text)
        with_history = detector.detect(text, conversation_context=self.CALM)
        assert with_history.semantic_score == alone.semantic_score

    def test_context_can_only_add(self, detector):
        # Whatever the history, it must never talk the assessment down.
        text = "jag vill ta livet av mig"
        alone = detector.detect(text)
        for history in (self.ESCALATING, self.CALM, [], None):
            assert detector.detect(text, conversation_context=history).semantic_score >= alone.semantic_score

    def test_history_alone_is_not_a_crisis(self, detector):
        # A distressed history plus a harmless message must not be escalated
        # into a crisis on its own: 0.3 is the cap and 0.30 is exactly the
        # 'low' boundary, so this stays at the bottom of the scale.
        result = detector.detect("tack, det hjälpte", conversation_context=self.ESCALATING)
        assert result.risk_level in ('none', 'low')

    def test_context_contribution_is_capped(self, detector):
        many = [{'role': 'user', 'content': 'jag orkar inte mer'} for _ in range(20)]
        assert detector._analyze_context_keywords(many, {'d': ['orkar inte mer']}) == 0.3

    def test_short_or_missing_history_scores_nothing(self, detector):
        keywords = {'d': ['orkar inte mer']}
        assert detector._analyze_context_keywords(None, keywords) == 0.0
        assert detector._analyze_context_keywords([], keywords) == 0.0
        assert detector._analyze_context_keywords([{'role': 'user', 'content': 'orkar inte mer'}], keywords) == 0.0

    def test_malformed_history_does_not_raise(self, detector):
        keywords = {'d': ['orkar inte mer']}
        junk = [{'role': 'user'}, {'content': None}, 'not a dict', {'role': 'user', 'content': 42}, None]
        assert detector._analyze_context_keywords(junk, keywords) == 0.0

    def test_only_user_turns_count(self, detector):
        # What the assistant said back is not evidence about the user.
        assistant_only = [
            {'role': 'assistant', 'content': 'jag orkar inte mer'},
            {'role': 'assistant', 'content': 'allt känns hopplöst'},
        ]
        assert detector._analyze_context_keywords(assistant_only, {'d': ['orkar inte mer', 'hopplöst']}) == 0.0
