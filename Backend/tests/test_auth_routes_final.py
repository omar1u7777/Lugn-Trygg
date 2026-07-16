"""
Final coverage tests for the remaining uncovered statements in auth_routes.py.

These tests call the route view functions directly inside a test_request_context
so that CORS preflight and the before_request db guard do not mask the route
body.  The jwt_required mock in conftest.py is now built with @wraps, so we can
unwrap the decorator chain to reach the original route function.
"""
import importlib
import json
import sys
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from flask import g

from src.routes import auth_routes as auth_routes_module


TEST_USER_ID = "testuser1234567890ab"


def _unwrap(func):
    """Follow functools.wraps __wrapped__ chain to the inner route function."""
    for _ in range(10):
        if not hasattr(func, "__wrapped__"):
            break
        func = func.__wrapped__
    return func


def _mock_user_doc(user_data):
    """Return a Firestore-like doc mock."""
    doc = MagicMock(exists=True)
    doc.to_dict.return_value = user_data
    doc.id = TEST_USER_ID
    return doc


def _mock_db_with_user(user_data=None):
    """Return a mock db that returns a real user doc for the users collection."""
    if user_data is None:
        user_data = {"email": "test@example.com", "name": "Test", "created_at": "2025-01-01"}
    mock = MagicMock()
    user_doc = _mock_user_doc(user_data)

    def _collection(name):
        coll = MagicMock()
        doc_ref = MagicMock()
        doc_ref.id = TEST_USER_ID
        doc_ref.get.return_value = user_doc
        doc_ref.update.return_value = None
        doc_ref.set.return_value = None
        doc_ref.delete.return_value = None
        sub_coll = MagicMock()
        sub_coll.limit.return_value = sub_coll
        sub_coll.stream.return_value = []
        doc_ref.collection.return_value = sub_coll
        coll.document.return_value = doc_ref
        coll.where.return_value = coll
        coll.limit.return_value = coll
        coll.get.return_value = []
        coll.stream.return_value = []
        return coll

    mock.collection = MagicMock(side_effect=_collection)
    mock.transaction = MagicMock(side_effect=lambda: lambda fn: fn())
    return mock


class TestAuthRoutesOptions:
    """Cover every 'if request.method == OPTIONS: return _preflight_response()' line."""

    @pytest.fixture(autouse=True)
    def setup(self, app):
        self.app = app

    @pytest.mark.parametrize(
        "endpoint,args",
        [
            ("register_user", (None,)),
            ("login_user", (None,)),
            ("verify_2fa", ()),
            ("setup_2fa_biometric", ()),
            ("google_login", (None,)),
            ("logout", ()),
            ("reset_password", (None,)),
            ("confirm_password_reset", (None,)),
            ("update_consent", (None,)),
            ("get_consent", (TEST_USER_ID,)),
            ("refresh_token", ()),
            ("change_email", ()),
            ("change_password", (None,)),
            ("setup_2fa", ()),
            ("verify_2fa_setup", ()),
            ("export_user_data", ()),
            ("delete_account", (TEST_USER_ID,)),
        ],
    )
    def test_options_preflight(self, endpoint, args):
        view = getattr(auth_routes_module, endpoint)
        original = _unwrap(view)
        with self.app.test_request_context(
            f"/api/v1/auth/{endpoint.replace('_', '-')}",
            method="OPTIONS",
        ):
            response = original(*args)
        # APIResponse returns a tuple (json, status) by default
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 204


class TestAuthRoutesOuterExceptions:
    """Trigger the outer 'except' blocks by missing g.user_id or raising early."""

    @pytest.fixture(autouse=True)
    def setup(self, app):
        self.app = app

    @pytest.mark.parametrize(
        "endpoint,args,method",
        [
            ("verify_2fa", (), "POST"),
            ("setup_2fa_biometric", (), "POST"),
            ("setup_2fa", (), "POST"),
            ("verify_2fa_setup", (), "POST"),
            ("logout", (), "POST"),
            ("change_email", (), "POST"),
            ("change_password", (None,), "POST"),
            ("update_consent", (None,), "POST"),
            ("get_consent", (TEST_USER_ID,), "GET"),
            ("export_user_data", (), "GET"),
            ("delete_account", (TEST_USER_ID,), "DELETE"),
        ],
    )
    def test_missing_g_user_id(self, endpoint, args, method):
        """g.user_id missing -> AttributeError -> outer except returns 500."""
        view = getattr(auth_routes_module, endpoint)
        original = _unwrap(view)
        with self.app.test_request_context(
            f"/api/v1/auth/{endpoint.replace('_', '-')}",
            method=method,
            data=json.dumps({"code": "123456"}),
            content_type="application/json",
        ):
            response = original(*args)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_register_outer_exception(self):
        original = _unwrap(auth_routes_module.register_user)
        with self.app.test_request_context(
            "/api/v1/auth/register", method="POST", data="{}", content_type="application/json"
        ):
            response = original(None)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_login_outer_exception(self):
        original = _unwrap(auth_routes_module.login_user)
        with self.app.test_request_context(
            "/api/v1/auth/login", method="POST", data="{}", content_type="application/json"
        ):
            response = original(None)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_google_login_outer_exception(self):
        """Raise inside response-building so the outer except at 663-665 is hit."""
        original = _unwrap(auth_routes_module.google_login)
        validated = MagicMock(id_token="tok")
        with self.app.test_request_context(
            "/api/v1/auth/google-login", method="POST", data=json.dumps({"id_token": "tok"}), content_type="application/json"
        ):
            with patch("src.routes.auth_routes.create_or_update_google_user_simple", return_value=({}, TEST_USER_ID, True)):
                with patch("src.routes.auth_routes.AuthService.issue_session_tokens", side_effect=Exception("boom")):
                    response = original(validated)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_reset_password_outer_exception(self):
        original = _unwrap(auth_routes_module.reset_password)
        with self.app.test_request_context(
            "/api/v1/auth/reset-password", method="POST", data="{}", content_type="application/json"
        ):
            response = original(None)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_confirm_password_reset_outer_exception(self):
        original = _unwrap(auth_routes_module.confirm_password_reset)
        with self.app.test_request_context(
            "/api/v1/auth/confirm-password-reset", method="POST", data="{}", content_type="application/json"
        ):
            response = original(None)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500


class TestAuthRoutesRemainingBranches:
    """Cover the remaining 50 uncovered statements in auth_routes.py."""

    @pytest.fixture(autouse=True)
    def setup(self, app):
        self.app = app

    def test_auth_routes_import_fallback(self):
        """Lines 43-44: except ImportError fallback for config.settings."""
        with patch.dict("sys.modules", {"src.config.settings": None}):
            importlib.reload(auth_routes_module)
        assert isinstance(auth_routes_module.FIREBASE_WEB_API_KEY, str)

    def test_create_or_update_google_user_existing(self):
        """Lines 536-551: existing google_id mapping returns user data."""
        original = auth_routes_module.create_or_update_google_user_simple
        user_data = {"email": "g@g.com", "name": "G"}
        user_doc = MagicMock(exists=False)
        email_doc = MagicMock(exists=False)
        google_doc = MagicMock(exists=True)
        google_doc.to_dict.return_value = {"uid": TEST_USER_ID}
        existing_doc = MagicMock(exists=True)
        existing_doc.to_dict.return_value = user_data

        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.side_effect = [
            user_doc, email_doc, google_doc, existing_doc
        ]
        with self.app.test_request_context():
            with patch("src.firebase_config.db", mock_db):
                result = original("fbuid123", "g@g.com", "gid123", "G")
        assert result == (user_data, TEST_USER_ID, False)

    def test_google_login_validated_data_none(self):
        """Line 583: google_login returns bad_request when validated_data is None."""
        original = _unwrap(auth_routes_module.google_login)
        with self.app.test_request_context(
            "/api/v1/auth/google-login", method="POST", data="{}", content_type="application/json"
        ):
            response = original(None)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400

    def test_verify_2fa_totp_not_configured(self):
        """Line 370: TOTP not configured for this account."""
        original = _unwrap(auth_routes_module.verify_2fa)
        mock_db = _mock_db_with_user({"email": "t@t.com"})
        with self.app.test_request_context(
            "/api/v1/auth/verify-2fa", method="POST",
            data=json.dumps({"method": "totp", "code": "123456"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400

    def test_get_consent_invalid_user_id(self):
        """Line 868: get_consent returns bad_request for invalid user_id."""
        original = _unwrap(auth_routes_module.get_consent)
        with self.app.test_request_context(
            "/api/v1/auth/consent/bad", method="GET"
        ):
            g.user_id = TEST_USER_ID
            response = original("bad")
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400

    def test_refresh_token_missing_cookie(self):
        """Line 921: refresh_token returns 401 when no refresh cookie is present."""
        original = _unwrap(auth_routes_module.refresh_token)
        with self.app.test_request_context(
            "/api/v1/auth/refresh", method="POST"
        ):
            g.user_id = TEST_USER_ID
            response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 401

    def test_change_email_invalid_email(self):
        """Line 970: change_email returns bad_request for missing email/password."""
        original = _unwrap(auth_routes_module.change_email)
        with self.app.test_request_context(
            "/api/v1/auth/change-email", method="POST",
            data=json.dumps({"newEmail": "", "password": ""}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400

    def test_setup_2fa_totp_full_success(self):
        """Lines 1151-1153: setup_2fa TOTP success path."""
        original = _unwrap(auth_routes_module.setup_2fa)
        mock_db = _mock_db_with_user({"email": "t@t.com", "name": "T"})
        pyotp_mock = MagicMock()
        pyotp_mock.random_base32.return_value = "JBSWY3DPEHPK3PXP"
        totp_mock = MagicMock()
        totp_mock.provisioning_uri.return_value = "otpauth://test"
        pyotp_mock.TOTP.return_value = totp_mock
        qrcode_mock = MagicMock()
        qr = MagicMock()
        img = MagicMock()
        img.save = MagicMock()
        qr.make_image.return_value = img
        qrcode_mock.QRCode.return_value = qr
        with self.app.test_request_context(
            "/api/v1/auth/setup-2fa", method="POST",
            data=json.dumps({"method": "totp"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                with patch.dict("sys.modules", {"pyotp": pyotp_mock, "qrcode": qrcode_mock}):
                    with patch.dict("os.environ", {"HIPAA_ENCRYPTION_KEY": "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE="}):
                        response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 200

    def test_setup_2fa_import_error(self):
        """Lines 1161-1162: setup_2fa ImportError when pyotp is unavailable."""
        original = _unwrap(auth_routes_module.setup_2fa)
        mock_db = _mock_db_with_user({"email": "t@t.com", "name": "T"})
        with self.app.test_request_context(
            "/api/v1/auth/setup-2fa", method="POST",
            data=json.dumps({"method": "totp"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                with patch.dict("sys.modules", {"pyotp": None}):
                    response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 503

    def test_setup_2fa_outer_exception(self):
        """Lines 1167-1169: setup_2fa outer exception."""
        original = _unwrap(auth_routes_module.setup_2fa)
        with self.app.test_request_context(
            "/api/v1/auth/setup-2fa", method="POST",
            data=json.dumps({"method": "totp"}), content_type="application/json"
        ):
            response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_verify_2fa_setup_missing_code(self):
        """Line 1184: verify_2fa_setup returns bad_request when code is missing."""
        original = _unwrap(auth_routes_module.verify_2fa_setup)
        with self.app.test_request_context(
            "/api/v1/auth/verify-2fa-setup", method="POST",
            data=json.dumps({"code": ""}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400

    def test_verify_2fa_setup_invalid_code_format(self):
        """Line 1189: verify_2fa_setup returns bad_request for non 6-digit code."""
        original = _unwrap(auth_routes_module.verify_2fa_setup)
        with self.app.test_request_context(
            "/api/v1/auth/verify-2fa-setup", method="POST",
            data=json.dumps({"code": "abcd"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400

    def test_verify_2fa_setup_success(self):
        """Lines 1233-1249: verify_2fa_setup success path."""
        original = _unwrap(auth_routes_module.verify_2fa_setup)
        recent = datetime.now(UTC).isoformat()
        mock_db = _mock_db_with_user({
            "email": "t@t.com",
            "temp_2fa_secret": "JBSWY3DPEHPK3PXP",
            "temp_2fa_method": "totp",
            "temp_2fa_created_at": recent,
        })
        pyotp_mock = MagicMock()
        pyotp_mock.TOTP.return_value.verify.return_value = True
        with self.app.test_request_context(
            "/api/v1/auth/verify-2fa-setup", method="POST",
            data=json.dumps({"code": "123456"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                with patch.dict("sys.modules", {"pyotp": pyotp_mock}):
                    with patch.dict("os.environ", {"HIPAA_ENCRYPTION_KEY": "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE="}):
                        response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 200

    def test_verify_2fa_setup_import_error(self):
        """Lines 1251-1252: verify_2fa_setup ImportError when pyotp unavailable."""
        original = _unwrap(auth_routes_module.verify_2fa_setup)
        recent = datetime.now(UTC).isoformat()
        mock_db = _mock_db_with_user({
            "email": "t@t.com",
            "temp_2fa_secret": "JBSWY3DPEHPK3PXP",
            "temp_2fa_method": "totp",
            "temp_2fa_created_at": recent,
        })
        with self.app.test_request_context(
            "/api/v1/auth/verify-2fa-setup", method="POST",
            data=json.dumps({"code": "123456"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                with patch.dict("sys.modules", {"pyotp": None}):
                    response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 503

    def test_verify_2fa_setup_inner_exception(self):
        """Lines 1253-1255: verify_2fa_setup inner exception."""
        original = _unwrap(auth_routes_module.verify_2fa_setup)
        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.side_effect = Exception("db fail")
        with self.app.test_request_context(
            "/api/v1/auth/verify-2fa-setup", method="POST",
            data=json.dumps({"code": "123456"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_export_user_data_with_subcollections(self):
        """Lines 1302-1304, 1311-1313, 1320-1322, 1329-1331, 1338-1340: subcollection loops."""
        original = _unwrap(auth_routes_module.export_user_data)
        user_doc = _mock_user_doc({"email": "t@t.com", "name": "T"})

        def _collection(name):
            coll = MagicMock()
            doc_ref = MagicMock()
            doc_ref.get.return_value = user_doc
            doc_ref.update.return_value = None
            doc_ref.set.return_value = None
            sub_doc = MagicMock()
            sub_doc.id = "doc1"
            sub_doc.to_dict.return_value = {"x": 1}
            sub_coll = MagicMock()
            sub_coll.limit.return_value = sub_coll
            sub_coll.stream.return_value = [sub_doc]
            doc_ref.collection.return_value = sub_coll
            coll.document.return_value = doc_ref
            coll.where.return_value = coll
            coll.limit.return_value = coll
            coll.get.return_value = []
            coll.stream.return_value = []
            return coll

        mock_db = MagicMock()
        mock_db.collection = MagicMock(side_effect=_collection)
        with self.app.test_request_context(
            "/api/v1/auth/export-data", method="GET"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                response = original()
        status = response.status_code if hasattr(response, "status_code") else response[1]
        assert status == 200

    def test_delete_account_invalid_user_id(self):
        """Line 1372: delete_account returns bad_request for invalid user_id."""
        original = _unwrap(auth_routes_module.delete_account)
        with self.app.test_request_context(
            "/api/v1/auth/delete-account/bad", method="DELETE"
        ):
            g.user_id = TEST_USER_ID
            response = original("bad")
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400

    def test_delete_account_outer_exception(self):
        """Lines 1460-1462: delete_account outer exception."""
        original = _unwrap(auth_routes_module.delete_account)
        with self.app.test_request_context(
            "/api/v1/auth/delete-account/testuser1234567890ab", method="DELETE"
        ):
            response = original(TEST_USER_ID)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 500

    def test_delete_account_anonymization_exception(self):
        """Lines 1440-1441: delete_account catches exception during anonymization."""
        original = _unwrap(auth_routes_module.delete_account)

        user_doc = _mock_user_doc({"email": "t@t.com"})
        update_calls = {"count": 0}

        def _update_side_effect(*args, **kwargs):
            update_calls["count"] += 1
            if update_calls["count"] == 2:
                raise Exception("anonymization failed")

        def _collection(name):
            coll = MagicMock()
            doc_ref = MagicMock()
            doc_ref.get.return_value = user_doc
            doc_ref.update.side_effect = _update_side_effect
            doc_ref.set.return_value = None
            doc_ref.delete.return_value = None
            sub_coll = MagicMock()
            sub_coll.limit.return_value = sub_coll
            sub_coll.stream.return_value = []
            doc_ref.collection.return_value = sub_coll
            coll.document.return_value = doc_ref
            coll.where.return_value = coll
            coll.limit.return_value = coll
            coll.get.return_value = []
            coll.stream.return_value = []
            return coll

        mock_db = MagicMock()
        mock_db.collection.side_effect = _collection
        mock_user = MagicMock()
        mock_user.email = "t@t.com"

        with self.app.test_request_context(
            "/api/v1/auth/delete-account/testuser1234567890ab", method="DELETE",
            data=json.dumps({"password": "Pass"}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            with patch("src.firebase_config.db", mock_db):
                with patch("src.routes.auth_routes.AuthService.verify_user_identity", return_value=(mock_user, None)):
                    with patch("src.routes.auth_routes._verify_current_password", return_value=True):
                        with patch("firebase_admin.auth.update_user"):
                            response = original(TEST_USER_ID)
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 200

    def test_verify_2fa_setup_empty_data(self):
        """Line 1184: verify_2fa_setup returns bad_request when data is empty."""
        original = _unwrap(auth_routes_module.verify_2fa_setup)
        with self.app.test_request_context(
            "/api/v1/auth/verify-2fa-setup", method="POST",
            data=json.dumps({}), content_type="application/json"
        ):
            g.user_id = TEST_USER_ID
            response = original()
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 400
