import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from src.firebase_config import db

chatbot_bp = Blueprint("chatbot", __name__)
logger = logging.getLogger(__name__)

# 🔹 Therapeutic chatbot conversation
@chatbot_bp.route("/chat", methods=["POST"])
def chat_with_ai():
    try:
        logger.info("🔄 Chat endpoint called")
        data = request.get_json(force=True, silent=False)
        logger.info(f"📨 Received data: {data}")

        if not data or "message" not in data or "user_id" not in data:
            logger.error("❌ Missing message or user_id in request")
            return jsonify({"error": "Meddelande och användar-ID krävs!"}), 400

        user_message = data["message"].strip()
        user_id = data["user_id"].strip()

        logger.info(f"👤 Processing chat for user: {user_id}, message length: {len(user_message)}")

        if not user_message or not user_id:
            logger.error("❌ Empty message or user_id")
            return jsonify({"error": "Meddelande och användar-ID får inte vara tomma!"}), 400

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
        logger.info(f"🤖 Generating AI response for message: '{user_message[:50]}...'")
        from src.utils.ai_services import ai_services

        try:
            ai_response = generate_enhanced_therapeutic_response(user_message, conversation_history)
            logger.info(f"✅ AI response generated successfully, length: {len(ai_response.get('response', ''))}")
        except Exception as ai_error:
            logger.warning(f"⚠️ AI response generation failed, using fallback: {str(ai_error)}")
            ai_response = generate_fallback_response(user_message)

        # Save conversation to database
        timestamp = datetime.now(timezone.utc).isoformat()

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

        logger.info(f"✅ Chatt-konversation sparad för användare {user_id}")

        return jsonify({
            "response": ai_response["response"],
            "emotions_detected": ai_response.get("emotions_detected", []),
            "suggested_actions": ai_response.get("suggested_actions", []),
            "exercise_recommendations": ai_response.get("exercise_recommendations", []),
            "crisis_detected": ai_response.get("crisis_detected", False),
            "crisis_analysis": ai_response.get("crisis_analysis", {}),
            "ai_generated": ai_response.get("ai_generated", True),
            "model_used": ai_response.get("model_used", "unknown"),
            "sentiment_analysis": ai_response.get("sentiment_analysis", {}),
            "ai_feature_suggestions": ai_feature_suggestions
        }), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid AI-chatt: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid chatt-hantering."}), 500

def generate_enhanced_therapeutic_response(user_message: str, conversation_history: list) -> dict:
    """
    Generate enhanced therapeutic AI response with crisis detection and advanced features
    """
    from src.utils.ai_services import ai_services

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
    from src.utils.ai_services import ai_services

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
@chatbot_bp.route("/history", methods=["GET"])
def get_chat_history():
    try:
        user_id = request.args.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        # Get conversation history
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        messages = list(conversation_ref.order_by("timestamp").stream())

        conversation = []
        for msg_doc in messages:
            msg_data = msg_doc.to_dict()
            conversation.append({
                "role": msg_data.get("role"),
                "content": msg_data.get("content"),
                "timestamp": msg_data.get("timestamp"),
                "emotions_detected": msg_data.get("emotions_detected", []),
                "suggested_actions": msg_data.get("suggested_actions", []),
                "crisis_detected": msg_data.get("crisis_detected", False),
                "crisis_analysis": msg_data.get("crisis_analysis", {}),
                "ai_generated": msg_data.get("ai_generated", True),
                "model_used": msg_data.get("model_used", "unknown")
            })

        return jsonify({"conversation": conversation}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av chatt-historik: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid hämtning av chatt-historik."}), 500

# 🔹 Mood Pattern Analysis
@chatbot_bp.route("/analyze-patterns", methods=["POST"])
def analyze_mood_patterns():
    """Analyze user's mood patterns and provide insights"""
    try:
        data = request.get_json(force=True, silent=False)
        if not data or "user_id" not in data:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        user_id = data["user_id"].strip()

        if not user_id:
            return jsonify({"error": "Användar-ID får inte vara tomt!"}), 400

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
        from src.utils.ai_services import ai_services

        try:
            logger.info(f"📊 Analyzing mood patterns for user {user_id}, {len(mood_history)} data points")
            pattern_analysis = ai_services.analyze_mood_patterns(mood_history)
            logger.info(f"✅ Pattern analysis completed successfully")
        except Exception as pattern_error:
            logger.warning(f"⚠️ Pattern analysis failed, using fallback: {str(pattern_error)}")
            pattern_analysis = {
                "pattern_analysis": "Otillräcklig data för avancerad mönsteranalys",
                "predictions": "Behöver mer data för prediktioner",
                "confidence": 0.0
            }

        return jsonify({
            "pattern_analysis": pattern_analysis,
            "data_points_analyzed": len(mood_history),
            "analysis_timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid mönsteranalys: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid mönsteranalys."}), 500

# 🔹 CBT/Mindfulness Exercises
@chatbot_bp.route("/exercise", methods=["POST"])
def start_exercise():
    """Start a CBT or mindfulness exercise session"""
    try:
        data = request.get_json(force=True, silent=False)
        if not data or "user_id" not in data or "exercise_type" not in data:
            return jsonify({"error": "Användar-ID och övningstyp krävs!"}), 400

        user_id = data["user_id"].strip()
        exercise_type = data["exercise_type"].strip()
        duration = data.get("duration", 5)  # Default 5 minutes

        if not user_id or not exercise_type:
            return jsonify({"error": "Användar-ID och övningstyp får inte vara tomma!"}), 400

        # Generate exercise content based on type
        exercise_content = generate_exercise_content(exercise_type, duration)

        # Save exercise session to database
        timestamp = datetime.now(timezone.utc).isoformat()
        exercise_ref = db.collection("users").document(user_id).collection("exercises")

        exercise_ref.document(f"exercise_{timestamp}").set({
            "exercise_type": exercise_type,
            "duration": duration,
            "started_at": timestamp,
            "completed": False,
            "content": exercise_content
        })

        logger.info(f"✅ Exercise started for user {user_id}: {exercise_type}")

        return jsonify({
            "exercise": exercise_content,
            "exercise_type": exercise_type,
            "duration": duration,
            "started_at": timestamp
        }), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid övningsstart: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid övningsstart."}), 500

@chatbot_bp.route("/exercise/<user_id>/<exercise_id>/complete", methods=["POST"])
def complete_exercise(user_id, exercise_id):
    """Mark an exercise as completed"""
    try:
        if not user_id or not exercise_id:
            return jsonify({"error": "Användar-ID och övnings-ID krävs!"}), 400

        # Update exercise completion status
        exercise_ref = db.collection("users").document(user_id).collection("exercises").document(exercise_id)

        exercise_ref.update({
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        })

        logger.info(f"✅ Exercise completed for user {user_id}: {exercise_id}")

        return jsonify({"message": "Övning markerad som slutförd!"}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid övningsslutförande: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid övningsslutförande."}), 500

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