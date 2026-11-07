"""Text clean-up before sentiment scoring: e-mail removal and its cost.

The e-mail pattern used to be \\S+@\\S+\\.\\S+. Its overlapping runs made
the time cubic in the length of a token: 8 000 '@' characters took over four
minutes on one worker, so a single chat message could stall the API.
"""

import time

import pytest

from src.services.ml_sentiment_service import MLSentimentService

preprocess = MLSentimentService._preprocess


@pytest.mark.parametrize('text, expected', [
    ('Mejla mig på anna.berg@example.se idag', 'mejla mig på idag'),
    ('(kontakt: x.y@mail.example.com) tack', '(kontakt: tack'),
    ('a@b.se och c@d.org', 'och'),
    ('Inget här @ alls . eller', 'inget här @ alls . eller'),
    ('foo@bar utan domän', 'foo@bar utan domän'),
    ('Se https://example.se/x?y=1 sen', 'se sen'),
])
def test_emails_and_urls_are_removed(text, expected):
    assert preprocess(text) == expected


@pytest.mark.parametrize('hostile', [
    '@' * 20_000,
    'a' * 20_000,
    'a@' + '.' * 20_000,
    '@a.' * 7_000,
    ('x' * 50 + '@') * 400,
])
def test_hostile_input_is_cleaned_in_linear_time(hostile):
    started = time.perf_counter()
    preprocess(hostile)
    # The old pattern needed minutes for the first case; a linear one needs
    # milliseconds. One second leaves room for a slow CI runner.
    assert time.perf_counter() - started < 1.0
