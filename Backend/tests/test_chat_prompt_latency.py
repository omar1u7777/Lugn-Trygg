"""The chat prompt is built without a model call of its own.

Before the reply started streaming, build_enhanced_system_prompt sent the
user's message to GPT-4o for a sentiment label and used the label for one
sentence of guidance. In production on 8 November that call ended 1.96 s into
a request whose first text arrived after 3.15 s. The reply model reads the same
message, so the prompt now asks it to read the tone itself.
"""

from unittest.mock import MagicMock

import pytest

from src.services.ai.conversation_engine import ConversationEngine


def _svc():
    svc = MagicMock()
    svc.openai_available = True
    svc._fetch_user_profile_context.return_value = ''
    svc._fetch_cross_source_context.return_value = ''
    return svc


@pytest.mark.parametrize('message', ['Jag är så ledsen idag', 'Allt går bra!', 'Hur mår jag?'])
def test_builds_the_prompt_without_classifying_the_message_first(message):
    svc = _svc()

    ConversationEngine(svc).build_enhanced_system_prompt(message)

    svc.enhanced_sentiment_analysis.assert_not_called()
    svc.analyze_sentiment.assert_not_called()
    svc.client.chat.completions.create.assert_not_called()


def test_tells_the_reply_model_how_to_meet_each_tone():
    prompt = ConversationEngine(_svc()).build_enhanced_system_prompt('Jag är så ledsen idag')

    assert 'Läs av känsloläget i användarens senaste meddelande' in prompt
    assert 'validera känslorna och erbjud konkreta coping-strategier' in prompt
    assert 'uppmärksamma och förstärk dem' in prompt
    assert 'var nyfiken och utforskande' in prompt
