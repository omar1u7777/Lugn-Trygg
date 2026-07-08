"""TDD tests for sentiment negation — BUG C."""
import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.services.ml_sentiment_service import MLSentimentService


class TestNegation:
    def test_inte_bra_not_positive(self):
        r = MLSentimentService._keyword_fallback("Jag är inte bra idag")
        assert r['sentiment'] != 'POSITIVE'

    def test_inte_stressad_not_negative(self):
        r = MLSentimentService._keyword_fallback("Jag är inte stressad")
        assert r['sentiment'] != 'NEGATIVE'

    def test_bra_alone_positive(self):
        r = MLSentimentService._keyword_fallback("Jag mår bra")
        assert r['sentiment'] == 'POSITIVE'
