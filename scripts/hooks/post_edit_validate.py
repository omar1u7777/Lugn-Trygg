#!/usr/bin/env python3
"""PostToolUse hook: run lightweight validation after edits in critical folders."""

from __future__ import annotations

import json
import os
import py_compile
import sys
from pathlib import Path
from typing import Any

CRITICAL_FOLDERS = (
    "src/",
    "shared/",
    "Backend/src/",
    "Backend/tests/",
)

EDIT_TOOLS = {
    "apply_patch",
    "create_file",
    "edit_notebook_file",
    "vscode_renameSymbol",
    "vscode_rename_symbol",
}


def _load_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}

    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _extract_event(payload: dict[str, Any]) -> str:
    for key in ("hookEventName", "eventName", "event"):
        value = payload.get(key)
        if isinstance(value, str):
            return value

    hs = payload.get("hookSpecificInput")
    if isinstance(hs, dict):
        for key in ("hookEventName", "eventName", "event"):
            value = hs.get(key)
            if isinstance(value, str):
                return value

    return ""


def _extract_tool_name(payload: dict[str, Any]) -> str:
    keys = ("toolName", "tool", "tool_name", "name")
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str):
            return value

    hs = payload.get("hookSpecificInput")
    if isinstance(hs, dict):
        for key in keys:
            value = hs.get(key)
            if isinstance(value, str):
                return value

    return ""


def _iter_dict(d: dict[str, Any]) -> list[Any]:
    values: list[Any] = []
    for value in d.values():
        values.append(value)
        if isinstance(value, dict):
            values.extend(_iter_dict(value))
        elif isinstance(value, list):
            for item in value:
                values.append(item)
                if isinstance(item, dict):
                    values.extend(_iter_dict(item))
    return values


def _candidate_paths(payload: dict[str, Any]) -> list[str]:
    out: list[str] = []
    values = [payload]
    if isinstance(payload.get("hookSpecificInput"), dict):
        values.append(payload["hookSpecificInput"])

    for value in values:
        if not isinstance(value, dict):
            continue

        all_values = _iter_dict(value)
        for entry in all_values:
            if isinstance(entry, str):
                maybe = entry.replace("\\", "/")
                if "/" in maybe and ("." in Path(maybe).name):
                    out.append(maybe)

    deduped: list[str] = []
    seen: set[str] = set()
    for path in out:
        if path not in seen:
            seen.add(path)
            deduped.append(path)
    return deduped


def _is_critical(path_text: str) -> bool:
    normalized = path_text.replace("\\", "/")
    return any(part in normalized for part in CRITICAL_FOLDERS)


def _resolve_existing_file(path_text: str) -> Path | None:
    normalized = path_text.replace("\\", "/")
    path = Path(normalized)

    if path.is_file():
        return path

    repo_relative = Path.cwd() / normalized
    if repo_relative.is_file():
        return repo_relative

    return None


def _validate_file(path: Path) -> str | None:
    suffix = path.suffix.lower()

    if suffix == ".py":
        try:
            py_compile.compile(str(path), doraise=True)
            return None
        except py_compile.PyCompileError as exc:
            return f"Python compile error in {path}: {exc.msg}"

    if suffix == ".json":
        try:
            json.loads(path.read_text(encoding="utf-8"))
            return None
        except json.JSONDecodeError as exc:
            return f"JSON syntax error in {path}: line {exc.lineno} col {exc.colno}"
        except UnicodeDecodeError:
            return f"Cannot decode JSON as UTF-8: {path}"

    if suffix in {".js", ".jsx"}:
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "<<<<<<<" in text or ">>>>>>>" in text:
            return f"Merge marker detected in {path}"
        return None

    return None


def _emit(data: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(data))


def main() -> int:
    payload = _load_payload()
    event = _extract_event(payload)

    if event and event != "PostToolUse":
        _emit({"continue": True})
        return 0

    tool_name = _extract_tool_name(payload)
    if tool_name and tool_name not in EDIT_TOOLS:
        _emit({"continue": True})
        return 0

    failures: list[str] = []
    checked: list[str] = []

    for candidate in _candidate_paths(payload):
        if not _is_critical(candidate):
            continue

        file_path = _resolve_existing_file(candidate)
        if file_path is None:
            continue

        checked.append(str(file_path))
        error = _validate_file(file_path)
        if error:
            failures.append(error)

    if failures:
        _emit(
            {
                "continue": True,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "decision": "block"
                },
                "stopReason": "Post-edit validation failed: " + " | ".join(failures[:3]),
                "systemMessage": "Validation errors detected in critical folders. Fix before continuing."
            }
        )
        return 2

    if checked:
        _emit(
            {
                "continue": True,
                "systemMessage": "Post-edit validation passed for critical files: " + ", ".join(checked[:5]),
            }
        )
        return 0

    _emit({"continue": True})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
