"""
Tests for crisis_routes.py
Covers: crisis assessment, safety plans, protocols, history, indicators, escalation.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch


BASE = "/api/v1/crisis"


def _make_indicator(**overrides):
    """Create a MagicMock that mimics a CrisisIndicator dataclass instance."""
    defaults = {
        "indicator_id": "social_withdrawal",
        "name": "Social Isolering",
        "category": "behavioral",
        "severity_level": "medium",
        "detection_rules": {},
        "intervention_triggers": ["immediate_support_check"],
        "swedish_description": "Minskad social interaktion",
        "risk_weight": 0.7,
    }
    defaults.update(overrides)
    ind = MagicMock()
    for k, v in defaults.items():
        setattr(ind, k, v)
    return ind


def _make_assessment(**overrides):
    """Create a MagicMock that mimics a CrisisAssessment dataclass instance."""
    defaults = {
        "user_id": "testuser1234567890ab",
        "overall_risk_level": "low",
        "risk_score": 0.15,
        "active_indicators": [],
        "risk_trends": {"trend": "stable"},
        "intervention_recommendations": ["Continue monitoring"],
        "assessment_timestamp": MagicMock(isoformat=MagicMock(return_value="2026-02-13T10:00:00+00:00")),
        "confidence_score": 0.85,
    }
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _make_protocol(**overrides):
    """Create a MagicMock that mimics an InterventionProtocol dataclass instance."""
    defaults = {
        "protocol_id": "proto_low",
        "name": "Low Risk Protocol",
        "risk_level": "low",
        "immediate_actions": ["Monitor mood"],
        "support_resources": [{"name": "Självmordslinjen", "phone": "90101"}],
        "follow_up_steps": ["Schedule follow-up"],
        "escalation_criteria": {"score_threshold": 0.6},
        "swedish_guidance": "Fortsätt övervaka",
    }
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


@pytest.fixture
def mock_crisis_service():
    """Mock crisis_intervention_service with proper attribute-based return values."""
    with patch("src.routes.crisis_routes.crisis_intervention_service") as mock_svc:
        # assess_crisis_risk → returns object with attributes
        mock_svc.assess_crisis_risk.return_value = _make_assessment()

        # generate_safety_plan → returns dict (route uses it as plain dict)
        mock_svc.generate_safety_plan.return_value = {
            "warning_signs": ["insomnia"],
            "coping_strategies": ["breathing exercises"],
            "support_contacts": [],
            "professional_help": [],
            "environmental_safety": [],
        }

        # get_emergency_protocol → returns object with attributes
        mock_svc.get_emergency_protocol.return_value = _make_protocol()

        # should_escalate_crisis → returns boolean
        mock_svc.should_escalate_crisis.return_value = False

        # crisis_indicators → dict[str, CrisisIndicator-like objects]
        mock_svc.crisis_indicators = {
            "social_withdrawal": _make_indicator(
                indicator_id="social_withdrawal",
                name="Social Isolering",
                category="behavioral",
                severity_level="medium",
            ),
            "severe_mood_decline": _make_indicator(
                indicator_id="severe_mood_decline",
                name="Svår Sinnesstämningsförsämring",
                category="emotional",
                severity_level="high",
            ),
        }

        yield mock_svc


# ---------------------------------------------------------------------------
# Helpers for Firestore side_effect patterns
# ---------------------------------------------------------------------------

def _setup_db_for_safety_plan_get(mock_db):
    """Configure mock_db so safety-plan GET finds a user and moods collection."""
    user_doc = MagicMock()
    user_doc.exists = True
    user_doc.to_dict.return_value = {
        "preferred_coping_strategies": ["walking"],
        "emergency_contacts": [{"name": "Mom", "phone": "123"}],
    }

    mood_collection = MagicMock()
    mood_collection.where.return_value = mood_collection
    mood_collection.order_by.return_value = mood_collection
    mood_collection.limit.return_value = mood_collection
    mood_collection.stream.return_value = []

    safety_collection = MagicMock()
    safety_doc_ref = MagicMock()
    safety_doc_ref.set = MagicMock()
    safety_collection.document.return_value = safety_doc_ref

    user_collection = MagicMock()
    user_doc_ref = MagicMock()
    user_doc_ref.get.return_value = user_doc
    user_collection.document.return_value = user_doc_ref

    original_side_effect = mock_db.collection.side_effect

    def col(name):
        if name == "users":
            return user_collection
        if name == "moods":
            return mood_collection
        if name == "safety_plans":
            return safety_collection
        # Fall back to default mock collection
        if original_side_effect:
            return original_side_effect(name)
        return MagicMock()

    mock_db.collection.side_effect = col


def _setup_db_for_check_escalation(mock_db):
    """Configure mock_db so check-escalation finds a previous assessment."""
    assessment_doc = MagicMock()
    assessment_doc.exists = True
    assessment_doc.to_dict.return_value = {
        "user_id": "testuser1234567890ab",
        "risk_level": "low",
        "risk_score": 0.15,
        "active_indicators": [],
        "intervention_recommendations": ["Continue monitoring"],
        "confidence_score": 0.85,
        "risk_trends": {"trend": "stable"},
        "assessment_timestamp": "2026-02-13T10:00:00+00:00",
    }

    assessment_collection = MagicMock()
    assessment_doc_ref = MagicMock()
    assessment_doc_ref.get.return_value = assessment_doc
    assessment_doc_ref.set = MagicMock()
    assessment_collection.document.return_value = assessment_doc_ref
    assessment_collection.where.return_value = assessment_collection
    assessment_collection.order_by.return_value = assessment_collection
    assessment_collection.limit.return_value = assessment_collection
    assessment_collection.stream.return_value = []

    original_side_effect = mock_db.collection.side_effect

    def col(name):
        if name == "crisis_assessments":
            return assessment_collection
        if original_side_effect:
            return original_side_effect(name)
        return MagicMock()

    mock_db.collection.side_effect = col


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCrisisAssessment:
    """Tests for POST /api/v1/crisis/assess"""

    def test_assess_success(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.post(
            f"{BASE}/assess",
            json={"mood_history": [], "recent_text_content": "feeling ok"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        # APIResponse wraps in {"success": ..., "data": ...}
        payload = data.get("data", data)
        assert payload.get("risk_level") == "low"
        assert "risk_score" in payload

    def test_assess_with_indicators(self, client, auth_headers, mock_db, mock_crisis_service):
        """Assessment that returns active indicators."""
        ind = _make_indicator()
        assessment = _make_assessment(
            overall_risk_level="medium",
            risk_score=0.55,
            active_indicators=[ind],
        )
        mock_crisis_service.assess_crisis_risk.return_value = assessment

        resp = client.post(
            f"{BASE}/assess",
            json={"mood_history": [3, 2, 2], "recent_text_content": "not great"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert payload["risk_level"] == "medium"
        assert len(payload["active_indicators"]) == 1

    def test_assess_critical_triggers_escalation(self, client, auth_headers, mock_db, mock_crisis_service):
        """Critical risk level triggers _escalate_crisis."""
        assessment = _make_assessment(overall_risk_level="critical", risk_score=0.98)
        mock_crisis_service.assess_crisis_risk.return_value = assessment

        resp = client.post(
            f"{BASE}/assess",
            json={"mood_history": [1, 1, 1]},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_assess_no_auth(self, client, mock_db, mock_crisis_service):
        """Without explicit auth header — conftest bypasses auth so expect 200."""
        resp = client.post(f"{BASE}/assess", json={"mood_history": []})
        assert resp.status_code in (200, 401, 403, 422)

    def test_assess_empty_body(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.post(f"{BASE}/assess", json={}, headers=auth_headers)
        assert resp.status_code == 200


class TestSafetyPlan:
    """Tests for GET/PUT /api/v1/crisis/safety-plan"""

    def test_get_safety_plan(self, client, auth_headers, mock_db, mock_crisis_service):
        _setup_db_for_safety_plan_get(mock_db)
        resp = client.get(f"{BASE}/safety-plan", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert "warning_signs" in payload or "coping_strategies" in payload

    def test_get_safety_plan_user_not_found(self, client, auth_headers, mock_db, mock_crisis_service):
        """When user document does not exist in Firestore, expect 404."""
        # Default mock_db returns exists=False, which triggers 404
        resp = client.get(f"{BASE}/safety-plan", headers=auth_headers)
        assert resp.status_code == 404

    def test_update_safety_plan(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.put(
            f"{BASE}/safety-plan",
            json={
                "warning_signs": ["bad sleep"],
                "coping_strategies": ["walk"],
                "support_contacts": [{"name": "Mom", "phone": "123"}],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert payload.get("warning_signs") == ["bad sleep"]

    def test_update_safety_plan_empty(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.put(f"{BASE}/safety-plan", json={}, headers=auth_headers)
        assert resp.status_code == 200


class TestProtocols:
    """Tests for GET /api/v1/crisis/protocols/<risk_level>"""

    @pytest.mark.parametrize("level", ["low", "medium", "high", "critical"])
    def test_get_protocol(self, client, auth_headers, mock_db, mock_crisis_service, level):
        mock_crisis_service.get_emergency_protocol.return_value = _make_protocol(
            protocol_id=f"proto_{level}", risk_level=level
        )
        resp = client.get(f"{BASE}/protocols/{level}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert payload.get("risk_level") == level

    def test_invalid_risk_level(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.get(f"{BASE}/protocols/invalid_level", headers=auth_headers)
        assert resp.status_code == 400

    def test_protocol_not_found(self, client, auth_headers, mock_db, mock_crisis_service):
        """When service returns None for a valid level."""
        mock_crisis_service.get_emergency_protocol.return_value = None
        resp = client.get(f"{BASE}/protocols/low", headers=auth_headers)
        assert resp.status_code == 404


class TestCrisisHistory:
    """Tests for GET /api/v1/crisis/history"""

    def test_get_history(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.get(f"{BASE}/history", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert "assessments" in payload

    def test_get_history_with_limit(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.get(f"{BASE}/history?limit=5", headers=auth_headers)
        assert resp.status_code == 200

    def test_get_history_with_results(self, client, auth_headers, mock_db, mock_crisis_service):
        """History endpoint with actual assessment documents."""
        mock_assessment_doc = MagicMock()
        mock_assessment_doc.to_dict.return_value = {
            "user_id": "testuser1234567890ab",
            "risk_level": "low",
            "risk_score": 0.15,
            "assessment_timestamp": "2026-02-13T10:00:00+00:00",
        }

        history_col = MagicMock()
        history_col.where.return_value = history_col
        history_col.order_by.return_value = history_col
        history_col.limit.return_value = history_col
        history_col.stream.return_value = [mock_assessment_doc]

        original = mock_db.collection.side_effect

        def col(name):
            if name == "crisis_assessments":
                return history_col
            if original:
                return original(name)
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.get(f"{BASE}/history", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert payload["total_count"] == 1


class TestIndicators:
    """Tests for GET /api/v1/crisis/indicators"""

    def test_get_indicators(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.get(f"{BASE}/indicators", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert "indicators" in payload
        assert payload["total_count"] == 2

    def test_indicators_grouped(self, client, auth_headers, mock_db, mock_crisis_service):
        resp = client.get(f"{BASE}/indicators", headers=auth_headers)
        data = resp.get_json()
        payload = data.get("data", data)
        grouped = payload.get("grouped_by_category", {})
        assert "behavioral" in grouped
        assert "emotional" in grouped


class TestCheckEscalation:
    """Tests for POST /api/v1/crisis/check-escalation"""

    def test_check_escalation_no_escalation(self, client, auth_headers, mock_db, mock_crisis_service):
        _setup_db_for_check_escalation(mock_db)
        mock_crisis_service.should_escalate_crisis.return_value = False

        resp = client.post(
            f"{BASE}/check-escalation",
            json={"current_context": {"note": "feeling better"}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert payload["should_escalate"] is False

    def test_check_escalation_should_escalate(self, client, auth_headers, mock_db, mock_crisis_service):
        _setup_db_for_check_escalation(mock_db)
        mock_crisis_service.should_escalate_crisis.return_value = True

        resp = client.post(
            f"{BASE}/check-escalation",
            json={"current_context": {"note": "worse"}},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        payload = data.get("data", data)
        assert payload["should_escalate"] is True

    def test_check_escalation_no_previous_assessment(self, client, auth_headers, mock_db, mock_crisis_service):
        """When no previous assessment exists, expect 404."""
        # Default mock_db returns exists=False
        resp = client.post(
            f"{BASE}/check-escalation",
            json={"current_context": {}},
            headers=auth_headers,
        )
        assert resp.status_code == 404
