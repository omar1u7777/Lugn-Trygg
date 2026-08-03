"""Sentiment and emotion analysis (Google NLP → OpenAI → ML → keyword fallbacks).

All cross-method calls and shared state go through the facade (svc) so
monkeypatches on AIServices methods keep affecting this pipeline exactly as
they did when it was a single class.
"""

import logging
from typing import Any

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)

# Typed Google Cloud fault class for explicit vendor error handling.
try:
    from google.api_core.exceptions import GoogleAPIError
except ImportError:  # pragma: no cover - google-api-core always ships with firestore
    GoogleAPIError = Exception  # type: ignore[assignment,misc]


class SentimentAnalyzer:
    """Single responsibility: turn text into sentiment/emotion structures."""

    def __init__(self, svc):
        self._svc = svc

    def analyze_sentiment(self, text: str) -> dict[str, Any]:
        """
        Advanced sentiment analysis using Google Cloud Natural Language API with OpenAI fallback

        Returns:
            {
                "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
                "score": float (-1.0 to 1.0),
                "magnitude": float (0.0+),
                "confidence": float (0.0 to 1.0),
                "emotions": ["joy", "sadness", "anger", "fear", "surprise"],
                "intensity": float (0.0 to 1.0)
            }
        """
        svc = self._svc
        # Check if text is likely Swedish (contains Swedish characters or common words)
        swedish_indicators = ['å', 'ä', 'ö', 'jag', 'är', 'och', 'det', 'att', 'en', 'som']
        is_swedish = any(char in text.lower() for char in ['å', 'ä', 'ö']) or \
                      any(word in text.lower() for word in swedish_indicators)

        # Try Google NLP first if available and not Swedish
        if svc.google_nlp_available and not is_swedish:
            try:
                return svc._google_sentiment_analysis(text)
            except GoogleAPIError as e:
                # Typed vendor fault — Google Cloud API level failure.
                telemetry.degraded("sentiment_analysis", "google_nlp_api_error", error=str(e))
                logger.warning(f"Google NLP API error, trying OpenAI: {str(e)}")
            except Exception as e:
                telemetry.degraded("sentiment_analysis", "google_nlp_failure", error=str(e))
                logger.warning(f"Google NLP failed, trying OpenAI: {str(e)}")

        # Try OpenAI if available
        if svc.openai_available and svc.client:
            try:
                return svc._openai_sentiment_analysis(text)
            except svc._rate_limit_error:
                # Typed vendor fault — quota/rate limit.
                telemetry.degraded("sentiment_analysis", "openai_rate_limited")
                logger.warning("OpenAI rate limit exceeded, using fallback")
                return svc._fallback_sentiment_analysis(text, quota_exceeded=True)
            except TimeoutError as e:
                telemetry.degraded("sentiment_analysis", "openai_timeout", error=str(e))
                logger.warning(f"OpenAI sentiment analysis timed out: {str(e)}")
            except Exception as e:
                telemetry.degraded("sentiment_analysis", "openai_error", error=str(e))
                logger.warning(f"OpenAI sentiment analysis failed: {str(e)}")

        # Final fallback
        return svc._fallback_sentiment_analysis(text)

    def google_sentiment_analysis(self, text: str) -> dict[str, Any]:
        """Google Cloud Natural Language API sentiment analysis"""
        svc = self._svc
        from google.cloud import language_v1

        from .client_provider import get_google_nlp_credentials

        client = language_v1.LanguageServiceClient(credentials=get_google_nlp_credentials())
        document = language_v1.Document(
            content=text,
            type_=language_v1.Document.Type.PLAIN_TEXT,
            language="en"  # English (Swedish not supported for sentiment)
        )

        # Analyze sentiment
        sentiment_response = client.analyze_sentiment(document=document)
        sentiment = sentiment_response.document_sentiment

        # Analyze entities for emotion detection
        entities_response = client.analyze_entities(document=document)

        # Extract emotions from text and entities
        emotions = svc._extract_emotions_from_text(text, entities_response.entities)

        result = {
            "sentiment": svc._sentiment_score_to_label(sentiment.score),
            "score": sentiment.score,
            "magnitude": sentiment.magnitude,
            "confidence": 0.8,  # Google NLP doesn't provide confidence for document sentiment
            "emotions": emotions,
            "intensity": min(abs(sentiment.score) * sentiment.magnitude, 1.0),
            "method": "google_nlp"
        }

        logger.info(f"Google NLP sentiment analysis completed: {result['sentiment']} ({result['score']:.2f})")
        return result

    def openai_sentiment_analysis(self, text: str) -> dict[str, Any]:
        """OpenAI-based sentiment analysis as fallback"""
        svc = self._svc
        if svc.client is None:
            return svc._fallback_sentiment_analysis(text)
        try:
            prompt = f"""Analysera följande text och returnera JSON med sentimentanalys:

Text: "{text}"

Returnera JSON i detta format:
{{
    "sentiment": "POSITIVE" eller "NEGATIVE" eller "NEUTRAL",
    "score": nummer mellan -1.0 och 1.0,
    "confidence": nummer mellan 0.0 och 1.0,
    "emotions": ["lista", "av", "känslor"],
    "intensity": nummer mellan 0.0 och 1.0
}}

Var noga med att returnera endast giltig JSON."""

            # CRITICAL FIX: Add explicit timeout and error handling to prevent 4.1s hangs
            response = svc.client.chat.completions.create(
                model=svc._get_model_name(),
                messages=[
                    {"role": "system", "content": "Du är en expert på sentimentanalys. Returnera endast giltig JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.3,
                timeout=30.0  # 30s timeout to prevent hanging
            )

            content = response.choices[0].message.content
            if content is None:
                return svc._fallback_sentiment_analysis(text)
            result_text = content.strip()

            # Clean up response (remove markdown code blocks if present)
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:].strip()

            import json
            result = json.loads(result_text)

            # Validate and ensure required fields
            result["method"] = "openai"
            result["magnitude"] = result.get("magnitude", abs(result.get("score", 0)))

            logger.info(f"OpenAI sentiment analysis completed: {result.get('sentiment')} ({result.get('score', 0):.2f})")
            return result

        except (TimeoutError, Exception) as e:
            # CRITICAL FIX: Handle timeout errors gracefully to prevent 4.1s hangs
            error_str = str(e).lower()
            if 'timeout' in error_str or 'timed out' in error_str:
                logger.warning(f"⚠️ OpenAI sentiment analysis timeout: {str(e)}, using fallback")
                return svc._fallback_sentiment_analysis(text, quota_exceeded=False)
            logger.error(f"OpenAI sentiment analysis failed: {str(e)}")
            return svc._fallback_sentiment_analysis(text, quota_exceeded=False)

    def fallback_sentiment_analysis(self, text: str, quota_exceeded: bool = False) -> dict[str, Any]:
        """Fallback sentiment analysis – uses ML model first, keyword matching as last resort."""
        svc = self._svc
        try:
            from ..ml_sentiment_service import ml_sentiment
            if ml_sentiment.available:
                result = ml_sentiment.analyze(text)
                if quota_exceeded:
                    result["quota_exceeded"] = True
                logger.info(f"ML sentiment analysis: {result.get('sentiment')} (conf={result.get('confidence')})")
                return result
        except Exception as e:
            logger.warning(f"ML sentiment model unavailable, using keyword fallback: {e}")

        # Last resort tier reached — flag the degraded state explicitly so the
        # keyword heuristic can never masquerade as full AI sentiment.
        telemetry.degraded(
            "sentiment_analysis",
            "quota_exhausted_keyword_fallback" if quota_exceeded else "keyword_fallback",
        )

        # Last-resort keyword matching
        positive_words = ["glad", "lycklig", "bra", "positiv", "tacksam", "nöjd", "härligt", "fantastiskt", "avslappnad", "harmonisk", "energisk"]
        negative_words = ["ledsen", "arg", "stressad", "deppig", "frustrerad", "irriterad", "orolig", "dålig", "trött", "utmattad", "ängslig", "sorgsen"]

        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)

        if positive_count > negative_count:
            score = min(positive_count * 0.2, 1.0)
            sentiment = "POSITIVE"
        elif negative_count > positive_count:
            score = -min(negative_count * 0.2, 1.0)
            sentiment = "NEGATIVE"
        else:
            score = 0.0
            sentiment = "NEUTRAL"

        result = {
            "sentiment": sentiment,
            "score": score,
            "magnitude": max(positive_count + negative_count, 1.0),
            "confidence": 0.5 if quota_exceeded else 0.6,
            "emotions": svc._extract_emotions_fallback(text),
            "intensity": min(abs(score), 1.0),
            "method": "keyword_fallback"
        }

        if quota_exceeded:
            result["quota_exceeded"] = True

        return result

    @staticmethod
    def sentiment_score_to_label(score: float) -> str:
        """Convert sentiment score to label"""
        if score > 0.2:
            return "POSITIVE"
        elif score < -0.2:
            return "NEGATIVE"
        else:
            return "NEUTRAL"

    @staticmethod
    def extract_emotions_from_text(text: str, entities: Any) -> list[str]:
        """Extract emotions from text using entity analysis"""
        emotions: list[str] = []
        text_lower = text.lower()

        # Emotion keywords mapping
        emotion_keywords = {
            "joy": ["glädje", "lycka", "nöje", "glad", "lycklig", "härligt"],
            "sadness": ["sorg", "ledsen", "deppig", "nedstämd", "gråter"],
            "anger": ["arg", "rasande", "irriterad", "frustrerad", "ilska"],
            "fear": ["rädd", "orolig", "ängslig", "skräck", "nervös"],
            "surprise": ["förvånad", "chockad", "överraskad"],
            "disgust": ["äcklad", "avsky", "motvilja"],
            "trust": ["förtroende", "tillit", "trygg"],
            "anticipation": ["spänning", "förväntan", "hopp"]
        }

        for emotion, keywords in emotion_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                emotions.append(emotion)

        return emotions[:3] if emotions else ["neutral"]

    def extract_emotions_fallback(self, text: str) -> list[str]:
        """Fallback emotion extraction"""
        return self._svc._extract_emotions_from_text(text, [])

    def enhanced_sentiment_analysis(self, text: str) -> dict[str, Any]:
        """
        Enhanced sentiment analysis using transformers for Swedish
        Falls back to existing method if transformers unavailable
        """
        svc = self._svc
        if not svc._transformer_sentiment_enabled:
            # Keep chat path stable in constrained runtimes unless explicitly enabled.
            return {
                **svc.analyze_sentiment(text),
                "method": "keyword_based"
            }

        try:
            from transformers import pipeline

            # Use a Swedish-capable model or multilingual model
            model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
            # For Swedish specifically, you might want to use: "KB/bert-base-swedish-cased-sentiment"

            try:
                if svc._sentiment_pipeline is None:
                    # type: ignore for transformers pipeline overload issue
                    svc._sentiment_pipeline = pipeline(
                        task="sentiment-analysis",  # type: ignore[arg-type]
                        model=model_name,
                        tokenizer=model_name,
                        return_all_scores=True  # type: ignore[call-overload]
                    )

                results = svc._sentiment_pipeline(text[:512])  # Truncate for model limits

                if results and len(results) > 0:
                    scores = results[0]
                    # Convert to our format
                    label_map = {
                        "LABEL_0": "NEGATIVE",
                        "LABEL_1": "NEUTRAL",
                        "LABEL_2": "POSITIVE"
                    }

                    # Get the highest scoring sentiment
                    best_result = max(scores, key=lambda x: x['score'])

                    return {
                        "sentiment": label_map.get(best_result['label'], "NEUTRAL"),
                        "score": (best_result['score'] - 0.5) * 2,  # Normalize to -1 to 1
                        "magnitude": best_result['score'],
                        "confidence": best_result['score'],
                        "emotions": svc._extract_emotions_advanced(text),
                        "intensity": abs((best_result['score'] - 0.5) * 2),
                        "method": "transformer"
                    }

            except Exception as e:
                svc._transformer_sentiment_enabled = False
                logger.warning(f"Transformer analysis failed: {str(e)}")

        except ImportError:
            logger.warning("Transformers library not available, using fallback method")

        # Fall back to existing method
        return {
            **svc.analyze_sentiment(text),
            "method": "keyword_based"
        }

    @staticmethod
    def extract_emotions_advanced(text: str) -> list[str]:
        """Extract emotions using advanced NLP techniques"""
        # Enhanced emotion keywords for Swedish
        emotion_keywords = {
            "joy": ["glädje", "lycka", "nöje", "glad", "lycklig", "härligt", "fantastiskt", "underbart", "kul"],
            "sadness": ["sorg", "ledsen", "deppig", "nedstämd", "gråter", "tråkig", "sorgsen", "nedslagen"],
            "anger": ["arg", "rasande", "irriterad", "frustrerad", "ilska", "förbannad", "upprörd"],
            "fear": ["rädd", "orolig", "ängslig", "skräck", "nervös", "panik", "rädsla"],
            "surprise": ["förvånad", "chockad", "överraskad", "oväntat"],
            "disgust": ["äcklad", "avsky", "motvilja", "vedervärdig"],
            "trust": ["förtroende", "tillit", "trygg", "säker"],
            "anticipation": ["spänning", "förväntan", "hopp", "ivrig"]
        }

        text_lower = text.lower()
        emotion_scores = {}

        for emotion, keywords in emotion_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            if score > 0:
                emotion_scores[emotion] = score

        # Return top 3 emotions by score
        sorted_emotions = sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True)
        return [emotion for emotion, score in sorted_emotions[:3]]

    @staticmethod
    def extract_emotion(text: str) -> str:
        """Extract dominant emotion from text."""
        emotion_keywords = {
            'ledsen': 'sadness',
            'deppig': 'sadness',
            'arg': 'anger',
            'ilska': 'anger',
            'orolig': 'anxiety',
            'stressad': 'anxiety',
            'rädd': 'fear',
            'glad': 'joy',
            'lycklig': 'joy'
        }

        text_lower = text.lower()
        for keyword, emotion in emotion_keywords.items():
            if keyword in text_lower:
                return emotion

        return 'neutral'
