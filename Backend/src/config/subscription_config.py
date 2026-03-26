"""Shared subscription configuration loader.

Ensures the backend reads the same plan metadata as the frontend by sourcing
`shared/subscription_plans.json` from the monorepo root.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHARED_PLAN_PATH = PROJECT_ROOT / "shared" / "subscription_plans.json"
logger = logging.getLogger(__name__)


def _validate_plans_payload(payload: Any) -> dict[str, Any]:
    """Validate shared plan payload structure before exposing it to routes/services."""
    if not isinstance(payload, dict):
        raise ValueError("subscription_plans.json måste innehålla ett objekt på toppnivå")

    if "free" not in payload:
        raise ValueError("subscription_plans.json måste innehålla planen 'free'")

    required_plan_fields = {"name", "price", "currency", "interval", "limits", "features"}
    for plan_key, plan_value in payload.items():
        if not isinstance(plan_value, dict):
            raise ValueError(f"Planen '{plan_key}' måste vara ett objekt")

        missing = required_plan_fields.difference(plan_value.keys())
        if missing:
            missing_sorted = ", ".join(sorted(missing))
            raise ValueError(f"Planen '{plan_key}' saknar obligatoriska fält: {missing_sorted}")

        if not isinstance(plan_value.get("limits"), dict):
            raise ValueError(f"Planen '{plan_key}' har ogiltigt fält 'limits' (måste vara objekt)")
        if not isinstance(plan_value.get("features"), dict):
            raise ValueError(f"Planen '{plan_key}' har ogiltigt fält 'features' (måste vara objekt)")

    return payload


@lru_cache(maxsize=1)
def load_subscription_plans() -> dict[str, Any]:
    if not SHARED_PLAN_PATH.exists():
        raise FileNotFoundError(
            f"Shared subscription plan file saknas: {SHARED_PLAN_PATH}"
        )

    try:
        with SHARED_PLAN_PATH.open(encoding="utf-8") as handle:
            payload = json.load(handle)
    except json.JSONDecodeError as exc:
        raise ValueError("subscription_plans.json innehåller ogiltig JSON") from exc

    validated = _validate_plans_payload(payload)
    logger.info("Laddade %d prenumerationsplaner från shared-konfiguration", len(validated))
    return validated


def get_plan_definition(plan_key: str) -> dict[str, Any]:
    plans = load_subscription_plans()
    normalized_key = (plan_key or "").strip().lower()
    selected = plans.get(normalized_key)
    if isinstance(selected, dict):
        return selected

    logger.warning("Okänd plan '%s', fallback till 'free'", normalized_key)
    fallback = plans.get("free")
    if isinstance(fallback, dict):
        return fallback

    raise ValueError("Kunde inte läsa fallback-planen 'free' från subscription_plans.json")


def clear_subscription_plan_cache() -> None:
    """Clear cache to support admin reload workflows or tests."""
    load_subscription_plans.cache_clear()
