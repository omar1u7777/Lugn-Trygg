"""Shared wellness goal constants and validation helpers."""

import json
from pathlib import Path

from .input_sanitization import sanitize_text

_DEFAULT_MAX_WELLNESS_GOALS = 3
MAX_WELLNESS_GOAL_LENGTH = 80

_DEFAULT_ALLOWED_WELLNESS_GOALS: tuple[str, ...] = (
    'Hantera stress',
    'Bättre sömn',
    'Ökad fokusering',
    'Mental klarhet',
    'Ångesthantering',
    'Självkänsla',
    'Relationsstöd',
    'Arbetsbalans',
    'Mindfulness',
    'Emotionell balans',
    'Energi',
)


def _load_shared_wellness_goals() -> tuple[int, tuple[str, ...]]:
    """Load goal configuration from shared JSON used by frontend and backend."""
    shared_config_path = Path(__file__).resolve().parents[3] / 'shared' / 'wellness_goals.json'

    try:
        with shared_config_path.open(encoding='utf-8') as shared_file:
            config_data = json.load(shared_file)

        if not isinstance(config_data, dict):
            raise ValueError('Invalid wellness goal config format')

        raw_max_goals = config_data.get('maxGoals', _DEFAULT_MAX_WELLNESS_GOALS)
        max_goals = raw_max_goals if isinstance(raw_max_goals, int) and raw_max_goals > 0 else _DEFAULT_MAX_WELLNESS_GOALS

        raw_goals = config_data.get('goals', [])
        if not isinstance(raw_goals, list):
            raise ValueError('Invalid goals list format')

        canonical_goals: list[str] = []
        seen_goals: set[str] = set()
        for goal_entry in raw_goals:
            if not isinstance(goal_entry, dict):
                continue

            goal_id = goal_entry.get('id')
            if not isinstance(goal_id, str):
                continue

            normalized_goal = goal_id.strip()
            if not normalized_goal:
                continue

            dedupe_key = normalized_goal.casefold()
            if dedupe_key in seen_goals:
                continue

            seen_goals.add(dedupe_key)
            canonical_goals.append(normalized_goal)

        if canonical_goals:
            return max_goals, tuple(canonical_goals)
    except Exception:
        # Fall back to defaults to keep API stable if shared config is unavailable.
        pass

    return _DEFAULT_MAX_WELLNESS_GOALS, _DEFAULT_ALLOWED_WELLNESS_GOALS


MAX_WELLNESS_GOALS, ALLOWED_WELLNESS_GOALS = _load_shared_wellness_goals()

_ALLOWED_WELLNESS_GOALS_LOOKUP = {goal.casefold(): goal for goal in ALLOWED_WELLNESS_GOALS}


def normalize_and_validate_wellness_goals(raw_goals: object) -> list[str]:
    """Validate, sanitize, deduplicate and canonicalize wellness goals."""
    if not isinstance(raw_goals, list) or len(raw_goals) == 0:
        raise ValueError('wellnessGoals must be a non-empty list')

    if len(raw_goals) > MAX_WELLNESS_GOALS:
        raise ValueError(f'A maximum of {MAX_WELLNESS_GOALS} wellness goals is allowed')

    normalized_goals: list[str] = []
    seen_goals: set[str] = set()
    invalid_goals: list[str] = []

    for goal in raw_goals:
        if not isinstance(goal, str):
            raise ValueError('Each wellness goal must be a string')

        sanitized_goal = sanitize_text(goal, max_length=MAX_WELLNESS_GOAL_LENGTH).strip()
        if not sanitized_goal:
            raise ValueError('Wellness goals cannot contain empty values')

        normalized_key = sanitized_goal.casefold()
        canonical_goal = _ALLOWED_WELLNESS_GOALS_LOOKUP.get(normalized_key)
        if canonical_goal is None:
            invalid_goals.append(sanitized_goal)
            continue

        canonical_key = canonical_goal.casefold()
        if canonical_key in seen_goals:
            continue

        seen_goals.add(canonical_key)
        normalized_goals.append(canonical_goal)

    if invalid_goals:
        invalid_values = ', '.join(invalid_goals)
        raise ValueError(f'Invalid wellness goal(s): {invalid_values}')

    if len(normalized_goals) == 0:
        raise ValueError('wellnessGoals must be a non-empty list')

    return normalized_goals


def extract_and_validate_wellness_goals(payload: dict | None, field_name: str = 'wellnessGoals') -> list[str]:
    """Extract goals from payload and validate them using shared rules."""
    if not payload or field_name not in payload:
        raise ValueError(f'Request body must contain {field_name}')

    return normalize_and_validate_wellness_goals(payload.get(field_name))
