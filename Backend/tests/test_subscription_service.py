"""
Tests for subscription_service.py
Covers: plan normalization, premium check, plan context, daily usage, quota.
"""
import pytest
from unittest.mock import MagicMock


class TestNormalizePlan:
    """Tests for SubscriptionService._normalize_plan."""

    def test_normalize_none(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService._normalize_plan(None) == "free"

    def test_normalize_uppercase(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService._normalize_plan("PREMIUM") == "premium"

    def test_normalize_unknown(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService._normalize_plan("unknown_plan_xyz") == "free"

    def test_normalize_free(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService._normalize_plan("free") == "free"

    def test_normalize_enterprise(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService._normalize_plan("enterprise") == "enterprise"


class TestIsPremiumPlan:
    """Tests for SubscriptionService.is_premium_plan."""

    def test_premium_is_premium(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService.is_premium_plan("premium") is True

    def test_enterprise_is_premium(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService.is_premium_plan("enterprise") is True

    def test_free_is_not_premium(self):
        from src.services.subscription_service import SubscriptionService
        assert SubscriptionService.is_premium_plan("free") is False

    def test_trial_is_not_premium(self):
        from src.services.subscription_service import SubscriptionService
        result = SubscriptionService.is_premium_plan("trial")
        assert isinstance(result, bool)


class TestGetPlanContext:
    """Tests for SubscriptionService.get_plan_context."""

    def test_premium_user(self):
        from src.services.subscription_service import SubscriptionService
        user_data = {"subscription": {"plan": "premium", "status": "active"}}
        result = SubscriptionService.get_plan_context(user_data)
        assert result["is_premium"] is True

    def test_free_user(self):
        from src.services.subscription_service import SubscriptionService
        user_data = {"subscription": {"plan": "free"}}
        result = SubscriptionService.get_plan_context(user_data)
        assert result["is_premium"] is False

    def test_none_user_data(self):
        from src.services.subscription_service import SubscriptionService
        result = SubscriptionService.get_plan_context(None)
        assert result["is_premium"] is False

    def test_missing_subscription_key(self):
        from src.services.subscription_service import SubscriptionService
        result = SubscriptionService.get_plan_context({"email": "test@test.com"})
        assert result["is_premium"] is False


class TestSubscriptionLimitError:
    """Tests for SubscriptionLimitError exception."""

    def test_error_instantiation(self):
        from src.services.subscription_service import SubscriptionLimitError
        err = SubscriptionLimitError("mood_logs", 10)
        assert "mood_logs" in str(err) or hasattr(err, "usage_type")
        assert isinstance(err, Exception)


class TestGetDailyUsage:
    """Tests for SubscriptionService.get_daily_usage."""

    def test_get_daily_usage(self, mock_db):
        from src.services.subscription_service import SubscriptionService
        result = SubscriptionService.get_daily_usage("testuser1234567890ab")
        assert isinstance(result, dict)
        assert "mood_logs" in result or "date" in result


class TestBuildStatusPayload:
    """Tests for SubscriptionService.build_status_payload."""

    def test_build_payload(self, mock_db):
        from src.services.subscription_service import SubscriptionService
        user_data = {"subscription": {"plan": "free"}}
        result = SubscriptionService.build_status_payload("testuser1234567890ab", user_data)
        assert isinstance(result, dict)
