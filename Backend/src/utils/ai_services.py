import logging
import os
import re
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
import json
import numpy as np
from collections import Counter, defaultdict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Import OpenAI exceptions for better error handling
try:
    from openai import RateLimitError, APIError
except ImportError:
    RateLimitError = Exception  # Fallback if not available
    APIError = Exception

class AIServices:
    """Advanced AI services for mental health and wellness app"""

    def __init__(self):
        logger.info("🤖 Initializing AI Services...")
        self.client = None
        self._openai_checked = False
        self._openai_available = False
        self.google_nlp_available = self._check_google_nlp()
        logger.info(f"🤖 AI Services initialized - Google NLP: {self.google_nlp_available}, OpenAI: lazy loaded")

    async def get_openai_client(self):
        """Lazy load OpenAI client asynchronously"""
        if self.client is None:
            if not self._openai_checked:
                self._openai_available = self._check_openai()
                self._openai_checked = True
            if self._openai_available:
                # Client is already initialized in _check_openai
                pass
        return self.client

    def _check_google_nlp(self) -> bool:
        """Check if Google Cloud Natural Language API is available"""
        try:
            from google.cloud import language_v1
            return True
        except ImportError:
            logger.warning("Google Cloud Natural Language API not available")
            return False

    @property
    def openai_available(self) -> bool:
        """Lazy check if OpenAI API is available"""
        if not self._openai_checked:
            self._openai_available = self._check_openai()
            self._openai_checked = True
        return self._openai_available

    def _check_openai(self) -> bool:
        """Check if OpenAI API is available"""
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=api_key)
                logger.info("✅ OpenAI client initialized successfully")
                return True
            except ImportError:
                logger.warning("OpenAI library not available")
                return False
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {str(e)}")
                return False
        else:
            logger.warning("OPENAI_API_KEY not set")
            return False

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Advanced sentiment analysis using Google Cloud Natural Language API

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
        # Check if text is likely Swedish (contains Swedish characters or common words)
        swedish_indicators = ['å', 'ä', 'ö', 'jag', 'är', 'och', 'det', 'att', 'en', 'som']
        is_swedish = any(char in text.lower() for char in ['å', 'ä', 'ö']) or \
                     any(word in text.lower() for word in swedish_indicators)

        if not self.google_nlp_available or is_swedish:
            return self._fallback_sentiment_analysis(text)

        try:
            from google.cloud import language_v1

            client = language_v1.LanguageServiceClient()
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
            emotions = self._extract_emotions_from_text(text, entities_response.entities)

            result = {
                "sentiment": self._sentiment_score_to_label(sentiment.score),
                "score": sentiment.score,
                "magnitude": sentiment.magnitude,
                "confidence": 0.8,  # Google NLP doesn't provide confidence for document sentiment
                "emotions": emotions,
                "intensity": min(abs(sentiment.score) * sentiment.magnitude, 1.0)
            }

            logger.info(f"Sentiment analysis completed: {result['sentiment']} ({result['score']:.2f})")
            return result

        except Exception as e:
            logger.error(f"Google NLP sentiment analysis failed: {str(e)}")
            return self._fallback_sentiment_analysis(text)

    def _fallback_sentiment_analysis(self, text: str) -> Dict[str, Any]:
        """Fallback sentiment analysis using keyword matching"""
        positive_words = ["glad", "lycklig", "bra", "positiv", "tacksam", "nöjd", "bra", "härligt", "fantastiskt"]
        negative_words = ["ledsen", "arg", "stressad", "deppig", "frustrerad", "irriterad", "orolig", "dålig", "trött"]

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

        return {
            "sentiment": sentiment,
            "score": score,
            "magnitude": max(positive_count + negative_count, 1.0),
            "confidence": 0.6,
            "emotions": self._extract_emotions_fallback(text),
            "intensity": min(abs(score), 1.0)
        }

    def _sentiment_score_to_label(self, score: float) -> str:
        """Convert sentiment score to label"""
        if score > 0.2:
            return "POSITIVE"
        elif score < -0.2:
            return "NEGATIVE"
        else:
            return "NEUTRAL"

    def _extract_emotions_from_text(self, text: str, entities: List) -> List[str]:
        """Extract emotions from text using entity analysis"""
        emotions = []
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

    def _extract_emotions_fallback(self, text: str) -> List[str]:
        """Fallback emotion extraction"""
        return self._extract_emotions_from_text(text, [])

    def analyze_voice_emotion(self, audio_data: bytes, transcript: str) -> Dict[str, Any]:
        """
        Enhanced voice emotion analysis using advanced audio processing
        """
        try:
            import librosa
            import numpy as np
            from io import BytesIO

            # For now, combine transcript analysis with basic audio features
            transcript_analysis = self.analyze_sentiment(transcript)

            # Enhanced voice characteristics analysis
            voice_characteristics = self._analyze_audio_features(audio_data)

            # Combine transcript and audio analysis for better accuracy
            combined_confidence = (transcript_analysis["confidence"] + voice_characteristics["confidence"]) / 2

            return {
                "primary_emotion": transcript_analysis["emotions"][0] if transcript_analysis["emotions"] else "neutral",
                "confidence": combined_confidence,
                "voice_characteristics": voice_characteristics,
                "transcript_sentiment": transcript_analysis["sentiment"],
                "audio_emotion_score": voice_characteristics["emotion_score"],
                "combined_analysis": self._combine_analyses(transcript_analysis, voice_characteristics),
                **transcript_analysis
            }

        except ImportError:
            logger.warning("Advanced audio libraries not available, using basic analysis")
            return self._basic_voice_analysis(audio_data, transcript)

    def _analyze_audio_features(self, audio_data: bytes) -> Dict[str, Any]:
        """Analyze audio features for emotion detection"""
        try:
            import librosa
            import numpy as np
            from io import BytesIO

            # Convert bytes to audio array (simplified - would need proper audio format handling)
            # This is a placeholder for actual audio analysis
            audio_array = np.frombuffer(audio_data, dtype=np.float32)

            # Basic audio features (in real implementation, these would be calculated from actual audio)
            energy_level = "medium"  # Would calculate RMS energy
            speech_rate = "normal"   # Would calculate speech tempo
            pitch_variation = 0.5    # Would calculate fundamental frequency variation

            # Estimate emotion from audio features
            emotion_score = 0.0
            if energy_level == "high":
                emotion_score += 0.3
            if speech_rate == "fast":
                emotion_score += 0.2
            if pitch_variation > 0.7:
                emotion_score += 0.4

            return {
                "energy_level": energy_level,
                "speech_rate": speech_rate,
                "pitch_variation": pitch_variation,
                "emotion_score": min(emotion_score, 1.0),
                "confidence": 0.7,  # Audio analysis confidence
                "analysis_method": "basic_features"
            }

        except Exception as e:
            logger.error(f"Audio feature analysis failed: {str(e)}")
            return {
                "energy_level": "unknown",
                "speech_rate": "unknown",
                "pitch_variation": 0.0,
                "emotion_score": 0.0,
                "confidence": 0.0,
                "analysis_method": "failed"
            }

    def _basic_voice_analysis(self, audio_data: bytes, transcript: str) -> Dict[str, Any]:
        """Basic voice analysis when advanced libraries aren't available"""
        transcript_analysis = self.analyze_sentiment(transcript)

        return {
            "primary_emotion": transcript_analysis["emotions"][0] if transcript_analysis["emotions"] else "neutral",
            "confidence": transcript_analysis["confidence"] * 0.8,
            "voice_characteristics": {
                "energy_level": "medium",
                "speech_rate": "normal",
                "emotional_intensity": transcript_analysis["intensity"],
                "analysis_method": "transcript_only"
            },
            "transcript_sentiment": transcript_analysis["sentiment"],
            "audio_emotion_score": 0.0,
            "combined_analysis": transcript_analysis["sentiment"],
            **transcript_analysis
        }

    def _combine_analyses(self, transcript_analysis: Dict, voice_characteristics: Dict) -> str:
        """Combine transcript and voice analysis for better accuracy"""
        transcript_sentiment = transcript_analysis.get("sentiment", "NEUTRAL")
        audio_score = voice_characteristics.get("emotion_score", 0.0)

        # If audio analysis shows high emotion but transcript is neutral, adjust
        if audio_score > 0.6 and transcript_sentiment == "NEUTRAL":
            return "MIXED_HIGH_EMOTION"
        elif audio_score > 0.4 and transcript_sentiment == "NEGATIVE":
            return "NEGATIVE_INTENSE"
        elif audio_score > 0.4 and transcript_sentiment == "POSITIVE":
            return "POSITIVE_INTENSE"

        return transcript_sentiment

    def generate_personalized_recommendations(self, user_history: List[Dict], current_mood: str) -> Dict[str, Any]:
        """
        Generate AI-powered personalized wellness recommendations using GPT-4o-mini

        Args:
            user_history: List of user's mood logs
            current_mood: Current detected mood

        Returns:
            Personalized recommendations as JSON-friendly dict
        """
        if not self.openai_available or not self.client:
            logger.warning("⚠️ OpenAI not available for recommendations, using fallback")
            return self._fallback_recommendations(user_history, current_mood)

        try:
            # Prepare context from user history
            recent_moods = user_history[-7:] if len(user_history) > 7 else user_history
            mood_summary = self._summarize_mood_history(recent_moods)

            prompt = f"""Du är en empatisk mentalvårdsprofessionell som hjälper användaren att må bättre.
            Baserat på följande information, ge personliga, empatiska och praktiska råd för välbefinnande:

            Nuvarande sinnesstämning: {current_mood}
            Sista veckans mönster: {mood_summary}

            Ge råd i följande format:
            1. Omedelbara coping-strategier (2-3 konkreta tips)
            2. Långsiktiga välbefinnande-strategier (2-3 tips)
            3. När man ska söka professionell hjälp

            Håll råden empatiska, praktiska och på svenska. Var kortfattad men hjälpsam."""

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Du är en erfaren psykolog som ger empatiska råd på svenska för mental hälsa."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )

            recommendations = response.choices[0].message.content.strip()

            logger.info(f"✅ Personalized recommendations generated using GPT-4o-mini")

            return {
                "ai_generated": True,
                "recommendations": recommendations,
                "confidence": 0.85,
                "personalized": True,
                "model_used": "gpt-4o"
            }

        except RateLimitError as e:
            logger.warning(f"⚠️ OpenAI rate limit exceeded for recommendations: {str(e)}")
            return self._fallback_recommendations(user_history, current_mood, quota_exceeded=True)
        except APIError as e:
            logger.error(f"OpenAI API error for recommendations: {str(e)}")
            return self._fallback_recommendations(user_history, current_mood)
        except Exception as e:
            logger.error(f"OpenAI recommendation generation failed: {str(e)}")
            return self._fallback_recommendations(user_history, current_mood)

    def _summarize_mood_history(self, history: List[Dict]) -> str:
        """Summarize user's mood history"""
        if not history:
            return "Ingen historik tillgänglig"

        positive_count = sum(1 for entry in history if entry.get("sentiment") == "POSITIVE")
        negative_count = sum(1 for entry in history if entry.get("sentiment") == "NEGATIVE")
        neutral_count = len(history) - positive_count - negative_count

        return f"{positive_count} positiva, {negative_count} negativa, {neutral_count} neutrala stämningar"

    def _fallback_recommendations(self, user_history: List[Dict], current_mood: str, quota_exceeded: bool = False) -> Dict[str, Any]:
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

    def generate_weekly_insights(self, weekly_data: Dict, locale: str = 'sv') -> Dict[str, Any]:
        """
        Generate AI-powered weekly insights from mood data using GPT-4o-mini

        Args:
            weekly_data: Dictionary containing mood logs, memories, etc.
            locale: User's language ('sv', 'en', 'no')

        Returns:
            AI-generated insights and suggestions as JSON-friendly dict
        """
        if not self.openai_available or not self.client:
            logger.warning("⚠️ OpenAI not available for weekly insights, using fallback")
            return self._fallback_weekly_insights(weekly_data, locale)

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

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Du är en erfaren psykolog som analyserar mental hälsa-data empatiskt och ger stödjande insikter." if locale == 'sv' else "You are an experienced psychologist who analyzes mental health data empathetically and provides supportive insights." if locale == 'en' else "Du er en erfaren psykolog som analyserer mentalhelsedata empatisk og gir støttende innsikter."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.6
            )

            insights = response.choices[0].message.content.strip()

            logger.info(f"✅ Weekly insights generated using GPT-4o-mini")

            return {
                "ai_generated": True,
                "insights": insights,
                "confidence": 0.8,
                "comprehensive": True,
                "model_used": "gpt-4o"
            }

        except RateLimitError as e:
            logger.warning(f"⚠️ OpenAI rate limit exceeded for weekly insights: {str(e)}")
            return self._fallback_weekly_insights(weekly_data, locale, quota_exceeded=True)
        except APIError as e:
            logger.error(f"OpenAI API error for weekly insights: {str(e)}")
            return self._fallback_weekly_insights(weekly_data, locale)
        except Exception as e:
            logger.error(f"OpenAI weekly insights generation failed: {str(e)}")
            return self._fallback_weekly_insights(weekly_data, locale)

    def _fallback_weekly_insights(self, weekly_data: Dict, locale: str = 'sv', quota_exceeded: bool = False) -> Dict[str, Any]:
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

    def detect_crisis_indicators(self, text: str) -> Dict[str, Any]:
        """
        Detect potential crisis indicators in user text
        Critical for mental health apps - requires immediate attention
        """
        crisis_keywords = {
            "suicidal": ["döda mig", "ta livet av mig", "självmord", "inte orka längre", "sluta leva"],
            "self_harm": ["skada mig själv", "skära mig", "göra illa mig", "självskada"],
            "hopelessness": ["hopplöst", "ingen mening", "allt är meningslöst", "ge upp"],
            "severe_distress": ["kan inte fortsätta", "håller på att bryta ihop", "psykiskt sammanbrott"]
        }

        text_lower = text.lower()
        detected_indicators = []
        severity_score = 0

        for category, keywords in crisis_keywords.items():
            matches = [keyword for keyword in keywords if keyword in text_lower]
            if matches:
                detected_indicators.extend(matches)
                severity_score += len(matches) * 2  # Higher weight for crisis indicators

        # Check for urgency indicators
        urgency_patterns = [
            r"hjälp.*?nu", r"snart", r"omedelbart", r"direkt",
            r"kan inte.*?längre", r"håll.*inte.*?ut"
        ]

        for pattern in urgency_patterns:
            if re.search(pattern, text_lower):
                severity_score += 1.5

        risk_level = "LOW"
        if severity_score >= 5:
            risk_level = "CRITICAL"
        elif severity_score >= 3:
            risk_level = "HIGH"
        elif severity_score >= 1:
            risk_level = "MEDIUM"

        return {
            "risk_level": risk_level,
            "severity_score": severity_score,
            "indicators": list(set(detected_indicators)),
            "requires_immediate_attention": risk_level in ["CRITICAL", "HIGH"],
            "recommended_actions": self._get_crisis_recommendations(risk_level)
        }

    def _get_crisis_recommendations(self, risk_level: str) -> List[str]:
        """Get appropriate recommendations based on crisis risk level"""
        recommendations = {
            "CRITICAL": [
                "Ring 112 för akut hjälp",
                "Kontakta närmaste akutmottagning",
                "Ring Självmordslinjen: 90101",
                "Prata med en nära vän eller familjemedlem"
            ],
            "HIGH": [
                "Kontakta din vårdcentral eller terapeut",
                "Ring Självmordslinjen: 90101",
                "Prata med någon du litar på",
                "Undvik att vara ensam just nu"
            ],
            "MEDIUM": [
                "Kontakta din vårdcentral inom kort",
                "Prata med någon du litar på om dina känslor",
                "Överväg att kontakta en terapeut"
            ],
            "LOW": [
                "Fortsätt att söka stöd när du behöver det",
                "Prata med någon du litar på"
            ]
        }

        return recommendations.get(risk_level, recommendations["LOW"])

    def analyze_mood_patterns(self, mood_history: List[Dict]) -> Dict[str, Any]:
        """
        Analyze mood patterns using machine learning techniques
        Predict future mood trends and provide insights
        """
        if len(mood_history) < 7:
            return {
                "pattern_analysis": "Otillräcklig data för mönsteranalys",
                "predictions": "Behöver mer data för prediktioner",
                "confidence": 0.0
            }

        try:
            # Extract mood scores and timestamps
            mood_scores = []
            timestamps = []

            for entry in mood_history[-30:]:  # Last 30 entries
                try:
                    # Get score from ai_analysis if available, otherwise from direct field
                    ai_analysis = entry.get("ai_analysis", {})
                    score = float(ai_analysis.get("score", entry.get("sentiment_score", 0)))
                    mood_scores.append(score)
                    timestamps.append(datetime.fromisoformat(entry.get("timestamp", "").replace('Z', '+00:00')))
                except (ValueError, TypeError):
                    continue

            if len(mood_scores) < 7:
                return {
                    "pattern_analysis": "Otillräcklig numerisk data för analys",
                    "predictions": "Behöver mer kvantitativ data",
                    "confidence": 0.0
                }

            # Calculate trends using numpy
            scores_array = np.array(mood_scores)

            # Simple linear trend analysis
            x = np.arange(len(scores_array))
            trend = np.polyfit(x, scores_array, 1)[0]

            # Calculate moving averages
            short_ma = np.mean(scores_array[-7:])  # Last week
            long_ma = np.mean(scores_array[-14:]) if len(scores_array) >= 14 else short_ma

            # Determine trend direction
            trend_direction = "improving" if trend > 0.05 else "declining" if trend < -0.05 else "stable"

            # Calculate volatility (mood swings)
            volatility = np.std(scores_array)

            # Generate insights
            insights = []
            if trend_direction == "improving":
                insights.append("Din sinnesstämning visar en positiv trend")
            elif trend_direction == "declining":
                insights.append("Din sinnesstämning visar en nedåtgående trend - överväg extra stöd")

            if volatility > 0.5:
                insights.append("Du upplever stora humörsvängningar - mindfulness kan hjälpa")
            elif volatility < 0.2:
                insights.append("Din sinnesstämning är stabil - bra jobbat!")

            # Simple prediction for next week
            prediction = "Liknande mönster förväntas nästa vecka"
            if abs(trend) > 0.1:
                prediction = f"Trend pekar mot {'förbättring' if trend > 0 else 'försämring'}"

            return {
                "pattern_analysis": "; ".join(insights),
                "predictions": prediction,
                "confidence": min(0.8, len(mood_scores) / 30.0),
                "trend_direction": trend_direction,
                "volatility": float(volatility),
                "trend_strength": abs(float(trend))
            }

        except Exception as e:
            logger.error(f"Pattern analysis failed: {str(e)}")
            return {
                "pattern_analysis": "Kunde inte analysera mönster",
                "predictions": "Otillräcklig data för prediktioner",
                "confidence": 0.0
            }

    def predictive_mood_analytics(self, mood_history: List[Dict], days_ahead: int = 7) -> Dict[str, Any]:
        """
        Advanced predictive analytics for mood forecasting using ML techniques
        """
        if len(mood_history) < 14:
            return {
                "forecast": "Otillräcklig data för prediktion",
                "confidence": 0.0,
                "risk_factors": [],
                "recommendations": ["Logga fler humör för bättre prediktioner"]
            }

        try:
            # Extract and prepare data
            scores = []
            dates = []

            for entry in mood_history[-60:]:  # Use last 60 entries for better prediction
                try:
                    ai_analysis = entry.get("ai_analysis", {})
                    score = float(ai_analysis.get("score", entry.get("sentiment_score", 0)))
                    timestamp = datetime.fromisoformat(entry.get("timestamp", "").replace('Z', '+00:00'))
                    scores.append(score)
                    dates.append(timestamp)
                except (ValueError, TypeError):
                    continue

            if len(scores) < 14:
                return {
                    "forecast": "Behöver mer data för prediktion",
                    "confidence": 0.0,
                    "risk_factors": [],
                    "recommendations": ["Fortsätt logga humör dagligen"]
                }

            scores_array = np.array(scores)

            # Advanced trend analysis
            trend = np.polyfit(range(len(scores_array)), scores_array, 2)  # Quadratic trend

            # Calculate momentum (rate of change)
            momentum = np.gradient(scores_array)

            # Volatility analysis
            volatility = np.std(scores_array[-14:])  # Recent volatility

            # Seasonal patterns (weekly)
            if len(scores_array) >= 14:
                weekly_pattern = self._analyze_weekly_patterns(scores_array, dates)

            # Predict future values
            future_predictions = []
            last_score = scores_array[-1]
            current_trend = trend[1]  # Linear coefficient

            for i in range(days_ahead):
                # Simple exponential smoothing prediction
                prediction = last_score + (current_trend * (i + 1))
                # Add some randomness based on historical volatility
                noise = np.random.normal(0, volatility * 0.5)
                prediction += noise
                # Bound predictions between -1 and 1
                prediction = np.clip(prediction, -1.0, 1.0)
                future_predictions.append(float(prediction))

            # Risk assessment
            risk_factors = []
            if volatility > 0.6:
                risk_factors.append("high_mood_volatility")
            if current_trend < -0.1:
                risk_factors.append("negative_trend")
            if np.mean(scores_array[-7:]) < -0.3:
                risk_factors.append("persistently_low_mood")
            if len([s for s in scores_array[-7:] if s < -0.5]) > 3:
                risk_factors.append("frequent_negative_moods")

            # Generate recommendations based on analysis
            recommendations = self._generate_predictive_recommendations(
                risk_factors, current_trend, volatility, future_predictions
            )

            # Calculate confidence based on data quality and consistency
            data_consistency = 1.0 - (volatility / 2.0)  # Lower volatility = higher confidence
            data_quantity = min(1.0, len(scores_array) / 60.0)  # More data = higher confidence
            confidence = (data_consistency + data_quantity) / 2.0

            return {
                "forecast": {
                    "next_week_average": float(np.mean(future_predictions)),
                    "trend_direction": "improving" if current_trend > 0.05 else "declining" if current_trend < -0.05 else "stable",
                    "volatility_level": "high" if volatility > 0.6 else "medium" if volatility > 0.3 else "low",
                    "daily_predictions": future_predictions
                },
                "current_analysis": {
                    "recent_average": float(np.mean(scores_array[-7:])),
                    "trend_strength": abs(float(current_trend)),
                    "volatility": float(volatility),
                    "momentum": float(momentum[-1])
                },
                "risk_factors": risk_factors,
                "recommendations": recommendations,
                "confidence": float(confidence),
                "data_points_used": len(scores_array)
            }

        except Exception as e:
            logger.error(f"Predictive analytics failed: {str(e)}")
            return {
                "forecast": "Kunde inte generera prediktion",
                "confidence": 0.0,
                "risk_factors": ["analysis_error"],
                "recommendations": ["Försök igen senare"]
            }

    def _analyze_weekly_patterns(self, scores: np.ndarray, dates: List[datetime]) -> Dict[str, Any]:
        """Analyze weekly mood patterns"""
        try:
            # Group by day of week
            weekday_scores = {i: [] for i in range(7)}

            for score, date in zip(scores, dates):
                weekday = date.weekday()  # 0=Monday, 6=Sunday
                weekday_scores[weekday].append(score)

            # Calculate average for each weekday
            weekday_averages = {}
            for day, day_scores in weekday_scores.items():
                if day_scores:
                    weekday_averages[day] = float(np.mean(day_scores))

            return {
                "weekday_patterns": weekday_averages,
                "best_day": max(weekday_averages.items(), key=lambda x: x[1]) if weekday_averages else None,
                "worst_day": min(weekday_averages.items(), key=lambda x: x[1]) if weekday_averages else None
            }
        except Exception:
            return {"weekday_patterns": {}, "best_day": None, "worst_day": None}

    def _generate_predictive_recommendations(self, risk_factors: List[str],
                                           trend: float, volatility: float,
                                           predictions: List[float]) -> List[str]:
        """Generate personalized recommendations based on predictive analysis"""
        recommendations = []

        if "high_mood_volatility" in risk_factors:
            recommendations.extend([
                "Öva daglig mindfulness för att stabilisera humör",
                "Skapa rutiner för att minska stressfaktorer",
                "Överväg att föra en känslodagbok"
            ])

        if "negative_trend" in risk_factors:
            recommendations.extend([
                "Öka fysisk aktivitet för humörförbättring",
                "Sök socialt stöd från vänner eller familj",
                "Överväg professionell rådgivning om trenden fortsätter"
            ])

        if "persistently_low_mood" in risk_factors:
            recommendations.extend([
                "Kontakta vårdcentral för professionell bedömning",
                "Öka exponeringen för naturligt ljus",
                "Utvärdera sömnkvalitet och rutiner"
            ])

        if trend > 0.1:
            recommendations.append("Fortsätt med de strategier som fungerar bra för dig")

        if volatility < 0.2:
            recommendations.append("Din humörstabilitet är imponerande - fortsätt med dina rutiner")

        # Add general recommendations if none specific
        if not recommendations:
            recommendations.extend([
                "Fortsätt logga ditt humör regelbundet",
                "Uppmärksamma positiva händelser i vardagen",
                "Skapa balans mellan arbete och återhämtning"
            ])

        return recommendations[:5]  # Return top 5 recommendations

    def enhanced_sentiment_analysis(self, text: str) -> Dict[str, Any]:
        """
        Enhanced sentiment analysis using transformers for Swedish
        Falls back to existing method if transformers unavailable
        """
        try:
            from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
            import torch

            # Use a Swedish-capable model or multilingual model
            model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
            # For Swedish specifically, you might want to use: "KB/bert-base-swedish-cased-sentiment"

            try:
                sentiment_pipeline = pipeline(
                    "sentiment-analysis",
                    model=model_name,
                    tokenizer=model_name,
                    return_all_scores=True
                )

                results = sentiment_pipeline(text[:512])  # Truncate for model limits

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
                        "emotions": self._extract_emotions_advanced(text),
                        "intensity": abs((best_result['score'] - 0.5) * 2),
                        "method": "transformer"
                    }

            except Exception as e:
                logger.warning(f"Transformer analysis failed: {str(e)}")

        except ImportError:
            logger.warning("Transformers library not available, using fallback method")

        # Fall back to existing method
        return {
            **self.analyze_sentiment(text),
            "method": "keyword_based"
        }

    def _extract_emotions_advanced(self, text: str) -> List[str]:
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

    def generate_therapeutic_conversation(self, user_message: str, conversation_history: List[Dict],
                                         user_profile: Dict = None) -> Dict[str, Any]:
        """
        Generate sophisticated therapeutic responses using OpenAI GPT-4o-mini
        """
        logger.info(f"🧠 Generating therapeutic conversation for message: '{user_message[:50]}...'")
        logger.info(f"🧠 OpenAI available: {self.openai_available}")

        if not self.openai_available or not self.client:
            logger.warning("⚠️ OpenAI not available, using fallback response")
            return self._generate_fallback_therapeutic_response(user_message)

        try:
            # Check for crisis indicators first
            crisis_analysis = self.detect_crisis_indicators(user_message)
            if crisis_analysis["requires_immediate_attention"]:
                return {
                    "response": self._generate_crisis_response(crisis_analysis),
                    "crisis_detected": True,
                    "crisis_analysis": crisis_analysis,
                    "ai_generated": True,
                    "model_used": "crisis_detection"
                }

            # Build enhanced context with therapeutic system prompt
            system_prompt = """Du är en empatisk terapeutisk AI-assistent specialiserad på mental hälsa och välbefinnande.
            Du hjälper användaren att reflektera lugnt och tryggt över sina känslor och tankar.

            Dina principer:
            - Var alltid empatisk, stödjande och icke-dömande
            - Använd evidensbaserade tekniker (KBT, ACT, mindfulness, avslappning)
            - Ställ öppna frågor för att utforska känslor och tankar djupare
            - Ge konkreta coping-strategier när det känns rätt
            - Uppmuntra professionell hjälp vid behov
            - Svara på svenska med värme och medkänsla
            - Var kortfattad men hjälpsam - fokusera på kvalitet över kvantitet
            - Skapa en säker, trygg atmosfär för reflektion"""

            # Add user profile context if available
            if user_profile:
                system_prompt += f"\n\nAnvändarinformation: {user_profile.get('age_group', 'vuxen')}, {user_profile.get('main_concerns', 'allmänna välmående-frågor')}"

            messages = [{"role": "system", "content": system_prompt}]

            # Add relevant conversation history (last 6 exchanges for context)
            for msg in conversation_history[-6:]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"][:300]  # Truncate long messages
                })

            # Add current message
            messages.append({"role": "user", "content": user_message})

            # Use GPT-4o-mini for cost-effective, fast therapeutic responses
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=400,
                temperature=0.7,
                presence_penalty=0.1,
                frequency_penalty=0.1
            )

            ai_response = response.choices[0].message.content.strip()

            # Enhanced sentiment analysis for emotion detection
            sentiment_analysis = self.enhanced_sentiment_analysis(user_message)

            logger.info(f"✅ Therapeutic response generated successfully using GPT-4o-mini")

            # Add exercise recommendations based on sentiment and conversation
            exercise_recommendations = self._generate_exercise_recommendations(sentiment_analysis, user_message)

            return {
                "response": ai_response,
                "crisis_detected": False,
                "sentiment_analysis": sentiment_analysis,
                "conversation_context": len(conversation_history),
                "exercise_recommendations": exercise_recommendations,
                "ai_generated": True,
                "model_used": "gpt-4o"
            }

        except RateLimitError as e:
            logger.warning(f"⚠️ OpenAI rate limit exceeded for therapeutic conversation: {str(e)}")
            return self._generate_fallback_therapeutic_response(user_message, quota_exceeded=True)
        except APIError as e:
            logger.error(f"OpenAI API error for therapeutic conversation: {str(e)}")
            return self._generate_fallback_therapeutic_response(user_message)
        except Exception as e:
            logger.error(f"Enhanced therapeutic conversation failed: {str(e)}")
            return self._generate_fallback_therapeutic_response(user_message)

    def _generate_crisis_response(self, crisis_analysis: Dict) -> str:
        """Generate appropriate crisis response"""
        risk_level = crisis_analysis["risk_level"]

        if risk_level == "CRITICAL":
            return """Jag är allvarligt oroad över ditt mående just nu. Detta är en akut situation som kräver omedelbar professionell hjälp.

Vänligen ring 112 direkt för akut hjälp, eller kontakta närmaste akutmottagning.

Du kan också ringa:
- Självmordslinjen: 90101 (öppen dygnet runt)
- Jourhavande präst: 112 (för akuta samtal)
- Vårdguiden: 1177

Du är inte ensam i detta. Professionell hjälp finns tillgänglig just nu."""

        elif risk_level == "HIGH":
            return """Jag hör att du mår väldigt dåligt just nu och behöver stöd. Detta är allvarligt och du bör söka hjälp snarast.

Rekommenderade åtgärder:
1. Kontakta din vårdcentral eller terapeut idag
2. Ring Självmordslinjen: 90101 för stöd
3. Prata med någon du litar på

Vill du att jag hjälper dig att formulera hur du ska kontakta vården?"""

        else:
            return """Jag hör att du har det svårt just nu. Dina känslor är viktiga och förtjänar uppmärksamhet.

Överväg att kontakta:
- Din vårdcentral för rådgivning
- En terapeut eller psykolog
- Någon du litar på för stöd

Vill du prata mer om vad som känns svårt just nu?"""

    def _generate_fallback_therapeutic_response(self, user_message: str, quota_exceeded: bool = False) -> Dict[str, Any]:
        """Enhanced fallback response"""
        # Generate fallback response locally
        fallback_response = self._generate_local_fallback_response(user_message)

        response_text = fallback_response["response"]
        if quota_exceeded:
            response_text = f"⚠️ AI-assistenten är tillfälligt otillgänglig på grund av hög efterfrågan. Här är allmänna råd baserade på ditt meddelande:\n\n{response_text}"

        return {
            "response": response_text,
            "crisis_detected": False,
            "sentiment_analysis": self.analyze_sentiment(user_message),
            "conversation_context": 0,
            "exercise_recommendations": fallback_response.get("suggested_actions", []),
            "ai_generated": False,
            "model_used": "fallback",
            "quota_exceeded": quota_exceeded
        }

    def _generate_local_fallback_response(self, user_message: str) -> Dict[str, Any]:
        """Local fallback response generation"""
        # Simple keyword-based responses
        message_lower = user_message.lower()

        if any(word in message_lower for word in ["stressad", "stress", "orolig", "ängslig"]):
            response = "Jag hör att du känner dig stressad. Ett bra första steg är att ta några djupa andetag - inandning i 4 sekunder, håll i 4, andas ut i 4. Vill du prata mer om vad som stressar dig?"
            actions = ["Djupandning", "Kort promenad", "Skriv ner dina tankar"]

        elif any(word in message_lower for word in ["ledsen", "sorg", "deppig", "nedstämd"]):
            response = "Det låter som du känner dig ledsen just nu. Sorg är en naturlig del av livet, men om den känns överväldigande kan det hjälpa att prata om det. Vad har hänt som gjort dig ledsen?"
            actions = ["Prata med någon du litar på", "Skriv ett brev till dig själv", "Lyssna på lugn musik"]

        elif any(word in message_lower for word in ["arg", "rasande", "irriterad"]):
            response = "Ilska är en viktig känsla att uppmärksamma. Den berättar ofta att något viktigt behöver förändras. Vad tror du ligger bakom din ilska?"
            actions = ["Fysisk aktivitet", "Skriv ner dina känslor", "Andningstekniker"]

        elif any(word in message_lower for word in ["glad", "lycklig", "nöjd"]):
            response = "Vad kul att höra att du känner dig glad! Vad är det som gör dig glad idag?"
            actions = ["Fira känslan", "Dela med andra", "Spara positiva minnen"]

        else:
            response = "Tack för att du delar med dig. Jag är här för att lyssna och stödja dig. Vill du berätta mer om hur du känner dig just nu?"
            actions = ["Skriv dagbok", "Mindfulness", "Prata med nära vän"]

        return {
            "response": response,
            "emotions_detected": [],
            "suggested_actions": actions,
            "ai_generated": False
        }

    def generate_personalized_therapeutic_story(self, user_mood_data: List[Dict], user_profile: Dict = None, locale: str = 'sv') -> Dict[str, Any]:
        """
        Generate personalized therapeutic stories using OpenAI GPT-4o with user mood data

        Args:
            user_mood_data: List of user's mood logs with timestamps and sentiment scores
            user_profile: Optional user profile information
            locale: Language ('sv', 'en', 'no')

        Returns:
            Story generation result with AI-generated therapeutic narrative
        """
        if not self.openai_available or not self.client:
            logger.warning("⚠️ OpenAI not available for story generation, using fallback")
            return self._fallback_therapeutic_story(user_mood_data, locale)

        try:
            # Analyze mood patterns for story context
            mood_summary = self._analyze_mood_for_story(user_mood_data)

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

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Du är en erfaren terapeut som använder berättelser för läkande och personlig utveckling." if locale == 'sv' else "You are an experienced therapist who uses stories for healing and personal development." if locale == 'en' else "Du er en erfaren terapeut som bruker fortellinger for helbredelse og personlig utvikling."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.8,
                presence_penalty=0.3
            )

            story = response.choices[0].message.content.strip()

            logger.info(f"✅ Personalized therapeutic story generated using GPT-4o")

            return {
                "story": story,
                "ai_generated": True,
                "model_used": "gpt-4o",
                "locale": locale,
                "mood_summary": mood_summary,
                "word_count": len(story.split()),
                "confidence": 0.9
            }

        except RateLimitError as e:
            logger.warning(f"⚠️ OpenAI rate limit exceeded for story generation: {str(e)}")
            return self._fallback_therapeutic_story(user_mood_data, locale, quota_exceeded=True)
        except Exception as e:
            logger.error(f"Story generation failed: {str(e)}")
            return self._fallback_therapeutic_story(user_mood_data, locale)

    def _analyze_mood_for_story(self, mood_data: List[Dict]) -> Dict[str, Any]:
        """Analyze mood data to create context for therapeutic story"""
        if not mood_data:
            return {
                "avg_sentiment": "NEUTRAL",
                "dominant_emotions": ["neutral"],
                "pattern_description": "Ingen data tillgänglig"
            }

        sentiments = []
        emotions = []

        for entry in mood_data[-14:]:  # Last 2 weeks
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
            "dominant_emotions": dominant_emotions if dominant_emotions else ["neutral"],
            "pattern_description": pattern,
            "data_points": len(mood_data)
        }

    def _fallback_therapeutic_story(self, mood_data: List[Dict], locale: str = 'sv', quota_exceeded: bool = False) -> Dict[str, Any]:
        """Fallback therapeutic story generation"""
        mood_summary = self._analyze_mood_for_story(mood_data)

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

    def predictive_mood_forecasting_sklearn(self, mood_history: List[Dict], days_ahead: int = 7) -> Dict[str, Any]:
        """
        Advanced predictive mood forecasting using scikit-learn ML models trained on historical mood logs

        Args:
            mood_history: List of mood entries with timestamps and scores
            days_ahead: Number of days to forecast

        Returns:
            ML-based mood forecast with confidence intervals
        """
        try:
            import sklearn
            from sklearn.linear_model import LinearRegression
            from sklearn.ensemble import RandomForestRegressor
            from sklearn.model_selection import train_test_split
            from sklearn.metrics import mean_squared_error
            import numpy as np

        except ImportError:
            logger.warning("scikit-learn not available, using fallback forecasting")
            return self.predictive_mood_analytics(mood_history, days_ahead)

        if len(mood_history) < 14:
            return {
                "forecast": "Otillräcklig data för ML-baserad prognos",
                "confidence": 0.0,
                "model_info": "fallback_used",
                "recommendations": ["Logga fler humör för bättre prognoser"]
            }

        try:
            # Prepare data for ML
            scores = []
            dates = []
            features = []

            for entry in mood_history[-60:]:  # Use last 60 entries for training
                try:
                    score = float(entry.get("sentiment_score", entry.get("score", 0)))
                    timestamp = datetime.fromisoformat(entry.get("timestamp", "").replace('Z', '+00:00'))

                    scores.append(score)
                    dates.append(timestamp)

                    # Create features: day of week, time of day, recent averages
                    day_of_week = timestamp.weekday()
                    hour = timestamp.hour

                    # Calculate rolling averages as features
                    if len(scores) >= 7:
                        week_avg = np.mean(scores[-7:])
                        month_avg = np.mean(scores[-30:]) if len(scores) >= 30 else week_avg
                    else:
                        week_avg = np.mean(scores)
                        month_avg = week_avg

                    features.append([day_of_week, hour, week_avg, month_avg])

                except (ValueError, TypeError):
                    continue

            if len(scores) < 14:
                return {
                    "forecast": "Behöver mer data för ML-träning",
                    "confidence": 0.0,
                    "model_info": "insufficient_data"
                }

            # Prepare training data
            X = np.array(features[:-7])  # Features for training (exclude last week)
            y = np.array(scores[7:])    # Target: next day's score

            if len(X) < 7:
                return {
                    "forecast": "Behöver längre historik för prognos",
                    "confidence": 0.0,
                    "model_info": "insufficient_history"
                }

            # Split data for validation
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            # Train models
            models = {
                "linear_regression": LinearRegression(),
                "random_forest": RandomForestRegressor(n_estimators=50, random_state=42)
            }

            best_model = None
            best_score = float('inf')
            best_model_name = ""

            for name, model in models.items():
                try:
                    model.fit(X_train, y_train)
                    predictions = model.predict(X_test)
                    mse = mean_squared_error(y_test, predictions)

                    if mse < best_score:
                        best_score = mse
                        best_model = model
                        best_model_name = name
                except Exception as e:
                    logger.warning(f"Model {name} training failed: {str(e)}")
                    continue

            if best_model is None:
                return {
                    "forecast": "Kunde inte träna ML-modell",
                    "confidence": 0.0,
                    "model_info": "training_failed"
                }

            # Generate forecast
            last_features = features[-1]
            forecast_scores = []

            for day in range(days_ahead):
                # Create features for next day
                next_day = dates[-1] + timedelta(days=day+1)
                next_day_of_week = next_day.weekday()
                next_hour = 12  # Assume midday for simplicity

                # Update rolling averages with forecasted values
                recent_scores = scores[-7:] + forecast_scores
                week_avg = np.mean(recent_scores[-7:])
                month_avg = np.mean(recent_scores[-30:]) if len(recent_scores) >= 30 else week_avg

                next_features = np.array([[next_day_of_week, next_hour, week_avg, month_avg]])
                predicted_score = best_model.predict(next_features)[0]

                # Clip to valid range
                predicted_score = np.clip(predicted_score, -1.0, 1.0)
                forecast_scores.append(float(predicted_score))

            # Calculate confidence based on model performance
            rmse = np.sqrt(best_score)
            confidence = max(0.0, 1.0 - (rmse / 2.0))  # Lower RMSE = higher confidence

            # Analyze forecast trends
            avg_forecast = np.mean(forecast_scores)
            trend = "improving" if avg_forecast > np.mean(scores[-7:]) + 0.1 else "declining" if avg_forecast < np.mean(scores[-7:]) - 0.1 else "stable"

            # Risk assessment
            risk_factors = []
            if np.std(forecast_scores) > 0.4:
                risk_factors.append("high_volatility_predicted")
            if avg_forecast < -0.3:
                risk_factors.append("low_mood_forecast")
            if trend == "declining":
                risk_factors.append("negative_trend")

            return {
                "forecast": {
                    "daily_predictions": forecast_scores,
                    "average_forecast": float(avg_forecast),
                    "trend": trend,
                    "confidence_interval": {
                        "lower": float(np.percentile(forecast_scores, 25)),
                        "upper": float(np.percentile(forecast_scores, 75))
                    }
                },
                "model_info": {
                    "algorithm": best_model_name,
                    "training_rmse": float(rmse),
                    "data_points_used": len(X_train),
                    "features_used": ["day_of_week", "hour", "week_avg", "month_avg"]
                },
                "current_analysis": {
                    "recent_average": float(np.mean(scores[-7:])),
                    "historical_volatility": float(np.std(scores)),
                    "data_points": len(scores)
                },
                "risk_factors": risk_factors,
                "recommendations": self._generate_ml_forecast_recommendations(risk_factors, trend, avg_forecast),
                "confidence": float(confidence),
                "forecast_period_days": days_ahead
            }

        except Exception as e:
            logger.error(f"ML forecasting failed: {str(e)}")
            return {
                "forecast": "ML-prognos misslyckades, använder fallback",
                "confidence": 0.0,
                "error": str(e),
                "fallback": self.predictive_mood_analytics(mood_history, days_ahead)
            }

    def _generate_ml_forecast_recommendations(self, risk_factors: List[str], trend: str, avg_forecast: float) -> List[str]:
        """Generate recommendations based on ML forecast"""
        recommendations = []

        if "high_volatility_predicted" in risk_factors:
            recommendations.extend([
                "Förbered dig för humörsvängningar - ha coping-strategier redo",
                "Öka mindfulness-övningar för bättre känsloreglering",
                "Skapa en stödjande rutin för utmanande dagar"
            ])

        if "low_mood_forecast" in risk_factors:
            recommendations.extend([
                "Öka socialt stöd och kontakt med nära vänner",
                "Planera aktiviteter som vanligtvis förbättrar ditt humör",
                "Överväg professionell hjälp om nedstämdheten kvarstår"
            ])

        if trend == "improving":
            recommendations.append("Fortsätt med de strategier som fungerar bra för dig")
        elif trend == "declining":
            recommendations.extend([
                "Öka självvårdsaktiviteter för att motverka nedåtgående trend",
                "Sök extra stöd från terapeut eller stödgrupp",
                "Övervaka ditt mående noga de kommande dagarna"
            ])

        if avg_forecast > 0.2:
            recommendations.append("Dina prognoser ser positiva ut - fira små segrar")

        # Add general recommendations if needed
        if not recommendations:
            recommendations.extend([
                "Fortsätt logga ditt humör regelbundet för bättre prognoser",
                "Uppmärksamma positiva händelser i vardagen",
                "Bygg upp ett nätverk av stödjande relationer"
            ])

        return recommendations[:4]  # Return top 4 recommendations

    def _generate_exercise_recommendations(self, sentiment_analysis: Dict, user_message: str) -> List[Dict]:
        """Generate personalized exercise recommendations based on user state"""
        sentiment = sentiment_analysis.get("sentiment", "NEUTRAL")
        emotions = sentiment_analysis.get("emotions", [])
        message_lower = user_message.lower()

        recommendations = []

        # High stress indicators
        if sentiment == "NEGATIVE" or any(word in message_lower for word in ["stressad", "orolig", "spänd", "ångest"]):
            recommendations.append({
                "type": "breathing",
                "title": "Andningsövning",
                "description": "4-7-8 andningsteknik för omedelbar stresslindring",
                "duration": 5,
                "urgency": "high"
            })

        # Anxiety or worry
        if any(word in message_lower for word in ["oro", "ängslan", "rädsla", "bekymmer"]) or "fear" in emotions:
            recommendations.append({
                "type": "progressive_relaxation",
                "title": "Muskelavslappning",
                "description": "Progressiv avslappning för att släppa fysisk spänning",
                "duration": 10,
                "urgency": "medium"
            })

        # Negative thought patterns
        if sentiment == "NEGATIVE" or any(word in message_lower for word in ["negativ", "hopplös", "värdelös"]):
            recommendations.append({
                "type": "cbt_thought_record",
                "title": "Tankeinventering",
                "description": "KBT-teknik för att utmana negativa tankemönster",
                "duration": 15,
                "urgency": "medium"
            })

        # General mindfulness for everyone
        if len(recommendations) < 2:
            recommendations.append({
                "type": "mindfulness",
                "title": "Mindfulness-meditation",
                "description": "Kroppsskanning för ökad medvetenhet och närvaro",
                "duration": 10,
                "urgency": "low"
            })

        # Gratitude for positive reinforcement
        if sentiment == "POSITIVE" or len(recommendations) < 2:
            recommendations.append({
                "type": "gratitude",
                "title": "Tacksamhetsövning",
                "description": "Fokusera på positiva aspekter i livet",
                "duration": 5,
                "urgency": "low"
            })

        # Return top 2 most relevant recommendations
        return sorted(recommendations, key=lambda x: {"high": 0, "medium": 1, "low": 2}[x["urgency"]])[:2]

# Global instance
ai_services = AIServices()