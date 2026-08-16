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

    Note what this does NOT mean. Legacy /api/<segment>/ URLs still work,
    because main.py's LegacyAPIRewriter promotes them before Flask routes —
    see TestTheLegacyRewriterIsModelled. This asserts the shape of the route
    table, not that unversioned client URLs are broken.
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

    "Stale" means a request that matches no route once the legacy rewriter has
    been applied. Twenty-one requests used the pre-/api/v1/ scheme; those were
    NOT dead — the rewriter promotes them — and versioning them was tidying
    rather than a fix. This guards the real case: a request pointing at an
    endpoint that no longer exists under any spelling.
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


class TestTheLegacyRewriterIsModelled:
    """main.py installs a WSGI shim before Flask routing.

    LegacyAPIRewriter promotes /api/<segment>/... to /api/v1/<segment>/... for
    a fixed segment list. A checker that compares raw collection URLs against
    Flask's route table therefore calls every legacy path stale — which is what
    this one did, reporting 21 of them as dead. Probing production settles it:
    /api/auth/login answers 400 (the handler, rejecting an empty body), not
    404. They were compatibility URLs, not broken ones.
    """

    def test_legacy_paths_resolve_to_their_v1_form(self):
        assert drift.apply_legacy_rewrite('/api/mood/log') == '/api/v1/mood/log'
        assert drift.apply_legacy_rewrite('/api/auth/login') == '/api/v1/auth/login'

    def test_already_versioned_paths_are_untouched(self):
        assert drift.apply_legacy_rewrite('/api/v1/mood/log') == '/api/v1/mood/log'

    def test_segments_outside_the_list_are_untouched(self):
        """/api/docs and /api/health are genuinely unversioned."""
        assert drift.apply_legacy_rewrite('/api/docs/spec') == '/api/docs/spec'
        assert drift.apply_legacy_rewrite('/api/health/ready') == '/api/health/ready'

    def test_the_segment_list_is_read_from_main_not_duplicated(self):
        """Duplicating it here is how the two would drift apart."""
        segments = drift.legacy_rewrite_segments()
        assert len(segments) > 30
        assert {'mood', 'auth', 'crisis', 'security'} <= segments

    def test_a_legacy_collection_request_is_not_reported_as_stale(self):
        routes = drift.registered_routes()
        assert any(drift.matches(drift.normalise('/api/mood/log'), r) for r in routes)


class TestTheCspEndpointIsReachable:
    """The CSP report endpoint was registered at a path nothing routes to.

    'security' is in the rewriter's segment list, so a POST to
    /api/security/csp-violation arrived as /api/v1/security/csp-violation —
    where the only matching rule is main.py's catch-all OPTIONS preflight
    handler. Production returned 405 behind the 403 the CSRF gate produced
    first. Both were verified against the live service.
    """

    def test_the_rule_is_registered_where_the_rewriter_delivers(self):
        """Asserted against the source, not drift.registered_routes().

        The checker only discovers `@blueprint.route` decorators under
        src/routes/. This endpoint is registered with app.add_url_rule from
        src/middleware/security_headers.py, so the checker cannot see it — a
        blind spot worth knowing about when reading its 100% coverage number.
        """
        from pathlib import Path
        src = (Path(__file__).resolve().parents[1]
               / 'src' / 'middleware' / 'security_headers.py').read_text(encoding='utf-8')
        assert "'/api/v1/security/csp-violation'," in src
        assert "methods=['POST']" in src

    def test_the_report_uri_points_at_the_registered_rule(self):
        """A report-uri the browser cannot reach collects nothing."""
        from pathlib import Path
        src = (Path(__file__).resolve().parents[1]
               / 'src' / 'middleware' / 'security_headers.py').read_text(encoding='utf-8')
        assert "'report-uri': \"/api/v1/security/csp-violation\"" in src

    def test_the_path_is_csrf_exempt(self):
        """Browsers send CSP reports with no CSRF cookie and no header."""
        from pathlib import Path
        src = (Path(__file__).resolve().parents[1] / 'main.py').read_text(encoding='utf-8')
        assert "'/api/v1/security/csp-violation'," in src
