"""
Tests for response_utils.py
Covers: APIResponse static methods, convenience functions.
"""
import pytest
from flask import Flask


@pytest.fixture
def resp_app():
    """Minimal Flask app for testing jsonify context."""
    app = Flask(__name__)
    app.config["TESTING"] = True
    return app


class TestAPIResponse:
    """Tests for APIResponse class."""

    def test_success(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.success({"key": "value"}, "OK")
            assert status == 200
            data = response.get_json()
            assert data["success"] is True
            assert data["message"] == "OK"
            assert data["data"]["key"] == "value"

    def test_success_custom_status(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.success({}, "Created", status_code=201)
            assert status == 201

    def test_success_with_meta(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.success({}, "OK", meta={"page": 1})
            data = response.get_json()
            assert data.get("meta", {}).get("page") == 1

    def test_error(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.error("Something failed", "SERVER_ERROR", 500)
            assert status == 500
            data = response.get_json()
            assert data["success"] is False
            assert "SERVER_ERROR" in str(data.get("error", ""))

    def test_error_with_details(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.error("Bad", "BAD_REQUEST", 400, details={"field": "name"})
            data = response.get_json()
            assert status == 400

    def test_created(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.created({"id": "123"}, "Created")
            assert status == 201

    def test_bad_request(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.bad_request("Missing field")
            assert status == 400

    def test_unauthorized(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.unauthorized("Not authenticated")
            assert status == 401

    def test_forbidden(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.forbidden("No access")
            assert status == 403

    def test_not_found(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.not_found("Resource missing")
            assert status == 404

    def test_conflict(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.conflict("Already exists")
            assert status == 409

    def test_no_content(self, resp_app):
        from src.utils.response_utils import APIResponse
        with resp_app.app_context():
            response, status = APIResponse.no_content()
            assert status == 204
