"""GPT-backed personalized therapeutic story generation (with fallbacks)."""

import logging
from collections import Counter
from typing import Any

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)

# Story-card moods (AIStories.tsx colours by these) for a dominant sentiment.
_SENTIMENT_TO_STORY_MOOD = {"POSITIVE": "happy", "NEGATIVE": "sad", "NEUTRAL": "neutral"}


class StoryGenerator:
    """Single responsibility: generate therapeutic stories from mood data."""

    def __init__(self, svc):
        self._svc = svc

    def generate_personalized_therapeutic_story(self, user_mood_data: list[dict], user_profile: dict[str, Any] | None = None, locale: str = 'sv') -> dict[str, Any]:
        """
        Generate personalized therapeutic stories using OpenAI GPT-4o-mini with user mood data

        Args:
            user_mood_data: List of user's mood logs with timestamps and sentiment scores
            user_profile: Optional user profile information
            locale: Language ('sv', 'en', 'no')

        Returns:
            Story generation result with AI-generated therapeutic narrative
        """
        svc = self._svc
        if not svc.openai_available or not svc.client:
            telemetry.degraded("ai_stories", "openai_unavailable")
            logger.warning("⚠️ OpenAI not available for story generation, using fallback")
            return svc._fallback_therapeutic_story(user_mood_data, locale)

        try:
            # Analyze mood patterns for story context
            mood_summary = svc._analyze_mood_for_story(user_mood_data)

            # Build localized prompts
            prompts = {
                'sv': f"""Du är en terapeutisk berättare som skapar läkande historier baserat på användarens sinnesstämningsdata.

Skapa en kort, empatisk berättelse (200-300 ord) som:
1. Reflekterar användarens känslomönster från senaste veckan
2. Innehåller en resa från utmaning till tillväxt
3. Inkluderar terapeutiska metaforer för känsloreglering
4. Slutar med hopp och praktiska insikter

Användarinformation:
- Genomsnittlig sinnesstämning: {mood_summary['avg_sentiment']}
- Huvudkänslor: {', '.join(mood_summary['dominant_emotions'])}
- Mönster: {mood_summary['pattern_description']}

Berättelsen ska vara på svenska, empatisk och stödjande.""",
                'en': f"""You are a therapeutic storyteller who creates healing narratives based on the user's mood data.

Create a short, empathetic story (200-300 words) that:
1. Reflects the user's emotional patterns from the past week
2. Contains a journey from challenge to growth
3. Includes therapeutic metaphors for emotion regulation
4. Ends with hope and practical insights

User information:
- Average mood: {mood_summary['avg_sentiment']}
- Main emotions: {', '.join(mood_summary['dominant_emotions'])}
- Pattern: {mood_summary['pattern_description']}

The story should be in English, empathetic and supportive.""",
                'no': f"""Du er en terapeutisk forteller som skaper helbredende fortellinger basert på brukerens stemningsdata.

Lag en kort, empatisk historie (200-300 ord) som:
1. Reflekterer brukerens følelsesmønstre fra siste uken
2. Inneholder en reise fra utfordring til vekst
3. Inkluderer terapeutiske metaforer for følelsesregulering
4. Slutter med håp og praktiske innsikter

Brukerinformasjon:
- Gjennomsnittlig stemning: {mood_summary['avg_sentiment']}
- Hovedfølelser: {', '.join(mood_summary['dominant_emotions'])}
- Mønster: {mood_summary['pattern_description']}

Historien skal være på norsk, empatisk og støttende."""
            }

            prompt = prompts.get(locale, prompts['sv'])

            # CRITICAL FIX: Use _get_model_name() for Azure/OpenAI compatibility
            response = svc.client.chat.completions.create(
                model=svc._get_model_name(),
                messages=[
                    {"role": "system", "content": "Du är en erfaren terapeut som använder berättelser för läkande och personlig utveckling." if locale == 'sv' else "You are an experienced therapist who uses stories for healing and personal development." if locale == 'en' else "Du er en erfaren terapeut som bruker fortellinger for helbredelse og personlig utvikling."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.8,
                presence_penalty=0.3,
                timeout=30.0  # 30s timeout to prevent hanging
            )

            content = response.choices[0].message.content
            if content is None:
                return svc._fallback_therapeutic_story(user_mood_data, locale)
            story = content.strip()

            logger.info("✅ Personalized therapeutic story generated using %s", svc._get_model_name())

            return {
                "story": story,
                "ai_generated": True,
                "model_used": svc._get_model_name(),
                "locale": locale,
                "mood_summary": mood_summary,
                "word_count": len(story.split()),
                "confidence": 0.9
            }

        except svc._rate_limit_error as e:
            # CRITICAL FIX: Handle rate limit and quota exceeded errors
            error_str = str(e).lower()
            if 'quota' in error_str or 'insufficient_quota' in error_str:
                logger.warning(f"⚠️ OpenAI quota exceeded for story generation: {str(e)}")
                return svc._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=True)
            else:
                logger.warning(f"⚠️ OpenAI rate limit exceeded for story generation: {str(e)}")
                return svc._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=False)
        except (TimeoutError, Exception) as e:
            # CRITICAL FIX: Handle API errors, quota exceeded and timeouts gracefully
            error_str = str(e).lower()
            if isinstance(e, svc._api_error):
                if 'quota' in error_str or 'insufficient_quota' in error_str:
                    logger.warning(f"⚠️ OpenAI quota exceeded (APIError) for story generation: {str(e)}")
                    return svc._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=True)
                logger.error(f"OpenAI API error for story generation: {str(e)}")
                return svc._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=False)
            if 'timeout' in error_str or 'timed out' in error_str:
                logger.warning(f"⚠️ OpenAI story generation timeout: {str(e)}, using fallback")
                return svc._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=False)
            elif 'quota' in error_str or 'insufficient_quota' in error_str:
                logger.warning(f"⚠️ OpenAI quota exceeded (Exception) for story generation: {str(e)}")
                return svc._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=True)
            else:
                logger.error(f"Story generation failed: {str(e)}")
            return svc._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=False)

    @staticmethod
    def analyze_mood_for_story(mood_data: list[dict]) -> dict[str, Any]:
        """Analyze mood data to create context for therapeutic story"""
        if not mood_data:
            return {
                "avg_sentiment": "NEUTRAL",
                "dominant_mood": "neutral",
                "dominant_emotions": ["neutral"],
                "pattern_description": "Ingen data tillgänglig"
            }

        sentiments = []
        emotions = []

        for entry in mood_data[-14:]:  # The 14 most recent; callers pass oldest-first
            sentiment = entry.get("sentiment", "NEUTRAL")
            entry_emotions = entry.get("emotions_detected", [])

            sentiments.append(sentiment)
            emotions.extend(entry_emotions)

        # Calculate dominant sentiment
        sentiment_counts = Counter(sentiments)
        dominant_sentiment = sentiment_counts.most_common(1)[0][0] if sentiment_counts else "NEUTRAL"

        # Calculate dominant emotions
        emotion_counts = Counter(emotions)
        dominant_emotions = [emotion for emotion, count in emotion_counts.most_common(3)]

        # Pattern description
        positive_count = sentiments.count("POSITIVE")
        negative_count = sentiments.count("NEGATIVE")
        neutral_count = sentiments.count("NEUTRAL")

        if positive_count > negative_count and positive_count > neutral_count:
            pattern = "positiv utveckling"
        elif negative_count > positive_count:
            pattern = "utmanande period"
        else:
            pattern = "balanserad period"

        return {
            "avg_sentiment": dominant_sentiment,
            # The story card colours and labels by this; it read a key that
            # did not exist, so every story was filed as "neutral".
            "dominant_mood": _SENTIMENT_TO_STORY_MOOD.get(dominant_sentiment, "neutral"),
            "dominant_emotions": dominant_emotions if dominant_emotions else ["neutral"],
            "pattern_description": pattern,
            "data_points": len(mood_data)
        }

    def fallback_therapeutic_story(self, mood_data: list[dict], locale: str = 'sv', quota_exceeded: bool = False) -> dict[str, Any]:
        """Fallback therapeutic story generation"""
        svc = self._svc
        mood_summary = svc._analyze_mood_for_story(mood_data)

        # Localized fallback stories
        fallback_stories = {
            'sv': f"""Det var en gång en liten fågel som levde i en stor skog. Fågeln hade haft en tuff vinter med mycket blåst och regn. Men varje dag lärde den sig något nytt - hur vinden kunde bära den högre, hur regnet tvättade bort det gamla.

Precis som du har haft {mood_summary['pattern_description']} i din resa. Dina känslor av {', '.join(mood_summary['dominant_emotions'])} är som vädret - de förändras och lär dig saker.

Kom ihåg att efter varje storm kommer solsken. Du har styrkan att växa genom utmaningar, precis som träden som böjer sig i vinden men aldrig bryts.

Vad har du lärt dig av dina upplevelser den senaste tiden?""",
            'en': f"""Once upon a time, there was a little bird living in a big forest. The bird had experienced a tough winter with lots of wind and rain. But each day it learned something new - how the wind could carry it higher, how the rain washed away the old.

Just like you have had {mood_summary['pattern_description']} in your journey. Your feelings of {', '.join(mood_summary['dominant_emotions'])} are like the weather - they change and teach you things.

Remember that after every storm comes sunshine. You have the strength to grow through challenges, just like trees that bend in the wind but never break.

What have you learned from your experiences lately?""",
            'no': f"""Det var en gang en liten fugl som levde i en stor skog. Fuglen hadde hatt en tøff vinter med mye vind og regn. Men hver dag lærte den noe nytt - hvordan vinden kunne bære den høyere, hvordan regnet vasket bort det gamle.

Akkurat som du har hatt {mood_summary['pattern_description']} i reisen din. Følelsene dine av {', '.join(mood_summary['dominant_emotions'])} er som været - de endrer seg og lærer deg ting.

Husk at etter hver storm kommer solskinn. Du har styrken til å vokse gjennom utfordringer, akkurat som trærne som bøyer seg i vinden men aldri brytes.

Hva har du lært av opplevelsene dine den siste tiden?"""
        }

        story = fallback_stories.get(locale, fallback_stories['sv'])

        if quota_exceeded:
            quota_msg = "⚠️ AI-berättelsetjänsten är tillfälligt otillgänglig. Här är en allmän berättelse baserad på dina data:\n\n" if locale == 'sv' else "⚠️ AI story service is temporarily unavailable. Here is a general story based on your data:\n\n" if locale == 'en' else "⚠️ AI-fortellingstjenesten er midlertidig utilgjengelig. Her er en generell fortelling basert på dataene dine:\n\n"
            story = quota_msg + story

        return {
            "story": story,
            "ai_generated": False,
            "model_used": "fallback",
            "locale": locale,
            "mood_summary": mood_summary,
            "word_count": len(story.split()),
            "confidence": 0.7,
            "quota_exceeded": quota_exceeded
        }
