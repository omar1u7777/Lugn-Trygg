"""The professional-support offer is made once per conversation, and replies
that hit the token limit are not left mid-sentence.

UI audit 2026-09-29: B-13 saw the offer pasted onto nearly every reply,
including "Är du smart"; B-12 saw replies ending "### Reflektionsfråga:\\nHur".
"""

from unittest.mock import MagicMock

from src.services.ai.conversation_engine import (
    CHAT_MAX_TOKENS,
    PROFESSIONAL_SUPPORT_OFFER,
    ConversationEngine,
    support_offer_already_made,
    trim_to_last_sentence,
)


class TestSupportOfferAlreadyMade:
    def test_found_in_a_full_earlier_assistant_turn(self):
        long_reply = "x" * 900 + " " + PROFESSIONAL_SUPPORT_OFFER
        assert support_offer_already_made([{"role": "assistant", "content": long_reply}])

    def test_the_users_own_words_do_not_count(self):
        assert not support_offer_already_made(
            [{"role": "user", "content": "ska jag prata med någon professionell?"}])

    def test_empty_history(self):
        assert not support_offer_already_made([])
        assert not support_offer_already_made(None)


class TestTrimToLastSentence:
    def test_drops_the_unfinished_tail(self):
        assert trim_to_last_sentence("Det är svårt. Du är inte ensam.\n### Reflektionsfråga:\nHur") \
            == "Det är svårt. Du är inte ensam."

    def test_leaves_a_complete_reply_alone(self):
        assert trim_to_last_sentence("Hej. Hur mår du?") == "Hej. Hur mår du?"

    def test_leaves_text_without_any_sentence_end(self):
        assert trim_to_last_sentence("bara ett fragment") == "bara ett fragment"


def _chunk(content=None, finish=None):
    choice = MagicMock()
    choice.delta.content = content
    choice.finish_reason = finish
    chunk = MagicMock()
    chunk.choices = [choice]
    return chunk


class TestStreaming:
    def _engine(self, chunks):
        svc = MagicMock()
        svc.openai_available = True
        svc.detect_crisis_indicators.return_value = {"requires_immediate_attention": False}
        svc._build_enhanced_system_prompt.return_value = "system"
        svc.client.chat.completions.create.return_value = iter(chunks)
        return ConversationEngine(svc), svc

    def test_a_truncated_stream_says_so(self):
        engine, _ = self._engine([_chunk("Hej. Hur"), _chunk(None, "length")])
        events = list(engine.generate_therapeutic_conversation_stream("hej", [], None))
        assert 'data: {"truncated": true}\n\n' in events
        assert events[-1] == "data: [DONE]\n\n"

    def test_uses_the_raised_limit_and_passes_history_to_the_prompt(self):
        history = [{"role": "assistant", "content": PROFESSIONAL_SUPPORT_OFFER}]
        engine, svc = self._engine([_chunk("Hej.", "stop")])
        list(engine.generate_therapeutic_conversation_stream("hej", history, "uid"))
        assert svc.client.chat.completions.create.call_args.kwargs["max_tokens"] == CHAT_MAX_TOKENS
        assert svc._build_enhanced_system_prompt.call_args.args == ("hej", "uid", history)
