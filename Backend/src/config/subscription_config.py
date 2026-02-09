"""Shared subscription configuration loader.

Ensures the backend reads the same plan metadata as the frontend by sourcing
`shared/subscription_plans.json` from the monorepo root.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SHARED_PLAN_PATH = PROJECT_ROOT / "shared" / "subscription_plans.json"


@lru_cache(maxsize=1)
def load_subscription_plans() -> dict[str, Any]:
    if not SHARED_PLAN_PATH.exists():
        raise FileNotFoundError(
            f"Shared subscription plan file saknas: {SHARED_PLAN_PATH}"
        )

    with SHARED_PLAN_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def get_plan_definition(plan_key: str) -> dict[str, Any]:
    plans = load_subscription_plans()
    return plans.get(plan_key, plans.get("free", {}))
