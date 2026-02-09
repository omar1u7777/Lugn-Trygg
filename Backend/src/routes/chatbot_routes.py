import logging
from datetime import UTC, datetime

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.subscription_service import (
    SubscriptionLimitError,
    SubscriptionService,
)
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

chatbot_bp = Blueprint("chatbot", __name__)
logger = logging.getLogger(__name__)

# Maximum message length to prevent abuse
MAX_MESSAGE_LENGTH = 2000


def _to_camel_case_ai_suggestions(suggestions: dict) -> dict:
    """Convert AI feature suggestions to camelCase."""
    return {
        "suggestStory": suggestions.get("suggest_story", False),
        "suggestForecast": suggestions.get("suggest_forecast", False),
        "storyReason": suggestions.get("story_reason", ""),
        "forecastReason": suggestions.get("forecast_reason", "")
    }


def _to_camel_case_exercise(exercise: dict) -> dict:
    """Convert exercise content to camelCase."""
    return {
        "title": exercise.get("title", ""),
        "description": exercise.get("description", ""),
        "durationMinutes": exercise.get("duration_minutes", 5),
        "steps": exercise.get("steps", []),
        "tips": exercise.get("tips", ""),
        "benefits": exercise.get("benefits", ""),
        "instructions": exercise.get("instructions", "")
    }


def _to_camel_case_message(msg: dict) -> dict:
    """Convert chat message to camelCase."""
    return {
        "role": msg.get("role", ""),
        "content": msg.get("content", ""),
        "timestamp": msg.get("timestamp", ""),
        "emotionsDetected": msg.get("emotions_detected", []),
        "suggestedActions": msg.get("suggested_actions", []),
        "crisisDetected": msg.get("crisis_detected", False),
        "crisisAnalysis": msg.get("crisis_analysis", {}),
        "aiGenerated": msg.get("ai_generated", True),
        "modelUsed": msg.get("model_used", "unknown")
    }

# 🔹 Therapeutic chatbot conversation
@chatbot_bp.route("/chat", methods=["POST", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def chat_with_ai():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        logger.info("🔄 Chat endpoint called")

        # DB availability guard
        if db is None:
            logger.error("Database unavailable for chatbot")
            return APIResponse.error("Service temporarily unavailable", "SERVICE_UNAVAILABLE", 503)

        # Try to get JSON data
        try:
            data = request.get_json(force=True, silent=False)
        except Exception as json_error:
            logger.error(f"JSON parsing failed: {json_error}")
            return APIResponse.bad_request("Invalid JSON format. Please send a valid JSON body.")

        if not data or "message" not in data:
            logger.error("❌ Missing message in request")
            return APIResponse.bad_request("Message required")

        user_message = data["message"].strip()
        # Sanitize and cap message length
        user_message = input_sanitizer.sanitize(user_message, content_type='text', max_length=MAX_MESSAGE_LENGTH)
        if not user_message:
            return APIResponse.bad_request("Message required")

        payload_user_id = data.get("user_id", "").strip()
        token_user_id = getattr(g, "user_id", None)
        user_id = token_user_id or payload_user_id

        logger.info(f"👤 Processing chat for user: {user_id}, message length: {len(user_message)}")

        if not user_message or not user_id:
            logger.error("❌ Empty message or user_id")
            return APIResponse.bad_request("Message and authenticated user required")

        if payload_user_id and payload_user_id != user_id:
            logger.warning(
                "Payload user_id mismatch (payload=%s, token=%s) - using token",
                payload_user_id,
                user_id,
            )

        try:
            user_doc = db.collection("users").document(user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
        except Exception as exc:
            logger.warning("Failed to fetch user for chat usage tracking: %s", exc)
            user_data = {}

        plan_context = SubscriptionService.get_plan_context(user_data)
        try:
            SubscriptionService.consume_quota(
                user_id,
                "chat_messages",
                plan_context["limits"],
            )
        except SubscriptionLimitError as exc:
            logger.info("Chat message denied due to quota for user %s", user_id)
            return APIResponse.error(
                "You have reached your daily AI chat message limit",
                "RATE_LIMITED",
                429,
                {"limit": exc.limit_value}
            )

        # Get conversation history (last 10 messages)
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        recent_messages = list(conversation_ref.order_by("timestamp", direction="DESCENDING").limit(10).stream())

        # Build conversation context
        conversation_history = []
        for msg_doc in reversed(recent_messages):
            msg_data = msg_doc.to_dict()
            conversation_history.append({
                "role": msg_data.get("role"),
                "content": msg_data.get("content")
            })

        # Generate AI response with enhanced features
        logger.info(f"🤖 Generating AI response, message length: {len(user_message)}")

        try:
            ai_response = generate_enhanced_therapeutic_response(user_message, conversation_history)
            logger.info(f"✅ AI response generated successfully, length: {len(ai_response.get('response', ''))}")
        except Exception as ai_error:
            logger.warning(f"⚠️ AI response generation failed, using fallback: {str(ai_error)}")
            ai_response = generate_fallback_response(user_message)

        # Save conversation to database
        timestamp = datetime.now(UTC).isoformat()

        # Save user message
        conversation_ref.document(f"user_{timestamp}").set({
            "role": "user",
            "content": user_message,
            "timestamp": timestamp
        })

        # Check if we should suggest AI features based on conversation context
        ai_feature_suggestions = generate_ai_feature_suggestions(
            user_message, conversation_history, ai_response
        )

        # Save AI response
        conversation_ref.document(f"ai_{timestamp}").set({
            "role": "assistant",
            "content": ai_response["response"],
            "timestamp": timestamp,
            "emotions_detected": ai_response.get("emotions_detected", []),
            "suggested_actions": ai_response.get("suggested_actions", []),
            "crisis_detected": ai_response.get("crisis_detected", False),
            "crisis_analysis": ai_response.get("crisis_analysis", {}),
            "ai_generated": ai_response.get("ai_generated", True),
            "model_used": ai_response.get("model_used", "unknown"),
            "ai_feature_suggestions": ai_feature_suggestions
        })

        # Audit log for crisis detection (security-relevant event)
        if ai_response.get("crisis_detected", False):
            audit_log('crisis_detected', user_id, {
                'crisis_analysis': ai_response.get("crisis_analysis", {}),
                'timestamp': timestamp
            })

        logger.info(f"✅ Chatt-konversation sparad för användare {user_id}")

        # AUTO-AWARD XP for chatbot conversation
        try:
            from ..services.rewards_helper import award_xp
            award_xp(user_id, 'chatbot_conversation')
        except Exception as xp_err:
            logger.warning(f"XP award failed (non-blocking): {xp_err}")

        return APIResponse.success({
            "response": ai_response["response"],
            "emotionsDetected": ai_response.get("emotions_detected", []),
            "suggestedActions": ai_response.get("suggested_actions", []),
            "exerciseRecommendations": ai_response.get("exercise_recommendations", []),
            "crisisDetected": ai_response.get("crisis_detected", False),
            "crisisAnalysis": ai_response.get("crisis_analysis", {}),
            "aiGenerated": ai_response.get("ai_generated", True),
            "modelUsed": ai_response.get("model_used", "unknown"),
            "sentimentAnalysis": ai_response.get("sentiment_analysis", {}),
            "aiFeatureSuggestions": _to_camel_case_ai_suggestions(ai_feature_suggestions)
        })

    except Exception as e:
        logger.exception(f"🔥 Fel vid AI-chatt: {e}")
        return APIResponse.error("An internal error occurred during chat handling")


@chatbot_bp.route("/message", methods=["POST", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def legacy_chat_message():
    """Legacy alias for /chat used by older integrations and middleware tests."""
    if request.method == 'OPTIONS':
        return '', 204
    return chat_with_ai()

def generate_enhanced_therapeutic_response(user_message: str, conversation_history: list) -> dict:
    """
    Generate enhanced therapeutic AI response with crisis detection and advanced features
    """
    from src.services.ai_service import ai_services

    # Use the enhanced AI services method
    ai_response = ai_services.generate_therapeutic_conversation(
        user_message,
        conversation_history
    )

    # Add suggested actions if not in crisis
    if not ai_response.get("crisis_detected", False):
        sentiment_analysis = ai_response.get("sentiment_analysis", {})
        suggested_actions = generate_suggested_actions(sentiment_analysis)

        ai_response["suggested_actions"] = suggested_actions
        ai_response["emotions_detected"] = sentiment_analysis.get("emotions", [])

    return ai_response

def generate_ai_feature_suggestions(user_message: str, conversation_history: list, ai_response: dict) -> dict:
    """Generate suggestions for using advanced AI features based on conversation context"""
    suggestions = {
        "suggest_story": False,
        "suggest_forecast": False,
        "story_reason": "",
        "forecast_reason": ""
    }

    # Analyze conversation context to determine if AI features would be helpful
    message_lower = user_message.lower()
    sentiment = ai_response.get("sentiment_analysis", {}).get("sentiment", "NEUTRAL")

    # Suggest therapeutic story for:
    # - Users expressing interest in stories or narratives
    # - Users going through emotional challenges
    # - Users seeking deeper understanding of their patterns
    story_keywords = ["berättelse", "historia", "story", "fortelling", "förstå", "mönster", "utveckling", "resa"]
    emotional_challenge_keywords = ["svårt", "utmaning", "förändring", "utveckla", "växa", "lära"]

    if any(keyword in message_lower for keyword in story_keywords) or \
       (sentiment in ["NEGATIVE", "NEUTRAL"] and any(keyword in message_lower for keyword in emotional_challenge_keywords)):
        suggestions["suggest_story"] = True
        if any(keyword in message_lower for keyword in story_keywords):
            suggestions["story_reason"] = "Du verkar intresserad av berättelser för att förstå dina känslor bättre"
        else:
            suggestions["story_reason"] = "En personlig berättelse kan hjälpa dig att se din resa och hitta hopp"

    # Suggest mood forecasting for:
    # - Users asking about future mood or patterns
    # - Users with consistent mood logging
    # - Users expressing concern about future emotional state
    forecast_keywords = ["framtiden", "prognos", "förutspå", "trender", "mönster", "future", "predict", "forecast"]
    concern_keywords = ["oroar", "bekymrad", "osäker", "rädd", "ängslig"]

    if any(keyword in message_lower for keyword in forecast_keywords) or \
       (len(conversation_history) > 5 and any(keyword in message_lower for keyword in concern_keywords)):
        suggestions["suggest_forecast"] = True
        if any(keyword in message_lower for keyword in forecast_keywords):
            suggestions["forecast_reason"] = "Du kan få en AI-driven prognos över dina humörtrender"
        else:
            suggestions["forecast_reason"] = "En humörprognos kan ge insikt i kommande utmaningar och möjligheter"

    return suggestions

def generate_suggested_actions(sentiment_analysis: dict) -> list:
    """Generate suggested actions based on sentiment analysis"""
    sentiment = sentiment_analysis.get("sentiment", "NEUTRAL")
    emotions = sentiment_analysis.get("emotions", [])

    actions = []

    if sentiment == "NEGATIVE":
        actions.extend([
            "Ta några djupa andetag",
            "Gå en kort promenad",
            "Prata med en vän om dina känslor"
        ])
        if "sadness" in emotions:
            actions.append("Skriv ner tre saker du är tacksam för")
        if "anger" in emotions:
            actions.append("Prova progressiv muskelavslappning")
        if "fear" in emotions:
            actions.append("Använd grounding-tekniker (5-4-3-2-1)")

    elif sentiment == "POSITIVE":
        actions.extend([
            "Fira dina positiva känslor",
            "Dela glädjen med andra",
            "Spara detta ögonblick i ditt minne"
        ])

    else:  # NEUTRAL
        actions.extend([
            "Gör något du tycker om",
            "Ta en paus från skärmar",
            "Utöva mindfulness"
        ])

    return actions[:3]  # Return max 3 actions

def generate_fallback_response(user_message: str) -> dict:
    """Enhanced professional therapeutic fallback response when AI is not available"""
    from src.services.ai_service import ai_services

    # First, try to analyze sentiment even in fallback mode
    try:
        sentiment_analysis = ai_services.analyze_sentiment(user_message)
        emotions = sentiment_analysis.get("emotions", [])
        sentiment = sentiment_analysis.get("sentiment", "NEUTRAL")
    except Exception:
        sentiment = "NEUTRAL"
        emotions = []

    message_lower = user_message.lower()

    # Professional therapeutic responses based on detected emotions and content
    if any(word in message_lower for word in ["stressad", "stress", "orolig", "ängslig", "nervös", "spänd"]):
        response = """Jag förstår att du känner dig stressad just nu. Stress är en mycket vanlig reaktion på dagens snabba tempo och höga krav.

Ett bra första steg är att aktivera kroppens avslappningsrespons genom djupandning: Andas in långsamt genom näsan i 4 sekunder, håll andan i 4 sekunder, andas ut genom munnen i 6 sekunder.

Vad upplever du som mest stressande i din situation? Att prata om det kan ofta hjälpa att få perspektiv."""
        actions = [
            "Djupandning: 4-4-6-tekniken",
            "Kort promenad i naturen",
            "Prioritera dagens viktigaste uppgifter"
        ]

    elif any(word in message_lower for word in ["ledsen", "sorg", "deppig", "nedstämd", "tom", "hopplös"]):
        response = """Det är modigt av dig att dela att du känner dig ledsen. Sorg och nedstämdhet är naturliga delar av livet, men de kan kännas mycket tunga att bära ensam.

Kom ihåg att alla känslor är tillfälliga och att de kommer att förändras. Ett viktigt första steg är att vara vänlig mot dig själv - precis som du skulle vara mot en nära vän som mådde dåligt.

Vad har hänt som fått dig att känna så här? Att få uttrycka sina känslor är ofta det första steget mot läkning."""
        actions = [
            "Var vänlig mot dig själv - ingen förväntar sig perfektion",
            "Skriv ner tre saker du är tacksam för idag",
            "Kontakta en vän eller familjemedlem för stöd"
        ]

    elif any(word in message_lower for word in ["arg", "rasande", "irriterad", "frustrerad", "ilsken"]):
        response = """Ilska är en viktig signal från din kropp om att något behöver uppmärksammas eller förändras. Den innehåller ofta värdefull information om vad som är viktigt för dig.

Istället för att försöka undertrycka ilskan, kan det vara hjälpsamt att utforska vad den försöker berätta. Är det en situation som behöver förändras, eller en gräns som behöver sättas?

Vad tror du ligger bakom dina känslor av ilska? Att förstå roten till dem kan hjälpa dig att hantera dem bättre."""
        actions = [
            "Fysisk aktivitet för att släppa på ångest",
            "Skriv ner dina känslor utan att censurera",
            "Progressiv muskelavslappning"
        ]

    elif any(word in message_lower for word in ["glad", "lycklig", "nöjd", "tacksam", "harmonisk"]):
        response = """Vad underbart att höra att du känner dig glad! Positiva känslor är viktiga att uppmärksamma och fira - de ger oss energi och motivation att fortsätta framåt.

Glädje och lycka är ofta resultatet av meningsfulla relationer, aktiviteter vi värdesätter, och en känsla av att leva i linje med våra värderingar.

Vad har bidragit till dina positiva känslor idag? Att reflektera över det kan hjälpa dig att skapa mer av det i ditt liv."""
        actions = [
            "Fira denna positiva känsla medvetet",
            "Dela din glädje med andra",
            "Spara detta ögonblick som ett positivt minne"
        ]

    elif any(word in message_lower for word in ["trött", "utmattad", "utbränd", "energilös"]):
        response = """Trötthet och utmattning är signaler från kroppen om att du behöver återhämtning. I dagens samhälle är det lätt att ständigt vara "på", men återhämtning är lika viktigt som aktivitet.

Din kropp och själ behöver tid för vila och återhämtning. Det är inte en lyx - det är en nödvändighet för att fungera optimalt.

Hur ser din sömn och återhämtning ut just nu? Små förändringar i rutiner kan ofta göra stor skillnad."""
        actions = [
            "Prioritera 7-8 timmars sömn per natt",
            "Ta regelbundna pauser under dagen",
            "Öva på att säga nej till icke-prioriterade uppgifter"
        ]

    elif any(word in message_lower for word in ["ensam", "isolera", "saknar", "längtar"]):
        response = """Känslan av ensamhet kan vara mycket smärtsam, även när vi är omgivna av andra människor. Människor är sociala varelser som behöver kontakt och tillhörighet för att må bra.

Det är viktigt att komma ihåg att många andra känner likadant, och att det finns sätt att bygga meningsfulla relationer. Små steg som att nå ut till andra kan göra stor skillnad.

Vad längtar du efter i dina relationer? Att förstå det kan hjälpa dig att ta de första stegen mot mer kontakt."""
        actions = [
            "Nå ut till en vän eller familjemedlem idag",
            "Delta i en aktivitet eller grupp som intresserar dig",
            "Öva på att vara närvarande i sociala situationer"
        ]

    elif any(word in message_lower for word in ["oro", "ängslan", "rädsla", "bekymmer"]):
        response = """Oro och ängslan är kroppens sätt att försöka skydda oss från potentiella hot. Problemet är att denna skyddsmekanism ibland aktiveras även när det inte finns något verkligt hot.

Genom att lära oss att skilja mellan konstruktiv oro (som motiverar oss att agera) och destruktiv oro (som bara skapar ångest) kan vi hantera dessa känslor bättre.

Vad oroar dig mest just nu? Att namnge oron är ofta det första steget mot att hantera den."""
        actions = [
            "Använd 5-4-3-2-1 grounding-tekniken",
            "Begränsa \"oro-tid\" till en specifik period per dag",
            "Fokusera på det du kan kontrollera, inte det du inte kan"
        ]

    else:
        # General supportive response
        response = """Tack för att du delar dina tankar och känslor med mig. Det är ett viktigt första steg i självvård och personlig utveckling.

Jag är här för att lyssna utan att döma, och för att erbjuda stöd och vägledning baserat på evidensbaserade principer inom psykologi och mental hälsa.

Vad ligger dig varmast på hjärtat just nu? Att utforska dina känslor och tankar tillsammans kan ofta ge värdefulla insikter."""
        actions = [
            "Reflektera över dina känslor genom att skriva dagbok",
            "Öva mindfulness eller meditation dagligen",
            "Sök professionell hjälp om du behöver extra stöd"
        ]

    # Add emotion-specific insights if emotions were detected
    if emotions:
        emotion_insights = []
        if "sadness" in emotions:
            emotion_insights.append("Sorgbearbetning tar tid - var tålmodig med dig själv")
        if "anger" in emotions:
            emotion_insights.append("Ilska innehåller ofta viktiga budskap om dina gränser")
        if "fear" in emotions:
            emotion_insights.append("Ångest är kroppens falska larmsignal - andas djupt")

        if emotion_insights:
            response += f"\n\n{emotion_insights[0]}"

    return {
        "response": response,
        "emotions_detected": emotions,
        "suggested_actions": actions,
        "ai_generated": False,
        "sentiment_analysis": {
            "sentiment": sentiment,
            "emotions": emotions
        }
    }

# 🔹 Get conversation history
@chatbot_bp.route("/history", methods=["GET", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_chat_history():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        user_id = g.user_id
        if not user_id:
            return APIResponse.bad_request("User ID required")

        if db is None:
            return APIResponse.error("Service temporarily unavailable", "SERVICE_UNAVAILABLE", 503)

        # Get conversation history
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        messages = list(conversation_ref.order_by("timestamp").stream())

        conversation = []
        for msg_doc in messages:
            msg_data = msg_doc.to_dict()
            conversation.append(_to_camel_case_message(msg_data))

        return APIResponse.success({"conversation": conversation})

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av chatt-historik: {e}")
        return APIResponse.error("An internal error occurred while fetching chat history")

# 🔹 Mood Pattern Analysis
@chatbot_bp.route("/analyze-patterns", methods=["POST", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def analyze_mood_patterns():
    """Analyze user's mood patterns and provide insights"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        user_id = g.user_id
        if not user_id:
            return APIResponse.bad_request("User ID required")

        # Get mood history from database
        from src.firebase_config import db
        mood_ref = db.collection("users").document(user_id).collection("moods")
        mood_docs = list(mood_ref.order_by("timestamp", direction="DESCENDING").limit(50).stream())

        mood_history = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_history.append({
                "sentiment": mood_data.get("sentiment", "NEUTRAL"),
                "sentiment_score": mood_data.get("score", 0),
                "timestamp": mood_data.get("timestamp", ""),
                "note": mood_data.get("note", "")
            })

        # Use AI services for pattern analysis with fallback
        from src.services.ai_service import ai_services

        try:
            logger.info(f"📊 Analyzing mood patterns for user {user_id}, {len(mood_history)} data points")
            pattern_analysis = ai_services.analyze_mood_patterns(mood_history)
            logger.info("✅ Pattern analysis completed successfully")
        except Exception as pattern_error:
            logger.warning(f"⚠️ Pattern analysis failed, using fallback: {str(pattern_error)}")
            pattern_analysis = {
                "pattern_analysis": "Otillräcklig data för avancerad mönsteranalys",
                "predictions": "Behöver mer data för prediktioner",
                "confidence": 0.0
            }

        return APIResponse.success({
            "patternAnalysis": pattern_analysis,
            "dataPointsAnalyzed": len(mood_history),
            "analysisTimestamp": datetime.now(UTC).isoformat()
        })

    except Exception as e:
        logger.exception(f"🔥 Fel vid mönsteranalys: {e}")
        return APIResponse.error("An internal error occurred during pattern analysis")

# Allowed exercise types
ALLOWED_EXERCISE_TYPES = {'breathing', 'mindfulness', 'cbt_thought_record', 'gratitude', 'progressive_relaxation'}

# 🔹 CBT/Mindfulness Exercises
@chatbot_bp.route("/exercise", methods=["POST", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def start_exercise():
    """Start a CBT or mindfulness exercise session"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        user_id = g.user_id
        data = request.get_json(force=True, silent=False)
        if not data or "exercise_type" not in data:
            return APIResponse.bad_request("Exercise type required")

        # Accept both camelCase and snake_case
        exercise_type = (data.get("exerciseType") or data.get("exercise_type", "")).strip().lower()
        duration = data.get("duration", 5)  # Default 5 minutes

        # Validate exercise type
        if exercise_type not in ALLOWED_EXERCISE_TYPES:
            return APIResponse.bad_request(f"Invalid exercise type. Allowed: {', '.join(ALLOWED_EXERCISE_TYPES)}")

        # Validate and clamp duration (1-60 min)
        try:
            duration = int(duration)
        except (TypeError, ValueError):
            duration = 5
        duration = max(1, min(60, duration))

        if db is None:
            return APIResponse.error("Service temporarily unavailable", "SERVICE_UNAVAILABLE", 503)

        if not user_id:
            return APIResponse.bad_request("User ID required")

        # Generate exercise content based on type
        exercise_content = generate_exercise_content(exercise_type, duration)

        # Save exercise session to database
        timestamp = datetime.now(UTC).isoformat()
        exercise_ref = db.collection("users").document(user_id).collection("exercises")

        exercise_ref.document(f"exercise_{timestamp}").set({
            "exercise_type": exercise_type,
            "duration": duration,
            "started_at": timestamp,
            "completed": False,
            "content": exercise_content
        })

        logger.info(f"✅ Exercise started for user {user_id}: {exercise_type}")

        return APIResponse.success({
            "exercise": _to_camel_case_exercise(exercise_content),
            "exerciseType": exercise_type,
            "duration": duration,
            "startedAt": timestamp
        })

    except Exception as e:
        logger.exception(f"🔥 Fel vid övningsstart: {e}")
        return APIResponse.error("An internal error occurred while starting exercise")

@chatbot_bp.route("/exercise/<user_id>/<exercise_id>/complete", methods=["POST", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def complete_exercise(user_id, exercise_id):
    """Mark an exercise as completed"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        # Verify user owns this exercise
        if g.user_id != user_id:
            return APIResponse.forbidden("Unauthorized")

        if not user_id or not exercise_id:
            return APIResponse.bad_request("User ID and exercise ID required")

        if db is None:
            return APIResponse.error("Service temporarily unavailable", "SERVICE_UNAVAILABLE", 503)

        # Update exercise completion status
        exercise_ref = db.collection("users").document(user_id).collection("exercises").document(exercise_id)

        exercise_ref.update({
            "completed": True,
            "completed_at": datetime.now(UTC).isoformat()
        })

        logger.info(f"✅ Exercise completed for user {user_id}: {exercise_id}")

        return APIResponse.success({"message": "Exercise marked as completed"})

    except Exception as e:
        logger.exception(f"🔥 Fel vid övningsslutförande: {e}")
        return APIResponse.error("An internal error occurred while completing exercise")

def generate_exercise_content(exercise_type: str, duration: int) -> dict:
    """Generate content for different types of exercises"""

    exercises = {
        "breathing": {
            "title": "Andningsövning - 4-7-8 Teknik",
            "description": "En enkel andningsteknik för att lugna ner dig och minska stress.",
            "steps": [
                "Sitt bekvämt med ryggen rak",
                "Andas in tyst genom näsan i 4 sekunder",
                "Håll andan i 7 sekunder",
                "Andas ut ljudligt genom munnen i 8 sekunder",
                "Upprepa cykeln 4 gånger"
            ],
            "tips": "Fokusera på att göra utandningen längre än inandningen för att aktivera avslappningssystemet.",
            "benefits": "Minskar ångest, förbättrar sömn, lugnar nervsystemet"
        },

        "mindfulness": {
            "title": "Mindfulness - Kroppsskanning",
            "description": "En guidad meditation för att öka medvetenheten om kroppen och närvaron.",
            "steps": [
                "Ligg eller sitt bekvämt",
                "Stäng ögonen och fokusera på andningen",
                "Skanna kroppen från tårna till huvudet",
                "Lägg märke till spänningar utan att försöka ändra dem",
                "Andas in acceptans, andas ut släpp"
            ],
            "tips": "Om tankar vandrar iväg, notera dem vänligt och återvänd till kroppen.",
            "benefits": "Ökar kroppsmedvetenhet, minskar stress, förbättrar sömnkvalitet"
        },

        "cbt_thought_record": {
            "title": "KBT - Tankeinventering",
            "description": "En strukturerad metod för att utmana negativa tankemönster.",
            "steps": [
                "Identifiera en negativ tanke eller övertygelse",
                "Bedöm automatiskt hur mycket du tror på den (0-100%)",
                "Sök efter bevis för och emot tanken",
                "Formulera en mer balanserad alternativa tanke",
                "Bedöm hur mycket du tror på den nya tanken"
            ],
            "tips": "Var specifik med bevisen - använd konkreta exempel från ditt liv.",
            "benefits": "Bygger kritiskt tänkande, minskar kognitiv bias, förbättrar känsloreglering"
        },

        "gratitude": {
            "title": "Tacksamhetsövning",
            "description": "Öva på att uppmärksamma positiva aspekter i livet.",
            "steps": [
                "Sitt bekvämt och slappna av",
                "Tänk på tre saker du är tacksam för idag",
                "Beskriv varför du är tacksam för varje sak",
                "Känn känslan av tacksamhet i kroppen",
                "Avsluta med ett leende"
            ],
            "tips": "Börja med små saker som ofta tas för givna - en varm säng, rent vatten, vänliga ord.",
            "benefits": "Ökar livstillfredsställelse, minskar depression, bygger positiva relationer"
        },

        "progressive_relaxation": {
            "title": "Progressiv Muskelavslappning",
            "description": "En teknik för att medvetet spänna och släppa muskler för djup avslappning.",
            "steps": [
                "Ligg bekvämt på rygg",
                "Börja med fötterna - spänn tår och vader i 5 sekunder",
                "Släpp spänningen och känn skillnaden",
                "Fortsätt upp genom kroppen: vader, lår, mage, händer, armar, axlar, ansikte",
                "Avsluta med några djupa andetag"
            ],
            "tips": "Gå systematiskt genom kroppen. Om du har ont någonstans, var extra försiktig.",
            "benefits": "Minskar muskelspänningar, förbättrar sömn, minskar ångest"
        }
    }

    exercise = exercises.get(exercise_type, exercises["breathing"])

    return {
        "title": exercise["title"],
        "description": exercise["description"],
        "duration_minutes": duration,
        "steps": exercise["steps"],
        "tips": exercise["tips"],
        "benefits": exercise["benefits"],
        "instructions": f"Denna övning tar cirka {duration} minuter. Ta din tid och var vänlig mot dig själv."
    }
