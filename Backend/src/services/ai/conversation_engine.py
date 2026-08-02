"""Therapeutic conversation generation (streaming + non-streaming) and the
enhanced system prompt with mood/profile/journal/goal context."""

import logging
from datetime import datetime
from typing import Any

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)


def split_into_chunks(text: str, chunk_size: int = 8) -> list[str]:
    """Split text into word-based chunks for simulated streaming fallback."""
    words = text.split(" ")
    chunks = []
    for i in range(0, len(words), chunk_size):
        part = " ".join(words[i:i + chunk_size])
        if i + chunk_size < len(words):
            part += " "
        chunks.append(part)
    return chunks


class ConversationEngine:
    """Single responsibility: run the therapeutic chat pipeline."""

    def __init__(self, svc):
        self._svc = svc

    def generate_therapeutic_conversation(self, user_message: str, conversation_history: list[dict],
                                          user_profile: dict[str, Any] | None = None,
                                          user_id: str | None = None) -> dict[str, Any]:
        """
        Generate sophisticated therapeutic responses using OpenAI GPT-4o-mini
        with CBT/ACT framework and RAG personalization.
        """
        svc = self._svc
        logger.info(f"🧠 Generating therapeutic conversation for message: '{user_message[:50]}...'")
        logger.info(f"🧠 OpenAI available: {svc.openai_available}")

        if not svc.openai_available or not svc.client:
            logger.warning("⚠️ OpenAI not available, using fallback response")
            return svc._generate_fallback_therapeutic_response(user_message)

        try:
            # 1. CRITICAL: Perform sentiment analysis FIRST to influence response
            sentiment_analysis = svc.enhanced_sentiment_analysis(user_message)

            # 2. Check for crisis indicators (using semantic detection and sentiment)
            crisis_analysis = svc.detect_crisis_indicators(user_message)
            if crisis_analysis["requires_immediate_attention"]:
                return {
                    "response": svc._generate_crisis_response(crisis_analysis),
                    "crisis_detected": True,
                    "crisis_analysis": crisis_analysis,
                    "sentiment_analysis": sentiment_analysis,
                    "ai_generated": True,
                    "model_used": "crisis_detection"
                }

            # 3. Use therapeutic framework to analyze and select intervention
            from ..therapeutic_framework import TherapeuticContext, get_therapeutic_framework

            framework = get_therapeutic_framework()

            # Build therapeutic context with sentiment-enhanced emotion detection
            current_emotion = sentiment_analysis.get('primary_emotion') or svc._extract_emotion(user_message)
            therapeutic_context = TherapeuticContext(
                user_id=user_id or "anonymous",
                current_emotion=current_emotion,
                current_thoughts=[user_message],
                detected_distortions=[],  # Will be detected by framework
                conversation_stage="exploration",
                user_values=user_profile.get('values', []) if user_profile else [],
                past_effective_techniques=user_profile.get('effective_techniques', []) if user_profile else [],
                session_goals=user_profile.get('goals', []) if user_profile else []
            )

            # Analyze input for therapeutic content
            analysis = framework.analyze_input(user_message, therapeutic_context)

            # Get modality and technique
            modality = analysis['recommended_modality']
            technique = analysis['recommended_technique']

            logger.info(f"🎯 Therapeutic analysis: modality={modality.value if modality else 'none'}, "
                       f"technique={technique.value if technique else 'none'}, "
                       f"sentiment={sentiment_analysis.get('sentiment', 'unknown')}, "
                       f"distortions={analysis['detected_distortions']}")

            # 4. Fetch user's mood history for context-aware responses
            mood_context = ""
            safety_check_context = ""
            if user_id:
                try:
                    from src.firebase_config import db
                    mood_ref = db.collection("users").document(user_id).collection("moods")
                    recent_moods = list(mood_ref.order_by("timestamp", direction="DESCENDING").limit(7).stream())

                    if recent_moods:
                        mood_scores = []
                        mood_entries_raw: list[str] = []
                        low_mood_count = 0
                        negative_notes: list[str] = []

                        for mood_doc in recent_moods:
                            mood_data = mood_doc.to_dict()
                            score = mood_data.get("score", mood_data.get("sentiment_score", 5))
                            mood_scores.append(score)

                            # Build raw data entry for transparency
                            ts = mood_data.get("timestamp")
                            if isinstance(ts, datetime):
                                date_str = ts.strftime("%Y-%m-%d %H:%M")
                            elif isinstance(ts, str):
                                date_str = ts[:16]
                            else:
                                date_str = "okänt datum"

                            note = (mood_data.get("note") or "").strip()
                            tags = mood_data.get("tags") or []
                            tags_str = f" [{', '.join(tags)}]" if tags else ""
                            note_str = f" — \"{note}\"" if note else ""
                            mood_entries_raw.append(f"  • {date_str}: {score}/10{tags_str}{note_str}")

                            # Track low moods and negative notes for safety check
                            if score <= 3:
                                low_mood_count += 1
                            if note:
                                negative_notes.append(note)

                        avg_mood = sum(mood_scores) / len(mood_scores) if mood_scores else 5

                        # Determine trend with confidence level
                        if len(mood_scores) >= 5:
                            confidence = "hög"
                        elif len(mood_scores) >= 3:
                            confidence = "måttlig"
                        else:
                            confidence = "låg"

                        if len(mood_scores) >= 3:
                            recent_avg = sum(mood_scores[:3]) / 3
                            older_avg = sum(mood_scores[3:]) / len(mood_scores[3:]) if len(mood_scores) > 3 else recent_avg
                            if recent_avg > older_avg + 1:
                                trend = "förbättras"
                            elif recent_avg < older_avg - 1:
                                trend = "försämras"
                            else:
                                trend = "är stabilt"
                        else:
                            trend = "är okänt (för lite data)"

                        # Build enriched mood context with raw data + confidence marker
                        raw_entries = "\n".join(mood_entries_raw)
                        mood_context = f"""\n\nAnvändarens humördata (senaste {len(mood_scores)} loggningar, konfidens: {confidence}):
- Genomsnittligt humör: {avg_mood:.1f}/10
- Humörtrend: {trend}
- Senaste humör: {mood_scores[0]}/10

Rådata (visa detta först, innan tolkning):
{raw_entries}

VIKTIGA INSTRUKTIONER FÖR SVARET:
1. Börja med: 'Baserat på dina senaste {len(mood_scores)} loggningar (konfidens: {confidence})...'
2. Visa rådatan i en punktlista med datum, score och anteckningar INNAN någon tolkning.
3. Efter rådatan, skriv en sektion märkt 'Mönster:' med 1-2 datadrivna observationer.
4. Gör MAX 1 tolkning — formulera den som en fråga, inte ett påstående.
5. Dra ALDRIG slutsatser om mönster (t.ex. 'snabba humörväxlingar') baserat på färre än 4 datapunkter.
6. Om trenden bygger på färre än 5 loggningar, skriv uttryckligen: 'Notera: datan är begränsad till {len(mood_scores)} loggningar, trenden är indicativ.'"""
                        logger.info(f"📊 Mood context added: avg={avg_mood:.1f}, trend={trend}, confidence={confidence}, entries={len(mood_scores)}")

                        # Safety check: low moods (<=3) combined with negative notes
                        if low_mood_count >= 2 and negative_notes:
                            safety_check_context = f"""\n\nSÄKERHETSCHECK (aktiv — MÅSTE följas):
Användaren har {low_mood_count} låga humörloggningar (≤3/10) med anteckningar.
Du MÅSTE lägga till detta i slutet av ditt svar (efter reflektionsfrågan):

"Jag ser att du har loggat flera låga värden den senaste tiden. Om du vill prata med någon professionell kan jag hjälpa dig att hitta rätt stöd — det är helt upp till dig."

Regler:
- Erbjud som ett val, inte ett krav
- Var inte alarmistisk
- Placera EFTER reflektionsfrågan, inte före"""
                            logger.info(f"🛡️ Safety check triggered: {low_mood_count} low moods with notes")
                except Exception as mood_err:
                    logger.warning(f"⚠️ Failed to fetch mood history: {mood_err}")
                    mood_context = ""

            # 5. Generate base therapeutic prompt with sentiment and mood context
            base_prompt = framework.generate_therapeutic_prompt(modality, technique)

            # Add sentiment-specific guidance based on analysis
            sentiment_guidance = ""
            sentiment_label = sentiment_analysis.get('sentiment', 'NEUTRAL')
            if sentiment_label == 'NEGATIVE':
                sentiment_guidance = "Användaren verkar ha negativa känslor just nu - var extra stödjande, validera deras känslor, och erbjud konkreta coping-strategier."
            elif sentiment_label == 'POSITIVE':
                sentiment_guidance = "Användaren verkar vara i ett positivt tillstånd - uppmärksamma och förstärk dessa positiva känslor."
            else:
                sentiment_guidance = "Användarens sinnesstämning är neutral - var nyfiken och utforskande."

            # Add Swedish language enforcement and mood context
            # Fetch user profile context (name, assessments) for personalisation
            profile_context = ""
            if user_id:
                try:
                    profile_context = svc._fetch_user_profile_context(user_id)
                except Exception as prof_err:
                    logger.warning("⚠️ Failed to load profile context for non-stream chat: %s", prof_err)

            enhanced_prompt = f"""Du är en empatisk och professionell mental hälsa-assistent för appen Lugn & Trygg.

Din roll:
- Lyssna aktivt och empatiskt
- Ge stöd och validering
- Föreslå evidensbaserade coping-strategier (CBT, DBT, ACT)
- Uppmuntra professionell hjälp vid behov
- Aldrig diagnostisera eller ge medicinsk rådgivning
{profile_context}

{sentiment_guidance}

{base_prompt}
{mood_context}
{safety_check_context}

VIKTIGT: Svara ALLTID på svenska, kort och tydligt (max 150 ord). Var empatisk och personlig. Om du vet användarens namn, använd det naturligt."""

            # 5. Apply RAG if user_id available for personalization
            final_prompt = enhanced_prompt
            if user_id:
                try:
                    from ..rag_service import get_rag_service
                    rag_service = get_rag_service()
                    final_prompt = rag_service.generate_augmented_prompt(
                        user_id=user_id,
                        current_message=user_message,
                        base_system_prompt=enhanced_prompt
                    )
                    logger.info(f"✅ RAG augmentation applied for user {user_id[:8]}...")
                except Exception as rag_err:
                    logger.warning(f"⚠️ RAG augmentation failed: {rag_err}, using enhanced prompt")
                    final_prompt = enhanced_prompt

            # 6. Build messages for OpenAI
            messages: list[dict[str, str]] = [{"role": "system", "content": final_prompt}]

            # Add relevant conversation history (last 6 exchanges for context)
            for msg in conversation_history[-6:]:
                messages.append({
                    "role": str(msg["role"]),
                    "content": str(msg["content"])[:300]  # Truncate long messages
                })

            # Add current message
            messages.append({"role": "user", "content": user_message})

            # 7. Call OpenAI with timeout
            response = svc.client.chat.completions.create(
                model=svc._get_model_name(),
                messages=messages,  # type: ignore[arg-type]
                max_tokens=400,
                temperature=0.7,
                presence_penalty=0.1,
                frequency_penalty=0.1,
                timeout=30.0  # 30s timeout to prevent hanging
            )

            content = response.choices[0].message.content
            if content is None:
                return svc._generate_fallback_therapeutic_response(user_message)
            ai_response = content.strip()

            # 9. Generate suggested actions based on sentiment and technique
            suggested_actions = svc._generate_suggested_actions(
                sentiment_analysis,
                analysis['detected_distortions']
            )

            # 10. Generate interactive exercise if appropriate
            suggested_exercise = None
            if technique and analysis['detected_distortions'] or analysis['avoidance_detected']:
                try:
                    from ..worksheet_generator import get_worksheet_generator
                    worksheet_gen = get_worksheet_generator()

                    # Generate worksheet
                    conversation_data = conversation_history + [{"role": "user", "content": user_message}]
                    worksheet = worksheet_gen.generate_from_conversation(
                        conversation_id=f"conv_{user_id or 'anon'}_{datetime.now().timestamp()}",
                        messages=conversation_data,
                        detected_distortions=[d.value for d in analysis['detected_distortions']]
                    )

                    if worksheet:
                        suggested_exercise = {
                            "type": worksheet.type,
                            "title": worksheet.title,
                            "description": worksheet.description,
                            "estimated_duration": worksheet.estimated_duration,
                            "sections_count": len(worksheet.sections),
                            "worksheet_id": worksheet.id
                        }
                        logger.info(f"📝 Generated worksheet: {worksheet.type}")
                except Exception as ws_err:
                    logger.warning(f"⚠️ Worksheet generation failed: {ws_err}")

            # 11. Index conversation for future RAG if user_id available
            if user_id:
                try:
                    from ..rag_service import get_rag_service
                    rag_service = get_rag_service()

                    # Determine outcome based on sentiment
                    outcome = "positive" if sentiment_analysis.get('sentiment') == "POSITIVE" else \
                             "negative" if sentiment_analysis.get('sentiment') == "NEGATIVE" else "neutral"

                    rag_service.index_conversation(
                        user_id=user_id,
                        conversation_id=f"conv_{datetime.now().timestamp()}",
                        messages=conversation_history + [{"role": "user", "content": user_message}],
                        outcome=outcome
                    )

                    # Index effective coping strategy if identified
                    if suggested_actions and outcome == "positive":
                        for action in suggested_actions[:2]:
                            rag_service.index_coping_strategy(
                                user_id=user_id,
                                strategy=action,
                                context=f"Conversation: {user_message[:100]}...",
                                effectiveness=0.7
                            )

                except Exception as idx_err:
                    logger.warning(f"⚠️ Conversation indexing failed: {idx_err}")

            logger.info(
                f"✅ Therapeutic response generated: modality={modality.value if modality else 'none'}, "
                f"technique={technique.value if technique else 'none'}"
            )

            return {
                "response": ai_response,
                "crisis_detected": False,
                "sentiment_analysis": sentiment_analysis,
                "conversation_context": len(conversation_history),
                "suggested_actions": suggested_actions,
                "exercise_recommendations": [suggested_exercise] if suggested_exercise else [],
                "therapeutic_modality": modality.value if modality else None,
                "therapeutic_technique": technique.value if technique else None,
                "cognitive_distortions_detected": [d.value for d in analysis['detected_distortions']],
                "rag_augmented": user_id is not None,
                "ai_generated": True,
                "model_used": svc._get_model_name()
            }

        except svc._rate_limit_error as e:
            logger.warning(f"⚠️ OpenAI rate limit exceeded for therapeutic conversation: {str(e)}")
            return svc._generate_fallback_therapeutic_response(user_message, quota_exceeded=True)
        except (TimeoutError, Exception) as e:
            # CRITICAL FIX: Handle timeout errors gracefully to prevent 4.1s hangs
            error_str = str(e).lower()
            if 'timeout' in error_str or 'timed out' in error_str:
                logger.warning(f"⚠️ OpenAI therapeutic conversation timeout: {str(e)}, using fallback")
                return svc._generate_fallback_therapeutic_response(user_message, quota_exceeded=False)
            elif isinstance(e, svc._api_error):
                logger.error(f"OpenAI API error for therapeutic conversation: {str(e)}")
            else:
                logger.error(f"Enhanced therapeutic conversation failed: {str(e)}")
            return svc._generate_fallback_therapeutic_response(user_message)

    def generate_suggested_actions(self, sentiment_analysis: dict,
                                   distortions: list) -> list[str]:
        """Generate suggested actions based on sentiment and detected distortions."""
        actions = []

        sentiment = sentiment_analysis.get('sentiment', 'NEUTRAL')

        if sentiment == 'NEGATIVE':
            actions.extend([
                "Ta några djupa andetag (4 sekunder in, 6 ut)",
                "Gör en 5-4-3-2-1 grounding-övning",
                "Skriv ner dina tankar i ett tanke-record"
            ])

            # Add distortion-specific actions
            if any('catastrophizing' in str(d) for d in distortions):
                actions.append("Utforska: Vad är det värsta som kan hända? Och sedan? Och sedan?")
            if any('mind_reading' in str(d) for d in distortions):
                actions.append("Fråga dig själv: Vilka bevis har jag för vad andra tänker?")

        elif sentiment == 'POSITIVE':
            actions.extend([
                "Fira dina positiva känslor - vad hjälpte?",
                "Spara detta ögonblick i minnes-journalen",
                "Dela glädjen med någon du tycker om"
            ])

        else:  # NEUTRAL
            actions.extend([
                "Gör något du tycker om i 10 minuter",
                "Prova en kort mindfulness-övning",
                "Gå en 5-minuters promenad"
            ])

        return actions[:5]  # Return top 5

    def build_enhanced_system_prompt(self, user_message: str, user_id: str | None = None) -> str:
        """
        Build the enhanced therapeutic system prompt used by BOTH streaming and
        non-streaming endpoints, ensuring consistent therapeutic quality.

        Includes sentiment guidance and per-user mood history context.
        """
        svc = self._svc
        # Sentiment guidance based on current message
        try:
            sentiment_analysis = svc.enhanced_sentiment_analysis(user_message)
            sentiment_label = sentiment_analysis.get("sentiment", "NEUTRAL")
        except Exception:
            sentiment_label = "NEUTRAL"

        if sentiment_label == "NEGATIVE":
            sentiment_guidance = (
                "Användaren verkar ha negativa känslor just nu – var extra stödjande, "
                "validera deras känslor och erbjud konkreta coping-strategier."
            )
        elif sentiment_label == "POSITIVE":
            sentiment_guidance = (
                "Användaren verkar vara i ett positivt tillstånd – uppmärksamma och "
                "förstärk dessa positiva känslor."
            )
        else:
            sentiment_guidance = (
                "Användarens sinnesstämning är neutral – var nyfiken och utforskande."
            )

        # Per-user mood history for personalised context
        mood_context = ""
        safety_check_context = ""
        if user_id:
            try:
                from src.firebase_config import db
                mood_ref = db.collection("users").document(user_id).collection("moods")
                recent_moods = list(
                    mood_ref.order_by("timestamp", direction="DESCENDING").limit(7).stream()
                )
                if recent_moods:
                    mood_scores = []
                    mood_entries_raw: list[str] = []
                    low_mood_count = 0
                    negative_notes: list[str] = []

                    for m in recent_moods:
                        md = m.to_dict()
                        score = md.get("score", md.get("sentiment_score", 5))
                        mood_scores.append(score)

                        ts = md.get("timestamp")
                        if isinstance(ts, datetime):
                            date_str = ts.strftime("%Y-%m-%d %H:%M")
                        elif isinstance(ts, str):
                            date_str = ts[:16]
                        else:
                            date_str = "okänt datum"

                        note = (md.get("note") or "").strip()
                        tags = md.get("tags") or []
                        tags_str = f" [{', '.join(tags)}]" if tags else ""
                        note_str = f" — \"{note}\"" if note else ""
                        mood_entries_raw.append(f"  • {date_str}: {score}/10{tags_str}{note_str}")

                        if score <= 3:
                            low_mood_count += 1
                        if note:
                            negative_notes.append(note)

                    avg_mood = sum(mood_scores) / len(mood_scores)

                    if len(mood_scores) >= 5:
                        confidence = "hög"
                    elif len(mood_scores) >= 3:
                        confidence = "måttlig"
                    else:
                        confidence = "låg"

                    if len(mood_scores) >= 3:
                        recent_avg = sum(mood_scores[:3]) / 3
                        older_avg = sum(mood_scores[3:]) / max(len(mood_scores[3:]), 1)
                        if recent_avg > older_avg + 1:
                            trend = "förbättras"
                        elif recent_avg < older_avg - 1:
                            trend = "försämras"
                        else:
                            trend = "är stabilt"
                    else:
                        trend = "är okänt (för lite data)"

                    raw_entries = "\n".join(mood_entries_raw)
                    mood_context = (
                        f"\n\nAnvändarens humördata (senaste {len(mood_scores)} loggningar, konfidens: {confidence}):\n"
                        f"- Genomsnittligt humör: {avg_mood:.1f}/10\n"
                        f"- Humörtrend: {trend}\n"
                        f"- Senaste humör: {mood_scores[0]}/10\n\n"
                        f"Rådata (visa detta först, innan tolkning):\n"
                        f"{raw_entries}\n\n"
                        "VIKTIGA INSTRUKTIONER FÖR SVARET:\n"
                        f"1. Börja med: \"Baserat på dina senaste {len(mood_scores)} loggningar (konfidens: {confidence})...\"\n"
                        "2. Visa rådatan i en punktlista med datum, score och anteckningar INNAN någon tolkning.\n"
                        "3. Efter rådatan, skriv en sektion märkt \"Mönster:\" med 1-2 datadrivna observationer.\n"
                        "4. Gör MAX 1 tolkning — formulera den som en fråga, inte ett påstående.\n"
                        "5. Dra ALDRIG slutsatser om mönster (t.ex. \"snabba humörväxlingar\") baserat på färre än 4 datapunkter.\n"
                        f"6. Om trenden bygger på färre än 5 loggningar, skriv uttryckligen: \"Notera: datan är begränsad till {len(mood_scores)} loggningar, trenden är indicativ.\""
                    )

                    if low_mood_count >= 2 and negative_notes:
                        safety_check_context = (
                            f"\n\nSÄKERHETSCHECK (aktiv — MÅSTE följas):\n"
                            f"Användaren har {low_mood_count} låga humörloggningar (≤3/10) med anteckningar.\n"
                            "Du MÅSTE lägga till detta i slutet av ditt svar (efter reflektionsfrågan):\n\n"
                            "\"Jag ser att du har loggat flera låga värden den senaste tiden. Om du vill prata med någon professionell kan jag hjälpa dig att hitta rätt stöd — det är helt upp till dig.\"\n\n"
                            "Regler:\n"
                            "- Erbjud som ett val, inte ett krav\n"
                            "- Var inte alarmistisk\n"
                            "- Placera EFTER reflektionsfrågan, inte före"
                        )
                        logger.info("🛡️ Safety check triggered (stream): %s low moods with notes", low_mood_count)
            except Exception as mood_err:
                logger.warning("⚠️ Failed to fetch mood history for system prompt: %s", mood_err)

        # Cross-session memory: include recent session summaries so the assistant
        # can naturally reference what happened last time.
        memory_context = ""
        if user_id:
            try:
                from ..session_summary_service import SessionSummaryService
                recent = SessionSummaryService.get_recent_summaries(user_id)
                memory_context = SessionSummaryService.format_for_prompt(recent)
            except Exception as mem_err:
                logger.warning("⚠️ Failed to load session summaries: %s", mem_err)

        # User profile context: name, PHQ-9, GAD-7 scores for personalisation
        profile_context = ""
        if user_id:
            try:
                profile_context = svc._fetch_user_profile_context(user_id)
            except Exception as prof_err:
                logger.warning("⚠️ Failed to load user profile context: %s", prof_err)

        # Cross-source context: pull in journal entries + active goals so the
        # assistant can reference what the user has been writing about and
        # working towards. Recency-based — fast, no embeddings required.
        cross_context = ""
        if user_id:
            try:
                cross_context = svc._fetch_cross_source_context(user_id)
            except Exception as cs_err:
                logger.warning("⚠️ Failed to load cross-source context: %s", cs_err)

        return (
            "Du är en empatisk och professionell mental hälsa-assistent för appen Lugn & Trygg.\n\n"
            "Din roll:\n"
            "- Lyssna aktivt och empatiskt\n"
            "- Ge stöd och validering\n"
            "- Föreslå evidensbaserade coping-strategier (KBT, DBT, ACT, mindfulness)\n"
            "- Ställ öppna frågor för att utforska känslor och tankar djupare\n"
            "- Uppmuntra professionell hjälp vid behov\n"
            "- Aldrig diagnostisera eller ge medicinsk rådgivning\n"
            "- Skapa en säker, trygg atmosfär för reflektion\n\n"
            f"{profile_context}"
            f"{sentiment_guidance}"
            f"{mood_context}"
            f"{safety_check_context}"
            f"{cross_context}"
            f"{memory_context}\n\n"
            "VIKTIGT: Svara ALLTID på svenska, kort och tydligt (max 150 ord). "
            "Var empatisk och personlig. Om du vet användarens namn, använd det naturligt."
        )

    def fetch_user_profile_context(self, user_id: str) -> str:
        """Fetch user's name and latest clinical assessment scores for
        personalisation (Redis-cached 5 min). Returns empty string if no data.
        """
        from src.utils.context_cache import cached_user_context
        return cached_user_context("profile", user_id, lambda: self._compute_user_profile_context(user_id))

    def _compute_user_profile_context(self, user_id: str) -> str:
        from src.firebase_config import db

        if db is None:
            return ""

        parts: list[str] = []

        # 1. User's name from the users collection
        try:
            user_doc = db.collection("users").document(user_id).get()
            if user_doc.exists:
                raw = user_doc.to_dict() or {}
                name = (raw.get("name") or raw.get("displayName") or "").strip()
                email = (raw.get("email") or "").strip()
                if not name and email and "@" in email:
                    # Derive name from email as fallback
                    local_part = email.split("@")[0]
                    # Replace dots/underscores with spaces, title-case
                    name = local_part.replace(".", " ").replace("_", " ").title()
                if name:
                    parts.append(f"\n\nANVÄNDARENS PROFIL:\n- Namn: {name}")
            else:
                logger.debug("User doc does not exist for user_id=%s", user_id[:12])
        except Exception as exc:
            logger.warning("User profile name fetch failed: %s", exc)

        # 2. Latest PHQ-9 and GAD-7 assessment scores from clinical_assessments
        # Avoid composite index requirement by fetching recent docs and filtering in Python
        crisis_alert = ""
        for assessment_type, label in [("phq9", "PHQ-9 (depression)"), ("gad7", "GAD-7 (ångest)")]:
            try:
                # Fetch latest 10 assessments ordered by timestamp (no where filter = no index needed)
                docs = list(
                    db.collection("users")
                    .document(user_id)
                    .collection("clinical_assessments")
                    .order_by("timestamp", direction="DESCENDING")
                    .limit(10)
                    .stream()
                )
                # Filter in Python for the specific assessment type
                for doc in docs:
                    a_data = doc.to_dict() or {}
                    if a_data.get("type") == assessment_type:
                        score = a_data.get("total_score")
                        if score is not None:
                            severity = a_data.get("severity") or ""
                            severity_part = f" — {severity}" if severity else ""
                            parts.append(f"- Senaste {label}: {score} p{severity_part}")
                            # Check for suicidal ideation (PHQ-9 Q9)
                            if assessment_type == "phq9":
                                suicidal = a_data.get("suicidal_ideation", False)
                                self_harm = a_data.get("self_harm_score", 0)
                                if suicidal or (isinstance(self_harm, int | float) and self_harm > 0):
                                    crisis_alert = (
                                        "\n\nKRISISLARM (aktiv — HÖGST PRIORITET):\n"
                                        f"Användarens senaste PHQ-9 visar självskadetankar (Q9 poäng: {self_harm}).\n"
                                        "Du MÅSTE:\n"
                                        "1. Bekräfta användarens känslor med empati\n"
                                        "2. Fråga direkt och öppet om hur de mår just nu\n"
                                        "3. Påminna om krisstöd: 90101 (dygnet runt) eller 112 vid akut fara\n"
                                        "4. Erbjud professionell hjälp som ett konkret nästa steg\n"
                                        "Var inte alarmistisk men var TYDLIG om att hjälp finns.\n"
                                        "Säg inte 'det kommer gå över' eller minimera — validera istället."
                                    )
                                    logger.warning("🚨 Crisis alert: PHQ-9 suicidal ideation detected (self_harm_score=%s) for user %s", self_harm, user_id[:12])
                        break
            except Exception as exc:
                logger.warning("%s score fetch failed: %s", assessment_type, exc)

        if len(parts) <= 1:
            # Only name or nothing useful
            return "".join(parts) if parts else ""

        # Add guidance for the AI
        parts.append(
            "\nAnvänd denna information för att ge personligt stöd. "
            "Referera naturligt till användarens namn och vara medveten om "
            "deras nuvarande symtomnivå, men upprepa inte poängen mekaniskt."
        )
        return "\n\n".join(parts) + crisis_alert

    def fetch_cross_source_context(self, user_id: str) -> str:
        """Build a compact context block from the user's recent journal entries
        and active wellness goals (Redis-cached 5 min). Empty if no data.
        """
        from src.utils.context_cache import cached_user_context
        return cached_user_context("cross_source", user_id, lambda: self._compute_cross_source_context(user_id))

    def _compute_cross_source_context(self, user_id: str) -> str:
        from src.firebase_config import db

        if db is None:
            return ""

        parts: list[str] = []

        # 1. Recent journal entries (last 3) — gives the assistant insight into
        # what the user has been processing in writing.
        try:
            try:
                from google.cloud.firestore import FieldFilter
                journal_q = (
                    db.collection("journal_entries")
                    .where(filter=FieldFilter("user_id", "==", user_id))
                    .order_by("created_at", direction="DESCENDING")
                    .limit(3)
                )
            except ImportError:
                journal_q = (
                    db.collection("journal_entries")
                    .where("user_id", "==", user_id)
                    .order_by("created_at", direction="DESCENDING")
                    .limit(3)
                )

            journal_lines: list[str] = []
            for doc in journal_q.stream():
                data = doc.to_dict() or {}
                content = (data.get("content") or "").strip()
                if not content:
                    continue
                # Truncate to 160 chars to keep token budget tight
                snippet = content[:160].replace("\n", " ")
                mood = data.get("mood")
                mood_part = f" (humör: {mood})" if mood else ""
                journal_lines.append(f"- \"{snippet}\"{mood_part}")

            if journal_lines:
                parts.append(
                    "\n\nSENASTE JOURNALANTECKNINGAR (vad användaren skrivit om):\n"
                    + "\n".join(journal_lines)
                )
        except Exception as exc:
            logger.warning("Journal context fetch failed: %s", exc)

        # 2. Active wellness goals — what the user is working towards.
        try:
            goals_ref = (
                db.collection("users").document(user_id).collection("goals")
            )
            goal_lines: list[str] = []
            for doc in goals_ref.limit(20).stream():
                data = doc.to_dict() or {}
                status = (data.get("status") or "").lower()
                if status and status not in ("active", "in_progress", "ongoing"):
                    continue
                title = (data.get("title") or "").strip()
                if not title:
                    continue
                progress = data.get("progress")
                prog_part = f" ({int(progress)}%)" if isinstance(progress, int | float) else ""
                goal_lines.append(f"- {title[:100]}{prog_part}")
                if len(goal_lines) >= 3:
                    break

            if goal_lines:
                parts.append(
                    "\n\nAKTUELLA MÅL (vad användaren arbetar med):\n"
                    + "\n".join(goal_lines)
                    + "\nKoppla råd till dessa mål när det är naturligt."
                )
        except Exception as exc:
            logger.warning("Goals context fetch failed: %s", exc)

        return "".join(parts)

    def generate_therapeutic_conversation_stream(
        self,
        user_message: str,
        conversation_history: list[dict],
        user_id: str | None = None,
    ):
        """
        Stream therapeutic response token-by-token using OpenAI stream=True.
        Yields SSE-formatted strings: 'data: <chunk>\\n\\n' and 'data: [DONE]\\n\\n'
        Falls back to yielding full response at once if streaming unavailable.

        Uses the same enhanced system prompt as the non-streaming /chat endpoint
        to guarantee consistent therapeutic quality across both transports.
        """
        import json

        svc = self._svc

        if not svc.openai_available or not svc.client:
            logger.warning("⚠️ OpenAI not available, streaming fallback")
            fallback = svc._generate_fallback_therapeutic_response(user_message)
            text = fallback.get("response", "")
            for chunk in split_into_chunks(text, 8):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Crisis check before streaming
        try:
            crisis_analysis = svc.detect_crisis_indicators(user_message)
            if crisis_analysis["requires_immediate_attention"]:
                crisis_text = svc._generate_crisis_response(crisis_analysis)
                for chunk in split_into_chunks(crisis_text, 8):
                    yield f"data: {json.dumps({'content': chunk, 'crisis': True})}\n\n"
                yield "data: [DONE]\n\n"
                return
        except Exception as e:
            logger.warning("Crisis check failed during stream: %s", e)

        # Build the same rich system prompt used by the non-streaming endpoint
        system_prompt = svc._build_enhanced_system_prompt(user_message, user_id)

        # Apply RAG personalization: previous effective strategies, goals, continuity
        if user_id:
            try:
                from ..rag_service import get_rag_service
                rag_service = get_rag_service()
                system_prompt = rag_service.generate_augmented_prompt(
                    user_id=user_id,
                    current_message=user_message,
                    base_system_prompt=system_prompt,
                )
                logger.info("✅ RAG augmentation applied for stream user %s", user_id[:8])
            except Exception as rag_err:
                logger.warning("⚠️ RAG augmentation failed for stream: %s", rag_err)

        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history[-6:]:
            messages.append({
                "role": str(msg["role"]),
                "content": str(msg["content"])[:300]
            })
        messages.append({"role": "user", "content": user_message})

        try:
            stream = svc.client.chat.completions.create(
                model=svc._get_model_name(),
                messages=messages,  # type: ignore[arg-type]
                max_tokens=400,
                temperature=0.7,
                presence_penalty=0.1,
                frequency_penalty=0.1,
                stream=True,
                timeout=30.0
            )

            for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield f"data: {json.dumps({'content': delta.content})}\n\n"

            yield "data: [DONE]\n\n"
            logger.info("✅ Streaming therapeutic response completed")

        except svc._rate_limit_error:
            logger.warning("⚠️ OpenAI rate limit during stream")
            fallback = svc._generate_fallback_therapeutic_response(user_message, quota_exceeded=True)
            for chunk in split_into_chunks(fallback["response"], 8):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            fallback = svc._generate_fallback_therapeutic_response(user_message)
            for chunk in split_into_chunks(fallback["response"], 8):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"

    def generate_fallback_therapeutic_response(self, user_message: str, quota_exceeded: bool = False) -> dict[str, Any]:
        """Enhanced fallback response"""
        svc = self._svc
        # The AI chat is serving keyword-matched responses instead of GPT —
        # a clinically significant degradation that must be visible to ops.
        telemetry.degraded(
            "ai_chat",
            "quota_exhausted_local_fallback" if quota_exceeded else "local_fallback",
        )
        # Generate fallback response locally
        fallback_response = svc._generate_local_fallback_response(user_message)

        response_text = fallback_response["response"]
        if quota_exceeded:
            response_text = f"{response_text}"

        return {
            "response": response_text,
            "crisis_detected": False,
            "sentiment_analysis": svc.analyze_sentiment(user_message),
            "conversation_context": 0,
            "exercise_recommendations": fallback_response.get("suggested_actions", []),
            "ai_generated": False,
            "model_used": "fallback",
            "quota_exceeded": quota_exceeded
        }

    @staticmethod
    def generate_local_fallback_response(user_message: str) -> dict[str, Any]:
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

    @staticmethod
    def generate_exercise_recommendations(sentiment_analysis: dict, user_message: str) -> list[dict]:
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
