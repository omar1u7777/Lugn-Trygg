import logging
from flask import Blueprint, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_babel import gettext as _
from src.services.integration_service import IntegrationService
from src.services.auth_service import AuthService

# Initialize limiter for this module
limiter = Limiter(key_func=get_remote_address, default_limits=["100 per hour"])

# Create Blueprint
integration_bp = Blueprint("integration", __name__)
logger = logging.getLogger(__name__)

# Helper function for JSON response
def json_response(data, status=200):
    """Return JSON with correct UTF-8 encoding"""
    return jsonify(data), status, {"Content-Type": "application/json; charset=utf-8"}

# Wearable Data Synchronization Routes

@integration_bp.route("/wearable/google-fit/sync", methods=["POST"])
@AuthService.jwt_required
@limiter.limit("10 per hour")
def sync_google_fit():
    """Sync data from Google Fit"""
    try:
        user_id = request.user_id
        data = request.get_json(force=True, silent=True) or {}
        access_token = data.get("access_token", "").strip()

        if not access_token:
            return json_response({"error": _("access_token_required")}, 400)

        result = IntegrationService.sync_google_fit_data(user_id, access_token)

        if "error" in result:
            return json_response({"error": result["error"]}, 500)

        return json_response(result, 200)

    except Exception as e:
        logger.exception(f"Error syncing Google Fit: {str(e)}")
        return json_response({"error": _("sync_failed")}, 500)

@integration_bp.route("/wearable/apple-health/sync", methods=["POST"])
@AuthService.jwt_required
@limiter.limit("10 per hour")
def sync_apple_healthkit():
    """Sync data from Apple HealthKit"""
    try:
        user_id = request.user_id
        data = request.get_json(force=True, silent=True) or {}
        health_data = data.get("health_data", [])

        if not health_data:
            return json_response({"error": _("health_data_required")}, 400)

        result = IntegrationService.sync_apple_healthkit_data(user_id, health_data)

        if "error" in result:
            return json_response({"error": result["error"]}, 500)

        return json_response(result, 200)

    except Exception as e:
        logger.exception(f"Error syncing Apple HealthKit: {str(e)}")
        return json_response({"error": _("sync_failed")}, 500)

@integration_bp.route("/wearable/data", methods=["GET"])
@AuthService.jwt_required
@limiter.limit("30 per hour")
def get_wearable_data():
    """Get stored wearable data"""
    try:
        user_id = request.user_id

        result = IntegrationService.get_wearable_data(user_id)

        if "error" in result:
            return json_response({"error": result["error"]}, 500)

        return json_response(result, 200)

    except Exception as e:
        logger.exception(f"Error getting wearable data: {str(e)}")
        return json_response({"error": _("data_retrieval_failed")}, 500)

# Crisis Intervention Routes

@integration_bp.route("/crisis/referral", methods=["POST"])
@AuthService.jwt_required
@limiter.limit("5 per hour")
def create_crisis_referral():
    """Create crisis intervention referral"""
    try:
        user_id = request.user_id
        data = request.get_json(force=True, silent=True) or {}

        required_fields = ["crisis_type", "description"]
        for field in required_fields:
            if field not in data:
                return json_response({"error": _(f"{field}_required")}, 400)

        result = IntegrationService.create_crisis_referral(user_id, data)

        if "error" in result:
            return json_response({"error": result["error"]}, 500)

        return json_response(result, 201)

    except Exception as e:
        logger.exception(f"Error creating crisis referral: {str(e)}")
        return json_response({"error": _("referral_creation_failed")}, 500)

# FHIR Integration Routes

@integration_bp.route("/fhir/patient", methods=["GET"])
@AuthService.jwt_required
@limiter.limit("30 per hour")
def get_fhir_patient():
    """Get FHIR Patient resource"""
    try:
        user_id = request.user_id

        result = IntegrationService.get_fhir_patient(user_id)

        if "error" in result:
            return json_response({"error": result["error"]}, 500)

        return json_response(result, 200)

    except Exception as e:
        logger.exception(f"Error getting FHIR patient: {str(e)}")
        return json_response({"error": _("patient_retrieval_failed")}, 500)

@integration_bp.route("/fhir/observation", methods=["POST"])
@AuthService.jwt_required
@limiter.limit("20 per hour")
def create_fhir_observation():
    """Create FHIR Observation resource"""
    try:
        user_id = request.user_id
        data = request.get_json(force=True, silent=True) or {}

        required_fields = ["value"]
        for field in required_fields:
            if field not in data:
                return json_response({"error": _(f"{field}_required")}, 400)

        result = IntegrationService.create_fhir_observation(user_id, data)

        if "error" in result:
            return json_response({"error": result["error"]}, 500)

        return json_response(result, 201)

    except Exception as e:
        logger.exception(f"Error creating FHIR observation: {str(e)}")
        return json_response({"error": _("observation_creation_failed")}, 500)