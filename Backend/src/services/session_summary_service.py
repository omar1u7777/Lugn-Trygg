"""
Session Summary Service.

Generates compact, structured summaries of completed chat sessions so the
AI assistant can recall key themes, effective techniques, and open threads
across future conversations.

Stored at: users/{user_id}/session_summaries/{summary_id}
"""
from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from ..firebase_config import db

logger = logging.getLogger(__name__)

# Minimum user messages required before generating a summary
MIN_USER_MESSAGES_FOR_SUMMARY = 3
# Maximum messages we feed into the summariser to keep token cost bounded
MAX_MESSAGES_FOR_SUMMARY = 30
# How many recent summaries to surface in the next-session system prompt
RECENT_SUMMARIES_FOR_CONTEXT = 3


class SessionSummaryService:
    """Generate and retrieve structured session summaries."""

    @staticmethod
    def _summary_ref(user_id: str):
        if db is None:
            raise RuntimeError("Firestore database client is not initialized")
        return db.collection("users").document(user_id).collection("session_summaries")

    @staticmethod
    def _build_prompt(messages: list[dict[str, Any]]) -> str:
        transcript_lines: list[str] = []
        for msg in messages[-MAX_MESSAGES_FOR_SUMMARY:]:
            role = msg.get("role", "user")
            content = str(msg.get("content", "")).strip()
            if not content:
                continue
            speaker = "Användare" if role == "user" else "Assistent"
            transcript_lines.append(f"{speaker}: {content[:400]}")
        transcript = "\n".join(transcript_lines)

        return (
            "Du är en klinisk samtalsanalytiker. Sammanfatta följande terapeutiska "
            "konversation som strukturerad JSON. Var koncis och konkret.\n\n"
            "Returnera ENDAST giltig JSON i exakt detta format:\n"
            "{\n"
            '  "one_line": "kort mening om sessionens huvudtema",\n'
            '  "themes": ["tema1", "tema2"],\n'
            '  "emotional_arc": "vart användaren startade och slutade känslomässigt",\n'
            '  "effective_techniques": ["teknik som hjälpte"],\n'
            '  "open_threads": ["fråga eller område att följa upp"],\n'
            '  "user_strengths_observed": ["styrka som syntes"],\n'
            '  "next_session_focus": "ett konkret förslag på vad nästa samtal kan utforska"\n'
            "}\n\n"
            "Listor: max 3 element vardera. Strängar: max 140 tecken. Svenska.\n\n"
            "Konversation:\n"
            f"{transcript}"
        )

    @classmethod
    def generate_summary(
        cls,
        user_id: str,
        messages: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """Generate a structured summary for a chat session.

        Returns the parsed summary dict, or None if generation was skipped
        (too few messages) or failed.
        """
        user_messages = [m for m in messages if m.get("role") == "user"]
        if len(user_messages) < MIN_USER_MESSAGES_FOR_SUMMARY:
            logger.info(
                "Skipping summary for user %s: only %d user messages (min %d)",
                user_id, len(user_messages), MIN_USER_MESSAGES_FOR_SUMMARY,
            )
            return None

        try:
            from .ai_service import ai_services

            if not ai_services.openai_available or not ai_services.client:
                logger.info("Skipping summary: OpenAI unavailable")
                return None

            prompt = cls._build_prompt(messages)
            response = ai_services.client.chat.completions.create(
                model=ai_services._get_model_name(),
                messages=[
                    {
                        "role": "system",
                        "content": "Du är en klinisk samtalsanalytiker. Returnera endast giltig JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=400,
                temperature=0.3,
                timeout=30.0,
            )

            content = response.choices[0].message.content
            if not content:
                return None

            text = content.strip()
            # Strip markdown fences if model added them
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:].strip()
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

            data = json.loads(text)

            # Defensive normalisation
            summary = {
                "one_line": str(data.get("one_line", ""))[:200],
                "themes": [str(t)[:80] for t in (data.get("themes") or [])][:3],
                "emotional_arc": str(data.get("emotional_arc", ""))[:200],
                "effective_techniques": [
                    str(t)[:80] for t in (data.get("effective_techniques") or [])
                ][:3],
                "open_threads": [str(t)[:160] for t in (data.get("open_threads") or [])][:3],
                "user_strengths_observed": [
                    str(t)[:80] for t in (data.get("user_strengths_observed") or [])
                ][:3],
                "next_session_focus": str(data.get("next_session_focus", ""))[:200],
                "message_count": len(messages),
                "user_message_count": len(user_messages),
            }
            return summary

        except json.JSONDecodeError as exc:
            logger.warning("Summary JSON parse failed for user %s: %s", user_id, exc)
            return None
        except Exception as exc:
            logger.warning("Summary generation failed for user %s: %s", user_id, exc)
            return None

    @classmethod
    def save_summary(cls, user_id: str, summary: dict[str, Any]) -> str | None:
        """Persist a summary. Returns the summary document id or None on failure."""
        try:
            ref = cls._summary_ref(user_id)
            doc = ref.document()
            payload = {
                **summary,
                "created_at": datetime.now(UTC).isoformat(),
            }
            doc.set(payload)
            logger.info("Saved session summary %s for user %s", doc.id, user_id)
            return doc.id
        except Exception as exc:
            logger.warning("Failed to save summary for user %s: %s", user_id, exc)
            return None

    @classmethod
    def get_recent_summaries(
        cls,
        user_id: str,
        limit: int = RECENT_SUMMARIES_FOR_CONTEXT,
    ) -> list[dict[str, Any]]:
        """Return the most recent session summaries (newest first)."""
        try:
            ref = cls._summary_ref(user_id)
            docs = list(
                ref.order_by("created_at", direction="DESCENDING").limit(limit).stream()
            )
            return [d.to_dict() or {} for d in docs]
        except Exception as exc:
            logger.warning("Failed to read summaries for user %s: %s", user_id, exc)
            return []

    @classmethod
    def format_for_prompt(cls, summaries: list[dict[str, Any]]) -> str:
        """Render a list of summaries into a compact system-prompt block.

        Returns an empty string if there are no usable summaries.
        """
        if not summaries:
            return ""

        lines: list[str] = ["\n\nMINNE FRÅN TIDIGARE SESSIONER:"]
        for idx, s in enumerate(summaries, start=1):
            one_line = s.get("one_line") or ""
            themes = ", ".join(s.get("themes") or [])
            next_focus = s.get("next_session_focus") or ""
            open_threads = s.get("open_threads") or []

            lines.append(f"\nSession {idx}: {one_line}")
            if themes:
                lines.append(f"  Teman: {themes}")
            if open_threads:
                lines.append(f"  Öppna trådar: {'; '.join(open_threads[:2])}")
            if next_focus:
                lines.append(f"  Föreslaget fokus: {next_focus}")

        lines.append(
            "\nReferera till tidigare sessioner när det är naturligt – det får användaren "
            "att känna sig kommen ihåg. Pressa inte fram teman om användaren bytt fokus."
        )
        return "\n".join(lines)

    @classmethod
    def summarise_and_save(
        cls,
        user_id: str,
        messages: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """Convenience: generate + save in one call. Returns the saved summary or None."""
        summary = cls.generate_summary(user_id, messages)
        if summary is None:
            return None
        cls.save_summary(user_id, summary)
        return summary
