"""
Crisis Intervention Routes
Provides API endpoints for mental health crisis detection and intervention
"""

import logging
from datetime import UTC, datetime

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.crisis_intervention import crisis_intervention_service
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

crisis_bp = Blueprint('crisis', __name__)
logger = logging.getLogger(__name__)


@crisis_bp.route('/assess', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def assess_crisis_risk():
    """
    Assess user's crisis risk based on comprehensive data
    POST /api/crisis/assess
    Body: {
        "mood_history": [...],
        "recent_text_content": "...",
        "behavioral_data": {...},
        "context": {...}
    }
    """
    try:
        user_id = g.user_id
        data = request.get_json(silent=True) or {}

        # Build user context from request data
        user_context = {
            'user_id': user_id,
            'mood_history': data.get('mood_history', []),
            'recent_text_content': data.get('recent_text_content', ''),
            'days_without_social_interaction': data.get('days_without_social_interaction', 0),
            'social_activity_trend': data.get('social_activity_trend', 1.0),
            'avoidance_patterns': data.get('avoidance_patterns', []),
            'insomnia_nights_last_week': data.get('insomnia_nights_last_week', 0),
            'sleep_duration_change_percent': data.get('sleep_duration_change_percent', 0),
            'mood_score_drop_last_week': data.get('mood_score_drop_last_week', 0),
            'consecutive_low_mood_days': data.get('consecutive_low_mood_days', 0),
            'current_anxiety_score': data.get('current_anxiety_score', 0),
            'mood_decline_points_per_day': data.get('mood_decline_points_per_day', 0),
            'recent_data_days': data.get('recent_data_days', 0),
            'mood_patterns': data.get('mood_patterns', {}),
            'effective_coping_strategies': data.get('effective_coping_strategies', []),
            'emergency_contacts': data.get('emergency_contacts', [])
        }

        # Perform crisis assessment
        assessment = crisis_intervention_service.assess_crisis_risk(user_context)

        # Save assessment to Firestore
        assessment_data = {
            'user_id': user_id,
            'risk_level': assessment.overall_risk_level,
            'risk_score': assessment.risk_score,
            'active_indicators': [
                {
                    'id': ind.indicator_id,
                    'name': ind.name,
                    'category': ind.category,
                    'severity': ind.severity_level,
                    'description': ind.swedish_description
                }
                for ind in assessment.active_indicators
            ],
            'intervention_recommendations': assessment.intervention_recommendations,
            'confidence_score': assessment.confidence_score,
            'risk_trends': assessment.risk_trends,
            'assessment_timestamp': assessment.assessment_timestamp.isoformat(),
            'created_at': datetime.now(UTC)
        }

        db.collection('crisis_assessments').document(user_id).set(assessment_data)  # type: ignore

        # Audit log
        audit_log(
            'CRISIS_ASSESSMENT',
            user_id,
            {
                'risk_level': assessment.overall_risk_level,
                'risk_score': assessment.risk_score,
                'indicators_count': len(assessment.active_indicators)
            }
        )

        # Escalate critical situations — notify care team + persist alert
        if assessment.overall_risk_level in ['critical', 'high']:
            logger.warning(
                f"⚠️ CRITICAL: High crisis risk detected for user {user_id[:8]}... "
                f"Risk level: {assessment.overall_risk_level}, Score: {assessment.risk_score:.2f}"
            )
            _escalate_crisis(user_id, assessment)

        # Build response
        response_data = {
            'risk_level': assessment.overall_risk_level,
            'risk_score': assessment.risk_score,
            'confidence_score': assessment.confidence_score,
            'active_indicators': [
                {
                    'id': ind.indicator_id,
                    'name': ind.name,
                    'category': ind.category,
                    'severity': ind.severity_level,
                    'description': ind.swedish_description,
                    'risk_weight': ind.risk_weight
                }
                for ind in assessment.active_indicators
            ],
            'intervention_recommendations': assessment.intervention_recommendations[:5],  # Top 5
            'risk_trends': assessment.risk_trends,
            'assessment_timestamp': assessment.assessment_timestamp.isoformat(),
            'needs_immediate_attention': assessment.overall_risk_level in ['critical', 'high']
        }

        logger.info(f"📊 Crisis assessment completed for user {user_id[:8]}... Risk: {assessment.overall_risk_level}")

        return APIResponse.success(response_data, "Crisis assessment completed")

    except Exception as e:
        logger.exception(f"Error assessing crisis risk: {e}")
        return APIResponse.error("Could not assess crisis risk", "ASSESSMENT_ERROR", 500)


@crisis_bp.route('/safety-plan', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_safety_plan():
    """
    Get user's personalized safety plan
    GET /api/crisis/safety-plan
    """
    try:
        user_id = g.user_id

        # Get user data for safety plan generation
        user_doc = db.collection('users').document(user_id).get()  # type: ignore
        if not user_doc.exists:
            return APIResponse.error("User not found", "USER_NOT_FOUND", 404)

        user_data = user_doc.to_dict()

        # Get recent mood data
        mood_query = db.collection('moods')\
            .where('userId', '==', user_id)\
            .order_by('timestamp', direction='DESCENDING')\
            .limit(30)  # type: ignore

        [doc.to_dict() for doc in mood_query.stream()]

        # Build context for safety plan
        user_context = {
            'user_id': user_id,
            'mood_patterns': {'common_triggers': []},  # Would extract from mood data
            'effective_coping_strategies': user_data.get('preferred_coping_strategies', []),
            'emergency_contacts': user_data.get('emergency_contacts', [])
        }

        # Generate safety plan
        safety_plan = crisis_intervention_service.generate_safety_plan(user_context)

        # Save to Firestore
        db.collection('safety_plans').document(user_id).set(safety_plan)  # type: ignore

        logger.info(f"🛡️ Safety plan generated for user {user_id[:8]}...")

        return APIResponse.success(safety_plan, "Safety plan retrieved")

    except Exception as e:
        logger.exception(f"Error generating safety plan: {e}")
        return APIResponse.error("Could not generate safety plan", "SAFETY_PLAN_ERROR", 500)


@crisis_bp.route('/safety-plan', methods=['PUT'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_safety_plan():
    """
    Update user's safety plan
    PUT /api/crisis/safety-plan
    Body: {
        "warning_signs": [...],
        "coping_strategies": [...],
        "support_contacts": [...],
        "professional_help": [...],
        "environmental_safety": [...]
    }
    """
    try:
        user_id = g.user_id
        data = request.get_json(silent=True) or {}

        safety_plan = {
            'warning_signs': data.get('warning_signs', []),
            'coping_strategies': data.get('coping_strategies', []),
            'support_contacts': data.get('support_contacts', []),
            'professional_help': data.get('professional_help', []),
            'environmental_safety': data.get('environmental_safety', []),
            'updated_date': datetime.now(UTC).isoformat(),
            'user_id': user_id
        }

        db.collection('safety_plans').document(user_id).set(safety_plan)  # type: ignore

        audit_log('SAFETY_PLAN_UPDATED', user_id, {'sections': list(safety_plan.keys())})

        logger.info(f"✅ Safety plan updated for user {user_id[:8]}...")

        return APIResponse.success(safety_plan, "Safety plan updated")

    except Exception as e:
        logger.exception(f"Error updating safety plan: {e}")
        return APIResponse.error("Could not update safety plan", "UPDATE_ERROR", 500)


@crisis_bp.route('/protocols/<risk_level>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_intervention_protocol(risk_level: str):
    """
    Get intervention protocol for specific risk level
    GET /api/crisis/protocols/<risk_level>
    risk_level: low, medium, high, critical
    """
    try:
        user_id = g.user_id

        valid_levels = ['low', 'medium', 'high', 'critical']
        if risk_level not in valid_levels:
            return APIResponse.bad_request(
                f"Invalid risk level. Must be one of: {', '.join(valid_levels)}",
                "INVALID_RISK_LEVEL"
            )

        protocol = crisis_intervention_service.get_emergency_protocol(risk_level)

        if not protocol:
            return APIResponse.error("Protocol not found", "PROTOCOL_NOT_FOUND", 404)

        protocol_data = {
            'protocol_id': protocol.protocol_id,
            'name': protocol.name,
            'risk_level': protocol.risk_level,
            'immediate_actions': protocol.immediate_actions,
            'support_resources': protocol.support_resources,
            'follow_up_steps': protocol.follow_up_steps,
            'escalation_criteria': protocol.escalation_criteria,
            'swedish_guidance': protocol.swedish_guidance
        }

        logger.info(f"📋 Protocol retrieved for {risk_level} risk level by user {user_id[:8]}...")

        return APIResponse.success(protocol_data, f"Protocol for {risk_level} risk level")

    except Exception as e:
        logger.exception(f"Error retrieving protocol: {e}")
        return APIResponse.error("Could not retrieve protocol", "PROTOCOL_ERROR", 500)


@crisis_bp.route('/history', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_assessment_history():
    """
    Get user's crisis assessment history
    GET /api/crisis/history?limit=10
    """
    try:
        user_id = g.user_id
        limit = int(request.args.get('limit', 10))

        # Get recent assessments
        assessments_query = db.collection('crisis_assessments')\
            .where('user_id', '==', user_id)\
            .order_by('assessment_timestamp', direction='DESCENDING')\
            .limit(min(limit, 50))  # type: ignore

        assessments = [doc.to_dict() for doc in assessments_query.stream()]

        # Format response
        history = {
            'assessments': assessments,
            'total_count': len(assessments),
            'latest_assessment': assessments[0] if assessments else None,
            'risk_trend': 'stable'  # Would calculate from historical data
        }

        logger.info(f"📜 Assessment history retrieved for user {user_id[:8]}... Count: {len(assessments)}")

        return APIResponse.success(history, "Assessment history retrieved")

    except Exception as e:
        logger.exception(f"Error retrieving assessment history: {e}")
        return APIResponse.error("Could not retrieve history", "HISTORY_ERROR", 500)


@crisis_bp.route('/indicators', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_crisis_indicators():
    """
    Get all available crisis indicators information
    GET /api/crisis/indicators
    """
    try:
        user_id = g.user_id

        indicators = []
        for indicator in crisis_intervention_service.crisis_indicators.values():
            indicators.append({
                'id': indicator.indicator_id,
                'name': indicator.name,
                'category': indicator.category,
                'severity_level': indicator.severity_level,
                'description': indicator.swedish_description,
                'risk_weight': indicator.risk_weight,
                'intervention_triggers': indicator.intervention_triggers
            })

        # Group by category
        grouped = {
            'behavioral': [],
            'emotional': [],
            'cognitive': [],
            'physical': []
        }

        for ind in indicators:
            category = ind['category']
            if category in grouped:
                grouped[category].append(ind)

        response_data = {
            'indicators': indicators,
            'grouped_by_category': grouped,
            'total_count': len(indicators)
        }

        logger.info(f"📊 Crisis indicators retrieved by user {user_id[:8]}...")

        return APIResponse.success(response_data, "Crisis indicators retrieved")

    except Exception as e:
        logger.exception(f"Error retrieving indicators: {e}")
        return APIResponse.error("Could not retrieve indicators", "INDICATORS_ERROR", 500)


@crisis_bp.route('/check-escalation', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def check_escalation():
    """
    Check if crisis situation requires escalation
    POST /api/crisis/check-escalation
    Body: {
        "previous_assessment_id": "...",
        "current_context": {...}
    }
    """
    try:
        user_id = g.user_id
        data = request.get_json(silent=True) or {}

        # Get previous assessment
        prev_assessment_doc = db.collection('crisis_assessments').document(user_id).get()  # type: ignore
        if not prev_assessment_doc.exists:
            return APIResponse.error("No previous assessment found", "NO_ASSESSMENT", 404)

        prev_data = prev_assessment_doc.to_dict()

        # Recreate assessment object (simplified)
        from src.services.crisis_intervention import CrisisAssessment

        active_indicators = []
        for ind_data in prev_data.get('active_indicators', []):
            indicator = crisis_intervention_service.crisis_indicators.get(ind_data['id'])
            if indicator:
                active_indicators.append(indicator)

        prev_assessment = CrisisAssessment(
            user_id=user_id,
            overall_risk_level=prev_data['risk_level'],
            risk_score=prev_data['risk_score'],
            active_indicators=active_indicators,
            risk_trends=prev_data.get('risk_trends', {}),
            intervention_recommendations=prev_data.get('intervention_recommendations', []),
            assessment_timestamp=datetime.fromisoformat(prev_data['assessment_timestamp']),
            confidence_score=prev_data.get('confidence_score', 0.5)
        )

        # Check escalation
        new_context = data.get('current_context', {})
        new_context['user_id'] = user_id

        should_escalate = crisis_intervention_service.should_escalate_crisis(
            prev_assessment,
            new_context
        )

        response_data = {
            'should_escalate': should_escalate,
            'previous_risk_level': prev_assessment.overall_risk_level,
            'previous_risk_score': prev_assessment.risk_score,
            'days_since_assessment': (datetime.now(UTC) - prev_assessment.assessment_timestamp).days,
            'recommendation': 'Seek immediate professional help' if should_escalate else 'Continue monitoring'
        }

        if should_escalate:
            logger.warning(f"⚠️ ESCALATION NEEDED for user {user_id[:8]}...")
            audit_log('CRISIS_ESCALATION_NEEDED', user_id, response_data)

        return APIResponse.success(response_data, "Escalation check completed")

    except Exception as e:
        logger.exception(f"Error checking escalation: {e}")
        return APIResponse.error("Could not check escalation", "ESCALATION_ERROR", 500)


def _escalate_crisis(user_id: str, assessment) -> None:
    """
    Escalate a critical/high-risk crisis detection.
    Persists an alert document and notifies the care team via email.
    """
    try:
        import os
        alert_doc = {
            'user_id': user_id,
            'risk_level': assessment.overall_risk_level,
            'risk_score': assessment.risk_score,
            'active_indicators': [ind.indicator_id for ind in assessment.active_indicators],
            'status': 'pending',
            'created_at': datetime.now(UTC),
            'resolved_at': None,
            'resolved_by': None,
        }
        db.collection('crisis_alerts').add(alert_doc)
        logger.info(f"Crisis alert persisted for user {user_id[:8]}...")

        # Notify care team via email (SendGrid / SMTP)
        care_email = os.environ.get('CARE_TEAM_EMAIL')
        if care_email:
            _send_escalation_email(care_email, user_id, assessment)

        # Notify user's emergency contacts if available
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists:
            user_data = user_doc.to_dict() or {}
            emergency_contacts = user_data.get('emergency_contacts', [])
            for contact in emergency_contacts:
                contact_email = contact.get('email')
                if contact_email:
                    _send_emergency_contact_notification(contact_email, contact.get('name', ''))

    except Exception as e:
        logger.error(f"Failed to escalate crisis for user {user_id[:8]}...: {e}")


def _send_escalation_email(care_email: str, user_id: str, assessment) -> None:
    """Send crisis escalation email to care team."""
    try:
        import os
        import smtplib
        from email.mime.text import MIMEText

        smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        smtp_user = os.environ.get('SMTP_USER', '')
        smtp_pass = os.environ.get('SMTP_PASSWORD', '')
        from_email = os.environ.get('FROM_EMAIL', smtp_user)

        if not smtp_user or not smtp_pass:
            logger.warning("SMTP credentials not configured — skipping escalation email")
            return

        subject = f"🚨 Krisvarning — Risknivå: {assessment.overall_risk_level}"
        body = (
            f"En användare har triggat en krisvarning.\n\n"
            f"Användar-ID: {user_id[:8]}...\n"
            f"Risknivå: {assessment.overall_risk_level}\n"
            f"Riskpoäng: {assessment.risk_score:.2f}\n"
            f"Aktiva indikatorer: {len(assessment.active_indicators)}\n\n"
            f"Logga in på adminpanelen för att granska ärendet."
        )

        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = care_email

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, [care_email], msg.as_string())

        logger.info(f"Escalation email sent to {care_email}")

    except Exception as e:
        logger.error(f"Failed to send escalation email: {e}")


def _send_emergency_contact_notification(email: str, name: str) -> None:
    """Notify an emergency contact that their person may need support."""
    try:
        import os
        import smtplib
        from email.mime.text import MIMEText

        smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        smtp_user = os.environ.get('SMTP_USER', '')
        smtp_pass = os.environ.get('SMTP_PASSWORD', '')
        from_email = os.environ.get('FROM_EMAIL', smtp_user)

        if not smtp_user or not smtp_pass:
            return

        subject = "Lugn & Trygg — Din kontakt kan behöva stöd"
        body = (
            f"Hej {name},\n\n"
            f"Du har angetts som nödkontakt i appen Lugn & Trygg.\n"
            f"Vår system har identifierat att personen du bryr dig om kan behöva stöd just nu.\n\n"
            f"Vänligen kontakta personen och vid akut fara, ring 112 eller Självmordslinjen 90101.\n\n"
            f"Med vänliga hälsningar,\nLugn & Trygg-teamet"
        )

        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = email

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, [email], msg.as_string())

        logger.info("Emergency contact notification sent to %s", str(name).replace('\n', '').replace('\r', '')[:50])

    except Exception as e:
        logger.error("Failed to notify emergency contact: %s", str(e).replace('\n', '').replace('\r', '')[:200])
