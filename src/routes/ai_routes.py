import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from src.firebase_config import db

ai_bp = Blueprint("ai", __name__)
logger = logging.getLogger(__name__)

# 🔹 Generate Personalized Therapeutic Story
@ai_bp.route("/story", methods=["POST", "OPTIONS"])
def generate_therapeutic_story():
    """Generate a personalized therapeutic story based on user's mood data"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        logger.info("📖 Therapeutic story generation requested")
        data = request.get_json(force=True, silent=False)

        if not data or "user_id" not in data:
            logger.error("❌ Missing user_id in story request")
            return jsonify({"error": "Användar-ID krävs!"}), 400

        user_id = data["user_id"].strip()
        locale = data.get("locale", "sv")  # Default to Swedish

        if not user_id:
            logger.error("❌ Empty user_id")
            return jsonify({"error": "Användar-ID får inte vara tomt!"}), 400

        if locale not in ["sv", "en", "no"]:
            locale = "sv"  # Fallback to Swedish

        # Get user's mood history from database
        mood_ref = db.collection("users").document(user_id).collection("moods")
        mood_docs = list(mood_ref.order_by("timestamp", direction="DESCENDING").limit(50).stream())

        mood_history = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_history.append({
                "sentiment": mood_data.get("sentiment", "NEUTRAL"),
                "sentiment_score": mood_data.get("score", 0),
                "timestamp": mood_data.get("timestamp", ""),
                "note": mood_data.get("note", ""),
                "emotions_detected": mood_data.get("emotions_detected", [])
            })

        logger.info(f"📊 Retrieved {len(mood_history)} mood entries for story generation")

        # Generate personalized story
        from src.utils.ai_services import ai_services

        try:
            story_result = ai_services.generate_personalized_therapeutic_story(
                user_mood_data=mood_history,
                locale=locale
            )
            logger.info(f"✅ Story generated successfully for user {user_id}")
        except Exception as story_error:
            logger.warning(f"⚠️ Story generation failed, using fallback: {str(story_error)}")
            story_result = ai_services._fallback_therapeutic_story(mood_history, locale)

        # Save story generation to database for tracking
        timestamp = datetime.now(timezone.utc).isoformat()
        story_ref = db.collection("users").document(user_id).collection("stories")

        story_ref.document(f"story_{timestamp}").set({
            "story_content": story_result["story"][:500],  # Store preview
            "locale": locale,
            "mood_data_points": len(mood_history),
            "ai_generated": story_result.get("ai_generated", False),
            "model_used": story_result.get("model_used", "unknown"),
            "confidence": story_result.get("confidence", 0.0),
            "generated_at": timestamp
        })

        return jsonify({
            "story": story_result["story"],
            "locale": locale,
            "mood_summary": story_result.get("mood_summary", {}),
            "ai_generated": story_result.get("ai_generated", False),
            "model_used": story_result.get("model_used", "unknown"),
            "confidence": story_result.get("confidence", 0.0),
            "word_count": story_result.get("word_count", 0),
            "generated_at": timestamp
        }), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid berättelsegenerering: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid berättelsegenerering."}), 500

# 🔹 Predictive Mood Forecasting
@ai_bp.route("/forecast", methods=["POST", "OPTIONS"])
def predictive_mood_forecast():
    """Generate predictive mood forecast using ML models"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        logger.info("🔮 Mood forecasting requested")
        data = request.get_json(force=True, silent=False)

        if not data or "user_id" not in data:
            logger.error("❌ Missing user_id in forecast request")
            return jsonify({"error": "Användar-ID krävs!"}), 400

        user_id = data["user_id"].strip()
        days_ahead = data.get("days_ahead", 7)
        use_sklearn = data.get("use_sklearn", True)  # Default to sklearn model

        if not user_id:
            logger.error("❌ Empty user_id")
            return jsonify({"error": "Användar-ID får inte vara tomt!"}), 400

        if not isinstance(days_ahead, int) or days_ahead < 1 or days_ahead > 30:
            days_ahead = 7  # Default to 7 days

        # Get user's mood history from database
        mood_ref = db.collection("users").document(user_id).collection("moods")
        mood_docs = list(mood_ref.order_by("timestamp", direction="DESCENDING").limit(100).stream())

        mood_history = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_history.append({
                "sentiment": mood_data.get("sentiment", "NEUTRAL"),
                "sentiment_score": mood_data.get("score", 0),
                "timestamp": mood_data.get("timestamp", ""),
                "note": mood_data.get("note", ""),
                "emotions_detected": mood_data.get("emotions_detected", [])
            })

        logger.info(f"📊 Retrieved {len(mood_history)} mood entries for forecasting")

        # Generate forecast using sklearn ML model
        from src.utils.ai_services import ai_services

        try:
            if use_sklearn:
                forecast_result = ai_services.predictive_mood_forecasting_sklearn(
                    mood_history=mood_history,
                    days_ahead=days_ahead
                )
                logger.info(f"✅ ML-based forecast generated successfully for user {user_id}")
            else:
                # Fallback to existing method
                forecast_result = ai_services.predictive_mood_analytics(
                    mood_history=mood_history,
                    days_ahead=days_ahead
                )
                logger.info(f"✅ Fallback forecast generated for user {user_id}")
        except Exception as forecast_error:
            logger.warning(f"⚠️ Forecast generation failed, using basic analytics: {str(forecast_error)}")
            forecast_result = ai_services.predictive_mood_analytics(mood_history, days_ahead)

        # Save forecast to database for tracking
        timestamp = datetime.now(timezone.utc).isoformat()
        forecast_ref = db.collection("users").document(user_id).collection("forecasts")

        forecast_ref.document(f"forecast_{timestamp}").set({
            "forecast_summary": {
                "trend": forecast_result.get("forecast", {}).get("trend", "unknown"),
                "average": forecast_result.get("forecast", {}).get("average_forecast", 0),
                "confidence": forecast_result.get("confidence", 0)
            },
            "days_ahead": days_ahead,
            "model_used": forecast_result.get("model_info", {}).get("algorithm", "unknown") if use_sklearn else "fallback",
            "data_points_used": len(mood_history),
            "risk_factors": forecast_result.get("risk_factors", []),
            "generated_at": timestamp
        })

        return jsonify({
            "forecast": forecast_result.get("forecast", {}),
            "model_info": forecast_result.get("model_info", {}),
            "current_analysis": forecast_result.get("current_analysis", {}),
            "risk_factors": forecast_result.get("risk_factors", []),
            "recommendations": forecast_result.get("recommendations", []),
            "confidence": forecast_result.get("confidence", 0.0),
            "data_points_used": len(mood_history),
            "forecast_period_days": days_ahead,
            "generated_at": timestamp
        }), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid prognosgenerering: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid prognosgenerering."}), 500

# 🔹 Get User's Story History
@ai_bp.route("/stories", methods=["GET"])
def get_story_history():
    """Get user's generated therapeutic stories history"""
    try:
        user_id = request.args.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        # Get story history
        story_ref = db.collection("users").document(user_id).collection("stories")
        story_docs = list(story_ref.order_by("generated_at", direction="DESCENDING").limit(20).stream())

        stories = []
        for doc in story_docs:
            story_data = doc.to_dict()
            stories.append({
                "id": doc.id,
                "story_preview": story_data.get("story_content", ""),
                "locale": story_data.get("locale", "sv"),
                "mood_data_points": story_data.get("mood_data_points", 0),
                "ai_generated": story_data.get("ai_generated", False),
                "model_used": story_data.get("model_used", "unknown"),
                "confidence": story_data.get("confidence", 0.0),
                "generated_at": story_data.get("generated_at", "")
            })

        return jsonify({"stories": stories}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av berättelsehistorik: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid hämtning av berättelsehistorik."}), 500

# 🔹 Get User's Forecast History
@ai_bp.route("/forecasts", methods=["GET"])
def get_forecast_history():
    """Get user's mood forecast history"""
    try:
        user_id = request.args.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        # Get forecast history
        forecast_ref = db.collection("users").document(user_id).collection("forecasts")
        forecast_docs = list(forecast_ref.order_by("generated_at", direction="DESCENDING").limit(20).stream())

        forecasts = []
        for doc in forecast_docs:
            forecast_data = doc.to_dict()
            forecasts.append({
                "id": doc.id,
                "forecast_summary": forecast_data.get("forecast_summary", {}),
                "days_ahead": forecast_data.get("days_ahead", 7),
                "model_used": forecast_data.get("model_used", "unknown"),
                "data_points_used": forecast_data.get("data_points_used", 0),
                "risk_factors": forecast_data.get("risk_factors", []),
                "generated_at": forecast_data.get("generated_at", "")
            })

        return jsonify({"forecasts": forecasts}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av prognoshistorik: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid hämtning av prognoshistorik."}), 500


# 🔹 AI Chat Endpoint - NYTT för load test
@ai_bp.route("/chat", methods=["POST", "OPTIONS"])
def ai_chat():
    """AI chatbot conversation endpoint with wellness goal context"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(force=True, silent=False)
        user_id = data.get("user_id", "").strip()
        message = data.get("message", "").strip()
        
        if not user_id or not message:
            return jsonify({"error": "user_id och message krävs"}), 400
        
        # Get user's wellness goals for personalization
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        wellness_goals = []
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            wellness_goals = user_data.get("wellness_goals", [])
            logger.info(f"🎯 User wellness goals: {wellness_goals}")
        
        # Simple AI response (implementera med OpenAI senare)
        from src.utils.ai_services import ai_services
        
        try:
            response = ai_services.generate_chat_response(message, user_id, wellness_goals=wellness_goals)
        except Exception as e:
            logger.warning(f"AI response generation failed: {e}, using fallback")
            # Fallback response - personalized based on goals
            goal_context = ""
            if wellness_goals:
                goal_context = f" Jag ser att du arbetar med: {', '.join(wellness_goals)}."
            
            response = {
                "message": f"Tack för ditt meddelande.{goal_context} Hur kan jag stötta dig idag?",
                "sentiment": "NEUTRAL",
                "suggestions": ["Berätta mer", "Hur känner du dig nu?", "Vill du prata om något specifikt?"]
            }
        
        # Spara chat i databas
        timestamp = datetime.now(timezone.utc).isoformat()
        chat_ref = db.collection("users").document(user_id).collection("chat_history")
        chat_ref.add({
            "user_message": message,
            "ai_response": response.get("message", ""),
            "timestamp": timestamp,
            "sentiment": response.get("sentiment", "NEUTRAL")
        })
        
        return jsonify({
            "response": response.get("message", ""),
            "sentiment": response.get("sentiment", "NEUTRAL"),
            "suggestions": response.get("suggestions", []),
            "timestamp": timestamp
        }), 200
        
    except Exception as e:
        logger.error(f"❌ AI chat error: {str(e)}")
        return jsonify({"error": f"Chat failed: {str(e)}"}), 500


# 🔹 AI Chat History - NYTT för load test
@ai_bp.route("/history", methods=["POST", "OPTIONS"])
def ai_chat_history():
    """Get user's chat history"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(force=True, silent=False)
        user_id = data.get("user_id", "").strip()
        
        if not user_id:
            return jsonify({"error": "user_id krävs"}), 400
        
        limit = data.get("limit", 50)
        
        # Hämta chat history
        chat_ref = db.collection("users").document(user_id).collection("chat_history")
        chats = chat_ref.order_by("timestamp", direction="DESCENDING").limit(limit).stream()
        
        history = []
        for chat_doc in chats:
            chat_data = chat_doc.to_dict()
            history.append({
                "id": chat_doc.id,
                "user_message": chat_data.get("user_message", ""),
                "ai_response": chat_data.get("ai_response", ""),
                "timestamp": chat_data.get("timestamp", ""),
                "sentiment": chat_data.get("sentiment", "NEUTRAL")
            })
        
        return jsonify({
            "history": history,
            "count": len(history)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Chat history error: {str(e)}")
        return jsonify({"error": f"Failed to get history: {str(e)}"}), 500
