"""GPT-backed personalized recommendations and weekly insights (with fallbacks)."""

import logging
from typing import Any

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)


class InsightGenerator:
    """Single responsibility: generate recommendations and weekly insight texts."""

    def __init__(self, svc):
        self._svc = svc

    def generate_personalized_recommendations(self, user_history: list[dict], current_mood: str) -> dict[str, Any]:
        """
        Generate AI-powered personalized wellness recommendations using GPT-4o-mini

        Args:
            user_history: List of user's mood logs
            current_mood: Current detected mood

        Returns:
            Personalized recommendations as JSON-friendly dict
        """
        svc = self._svc
        if not svc.openai_available or not svc.client:
            telemetry.degraded("ai_recommendations", "openai_unavailable")
            logger.warning("⚠️ OpenAI not available for recommendations, using fallback")
            return svc._fallback_recommendations(user_history, current_mood)

        try:
            # Prepare context from user history
            recent_moods = user_history[-7:] if len(user_history) > 7 else user_history
            mood_summary = svc._summarize_mood_history(recent_moods)

            prompt = f"""Du är en empatisk mentalvårdsprofessionell som hjälper användaren att må bättre.
            Baserat på följande information, ge personliga, empatiska och praktiska råd för välbefinnande:

            Nuvarande sinnesstämning: {current_mood}
            Sista veckans mönster: {mood_summary}

            Ge råd i följande format:
            1. Omedelbara coping-strategier (2-3 konkreta tips)
            2. Långsiktiga välbefinnande-strategier (2-3 tips)
            3. När man ska söka professionell hjälp

            Håll råden empatiska, praktiska och på svenska. Var kortfattad men hjälpsam."""

            # CRITICAL FIX: Use _get_model_name() for Azure/OpenAI compatibility
            response = svc.client.chat.completions.create(
                model=svc._get_model_name(),
                messages=[
                    {"role": "system", "content": "Du är en erfaren psykolog som ger empatiska råd på svenska för mental hälsa."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7,
                timeout=30.0  # 30s timeout to prevent hanging
            )

            content = response.choices[0].message.content
            if content is None:
                return svc._fallback_recommendations(user_history, current_mood)
            recommendations = content.strip()

            logger.info("✅ Personalized recommendations generated using gpt-4o-mini")

            return {
                "ai_generated": True,
                "recommendations": recommendations,
                "confidence": 0.85,
                "personalized": True,
                "model_used": svc._get_model_name()
            }

        except svc._rate_limit_error as e:
            telemetry.degraded("ai_recommendations", "openai_rate_limited", error=str(e))
            logger.warning(f"⚠️ OpenAI rate limit exceeded for recommendations: {str(e)}")
            return svc._fallback_recommendations(user_history, current_mood, quota_exceeded=True)
        except (TimeoutError, Exception) as e:
            # CRITICAL FIX: Handle timeout errors gracefully to prevent 4.1s hangs
            error_str = str(e).lower()
            if 'timeout' in error_str or 'timed out' in error_str:
                logger.warning(f"⚠️ OpenAI recommendations timeout: {str(e)}, using fallback")
                return svc._fallback_recommendations(user_history, current_mood, quota_exceeded=False)
            elif isinstance(e, svc._api_error):
                logger.error(f"OpenAI API error for recommendations: {str(e)}")
            else:
                logger.error(f"OpenAI recommendation generation failed: {str(e)}")
            return svc._fallback_recommendations(user_history, current_mood)

    @staticmethod
    def summarize_mood_history(history: list[dict]) -> str:
        """Summarize user's mood history"""
        if not history:
            return "Ingen historik tillgänglig"

        positive_count = sum(1 for entry in history if entry.get("sentiment") == "POSITIVE")
        negative_count = sum(1 for entry in history if entry.get("sentiment") == "NEGATIVE")
        neutral_count = len(history) - positive_count - negative_count

        return f"{positive_count} positiva, {negative_count} negativa, {neutral_count} neutrala stämningar"

    @staticmethod
    def fallback_recommendations(user_history: list[dict], current_mood: str, quota_exceeded: bool = False) -> dict[str, Any]:
        """Fallback recommendations when AI is not available"""
        recommendations = {
            "POSITIVE": {
                "immediate": ["Fira dina positiva känslor", "Dela glädjen med någon du bryr dig om"],
                "long_term": ["Håll ett tacksamhetsdagbok", "Fortsätt med aktiviteter som gör dig glad"],
                "seek_help": "Om du känner dig överväldigad av positiva känslor kan professionell vägledning hjälpa"
            },
            "NEGATIVE": {
                "immediate": ["Ta djupa andetag", "Gå en kort promenad", "Prata med en vän"],
                "long_term": ["Öva mindfulness", "Håll en regelbunden sömnschema", "Sök professionell hjälp vid behov"],
                "seek_help": "Om negativa känslor kvarstår längre än två veckor, sök professionell hjälp"
            },
            "NEUTRAL": {
                "immediate": ["Gör något du tycker om", "Ta en paus från skärmar"],
                "long_term": ["Skapa balans i livet", "Utöva regelbunden motion"],
                "seek_help": "Vid ihållande känslor av tomhet eller meningslöshet, sök professionell hjälp"
            }
        }

        mood_recs = recommendations.get(current_mood, recommendations["NEUTRAL"])

        base_recommendations = f"""
Omedelbara coping-strategier:
• {" • ".join(mood_recs["immediate"])}

Långsiktiga välbefinnande-strategier:
• {" • ".join(mood_recs["long_term"])}

{mood_recs["seek_help"]}
        """.strip()

        if quota_exceeded:
            base_recommendations = f"⚠️ AI-tjänsten är tillfälligt otillgänglig på grund av hög efterfrågan. Här är allmänna råd baserade på ditt humör:\n\n{base_recommendations}"

        return {
            "ai_generated": False,
            "recommendations": base_recommendations,
            "confidence": 0.7,
            "personalized": False,
            "quota_exceeded": quota_exceeded
        }

    def generate_weekly_insights(self, weekly_data: dict, locale: str = 'sv') -> dict[str, Any]:
        """
        Generate AI-powered weekly insights from mood data using GPT-4o-mini

        Args:
            weekly_data: Dictionary containing mood logs, memories, etc.
            locale: User's language ('sv', 'en', 'no')

        Returns:
            AI-generated insights and suggestions as JSON-friendly dict
        """
        svc = self._svc
        if not svc.openai_available or not svc.client:
            telemetry.degraded("weekly_insights", "openai_unavailable")
            logger.warning("⚠️ OpenAI not available for weekly insights, using fallback")
            return svc._fallback_weekly_insights(weekly_data, locale)

        try:
            mood_logs = weekly_data.get("moods", [])
            memories = weekly_data.get("memories", [])

            # Localize prompt based on locale
            prompts = {
                'sv': f"""Analysera följande veckodata för en användare av en mentalvårdsapp och ge empatiska insikter:

            Humörloggar: {len(mood_logs)} st
            Minnesinlägg: {len(memories)} st

            Ge insikter i följande format:
            1. Övergripande mönster och trender
            2. Positiva observationer
            3. Områden att fokusera på
            4. Konkreta förslag för nästa vecka

            Var empatisk, stödjande och praktisk. Svara på svenska.""",
                'en': f"""Analyze the following weekly data for a mental health app user and provide empathetic insights:

            Mood logs: {len(mood_logs)} entries
            Memory entries: {len(memories)} entries

            Provide insights in the following format:
            1. Overall patterns and trends
            2. Positive observations
            3. Areas to focus on
            4. Concrete suggestions for next week

            Be empathetic, supportive and practical. Respond in English.""",
                'no': f"""Analyser følgende ukesdata for en bruker av en mentalhelseapp og gi empatiske innsikter:

            Humørlogger: {len(mood_logs)} oppføringer
            Minneoppføringer: {len(memories)} oppføringer

            Gi innsikter i følgende format:
            1. Overordnede mønstre og trender
            2. Positive observasjoner
            3. Områder å fokusere på
            4. Konkrete forslag for neste uke

            Vær empatisk, støttende og praktisk. Svar på norsk."""
            }

            prompt = prompts.get(locale, prompts['sv'])

            # CRITICAL FIX: Use _get_model_name() for Azure/OpenAI compatibility
            response = svc.client.chat.completions.create(
                model=svc._get_model_name(),
                messages=[
                    {"role": "system", "content": "Du är en erfaren psykolog som analyserar mental hälsa-data empatiskt och ger stödjande insikter." if locale == 'sv' else "You are an experienced psychologist who analyzes mental health data empathetically and provides supportive insights." if locale == 'en' else "Du er en erfaren psykolog som analyserer mentalhelsedata empatisk og gir støttende innsikter."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.6,
                timeout=30.0  # 30s timeout to prevent hanging
            )

            content = response.choices[0].message.content
            if content is None:
                return svc._fallback_weekly_insights(weekly_data, locale)
            insights = content.strip()

            logger.info("✅ Weekly insights generated using gpt-4o-mini")

            return {
                "ai_generated": True,
                "insights": insights,
                "confidence": 0.8,
                "comprehensive": True,
                "model_used": svc._get_model_name()
            }

        except svc._rate_limit_error as e:
            telemetry.degraded("weekly_insights", "openai_rate_limited", error=str(e))
            logger.warning(f"⚠️ OpenAI rate limit exceeded for weekly insights: {str(e)}")
            return svc._fallback_weekly_insights(weekly_data, locale, quota_exceeded=True)
        except (TimeoutError, Exception) as e:
            # CRITICAL FIX: Handle timeout errors gracefully to prevent 4.1s hangs
            error_str = str(e).lower()
            if 'timeout' in error_str or 'timed out' in error_str:
                logger.warning(f"⚠️ OpenAI weekly insights timeout: {str(e)}, using fallback")
                return svc._fallback_weekly_insights(weekly_data, locale, quota_exceeded=False)
            elif isinstance(e, svc._api_error):
                logger.error(f"OpenAI API error for weekly insights: {str(e)}")
            else:
                logger.error(f"OpenAI weekly insights generation failed: {str(e)}")
            return svc._fallback_weekly_insights(weekly_data, locale)

    @staticmethod
    def fallback_weekly_insights(weekly_data: dict, locale: str = 'sv', quota_exceeded: bool = False) -> dict[str, Any]:
        """Fallback weekly insights"""
        mood_count = len(weekly_data.get("moods", []))
        memory_count = len(weekly_data.get("memories", []))

        # Calculate average mood score if available
        moods = weekly_data.get("moods", [])
        avg_score = None
        if moods:
            scores = []
            for mood in moods:
                # Try to get score from various possible fields
                score = mood.get("sentiment_score") or mood.get("score")
                if score is not None:
                    try:
                        scores.append(float(score))
                    except (ValueError, TypeError):
                        continue
            if scores:
                avg_score = sum(scores) / len(scores)

        quota_message = ""
        if quota_exceeded:
            if locale == 'en':
                quota_message = "⚠️ AI service is temporarily unavailable due to high demand. Here are general insights based on your data:\n\n"
            elif locale == 'no':
                quota_message = "⚠️ AI-tjenesten er midlertidig utilgjengelig på grunn av høy etterspørsel. Her er generelle innsikter basert på dataene dine:\n\n"
            else:  # sv
                quota_message = "⚠️ AI-tjänsten är tillfälligt otillgänglig på grund av hög efterfrågan. Här är allmänna insikter baserade på dina data:\n\n"

        if locale == 'en':
            insights_parts = [
                "Overall patterns:",
                f"• You have logged {mood_count} moods this week",
                f"• You have created {memory_count} memories"
            ]

            if avg_score is not None:
                mood_desc = "positive" if avg_score > 0.2 else "negative" if avg_score < -0.2 else "neutral"
                insights_parts.append(f"• Average mood: {avg_score:.1f} ({mood_desc})")

            insights_parts.extend([
                "",
                "Positive observations:",
                "• Regularly logging moods shows engagement with your wellbeing",
                "• The memory function helps you reflect on positive experiences",
                "",
                "Areas to focus on:",
                "• Continue with regular mood logging",
                "• Use relaxation sounds when feeling stressed",
                "",
                "Concrete suggestions for next week:",
                "• Log your mood every day",
                "• Try different relaxation exercises",
                "• Write down three things you're grateful for each evening"
            ])
        elif locale == 'no':
            insights_parts = [
                "Overordnede mønstre:",
                f"• Du har logget {mood_count} humør denne uken",
                f"• Du har opprettet {memory_count} minner"
            ]

            if avg_score is not None:
                mood_desc = "positiv" if avg_score > 0.2 else "negativ" if avg_score < -0.2 else "nøytral"
                insights_parts.append(f"• Gjennomsnittlig humør: {avg_score:.1f} ({mood_desc})")

            insights_parts.extend([
                "",
                "Positive observasjoner:",
                "• Regelmessig logging av humør viser engasjement for ditt velvære",
                "• Minnefunksjonen hjelper deg å reflektere over positive opplevelser",
                "",
                "Områder å fokusere på:",
                "• Fortsett med regelmessig humørlogging",
                "• Bruk avslapningslyder når du føler deg stresset",
                "",
                "Konkrete forslag for neste uke:",
                "• Logg humøret ditt hver dag",
                "• Prøv forskjellige avslapningsøvelser",
                "• Skriv ned tre ting du er takknemlig for hver kveld"
            ])
        else:  # sv
            insights_parts = [
                "Övergripande mönster:",
                f"• Du har loggat {mood_count} humör denna vecka",
                f"• Du har skapat {memory_count} minnen"
            ]

            if avg_score is not None:
                mood_desc = "positiv" if avg_score > 0.2 else "negativ" if avg_score < -0.2 else "neutral"
                insights_parts.append(f"• Genomsnittlig sinnesstämning: {avg_score:.1f} ({mood_desc})")

            insights_parts.extend([
                "",
                "Positiva observationer:",
                "• Att regelbundet logga humör visar engagemang för ditt välbefinnande",
                "• Minnesfunktionen hjälper dig att reflektera över positiva upplevelser",
                "",
                "Områden att fokusera på:",
                "• Fortsätt med regelbunden humörloggning",
                "• Använd avslappningsljuden när du känner stress",
                "",
                "Konkreta förslag för nästa vecka:",
                "• Logga ditt humör varje dag",
                "• Prova olika avslappningsövningar",
                "• Skriv ner tre saker du är tacksam för varje kväll"
            ])

        insights = quota_message + "\n".join(insights_parts).strip()

        return {
            "ai_generated": False,
            "insights": insights,
            "confidence": 0.6,
            "comprehensive": False,
            "quota_exceeded": quota_exceeded
        }
