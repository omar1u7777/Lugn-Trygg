"""Tests for scripts/check_postman_drift.py.

The check is only worth running if its route discovery is complete. The first
draft read main.py alone and reported 41 false positives, because two whole
registration mechanisms were invisible to it:

  - peer_chat_bp carries url_prefix on the Blueprint() constructor and main.py
    registers it with no prefix argument
  - the four mood blueprints are registered by mood_gateway.register_mood_gateway,
    never by main.py

Both are pinned below against the real repository, so a future refactor that
moves registration somewhere new fails here instead of silently turning healthy
requests into "drift".
"""

import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "Backend" / "scripts" / "check_postman_drift.py"

spec = importlib.util.spec_from_file_location("check_postman_drift", SCRIPT)
assert spec and spec.loader
drift = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drift)


# ---------------------------------------------------------------------------
# Path normalisation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("/api/v1/privacy/settings/<user_id>", "/api/v1/privacy/settings/*"),
        ("/api/v1/privacy/settings/{{userId}}", "/api/v1/privacy/settings/*"),
        ("/api/v1/mood/<int:mood_id>", "/api/v1/mood/*"),
        ("/api/v1/mood/recent?limit=10", "/api/v1/mood/recent"),
        ("/api/v1/mood/recent/", "/api/v1/mood/recent"),
        ("/api/v1/users/:id/status", "/api/v1/users/*/status"),
    ],
)
def test_normalise_collapses_every_parameter_flavour(raw, expected):
    assert drift.normalise(raw) == expected


def test_normalise_does_not_eat_a_time_in_a_path():
    # ':' only introduces a parameter directly after a '/'.
    assert drift.normalise("/api/v1/report/09:30") == "/api/v1/report/09:30"


# ---------------------------------------------------------------------------
# Pattern matching
# ---------------------------------------------------------------------------

def test_concrete_value_matches_parameterised_route():
    # The collection deliberately requests a real risk level; the route is
    # registered as /protocols/<risk_level>. Same endpoint.
    assert drift.matches("/api/v1/crisis/protocols/critical", "/api/v1/crisis/protocols/*")


def test_different_segment_counts_never_match():
    assert not drift.matches("/api/v1/mood/log/extra", "/api/v1/mood/*")


def test_literal_segments_must_agree():
    assert not drift.matches("/api/v1/mood/log", "/api/v1/mood/recent")


# ---------------------------------------------------------------------------
# Negative-test detection
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "path",
    [
        "/api/health/nonexistent",
        "/api/v1/challenges/nonexistent-challenge-e2e-test-xyz",
        "/api/v1/cbt/modules/does_not_exist_xyz",
        "/api/v1/auth/consent/other-user-id-not-mine",
        "/api/v1/cbt/modules/..%2f..%2fetc%2fpasswd",
    ],
)
def test_deliberate_404_probes_are_not_drift(path):
    assert drift.is_negative_test(path)


def test_a_real_endpoint_is_not_mistaken_for_a_probe():
    assert not drift.is_negative_test("/api/v1/mood/log")


# ---------------------------------------------------------------------------
# Route discovery — the part that was wrong the first time
# ---------------------------------------------------------------------------

def test_discovers_prefixes_from_main_py():
    assert drift.blueprint_prefixes().get("crisis_bp") == "/api/v1/crisis"


def test_discovers_prefix_declared_on_the_blueprint_constructor():
    """peer_chat_bp sets url_prefix itself; main.py registers it bare.

    Reading main.py alone put its routes at the site root and reported all 13
    peer-chat requests as stale.
    """
    assert drift.blueprint_prefixes().get("peer_chat_bp") == "/api/v1/peer-chat"


def test_discovers_blueprints_registered_by_the_mood_gateway():
    """The mood domain never appears in main.py's register_blueprint calls."""
    prefixes = drift.blueprint_prefixes()
    assert prefixes.get("mood_bp") == "/api/v1/mood"
    assert prefixes.get("mood_stats_bp") == "/api/v1/mood-stats"
    assert prefixes.get("mood_analytics_bp") == "/api/v1/mood-analytics"
    assert prefixes.get("advanced_mood_bp") == "/api/v1/advanced-mood"


def test_route_discovery_finds_a_known_endpoint_with_its_methods():
    routes = drift.registered_routes()
    assert "/api/v1/crisis/safety-plan" in routes
    assert {"GET", "PUT"} <= routes["/api/v1/crisis/safety-plan"]


def test_discovers_blueprint_roots_registered_with_an_empty_rule():
    """`@mood_bp.route('', methods=['GET'])` is a real endpoint.

    The extraction regex required at least one character in the rule, so every
    blueprint root was skipped and five live endpoints were reported as
    requests aimed at nothing.
    """
    routes = drift.registered_routes()
    assert "/api/v1/mood" in routes
    assert "GET" in routes["/api/v1/mood"]


def test_every_registered_route_is_versioned_or_a_known_exception():
    """Only /api/docs and /api/health live outside /api/v1.

    This is what makes the 21 unversioned collection requests genuine drift
    rather than a second supported scheme. If an unversioned blueprint is ever
    added back, this fails and the drift report needs revisiting.
    """
    unexpected = [
        p
        for p in drift.registered_routes()
        if p.startswith("/api/")
        and not p.startswith("/api/v1/")
        and not p.startswith("/api/docs")
        and not p.startswith("/api/health")
        and not p.startswith("/api/security")
    ]
    assert unexpected == [], f"unversioned routes appeared: {unexpected}"


# ---------------------------------------------------------------------------
# End to end against the real repository
# ---------------------------------------------------------------------------

def test_analyse_runs_and_reports_sane_totals():
    result = drift.analyse()
    assert len(result["routes"]) > 200, "route discovery collapsed"
    assert len(result["collection"]) > 200, "collection discovery collapsed"


def test_every_collection_file_still_parses():
    assert drift.analyse()["parse_errors"] == []


def test_every_route_has_a_collection_request():
    """Full coverage, held.

    This started at 94% with 15 routes uncovered — the whole `admin` and
    `predictive` blueprints, including one endpoint that changes another user's
    account status and one on the crisis path. Both now have generated
    collections (scripts/generate_admin_predictive_collections.py).

    The floor is 100 rather than a percentage with slack, because slack is what
    let two entire blueprints sit uncovered without anyone noticing. A new route
    lands with its contract request, the way a new function lands with its test.
    """
    result = drift.analyse()
    uncovered = result["uncovered"]
    assert uncovered == [], (
        f"{len(uncovered)} route(s) have no collection request: {uncovered}. "
        "Add them to the matching Backend/postman/collections/*.json."
    )


def test_no_collection_request_targets_a_dead_endpoint():
    """Stale must stay at zero — CI runs this check with --strict.

    Twenty-one requests used the pre-/api/v1/ scheme and would 404 against
    every deployed version. They were corrected; this keeps them corrected.
    """
    stale = drift.analyse()["stale"]
    assert stale == [], f"{len(stale)} request(s) target no registered route: {stale}"


def test_commented_out_routes_are_not_counted_as_registered():
    """integration_routes.py keeps a deprecated `/wearable/connect` handler
    inside a triple-quoted block — removed on purpose, never registered.

    The regex-based extractor could not tell code from a string literal and
    counted it, then reported it as an endpoint with no collection. That sends
    someone off to write tests for something Flask does not serve. Parsing with
    ast sees only real decorators.
    """
    routes = drift.registered_routes()
    assert '/api/v1/integration/wearable/connect' not in routes
    # The live siblings in the same file are still found.
    assert '/api/v1/integration/wearable/disconnect' in routes
    assert '/api/v1/integration/wearable/status' in routes


def test_methods_come_from_the_decorator_not_a_default():
    routes = drift.registered_routes()
    # Declared as methods=['GET', 'OPTIONS'] on admin_routes.
    assert {'GET', 'OPTIONS'} <= routes['/api/v1/admin/stats']
    # Declared with no methods= at all, so Flask defaults to GET.
    assert routes['/api/v1/predictive/trends'] == {'GET'}


def test_admin_and_predictive_now_have_collections():
    """Both blueprints had none — 13 routes with zero contract coverage,
    including one that changes another user's account status and one on the
    crisis path."""
    result = drift.analyse()
    uncovered = set(result['uncovered'])
    assert not any(p.startswith('/api/v1/admin/') for p in uncovered)
    assert not any(p.startswith('/api/v1/predictive/') for p in uncovered)
