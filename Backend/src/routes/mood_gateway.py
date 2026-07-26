"""Mood domain gateway — single registration point for all mood blueprints.

The mood domain historically sprawled across four route modules
(mood, mood-stats, mood-analytics, advanced-mood), each registered separately
in main.py with its own prefix string. This module is now the ONE place that:

- owns the canonical URL prefix for every mood blueprint (external URLs are
  unchanged — zero client impact);
- declares the domain-wide authorization contract (`mood_authorization_required`)
  that every mood endpoint uses, so an auth-policy change is a one-line edit
  here instead of a four-file sweep;
- registers the whole domain atomically via `register_mood_gateway(app)`.

New mood endpoints must be added to one of these blueprints (or a new blueprint
listed in MOOD_BLUEPRINTS) — never registered ad hoc in main.py.
"""

import logging

from flask import Flask

from src.services.auth_service import AuthService

from .advanced_mood_routes import advanced_mood_bp
from .mood_analytics_routes import mood_analytics_bp
from .mood_routes import mood_bp
from .mood_stats_routes import mood_stats_bp

logger = logging.getLogger(__name__)

# Domain-wide authorization contract. All mood blueprints decorate their
# endpoints with AuthService.jwt_required; this alias is the gateway-level
# seam for tightening the policy (e.g. consent checks) in one place.
mood_authorization_required = AuthService.jwt_required

# Canonical (blueprint, url_prefix) registry for the mood domain.
# Prefixes are frozen for backward compatibility with deployed clients.
MOOD_BLUEPRINTS: tuple = (
    (mood_bp, '/api/v1/mood'),
    (mood_stats_bp, '/api/v1/mood-stats'),
    (mood_analytics_bp, '/api/v1/mood-analytics'),
    (advanced_mood_bp, '/api/v1/advanced-mood'),
)


def register_mood_gateway(app: Flask) -> None:
    """Register every mood-domain blueprint under its canonical prefix."""
    for blueprint, prefix in MOOD_BLUEPRINTS:
        app.register_blueprint(blueprint, url_prefix=prefix)
        logger.info(f"✅ Registered {blueprint.name} at {prefix} (mood gateway)")
