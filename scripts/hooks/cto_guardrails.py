#!/usr/bin/env python3
"""Guardrails hook for Lugn & Trygg agent sessions.

- Injects a reminder to call task_complete when work is finished.
- Blocks destructive git commands before tool execution.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any


DANGEROUS_PATTERNS = [
    r"\bgit\s+reset\s+--hard\b",
    r"\bgit\s+checkout\s+--\b",
    r"\brm\s+-rf\s+/\b",
    r"\bdel\s+/f\s+/q\b",
]


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}

    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
        return {}
    except json.JSONDecodeError:
        return {}


def _event_name(payload: dict[str, Any]) -> str:
    for key in ("hookEventName", "eventName", "event"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value

    hs = payload.get("hookSpecificInput")
    if isinstance(hs, dict):
        for key in ("hookEventName", "eventName", "event"):
            value = hs.get(key)
            if isinstance(value, str) and value:
                return value

    return ""


def _extract_tool_command(payload: dict[str, Any]) -> str:
    candidates: list[Any] = [
        payload.get("toolInput"),
        payload.get("tool_input"),
        payload.get("input"),
        payload.get("command"),
    ]

    hs = payload.get("hookSpecificInput")
    if isinstance(hs, dict):
        candidates.extend(
            [
                hs.get("toolInput"),
                hs.get("tool_input"),
                hs.get("input"),
                hs.get("command"),
            ]
        )

    for candidate in candidates:
        if isinstance(candidate, str):
            return candidate
        if isinstance(candidate, dict):
            for key in ("command", "input", "args"):
                inner = candidate.get(key)
                if isinstance(inner, str):
                    return inner

    return ""


def _matches_dangerous_command(text: str) -> bool:
    lowered = text.lower()
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, lowered):
            return True
    return False


def _print_json(data: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(data))


def main() -> int:
    payload = _read_payload()
    event = _event_name(payload)

    if event in {"SessionStart", "UserPromptSubmit"}:
        _print_json(
            {
                "continue": True,
                "systemMessage": (
                    "När uppgiften är klar ska du alltid först skriva en kort sammanfattning "
                    "och sedan anropa task_complete-verktyget."
                ),
            }
        )
        return 0

    if event == "PreToolUse":
        command = _extract_tool_command(payload)
        if command and _matches_dangerous_command(command):
            _print_json(
                {
                    "continue": False,
                    "stopReason": (
                        "Blocked by cto-guardrails hook: destructive command is not allowed."
                    ),
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": (
                            "Destruktiva kommandon som kan radera ändringar är blockerade."
                        ),
                    },
                }
            )
            return 2

    _print_json({"continue": True})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
