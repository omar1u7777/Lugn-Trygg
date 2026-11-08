"""The chat's mood list gives Swedish times and says what time it is now.

On 8 November a mood logged at 00:42 Swedish time reached the chat prompt as
"2026-11-07T23:42", the stored UTC string cut at 16 characters. The prompt
never said what time it was, so an entry logged six minutes earlier read as
one from the evening before. Nothing in the prompt said the list outranks the
mood figures that earlier replies in the conversation quote.
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from src.services.ai.conversation_engine import ConversationEngine

# What /api/v1/mood/log stores: datetime.now(UTC).isoformat().
LOGGED_AT = '2026-11-07T23:42:51.123456+00:00'
CHAT_AT = datetime(2026, 11, 7, 23, 48, 16, tzinfo=UTC)


def _mood(score, ts):
    doc = MagicMock()
    doc.to_dict.return_value = {'score': score, 'timestamp': ts, 'note': '', 'tags': []}
    return doc


@pytest.fixture
def moods(mocker):
    db = mocker.patch('src.firebase_config.db')
    query = db.collection.return_value.document.return_value.collection.return_value
    stream = query.order_by.return_value.limit.return_value.stream
    stream.return_value = [_mood(7, LOGGED_AT), _mood(4, '2026-11-06T18:05:00+00:00')]
    mocker.patch('src.services.ai.conversation_engine._now', return_value=CHAT_AT)
    return stream


def _svc():
    svc = MagicMock()
    svc.openai_available = True
    svc.enhanced_sentiment_analysis.return_value = {'sentiment': 'NEUTRAL'}
    svc.detect_crisis_indicators.return_value = {'requires_immediate_attention': False}
    svc._fetch_user_profile_context.return_value = ''
    svc._fetch_cross_source_context.return_value = ''
    return svc


def _assert_anchored(prompt):
    assert '2026-11-07T23:42' not in prompt
    assert '2026-11-08 00:42: 7/10' in prompt
    assert '2026-11-06 19:05: 4/10' in prompt
    assert 'Nu är det 2026-11-08 00:48 svensk tid' in prompt
    assert 'tidigare svar i samtalet citerar kan vara inaktuella' in prompt


def test_the_stream_prompt_dates_moods_in_swedish_time(moods, mocker):
    mocker.patch(
        'src.services.session_summary_service.SessionSummaryService.get_recent_summaries',
        return_value=[],
    )

    prompt = ConversationEngine(_svc()).build_enhanced_system_prompt('Hur mår jag?', 'uid')

    _assert_anchored(prompt)


def test_the_non_stream_prompt_dates_moods_in_swedish_time(moods, mocker):
    framework = mocker.patch('src.services.therapeutic_framework.get_therapeutic_framework').return_value
    framework.analyze_input.return_value = {
        'recommended_modality': None,
        'recommended_technique': None,
        'detected_distortions': [],
        'avoidance_detected': False,
    }
    framework.generate_therapeutic_prompt.return_value = ''
    rag = mocker.patch('src.services.rag_service.get_rag_service').return_value
    rag.generate_augmented_prompt.side_effect = lambda **kw: kw['base_system_prompt']
    svc = _svc()
    svc.client.chat.completions.create.return_value.choices = [MagicMock()]

    ConversationEngine(svc).generate_therapeutic_conversation('Hur mår jag?', [], user_id='uid')

    messages = svc.client.chat.completions.create.call_args.kwargs['messages']
    _assert_anchored(messages[0]['content'])


def test_summer_time_and_stored_datetimes(moods, mocker):
    moods.return_value = [_mood(6, datetime(2026, 7, 1, 22, 30, tzinfo=UTC))]
    mocker.patch(
        'src.services.ai.conversation_engine._now',
        return_value=datetime(2026, 7, 1, 22, 40, tzinfo=UTC),
    )
    mocker.patch(
        'src.services.session_summary_service.SessionSummaryService.get_recent_summaries',
        return_value=[],
    )

    prompt = ConversationEngine(_svc()).build_enhanced_system_prompt('Hur mår jag?', 'uid')

    assert '2026-07-02 00:30: 6/10' in prompt
    assert 'Nu är det 2026-07-02 00:40 svensk tid' in prompt
