"""AIServices facade.

The former 2,950-line god class is decomposed into single-responsibility
modules under src/services/ai/. This facade:

- owns ALL shared mutable state (OpenAI client, availability flags, sentiment
  pipeline, ML model cache) so existing tests that mock `ai_services.client`,
  `_openai_available`, `_ml_model_cache` etc. keep working unchanged;
- delegates every public and private method to the owning sub-service, so
  monkeypatching a facade method still affects every internal caller (all
  cross-module calls are routed back through the facade);
- keeps the historical module-level names (`RateLimitError`, `APIError`,
  `openai`, `_lazy_import_openai`, `_split_into_chunks`, `ai_services`).
"""

import logging
import os
from typing import Any

from dotenv import load_dotenv

from src.utils.hf_cache import configure_hf_cache

from .ai.client_provider import AIClientProvider
from .ai.conversation_engine import ConversationEngine
from .ai.conversation_engine import split_into_chunks as _split_into_chunks  # noqa: F401  (compat re-export)
from .ai.crisis_detector import CrisisDetector
from .ai.insight_generator import InsightGenerator
from .ai.ml_forecaster import MLForecaster
from .ai.model_cache import ModelCacheManager
from .ai.sentiment_analyzer import SentimentAnalyzer
from .ai.story_generator import StoryGenerator
from .ai.voice_emotion_engine import VoiceEmotionEngine

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)
_IS_PRODUCTION = os.getenv('FLASK_ENV', 'development').lower() == 'production'


configure_hf_cache()

# Lazy import OpenAI to avoid initialization errors
RateLimitError = Exception  # Default fallback
APIError = Exception  # Default fallback

# For testing purposes
openai = None

def _lazy_import_openai():
    """Bind the real OpenAI exception classes for typed exception handling.

    Historically this function was never called, which silently left
    RateLimitError/APIError as bare Exception — every `except RateLimitError`
    clause in the AI pipeline was actually a broad catch-all. It is now
    invoked at module import so vendor faults are handled as TYPED exceptions
    (openai.RateLimitError / openai.APIError) with Exception only as the
    final explicitly-degrading tier.
    """
    global RateLimitError, APIError
    try:
        from openai import APIError as _APIError
        from openai import RateLimitError as _RateLimitError
        RateLimitError = _RateLimitError
        APIError = _APIError
        return True
    except ImportError as e:
        logger.warning(f"OpenAI import failed: {e}")
        return False


# Activate typed vendor exceptions at import time (no-op if openai missing).
_lazy_import_openai()


class AIServices:
    """Facade composing the AI sub-services (see src/services/ai/)."""

    def __init__(self):
        logger.info("🤖 Initializing AI Services...")

        # ---- Shared state (owned here; sub-services read/write via facade) ----
        self.client = None
        self._openai_checked = False
        self._openai_available = False
        self._azure_deployment = None
        self._sentiment_pipeline = None
        self._transformer_sentiment_enabled = (
            os.getenv("ENABLE_TRANSFORMER_SENTIMENT", "false").lower() == "true"
        )
        # Cache for trained ML models to avoid retraining on every request
        self._ml_model_cache = {}
        self._model_cache_ttl = 3600  # 1 hour cache for ML models

        # Sub-services are created lazily (see properties below) so that test
        # code constructing a bare instance via AIServices.__new__(AIServices)
        # can still call any delegated method.
        self.google_nlp_available = self._check_google_nlp()

        # [B4] Eager production check — warn immediately at startup if OpenAI is unconfigured.
        # OpenAI is optional in dev but strongly recommended in production for full AI quality.
        if _IS_PRODUCTION and not os.getenv('OPENAI_API_KEY'):
            logger.warning(
                "[B4] OPENAI_API_KEY is not set in this PRODUCTION environment. "
                "The following features will degrade gracefully but have significantly reduced quality: "
                "(1) /ai/story — returns static template text instead of GPT-generated stories; "
                "(2) /ai/forecast — falls back to basic trend analysis instead of GPT forecast; "
                "(3) AI chat — uses keyword-matching instead of GPT responses. "
                "Set OPENAI_API_KEY to restore full AI functionality."
            )

        logger.info(f"🤖 AI Services initialized - Google NLP: {self.google_nlp_available}, OpenAI: lazy loaded")

    # ---- Exception classes (module globals, resolved at raise-time) ----

    @property
    def _rate_limit_error(self) -> type[Exception]:
        return RateLimitError

    @property
    def _api_error(self) -> type[Exception]:
        return APIError

    # ---- Lazy sub-service composition ----
    # Lazy (instead of assigned in __init__) so instances created without
    # __init__ — a pattern used by several tests — still fully function.

    def _lazy(self, key: str, factory):
        instance = self.__dict__.get(key)
        if instance is None:
            instance = factory(self)
            self.__dict__[key] = instance
        return instance

    @property
    def _provider(self) -> AIClientProvider:
        return self._lazy('_provider_instance', AIClientProvider)

    @property
    def _model_cache(self) -> ModelCacheManager:
        return self._lazy('_model_cache_instance', ModelCacheManager)

    @property
    def _sentiment(self) -> SentimentAnalyzer:
        return self._lazy('_sentiment_instance', SentimentAnalyzer)

    @property
    def _voice(self) -> VoiceEmotionEngine:
        return self._lazy('_voice_instance', VoiceEmotionEngine)

    @property
    def _crisis(self) -> CrisisDetector:
        return self._lazy('_crisis_instance', CrisisDetector)

    @property
    def _insights(self) -> InsightGenerator:
        return self._lazy('_insights_instance', InsightGenerator)

    @property
    def _story(self) -> StoryGenerator:
        return self._lazy('_story_instance', StoryGenerator)

    @property
    def _forecaster(self) -> MLForecaster:
        return self._lazy('_forecaster_instance', MLForecaster)

    @property
    def _conversation(self) -> ConversationEngine:
        return self._lazy('_conversation_instance', ConversationEngine)

    # ---- Client provider ----

    def get_openai_client(self):
        return self._provider.get_openai_client()

    def _check_google_nlp(self) -> bool:
        return self._provider.check_google_nlp()

    @property
    def openai_available(self) -> bool:
        """Lazy check if OpenAI API is available"""
        if not self._openai_checked:
            self._openai_available = self._check_openai()
            self._openai_checked = True
        return self._openai_available

    def _get_model_name(self) -> str:
        return self._provider.get_model_name()

    def _check_openai(self) -> bool:
        return self._provider.check_openai()

    # ---- Sentiment analysis ----

    def analyze_sentiment(self, text: str) -> dict[str, Any]:
        return self._sentiment.analyze_sentiment(text)

    def _google_sentiment_analysis(self, text: str) -> dict[str, Any]:
        return self._sentiment.google_sentiment_analysis(text)

    def _openai_sentiment_analysis(self, text: str) -> dict[str, Any]:
        return self._sentiment.openai_sentiment_analysis(text)

    def _fallback_sentiment_analysis(self, text: str, quota_exceeded: bool = False) -> dict[str, Any]:
        return self._sentiment.fallback_sentiment_analysis(text, quota_exceeded)

    def _sentiment_score_to_label(self, score: float) -> str:
        return self._sentiment.sentiment_score_to_label(score)

    def _extract_emotions_from_text(self, text: str, entities: Any) -> list[str]:
        return self._sentiment.extract_emotions_from_text(text, entities)

    def _extract_emotions_fallback(self, text: str) -> list[str]:
        return self._sentiment.extract_emotions_fallback(text)

    def enhanced_sentiment_analysis(self, text: str) -> dict[str, Any]:
        return self._sentiment.enhanced_sentiment_analysis(text)

    def _extract_emotions_advanced(self, text: str) -> list[str]:
        return self._sentiment.extract_emotions_advanced(text)

    def _extract_emotion(self, text: str) -> str:
        return self._sentiment.extract_emotion(text)

    # ---- Voice emotion ----

    def analyze_voice_emotion(self, audio_data: bytes, transcript: str) -> dict[str, Any]:
        return self._voice.analyze_voice_emotion(audio_data, transcript)

    def _analyze_audio_features(self, audio_data: bytes) -> dict[str, Any]:
        return self._voice.analyze_audio_features(audio_data)

    def _basic_voice_analysis(self, audio_data: bytes, transcript: str) -> dict[str, Any]:
        return self._voice.basic_voice_analysis(audio_data, transcript)

    def _combine_analyses(self, transcript_analysis: dict, voice_characteristics: dict) -> str:
        return self._voice.combine_analyses(transcript_analysis, voice_characteristics)

    def analyze_voice_emotion_fallback(self, text: str = "") -> dict[str, Any]:
        return self._voice.analyze_voice_emotion_fallback(text)

    # ---- Crisis detection ----

    def detect_crisis(self, text: str) -> bool:
        return self._crisis.detect_crisis(text)

    def detect_crisis_indicators(self, text: str) -> dict[str, Any]:
        return self._crisis.detect_crisis_indicators(text)

    def _get_crisis_recommendations(self, risk_level: str) -> list[str]:
        return self._crisis.get_crisis_recommendations(risk_level)

    def _generate_crisis_response(self, crisis_analysis: dict) -> str:
        return self._crisis.generate_crisis_response(crisis_analysis)

    # ---- Recommendations & weekly insights ----

    def generate_personalized_recommendations(self, user_history: list[dict], current_mood: str) -> dict[str, Any]:
        return self._insights.generate_personalized_recommendations(user_history, current_mood)

    def _summarize_mood_history(self, history: list[dict]) -> str:
        return self._insights.summarize_mood_history(history)

    def _fallback_recommendations(self, user_history: list[dict], current_mood: str, quota_exceeded: bool = False) -> dict[str, Any]:
        return self._insights.fallback_recommendations(user_history, current_mood, quota_exceeded)

    def generate_weekly_insights(self, weekly_data: dict, locale: str = 'sv') -> dict[str, Any]:
        return self._insights.generate_weekly_insights(weekly_data, locale)

    def _fallback_weekly_insights(self, weekly_data: dict, locale: str = 'sv', quota_exceeded: bool = False) -> dict[str, Any]:
        return self._insights.fallback_weekly_insights(weekly_data, locale, quota_exceeded)

    # ---- Story generation ----

    def generate_personalized_therapeutic_story(self, user_mood_data: list[dict], user_profile: dict[str, Any] | None = None, locale: str = 'sv') -> dict[str, Any]:
        return self._story.generate_personalized_therapeutic_story(user_mood_data, user_profile, locale)

    def _analyze_mood_for_story(self, mood_data: list[dict]) -> dict[str, Any]:
        return self._story.analyze_mood_for_story(mood_data)

    def _fallback_therapeutic_story(self, mood_data: list[dict], locale: str = 'sv', quota_exceeded: bool = False) -> dict[str, Any]:
        return self._story.fallback_therapeutic_story(mood_data, locale, quota_exceeded)

    # ---- ML forecasting & pattern analysis ----

    def analyze_mood_patterns(self, mood_history: list[dict]) -> dict[str, Any]:
        return self._forecaster.analyze_mood_patterns(mood_history)

    def predictive_mood_analytics(self, mood_history: list[dict], days_ahead: int = 7) -> dict[str, Any]:
        return self._forecaster.predictive_mood_analytics(mood_history, days_ahead)

    def _analyze_weekly_patterns(self, scores, dates) -> dict[str, Any]:
        return self._forecaster.analyze_weekly_patterns(scores, dates)

    def _generate_predictive_recommendations(self, risk_factors: list[str], trend: float, volatility: float, predictions: list[float]) -> list[str]:
        return self._forecaster.generate_predictive_recommendations(risk_factors, trend, volatility, predictions)

    def predictive_mood_forecasting_simple(self, mood_history: list[dict], days_ahead: int = 7, user_id: str | None = None) -> dict[str, Any]:
        return self._forecaster.predictive_mood_forecasting_simple(mood_history, days_ahead, user_id)

    def _generate_ml_forecast_recommendations(self, risk_factors: list[str], trend: str, avg_forecast: float) -> list[str]:
        return self._forecaster.generate_ml_forecast_recommendations(risk_factors, trend, avg_forecast)

    def _generate_simple_forecast_recommendations(self, risk_factors: list[str], trend: str, avg_forecast: float) -> list[str]:
        return self._forecaster.generate_simple_forecast_recommendations(risk_factors, trend, avg_forecast)

    # ---- ML model cache ----

    def _get_cached_ml_model(self, user_id: str, mood_history: list[dict]) -> dict | None:
        return self._model_cache.get_cached_ml_model(user_id, mood_history)

    def _cache_ml_model(self, user_id: str, model_data: dict, mood_history: list[dict]):
        return self._model_cache.cache_ml_model(user_id, model_data, mood_history)

    # ---- Therapeutic conversation ----

    def generate_therapeutic_conversation(self, user_message: str, conversation_history: list[dict],
                                          user_profile: dict[str, Any] | None = None,
                                          user_id: str | None = None) -> dict[str, Any]:
        return self._conversation.generate_therapeutic_conversation(
            user_message, conversation_history, user_profile, user_id
        )

    def generate_therapeutic_conversation_stream(self, user_message: str, conversation_history: list[dict],
                                                 user_id: str | None = None):
        return self._conversation.generate_therapeutic_conversation_stream(
            user_message, conversation_history, user_id
        )

    def _build_enhanced_system_prompt(self, user_message: str, user_id: str | None = None) -> str:
        return self._conversation.build_enhanced_system_prompt(user_message, user_id)

    def _fetch_user_profile_context(self, user_id: str) -> str:
        return self._conversation.fetch_user_profile_context(user_id)

    def _fetch_cross_source_context(self, user_id: str) -> str:
        return self._conversation.fetch_cross_source_context(user_id)

    def _generate_suggested_actions(self, sentiment_analysis: dict, distortions: list) -> list[str]:
        return self._conversation.generate_suggested_actions(sentiment_analysis, distortions)

    def _generate_fallback_therapeutic_response(self, user_message: str, quota_exceeded: bool = False) -> dict[str, Any]:
        return self._conversation.generate_fallback_therapeutic_response(user_message, quota_exceeded)

    def _generate_local_fallback_response(self, user_message: str) -> dict[str, Any]:
        return self._conversation.generate_local_fallback_response(user_message)

    def _generate_exercise_recommendations(self, sentiment_analysis: dict, user_message: str) -> list[dict]:
        return self._conversation.generate_exercise_recommendations(sentiment_analysis, user_message)


# Global instance
ai_services = AIServices()
