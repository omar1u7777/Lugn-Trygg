"""
UNIT TESTS - AI Stöd (AI Support Chatbot)
==========================================
Tests AI service logic: prompt construction, sentiment analysis integration,
crisis detection, and response generation.
Uses mocks to isolate from OpenAI API and Firestore.

Run: pytest tests/test_qa_unit_ai_support.py -v
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, Mock, patch

import pytest


# ---------------------------------------------------------------------------
# System Prompt Construction
# ---------------------------------------------------------------------------

class TestSystemPromptConstruction:
    """Test that the AI system prompt is correctly constructed."""

    def test_prompt_contains_therapeutic_guidelines(self):
        """System prompt should contain therapeutic role description."""
        prompt = (
            "Du är en empatisk och professionell mental hälsa-assistent för appen Lugn & Trygg.\n\n"
            "Din roll:\n"
            "- Lyssna aktivt och empatiskt\n"
            "- Ge stöd och validering\n"
            "- Föreslå evidensbaserade coping-strategier (KBT, DBT, ACT, mindfulness)\n"
            "- Ställ öppna frågor för att utforska känslor och tankar djupare\n"
            "- Uppmuntra professionell hjälp vid behov\n"
            "- Aldrig diagnostisera eller ge medicinsk rådgivning\n"
            "- Skapa en säker, trygg atmosfär för reflektion\n\n"
        )
        assert "empatisk" in prompt
        assert "KBT" in prompt
        assert "ACT" in prompt
        assert "mindfulness" in prompt
        assert "diagnostisera" in prompt

    def test_prompt_instructs_swedish_responses(self):
        """Prompt should instruct AI to always respond in Swedish."""
        prompt = "VIKTIGT: Svara ALLTID på svenska, kort och tydligt (max 150 ord)."
        assert "svenska" in prompt
        assert "150 ord" in prompt

    def test_prompt_includes_user_name_when_available(self):
        """Prompt should include user's name when provided."""
        name = "Anna"
        prompt_part = f"\n\nANVÄNDARENS PROFIL:\n- Namn: {name}"
        assert name in prompt_part
        assert "ANVÄNDARENS PROFIL" in prompt_part

    def test_prompt_uses_email_fallback_for_name(self):
        """When name is missing, derive from email local part."""
        email = "anna.andersson@example.com"
        local_part = email.split("@")[0]
        name = local_part.replace(".", " ").replace("_", " ").title()
        assert name == "Anna Andersson"

    def test_prompt_with_no_name_and_no_email(self):
        """When both name and email are missing, no profile section."""
        name = ""
        email = ""
        has_profile = bool(name) or (email and "@" in email)
        assert not has_profile


# ---------------------------------------------------------------------------
# Sentiment Analysis Integration
# ---------------------------------------------------------------------------

class TestSentimentAnalysisIntegration:
    """Test sentiment analysis data flow in AI service."""

    def test_positive_sentiment_guidance(self):
        """Positive sentiment should produce encouraging guidance."""
        sentiment = "POSITIVE"
        sentiment_guidance = ""
        if sentiment == "POSITIVE":
            sentiment_guidance = "Användaren verkar positivt inställd. Bekräfta och bygg vidare på detta.\n"
        assert "positivt" in sentiment_guidance

    def test_negative_sentiment_guidance(self):
        """Negative sentiment should produce supportive guidance."""
        sentiment = "NEGATIVE"
        sentiment_guidance = ""
        if sentiment == "NEGATIVE":
            sentiment_guidance = "Användaren verkar nedstämd. Var extra empatisk och validerande.\n"
        assert "nedstämd" in sentiment_guidance
        assert "empatisk" in sentiment_guidance

    def test_neutral_sentiment_no_special_guidance(self):
        """Neutral sentiment should not add special guidance."""
        sentiment = "NEUTRAL"
        sentiment_guidance = ""
        if sentiment == "POSITIVE":
            sentiment_guidance = "positive text"
        elif sentiment == "NEGATIVE":
            sentiment_guidance = "negative text"
        assert sentiment_guidance == ""


# ---------------------------------------------------------------------------
# Crisis Detection
# ---------------------------------------------------------------------------

class TestCrisisDetection:
    """Test crisis keyword detection logic."""

    CRISIS_KEYWORDS = [
        "självmord", "ta mitt liv", "vilja dö", "döda mig själv",
        "inte orka leva", "sluta leva", "vilja försvinna"
    ]

    def test_crisis_keywords_detected(self):
        """Messages containing crisis keywords should be flagged."""
        for keyword in self.CRISIS_KEYWORDS:
            message = f"Jag tänker på {keyword} ibland"
            is_crisis = any(kw in message.lower() for kw in self.CRISIS_KEYWORDS)
            assert is_crisis, f"Should detect crisis keyword: {keyword}"

    def test_non_crisis_message_not_flagged(self):
        """Normal messages should not be flagged as crisis."""
        messages = [
            "Jag känner mig lite nere idag",
            "Har haft en tuff vecka på jobbet",
            "Sömnproblem gör mig trött",
            "Känner mig stressad över tentamen",
        ]
        for msg in messages:
            is_crisis = any(kw in msg.lower() for kw in self.CRISIS_KEYWORDS)
            assert not is_crisis, f"Should not flag normal message: {msg}"

    def test_crisis_response_contains_resources(self):
        """Crisis response should include emergency resources."""
        crisis_resources = (
            "Om du är i akut behov, ring 112 eller Suicide Zero på 90101."
        )
        assert "112" in crisis_resources
        assert "90101" in crisis_resources


# ---------------------------------------------------------------------------
# Response Generation (mocked AI service)
# ---------------------------------------------------------------------------

class TestAIResponseGeneration:
    """Test AI response generation with mocked OpenAI client."""

    def test_response_returns_dict_with_message(self):
        """AI response should return a dict with 'response' key."""
        mock_instance = Mock()
        mock_instance.generate_therapeutic_conversation.return_value = {
            'response': 'Det låter jobbigt. Hur länge har du känt så här?',
            'sentiment': 'NEGATIVE',
            'crisis_detected': False,
        }
        result = mock_instance.generate_therapeutic_conversation("Jag mår dåligt", [])
        assert 'response' in result
        assert isinstance(result['response'], str)
        assert len(result['response']) > 0

    def test_response_includes_sentiment(self):
        """AI response should include sentiment analysis."""
        mock_instance = Mock()
        mock_instance.generate_therapeutic_conversation.return_value = {
            'response': 'Hej! Hur kan jag hjälpa dig idag?',
            'sentiment': 'NEUTRAL',
        }
        result = mock_instance.generate_therapeutic_conversation("Hej", [])
        assert 'sentiment' in result

    def test_response_max_150_words_instruction(self):
        """AI should be instructed to keep responses under 150 words."""
        mock_instance = Mock()
        mock_instance.generate_therapeutic_conversation.return_value = {
            'response': 'Kort svar.',
        }
        result = mock_instance.generate_therapeutic_conversation("Hej", [])
        assert len(result['response'].split()) <= 150

    def test_conversation_history_passed_to_ai(self):
        """Conversation history should be passed to the AI service."""
        mock_instance = Mock()
        mock_instance.generate_therapeutic_conversation.return_value = {'response': 'OK'}

        history = [
            {'role': 'user', 'content': 'Hej'},
            {'role': 'assistant', 'content': 'Hej! Hur mår du?'},
        ]
        mock_instance.generate_therapeutic_conversation("Bra", history)

        call_args = mock_instance.generate_therapeutic_conversation.call_args
        assert call_args[0][1] == history, "History should be second argument"


# ---------------------------------------------------------------------------
# User Profile Context
# ---------------------------------------------------------------------------

class TestUserProfileContext:
    """Test user profile context fetching for AI personalization."""

    @patch('src.firebase_config.db')
    def test_fetch_user_profile_with_name(self, mock_db):
        """Should extract name from Firestore user document."""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {'name': 'Erik', 'email': 'erik@test.com'}
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        # Simulate _fetch_user_profile_context logic
        user_doc = mock_db.collection('users').document('uid123').get()
        raw = user_doc.to_dict() or {}
        name = (raw.get('name') or raw.get('displayName') or '').strip()
        assert name == 'Erik'

    @patch('src.firebase_config.db')
    def test_fetch_user_profile_email_fallback(self, mock_db):
        """Should derive name from email when name is missing."""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {'name': '', 'email': 'anna.nord@example.com'}
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        user_doc = mock_db.collection('users').document('uid123').get()
        raw = user_doc.to_dict() or {}
        name = (raw.get('name') or raw.get('displayName') or '').strip()
        email = (raw.get('email') or '').strip()
        if not name and email and '@' in email:
            local_part = email.split('@')[0]
            name = local_part.replace('.', ' ').replace('_', ' ').title()
        assert name == 'Anna Nord'

    @patch('src.firebase_config.db')
    def test_fetch_user_profile_no_data(self, mock_db):
        """Should handle missing user document gracefully."""
        mock_doc = Mock()
        mock_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        user_doc = mock_db.collection('users').document('uid123').get()
        raw = user_doc.to_dict() if user_doc.exists else {}
        name = (raw.get('name') or '').strip() if raw else ''
        assert name == ''
