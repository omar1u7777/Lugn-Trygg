"""The daily insight pipeline end to end, from mood entries to saved insights.

Configuration, timestamps, saving and retrieval are in test_qa_unit_insights.py.
"""

from datetime import UTC, datetime, timedelta

import pytest

from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2


def _moods(scores):
    """One entry a day, oldest first, ending today."""
    now = datetime.now(UTC)
    last = len(scores) - 1
    return [
        {'id': f'mood-{i}', 'score': score, 'timestamp': (now - timedelta(days=last - i)).isoformat()}
        for i, score in enumerate(scores)
    ]


@pytest.fixture
def generate(mocker):
    """generate_insights for the given entries; returns (insights, saved)."""
    def run(moods):
        generator = DailyInsightGeneratorV2()
        mocker.patch.object(generator, '_already_generated_today', return_value=[])
        mocker.patch.object(generator, '_fetch_memories', return_value=moods)
        saved = mocker.patch.object(generator, '_save_insight')
        return generator.generate_insights('user-1'), saved
    return run


def _types(insights):
    return {getattr(i.insight_type, 'value', i.insight_type) for i in insights}


def test_falling_mood_gives_a_decline_insight(generate):
    insights, saved = generate(_moods([8, 8, 7, 7, 6, 5, 5, 4, 3, 3]))

    decline = [i for i in insights if getattr(i.insight_type, 'value', i.insight_type) == 'decline']
    assert len(decline) == 1
    assert decline[0].user_id == 'user-1'
    assert saved.call_count == len(insights)


@pytest.mark.parametrize('scores', [[3, 3, 4, 5, 5, 6, 7, 7, 8, 8], [6] * 10])
def test_rising_or_steady_mood_gives_no_decline_insight(generate, scores):
    insights, _ = generate(_moods(scores))

    assert 'decline' not in _types(insights)


def test_too_few_entries_give_the_onboarding_check_in(generate):
    insights, saved = generate(_moods([5, 5]))

    assert _types(insights) == {'checkin'}
    assert saved.call_count == 1
