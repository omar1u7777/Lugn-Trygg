import logging
from datetime import UTC, datetime

from flask import Blueprint, Response, g, make_response, request, stream_with_context

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.subscription_service import (
    SubscriptionLimitError,
    SubscriptionService,
)

# Import new advanced AI services
try:
    from src.services.chat_rag_service import get_chat_rag_service
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Chat RAG service not available")

try:
    from src.services.therapeutic_framework_detector import TherapeuticFramework, get_framework_detector
    FRAMEWORK_AVAILABLE = True
except ImportError:
    FRAMEWORK_AVAILABLE = False
    logger.warning("Framework detector not available")

try:
    from src.services.therapeutic_progress_tracker import get_progress_tracker
    PROGRESS_AVAILABLE = True
except ImportError:
    PROGRESS_AVAILABLE = False
    logger.warning("Progress tracker not available")

from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

chatbot_bp = Blueprint("chatbot", __name__)

def _preflight_response():
    """Return a typed 204 No Content response for OPTIONS preflight requests."""
    return make_response('', 204)


def _get_sse_cors_headers() -> dict:
    """
    Return CORS headers for SSE (streaming) responses.

    Flask's after_request hooks do NOT run for streaming Response objects, so
    we must set CORS headers manually here.  We reuse the same origin-allowlist
    logic from main.py rather than falling back to the unsafe wildcard (*).
    """
    try:
        from main import is_origin_allowed
    except ImportError:
        try:
            # When imported as a package (e.g. in tests)
            from src.main import is_origin_allowed  # type: ignore[no-redef]
        except ImportError:
            is_origin_allowed = None  # type: ignore[assignment]

    origin = request.headers.get("Origin", "")
    if origin and is_origin_allowed and is_origin_allowed(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    # Origin not allowed or allowlist unavailable — omit header so the browser
    # blocks the response rather than accepting a wildcard.
    return {}

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
        return _preflight_response()

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

        plan_context = SubscriptionService.get_plan_context(user_data, user_id=user_id)
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

        # Get conversation history - cap at MAX_CONVERSATION_HISTORY to prevent token overflow
        MAX_CONVERSATION_HISTORY = 20
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        recent_messages = list(conversation_ref.order_by("timestamp", direction="DESCENDING").limit(MAX_CONVERSATION_HISTORY).stream())

        # Build conversation context - limited to prevent memory/token issues
        conversation_history = []
        for msg_doc in reversed(recent_messages[:MAX_CONVERSATION_HISTORY]):
            msg_data = msg_doc.to_dict()
            conversation_history.append({
                "role": msg_data.get("role"),
                "content": msg_data.get("content")
            })
        
        if len(recent_messages) > MAX_CONVERSATION_HISTORY:
            logger.warning(f"Conversation history truncated from {len(recent_messages)} to {MAX_CONVERSATION_HISTORY} for user {user_id}")

        # Generate AI response with enhanced features
        logger.info(f"🤖 Generating AI response, message length: {len(user_message)}")

        try:
            ai_response = generate_enhanced_therapeutic_response(user_message, conversation_history, user_id)
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

        # Save AI response with enhanced metadata
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
            "ai_feature_suggestions": ai_feature_suggestions,
            # New advanced AI fields
            "rag_context_used": ai_response.get("rag_context_used", False),
            "framework_detected": ai_response.get("framework_detected"),
            "techniques_used": ai_response.get("techniques_used", []),
            "progress_tracking_enabled": ai_response.get("progress_tracking_enabled", False)
        })

        # Audit log for crisis detection (security-relevant event)
        if ai_response.get("crisis_detected", False):
            audit_log('crisis_detected', user_id, {
                'crisis_analysis': ai_response.get("crisis_analysis", {}),
                'timestamp': timestamp
            })

            # CRISIS INTERVENTION: Real escalation with SMS/email/push
            try:
                from ..services.crisis_escalation import CrisisAlert, get_crisis_escalation_service

                # Use semantic crisis detector for better accuracy
                from ..services.crisis_intervention import crisis_intervention_service

                # Get conversation context for better detection
                conversation_context = [
                    {"role": "user", "content": user_message}
                ] + [
                    {"role": msg.get("role"), "content": msg.get("content")}
                    for msg in conversation_history[-3:]  # Last 3 messages for context
                ]

                # Perform semantic crisis assessment
                assessment = crisis_intervention_service.assess_text_crisis_risk(
                    user_message,
                    conversation_context
                )

                if assessment.overall_risk_level in ('critical', 'high'):
                    logger.warning(
                        "🚨 CRISIS CONFIRMED via AI chat: user=%s risk=%s score=%.2f",
                        user_id, assessment.overall_risk_level, assessment.risk_score
                    )

                    # Create crisis alert for escalation
                    crisis_alert = CrisisAlert(
                        user_id=user_id,
                        risk_level=assessment.overall_risk_level,
                        risk_score=assessment.risk_score,
                        detected_indicators=[
                            ind.swedish_description for ind in assessment.active_indicators
                        ],
                        text_snippet=user_message[:200],
                        timestamp=datetime.now(UTC),
                        requires_immediate_action=assessment.overall_risk_level == 'critical'
                    )

                    # Execute REAL escalation in background thread to avoid blocking
                    import threading
                    def escalate_async(alert):
                        """
                        Run crisis escalation with exponential-backoff retries.
                        3 attempts: immediate → 2 s → 4 s.
                        Logs CRITICAL if all attempts fail so ops can act.
                        """
                        import asyncio
                        import time as _time

                        MAX_RETRIES = 3
                        BASE_DELAY = 2.0  # seconds
                        last_error: str = "unknown"

                        for attempt in range(1, MAX_RETRIES + 1):
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            try:
                                escalation_service = get_crisis_escalation_service()
                                result = loop.run_until_complete(
                                    escalation_service.escalate(alert)
                                )
                                if result.success:
                                    logger.info(
                                        "✅ Crisis escalation completed (attempt %d/%d) "
                                        "via channels: %s",
                                        attempt, MAX_RETRIES,
                                        [c.value for c in result.channels_used],
                                    )
                                    return  # Success — stop retrying
                                else:
                                    last_error = (
                                        f"{len(result.failures)} channel(s) failed"
                                    )
                                    logger.error(
                                        "❌ Crisis escalation attempt %d/%d: %s",
                                        attempt, MAX_RETRIES, last_error,
                                    )
                            except Exception as esc_err:
                                last_error = str(esc_err)
                                logger.exception(
                                    "Crisis escalation thread attempt %d/%d raised: %s",
                                    attempt, MAX_RETRIES, esc_err,
                                )
                            finally:
                                loop.close()

                            if attempt < MAX_RETRIES:
                                delay = BASE_DELAY * (2 ** (attempt - 1))  # 2 s, 4 s
                                logger.info(
                                    "⏳ Retrying crisis escalation in %.0f s "
                                    "(attempt %d/%d)…",
                                    delay, attempt + 1, MAX_RETRIES,
                                )
                                _time.sleep(delay)

                        logger.critical(
                            "🚨 CRISIS ESCALATION FAILED after %d attempts for "
                            "user=%s, risk=%s. Last error: %s. REQUIRES MANUAL REVIEW.",
                            MAX_RETRIES, alert.user_id, alert.risk_level, last_error,
                        )
                    
                    # Start escalation in background thread
                    escalation_thread = threading.Thread(
                        target=escalate_async, 
                        args=(crisis_alert,),
                        daemon=True
                    )
                    escalation_thread.start()

                    # Store alert info in response for frontend
                    ai_response["crisis_escalation"] = {
                        "escalated": True,
                        "alert_id": crisis_alert.timestamp.isoformat(),
                        "channels_attempted": ["sms", "email", "push", "dashboard"],
                        "pending": True
                    }

            except Exception as crisis_err:
                logger.exception(f"Crisis intervention/escalation failed (non-blocking): {crisis_err}")
                # Still flag crisis even if escalation fails
                ai_response["crisis_escalation"] = {
                    "escalated": False,
                    "error": str(crisis_err),
                    "requires_manual_review": True
                }

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
        return _preflight_response()
    return chat_with_ai()


@chatbot_bp.route("/chat/stream", methods=["POST", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def chat_stream():
    """
    Real SSE streaming endpoint for AI chat.
    Streams tokens from OpenAI using Server-Sent Events (text/event-stream).
    Frontend reads via fetch() + ReadableStream.
    """
    if request.method == 'OPTIONS':
        return _preflight_response()

    try:
        if db is None:
            return APIResponse.error("Service temporarily unavailable", "SERVICE_UNAVAILABLE", 503)

        try:
            data = request.get_json(force=True, silent=False)
        except Exception:
            return APIResponse.bad_request("Invalid JSON format")

        if not data or "message" not in data:
            return APIResponse.bad_request("Message required")

        user_message = data["message"].strip()
        user_message = input_sanitizer.sanitize(user_message, content_type='text', max_length=MAX_MESSAGE_LENGTH)
        if not user_message:
            return APIResponse.bad_request("Message required")

        token_user_id = getattr(g, "user_id", None)
        payload_user_id = data.get("user_id", "").strip()
        user_id = token_user_id or payload_user_id

        if not user_id:
            return APIResponse.bad_request("Authenticated user required")

        # Check subscription quota BEFORE streaming starts
        try:
            user_doc = db.collection("users").document(user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
        except Exception as exc:
            logger.warning("Failed to fetch user for stream quota check: %s", exc)
            user_data = {}

        plan_context = SubscriptionService.get_plan_context(user_data, user_id=user_id)
        try:
            SubscriptionService.consume_quota(user_id, "chat_messages", plan_context["limits"])
        except SubscriptionLimitError as exc:
            return APIResponse.error(
                "You have reached your daily AI chat message limit",
                "RATE_LIMITED", 429,
                {"limit": exc.limit_value}
            )

        # Fetch conversation history - cap at MAX_STREAM_HISTORY to prevent token overflow
        MAX_STREAM_HISTORY = 20
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        recent_docs = list(
            conversation_ref.order_by("timestamp", direction="DESCENDING").limit(MAX_STREAM_HISTORY).stream()
        )
        conversation_history = []
        for msg_doc in reversed(recent_docs[:MAX_STREAM_HISTORY]):
            msg_data = msg_doc.to_dict()
            conversation_history.append({
                "role": msg_data.get("role"),
                "content": msg_data.get("content")
            })
        
        if len(recent_docs) > MAX_STREAM_HISTORY:
            logger.warning(f"Stream conversation history truncated from {len(recent_docs)} to {MAX_STREAM_HISTORY} for user {user_id}")

        # Save user message to Firestore before streaming
        timestamp = datetime.now(UTC).isoformat()
        conversation_ref.document(f"user_{timestamp}").set({
            "role": "user",
            "content": user_message,
            "timestamp": timestamp
        })

        # Analytics optional - disabled to prevent undefined reference errors

        from src.services.ai_service import ai_services

        # Accumulate full response to save to Firestore after stream ends
        def generate():
            full_response = []
            chunk_count = 0
            error_count = 0
            try:
                for sse_chunk in ai_services.generate_therapeutic_conversation_stream(
                    user_message, conversation_history, user_id=user_id
                ):
                    chunk_count += 1
                    # Accumulate non-DONE chunks
                    if sse_chunk.strip() != "data: [DONE]":
                        import json as _json
                        try:
                            payload = _json.loads(sse_chunk.replace("data: ", "", 1))
                            content = payload.get("content", "")
                            if content:
                                full_response.append(content)
                        except _json.JSONDecodeError as json_err:
                            error_count += 1
                            if error_count <= 3:  # Log first 3 errors only
                                logger.warning(f"SSE JSON parse error (chunk {chunk_count}): {json_err}")
                            # Still yield the chunk for resilience
                            pass
                        except Exception as parse_err:
                            error_count += 1
                            if error_count <= 3:
                                logger.warning(f"SSE parse error (chunk {chunk_count}): {parse_err}")
                    yield sse_chunk

            except Exception as stream_err:
                logger.error(f"Streaming error: {stream_err}")
                # Yield error message to client
                import json as _json
                yield f"data: {_json.dumps({'error': 'Stream interrupted', 'content': ' [Avbruten] '})}\n\n"
                yield "data: [DONE]\n\n"
            finally:
                # Save AI response to Firestore after stream completes
                full_text = "".join(full_response)
                if full_text:
                    try:
                        ai_timestamp = datetime.now(UTC).isoformat()
                        conversation_ref.document(f"ai_{ai_timestamp}").set({
                            "role": "assistant",
                            "content": full_text,
                            "timestamp": ai_timestamp,
                            "ai_generated": True,
                            "model_used": "gpt-4o-mini-stream",
                            "chunks_received": chunk_count,
                            "parse_errors": error_count
                        })
                        # Award XP
                        try:
                            from ..services.rewards_helper import award_xp
                            award_xp(user_id, 'chatbot_conversation')
                        except Exception:
                            pass
                    except Exception as save_err:
                        logger.warning(f"Failed to save streamed response: {save_err}")

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
                # Use the validated request origin instead of wildcard (*) so the
                # strict CORS policy is enforced even for streaming responses.
                # Falls back to omitting the header if the origin is not allowed.
                **_get_sse_cors_headers(),
            }
        )

    except Exception as e:
        logger.exception(f"🔥 Fel vid streaming chat: {e}")
        return APIResponse.error("An internal error occurred during streaming")


def generate_enhanced_therapeutic_response(user_message: str, conversation_history: list, user_id: str = None) -> dict:
    """
    Generate enhanced therapeutic AI response with:
    - RAG (Retrieval-Augmented Generation) for personalized context
    - Therapeutic framework detection (CBT/ACT/DBT)
    - Crisis detection and advanced features
    """
    from src.services.ai_service import ai_services

    # Initialize advanced features
    rag_context_used = False
    framework_detected = None
    techniques_used = []

    # 1. Use RAG to retrieve personalized context if available
    if RAG_AVAILABLE and user_id:
        try:
            rag_service = get_chat_rag_service(user_id)

            # Retrieve relevant context from user's history
            contexts = rag_service.retrieve_context(
                query=user_message,
                context_types=['mood', 'journal', 'goals', 'strategies'],
                max_results=3,
                recency_days=30
            )

            if contexts:
                rag_context_used = True
                logger.info(f"RAG: Retrieved {len(contexts)} context items for user {user_id}")
        except Exception as e:
            logger.warning(f"RAG retrieval failed: {e}")
            contexts = []
    else:
        contexts = []

    # 2. Detect therapeutic framework
    if FRAMEWORK_AVAILABLE:
        try:
            detector = get_framework_detector()
            framework, confidence = detector.detect_framework(user_message)
            techniques = detector.detect_techniques(user_message)

            if confidence > 0.6:
                framework_detected = framework.value
                techniques_used = [t.technique for t in techniques[:3]]
                logger.info(f"Framework detected: {framework.value} (confidence: {confidence:.2f})")
        except Exception as e:
            logger.warning(f"Framework detection failed: {e}")

    # 3. Generate AI response with context augmentation
    try:
        if rag_context_used and contexts:
            # Build augmented prompt with RAG context
            context_text = "\n".join([f"[{ctx.source}] {ctx.content}" for ctx in contexts])

            augmented_message = f"""User message: {user_message}

Relevant context from user's history:
{context_text}

Please provide a personalized response that considers this context while being natural and conversational."""

            ai_response = ai_services.generate_therapeutic_conversation(
                augmented_message,
                conversation_history
            )
        else:
            # Standard response without RAG
            ai_response = ai_services.generate_therapeutic_conversation(
                user_message,
                conversation_history
            )

        # Add metadata about advanced features
        ai_response["rag_context_used"] = rag_context_used
        ai_response["framework_detected"] = framework_detected
        ai_response["techniques_used"] = techniques_used

    except Exception as e:
        logger.error(f"AI response generation failed: {e}")
        # Fallback to basic response
        ai_response = {
            "response": "Jag är här för att lyssna. Kan du berätta mer om vad du känner just nu?",
            "crisis_detected": False,
            "rag_context_used": False,
            "framework_detected": None,
            "techniques_used": []
        }

    # 4. Add suggested actions if not in crisis
    if not ai_response.get("crisis_detected", False):
        sentiment_analysis = ai_response.get("sentiment_analysis", {})
        suggested_actions = generate_suggested_actions(sentiment_analysis)

        ai_response["suggested_actions"] = suggested_actions
        ai_response["emotions_detected"] = sentiment_analysis.get("emotions", [])

    # 5. Track progress if available
    if PROGRESS_AVAILABLE and user_id:
        try:
            tracker = get_progress_tracker(user_id)
            # This will be saved with the conversation for later analysis
            ai_response["progress_tracking_enabled"] = True
        except Exception as e:
            logger.warning(f"Progress tracking setup failed: {e}")

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
        return _preflight_response()
    try:
        user_id = g.user_id
        if not user_id:
            return APIResponse.bad_request("User ID required")

        if db is None:
            return APIResponse.error("Service temporarily unavailable", "SERVICE_UNAVAILABLE", 503)

        # Get conversation history
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        # Paginate: default 50 messages, max 200
        limit = min(int(request.args.get("limit", 50)), 200)
        messages = list(conversation_ref.order_by("timestamp", direction="DESCENDING").limit(limit).stream())
        messages.reverse()  # Return in chronological order

        conversation = []
        for msg_doc in messages:
            msg_data = msg_doc.to_dict()
            conversation.append(_to_camel_case_message(msg_data))

        return APIResponse.success({
            "conversation": conversation,
            "totalMessages": len(conversation),
            "hasMore": len(conversation) >= limit
        })

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
        return _preflight_response()
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
        return _preflight_response()
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
        return _preflight_response()
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


# =============================================================================
# Advanced AI Chat Analytics Endpoints
# =============================================================================

@chatbot_bp.route("/analysis/framework", methods=["GET", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_therapeutic_framework_analysis():
    """
    Get therapeutic framework analysis for recent conversations.
    Returns detected frameworks (CBT, ACT, DBT) and techniques used.
    """
    if request.method == 'OPTIONS':
        return _preflight_response()

    if not FRAMEWORK_AVAILABLE:
        return APIResponse.error("Framework analysis unavailable", "SERVICE_UNAVAILABLE", 503)

    try:
        user_id = g.user_id

        # Get recent conversations
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        recent_messages = list(
            conversation_ref.order_by("timestamp", direction="DESCENDING")
            .limit(50)
            .get()
        )

        if not recent_messages:
            return APIResponse.success({
                "framework": "unknown",
                "confidence": 0,
                "techniques": [],
                "message": "No conversation data available"
            })

        # Analyze all AI messages for framework detection
        detector = get_framework_detector()
        ai_messages = [m.to_dict() for m in recent_messages if m.to_dict().get("role") == "assistant"]

        # Detect primary framework
        all_content = " ".join([m.get("content", "") for m in ai_messages])
        framework, confidence = detector.detect_framework(all_content)

        # Detect techniques
        all_techniques = []
        for msg in ai_messages:
            techniques = detector.detect_techniques(msg.get("content", ""))
            all_techniques.extend(techniques)

        # Count technique frequency
        technique_counts = {}
        for tech in all_techniques:
            key = tech.technique
            technique_counts[key] = technique_counts.get(key, 0) + 1

        # Get top techniques
        top_techniques = sorted(
            [{"technique": k, "count": v} for k, v in technique_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:5]

        return APIResponse.success({
            "framework": framework.value,
            "confidence": confidence,
            "techniques": top_techniques,
            "total_messages_analyzed": len(ai_messages),
            "analysis_timestamp": datetime.now(UTC).isoformat()
        })

    except Exception as e:
        logger.error(f"Framework analysis failed: {e}")
        return APIResponse.error("Analysis failed", "ANALYSIS_ERROR", 500)


@chatbot_bp.route("/analysis/progress", methods=["GET", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_therapeutic_progress():
    """
    Get therapeutic progress tracking data.
    Returns evidence-based progress metrics including alliance scores,
    outcome measures, and trajectory analysis.
    """
    if request.method == 'OPTIONS':
        return _preflight_response()

    if not PROGRESS_AVAILABLE:
        return APIResponse.error("Progress tracking unavailable", "SERVICE_UNAVAILABLE", 503)

    try:
        user_id = g.user_id
        tracker = get_progress_tracker(user_id)

        # Get all conversation sessions
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        session_docs = list(
            conversation_ref.order_by("timestamp", direction="DESCENDING")
            .limit(100)
            .get()
        )

        if len(session_docs) < 3:
            return APIResponse.success({
                "status": "insufficient_data",
                "message": "Need more conversation sessions for progress analysis",
                "sessions_available": len(session_docs),
                "sessions_needed": 3
            })

        # Build session outcomes from conversation data
        session_outcomes = []
        for doc in session_docs:
            data = doc.to_dict()
            if data.get("role") == "assistant":
                # Create outcome from conversation metadata
                outcome = {
                    "session_id": doc.id,
                    "timestamp": data.get("timestamp"),
                    "wellbeing_score": _estimate_wellbeing_from_sentiment(data),
                    "symptom_reduction": 0.0,  # Would need explicit symptom tracking
                    "action_items_completed": 0,
                    "action_items_total": len(data.get("suggested_actions", [])),
                    "user_satisfaction": data.get("user_rating", 3)
                }
                session_outcomes.append(outcome)

        # Analyze trajectory
        trajectory = tracker.analyze_progress_trajectory(session_outcomes)

        # Generate progress report
        report = tracker.generate_progress_report(
            session_outcomes=session_outcomes,
            alliances=[],  # Would need explicit alliance tracking
            trajectory=trajectory
        )

        return APIResponse.success({
            "progress_report": report,
            "trajectory": {
                "slope_wellbeing": trajectory.slope_wellbeing,
                "clinically_significant_change": trajectory.clinically_significant_change,
                "plateau_detected": trajectory.plateau_detected,
                "deterioration_detected": trajectory.deterioration_detected,
                "dropout_risk": trajectory.risk_of_dropout
            },
            "recommendations": _generate_progress_recommendations(trajectory),
            "analysis_timestamp": datetime.now(UTC).isoformat()
        })

    except Exception as e:
        logger.error(f"Progress analysis failed: {e}")
        return APIResponse.error("Progress analysis failed", "ANALYSIS_ERROR", 500)


@chatbot_bp.route("/analysis/quality", methods=["GET", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_conversation_quality_metrics():
    """
    Get conversation quality metrics for recent sessions.
    Returns empathy, specificity, collaboration, and structure scores.
    """
    if request.method == 'OPTIONS':
        return _preflight_response()

    if not FRAMEWORK_AVAILABLE:
        return APIResponse.error("Quality analysis unavailable", "SERVICE_UNAVAILABLE", 503)

    try:
        user_id = g.user_id

        # Get recent conversation
        conversation_ref = db.collection("users").document(user_id).collection("conversations")
        recent_messages = list(
            conversation_ref.order_by("timestamp", direction="DESCENDING")
            .limit(30)
            .get()
        )

        if not recent_messages:
            return APIResponse.success({
                "message": "No conversation data available",
                "metrics": None
            })

        # Convert to message format
        messages = [m.to_dict() for m in recent_messages]

        # Get user goals for goal alignment calculation
        try:
            goals_docs = db.collection("users").document(user_id).collection("goals").get()
            user_goals = [g.to_dict().get("title", "") for g in goals_docs]
        except Exception:
            user_goals = []

        # Calculate quality metrics
        detector = get_framework_detector()
        metrics = detector.analyze_conversation_quality(messages, user_goals)

        # Generate recommendations
        current_framework = TherapeuticFramework.CBT  # Default, could be detected
        recommendations = detector.generate_therapeutic_recommendations(
            current_framework, metrics, {}
        )

        return APIResponse.success({
            "metrics": {
                "empathy_score": metrics.empathy_score,
                "specificity_score": metrics.specificity_score,
                "collaboration_score": metrics.collaboration_score,
                "structure_score": metrics.structure_score,
                "overall_quality": metrics.overall_quality,
                "safety_assessment": metrics.safety_assessment,
                "goal_alignment": metrics.goal_alignment
            },
            "technique_usage": metrics.technique_usage,
            "recommendations": recommendations,
            "messages_analyzed": len(messages),
            "analysis_timestamp": datetime.now(UTC).isoformat()
        })

    except Exception as e:
        logger.error(f"Quality metrics failed: {e}")
        return APIResponse.error("Quality analysis failed", "ANALYSIS_ERROR", 500)


def _estimate_wellbeing_from_sentiment(data: dict) -> float:
    """Estimate wellbeing score from conversation sentiment"""
    sentiment = data.get("sentiment", "NEUTRAL")
    emotions = data.get("emotions_detected", [])

    # Base score from sentiment
    base_scores = {
        "POSITIVE": 7.0,
        "NEUTRAL": 5.0,
        "NEGATIVE": 3.0
    }
    score = base_scores.get(sentiment, 5.0)

    # Adjust based on emotions
    positive_emotions = ["joy", "contentment", "gratitude", "hope"]
    negative_emotions = ["sadness", "anger", "fear", "anxiety"]

    for emotion in emotions:
        if emotion.lower() in positive_emotions:
            score += 0.5
        elif emotion.lower() in negative_emotions:
            score -= 0.5

    return max(1.0, min(10.0, score))


def _generate_progress_recommendations(trajectory) -> list[str]:
    """Generate recommendations based on trajectory analysis"""
    recommendations = []

    if trajectory.deterioration_detected:
        recommendations.append("Kontakta en vårdgivare - dina måendeindikatorer visar på försämring")

    if trajectory.plateau_detected:
        recommendations.append("Överväg att prova nya terapeutiska tekniker eller öka sessionsfrekvensen")

    if trajectory.risk_of_dropout > 0.6:
        recommendations.append("Din engagemangsnivå har minskat - låt oss diskutera vad som skulle hjälpa")

    if trajectory.clinically_significant_change:
        recommendations.append("Fantastiskt framsteg! Fortsätt med dina nuvarande strategier")

    if not recommendations:
        recommendations.append("Fortsätt med dina nuvarande övningar och sessioner")

    return recommendations
