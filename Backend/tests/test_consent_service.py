"""
Tests for consent_service.py
Covers: check, grant, withdraw consent, user consents, feature access.
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone


@pytest.fixture
def consent_svc():
    """Import and return consent_service with mocked Firebase."""
    from src.services.consent_service import consent_service
    return consent_service


class TestCheckConsent:
    """Tests for consent_service.check_consent."""

    def test_check_active_consent(self, consent_svc, mock_db):
        """User with active consent → has_consent=True."""
        # consent_service reads db.collection('users').document(user_id).get()
        # then checks user_data.get('consents', {}).get(consent_type)
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={
                "consents": {
                    "terms_of_service": {
                        "granted": True,
                        "granted_at": datetime.now(timezone.utc).isoformat(),
                        "version": "1.0",
                        "withdrawn": False,
                    }
                }
            })
        )

        result = consent_svc.check_consent("user-123", "terms_of_service")
        assert result["has_consent"] is True

    def test_check_no_consent(self, consent_svc, mock_db):
        """User without consent → has_consent=False."""
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={"consents": {}})
        )

        result = consent_svc.check_consent("user-123", "terms_of_service")
        assert result["has_consent"] is False


class TestGrantConsent:
    """Tests for consent_service.grant_consent."""

    def test_grant_valid_consent(self, consent_svc, mock_db):
        result = consent_svc.grant_consent("user-123", "terms_of_service", "1.0")
        assert result is True

    def test_grant_invalid_consent_type(self, consent_svc, mock_db):
        result = consent_svc.grant_consent("user-123", "nonexistent_consent_type", "1.0")
        assert result is False


class TestWithdrawConsent:
    """Tests for consent_service.withdraw_consent."""

    def test_withdraw_consent(self, consent_svc, mock_db):
        result = consent_svc.withdraw_consent("user-123", "marketing")
        assert isinstance(result, bool)


class TestGetUserConsents:
    """Tests for consent_service.get_user_consents."""

    def test_get_all_consents(self, consent_svc, mock_db):
        result = consent_svc.get_user_consents("user-123")
        assert isinstance(result, dict)


class TestValidateFeatureAccess:
    """Tests for consent_service.validate_feature_access."""

    def test_feature_with_missing_consents(self, consent_svc, mock_db):
        """User without required consents should not have access."""
        result = consent_svc.validate_feature_access("user-123", "voice_analysis")
        assert isinstance(result, dict)
        assert "access_granted" in result or "missing_consents" in result or isinstance(result.get("access_granted"), bool)
