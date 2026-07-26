"""
Crisis Escalation Service - Real-time multi-channel notifications.
Sends SMS, email, and push notifications for crisis situations.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

# These will be imported when available, graceful fallback if not configured
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Content, Email, Mail, To
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False

try:
    from firebase_admin import messaging
    FCM_AVAILABLE = True
except ImportError:
    FCM_AVAILABLE = False

from src.firebase_config import db
from src.middleware.error_handler import with_circuit_breaker

logger = logging.getLogger(__name__)


@with_circuit_breaker('fcm_push')
def _fcm_send_message(message):
    return messaging.send(message)


class EscalationChannel(Enum):
    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"
    DASHBOARD = "dashboard"


@dataclass
class CrisisAlert:
    """A crisis alert to be escalated."""
    user_id: str
    risk_level: str
    risk_score: float
    detected_indicators: list[str]
    text_snippet: str
    timestamp: datetime
    requires_immediate_action: bool


@dataclass
class EmergencyContact:
    """Emergency contact for a user."""
    name: str
    phone: str | None = None
    email: str | None = None
    relationship: str = ""
    notify_sms: bool = True
    notify_email: bool = True


@dataclass
class EscalationResult:
    """Result of escalation attempts."""
    success: bool
    channels_used: list[EscalationChannel]
    failures: list[tuple[EscalationChannel, str]]
    alert_id: str | None = None


class CrisisEscalationService:
    """
    Multi-channel crisis escalation service.
    Sends real-time notifications via SMS (Twilio), email (SendGrid),
    and push notifications (Firebase Cloud Messaging).
    """

    def __init__(self):
        logger.info("🚨 Initializing Crisis Escalation Service...")

        self.twilio_client: TwilioClient | None = None
        self.sendgrid_client: SendGridAPIClient | None = None

        # Initialize Twilio if configured
        if TWILIO_AVAILABLE:
            self._init_twilio()
        else:
            logger.warning("⚠️ Twilio not available - SMS escalation disabled")

        # Initialize SendGrid if configured
        if SENDGRID_AVAILABLE:
            self._init_sendgrid()
        else:
            logger.warning("⚠️ SendGrid not available - email escalation disabled")

        if not FCM_AVAILABLE:
            logger.warning("⚠️ Firebase Cloud Messaging not available - push notifications disabled")

        logger.info("✅ Crisis Escalation Service initialized")

    def _init_twilio(self):
        """Initialize Twilio SMS client."""
        import os

        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_phone = os.getenv("TWILIO_PHONE_NUMBER")

        if account_sid and auth_token and self.twilio_phone:
            self.twilio_client = TwilioClient(account_sid, auth_token)
            logger.info("📱 Twilio SMS client initialized")
        else:
            logger.warning("⚠️ Twilio credentials not configured")
            self.twilio_client = None

    def _init_sendgrid(self):
        """Initialize SendGrid email client."""
        import os

        api_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = os.getenv("SENDGRID_FROM_EMAIL", "alerts@lugn-trygg.se")

        if api_key:
            self.sendgrid_client = SendGridAPIClient(api_key)
            logger.info("📧 SendGrid email client initialized")
        else:
            logger.warning("⚠️ SendGrid API key not configured")
            self.sendgrid_client = None

    # Channels that reach a HUMAN. A dashboard document write is bookkeeping,
    # not delivery — it must never make an escalation count as successful.
    HUMAN_CHANNELS = frozenset({
        EscalationChannel.SMS,
        EscalationChannel.EMAIL,
        EscalationChannel.PUSH,
    })

    def has_any_human_channel_configured(self) -> bool:
        """True when at least one human-reaching channel CAN deliver.

        FCM_AVAILABLE only means the firebase_admin package imported — it says
        nothing about whether a Firebase app is actually initialized. Checking
        it alone made this guard true in every deployment (firebase-admin is a
        hard requirement), so the fast-fail branch in escalate() never fired
        even with Twilio/SendGrid both unset — the misconfiguration was instead
        discovered only after the full send attempt, at the end of escalate().
        A real Firebase app is required for FCM to count as configured; whether
        a GIVEN alert's user has an fcm_token is still checked per-send in
        _send_push_notification (that's per-alert data, not global config).
        """
        twilio_ready = bool(self.twilio_client) and bool(self.twilio_phone)
        sendgrid_ready = bool(self.sendgrid_client)
        fcm_ready = False
        if FCM_AVAILABLE:
            try:
                import firebase_admin
                fcm_ready = bool(getattr(firebase_admin, "_apps", None))
            except Exception:
                fcm_ready = False
        return twilio_ready or sendgrid_ready or fcm_ready

    async def escalate(self, alert: CrisisAlert) -> EscalationResult:
        """
        Execute full escalation protocol for a crisis alert.

        DELIVERY ACCOUNTING CONTRACT: a channel is appended to channels_used
        ONLY on confirmed delivery (provider accepted the message). Skipped
        channels (unconfigured client, missing phone/token) are recorded as
        failures, and success requires at least one HUMAN channel delivered —
        never the dashboard write alone. This is what prevents the task queue
        from marking crisis tasks "completed" that no human ever saw.
        """
        logger.warning(
            f"🚨 CRISIS ESCALATION: user={alert.user_id[:8]}... "
            f"risk={alert.risk_level} score={alert.risk_score:.2f}"
        )

        channels_used = []
        failures = []

        try:
            from src.utils.telemetry import telemetry

            if not self.has_any_human_channel_configured():
                # Nothing can reach a human — fail loudly and immediately so
                # the caller/queue treats this as non-retryable configuration
                # error rather than burning retries.
                telemetry.critical(
                    "crisis_no_human_channel_configured",
                    "Crisis escalation invoked but NO human-reaching channel "
                    "(Twilio/SendGrid/FCM) is configured — alert cannot reach anyone",
                    user_id=alert.user_id[:8],
                    risk_level=alert.risk_level,
                )
                alert_id = await self._persist_alert(alert)
                try:
                    await self._create_dashboard_alert(alert, alert_id)
                    channels_used.append(EscalationChannel.DASHBOARD)
                except Exception as dash_err:
                    failures.append((EscalationChannel.DASHBOARD, str(dash_err)))
                failures.append((EscalationChannel.SMS, "no_human_channel_configured"))
                await self._log_escalation(alert, channels_used, failures, alert_id)
                return EscalationResult(
                    success=False,
                    channels_used=channels_used,
                    failures=failures,
                    alert_id=alert_id,
                )

            # 1. Persist alert to database immediately
            alert_id = await self._persist_alert(alert)

            # 2. Get user info including emergency contacts
            user_data = await self._get_user_data(alert.user_id)

            # 3. Send immediate SMS to user — count only confirmed delivery
            if alert.risk_level in ['high', 'critical']:
                try:
                    if await self._send_user_sms(alert, user_data):
                        channels_used.append(EscalationChannel.SMS)
                    else:
                        failures.append((EscalationChannel.SMS, "skipped: Twilio or user phone not configured"))
                except Exception as e:
                    logger.error(f"❌ Failed to send user SMS: {e}")
                    failures.append((EscalationChannel.SMS, str(e)))

            # 4. Notify emergency contacts (critical/high only) — per-contact
            #    delivery counts, not blanket channel claims
            if alert.risk_level in ['high', 'critical'] and user_data.get('emergency_contacts'):
                try:
                    contact_result = await self._notify_emergency_contacts(alert, user_data['emergency_contacts'])
                    if contact_result.get('sms_delivered', 0) > 0:
                        channels_used.append(EscalationChannel.SMS)
                    if contact_result.get('email_delivered', 0) > 0:
                        channels_used.append(EscalationChannel.EMAIL)
                    for err in contact_result.get('errors', []):
                        failures.append((EscalationChannel.EMAIL, err))
                except Exception as e:
                    logger.error(f"❌ Failed to notify emergency contacts: {e}")
                    failures.append((EscalationChannel.EMAIL, str(e)))

            # 5. Send push notification — count only confirmed delivery
            try:
                if await self._send_push_notification(alert, user_data):
                    channels_used.append(EscalationChannel.PUSH)
                else:
                    failures.append((EscalationChannel.PUSH, "skipped: FCM or device token not configured"))
            except Exception as e:
                logger.warning(f"⚠️ Push notification failed: {e}")
                failures.append((EscalationChannel.PUSH, str(e)))

            # 6. Create dashboard alert (for clinician dashboard) — recorded
            #    but NEVER counted as human delivery
            try:
                await self._create_dashboard_alert(alert, alert_id)
                channels_used.append(EscalationChannel.DASHBOARD)
            except Exception as e:
                logger.error(f"❌ Failed to create dashboard alert: {e}")
                failures.append((EscalationChannel.DASHBOARD, str(e)))

            # Log escalation
            await self._log_escalation(alert, channels_used, failures, alert_id)

            success = any(c in self.HUMAN_CHANNELS for c in channels_used)

            if success:
                logger.info(f"✅ Crisis escalation completed: {len(channels_used)} channels")
            else:
                telemetry.critical(
                    "crisis_escalation_no_human_reached",
                    "Crisis escalation finished WITHOUT any confirmed human delivery",
                    user_id=alert.user_id[:8],
                    risk_level=alert.risk_level,
                    failures=str([(c.value, e[:80]) for c, e in failures]),
                )
                logger.error("❌ Crisis escalation failed: no human-reaching channel delivered")

            return EscalationResult(
                success=success,
                channels_used=list(set(channels_used)),  # Deduplicate
                failures=failures,
                alert_id=alert_id
            )

        except Exception as e:
            logger.exception(f"🔥 Critical escalation failure: {e}")
            return EscalationResult(
                success=False,
                channels_used=channels_used,
                failures=failures + [(EscalationChannel.SMS, f"Critical failure: {e}")],
                alert_id=None
            )

    async def _persist_alert(self, alert: CrisisAlert) -> str:
        """Persist crisis alert to Firestore."""
        doc_ref = db.collection('crisis_alerts').document()

        doc_ref.set({
            'user_id': alert.user_id,
            'risk_level': alert.risk_level,
            'risk_score': alert.risk_score,
            'detected_indicators': alert.detected_indicators,
            'text_snippet': alert.text_snippet[:200],  # Limit for privacy
            'created_at': alert.timestamp.isoformat(),
            'resolved': False,
            'escalated': True,
            'requires_immediate_action': alert.requires_immediate_action,
            'notification_attempts': []
        })

        return doc_ref.id

    async def _get_user_data(self, user_id: str) -> dict:
        """Fetch user data including emergency contacts."""
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                logger.warning(f"User {user_id[:8]}... not found")
                return {}

            data = user_doc.to_dict() or {}

            # Get phone from profile
            phone = data.get('phone')
            if not phone:
                # Try to get from Firebase Auth
                try:
                    from firebase_admin import auth
                    user_record = auth.get_user(user_id)
                    phone = user_record.phone_number
                except Exception:
                    pass

            return {
                'name': data.get('display_name', data.get('name', 'Användare')),
                'phone': phone,
                'email': data.get('email'),
                'emergency_contacts': data.get('emergency_contacts', []),
                'fcm_token': data.get('fcm_token')  # For push notifications
            }

        except Exception as e:
            logger.error(f"Failed to fetch user data: {e}")
            return {}

    @with_circuit_breaker('twilio_sms')
    def _twilio_create_message(self, **kwargs):
        """Circuit-broken wrapper around the Twilio SDK call. Safe to trip on
        repeated failures: each call happens inside a bounded per-task
        execution window (see crisis_task_queue.EXECUTION_TIMEOUT_SECONDS),
        so a wrapped call can never hang the breaker open forever."""
        return self.twilio_client.messages.create(**kwargs)

    @with_circuit_breaker('sendgrid_email')
    def _sendgrid_send_message(self, message):
        return self.sendgrid_client.send(message)

    async def _send_user_sms(self, alert: CrisisAlert, user_data: dict) -> bool:
        """Send immediate grounding SMS to the user.

        Returns True only on confirmed provider acceptance; False when the
        channel is skipped (unconfigured/no phone). Raises on send failure.
        """
        if not self.twilio_client or not user_data.get('phone'):
            logger.warning("Cannot send user SMS - Twilio or phone not configured")
            return False

        # Swedish messages based on risk level
        if alert.risk_level == 'critical':
            message_body = (
                f"{user_data.get('name', 'Hej')}, vi ser att du har det mycket tufft just nu. "
                f"DU ÄR INTE ENSAM. Ring 112 om du känner att du är i fara. "
                f"Krisjouren: 90101. Hjälp finns."
            )
        else:  # high
            message_body = (
                f"{user_data.get('name', 'Hej')}, vi ser att du har det tufft just nu. "
                f"Öppna Lugn & Trygg för en grounding-övning, eller ring "
                f"Krisjouren på 90101. Du är inte ensam."
            )

        try:
            message = self._twilio_create_message(
                body=message_body,
                from_=self.twilio_phone,
                to=user_data['phone']
            )
            logger.info(f"📱 User SMS sent: SID={message.sid}")
            return True
        except Exception as e:
            logger.error(f"❌ Twilio SMS failed: {e}")
            raise

    async def _notify_emergency_contacts(self, alert: CrisisAlert, contacts: list[dict]) -> dict:
        """Notify emergency contacts via SMS and email.

        Returns per-channel delivery accounting:
        {'sms_delivered': int, 'email_delivered': int, 'errors': [str, ...]}
        so the caller can record exactly what was confirmed instead of
        blanket-claiming both channels.
        """
        user_name = "Användaren"  # Privacy - don't reveal full name
        result: dict = {'sms_delivered': 0, 'email_delivered': 0, 'errors': []}

        for contact in contacts:
            contact_name = contact.get('name', 'Kontakt')
            phone = contact.get('phone')
            email = contact.get('email')
            notify_sms = contact.get('notify_sms', True)
            notify_email = contact.get('notify_email', True)

            # SMS to contact
            if phone and notify_sms and self.twilio_client:
                try:
                    if alert.risk_level == 'critical':
                        sms_body = (
                            f"KRISLÄGE: {user_name} har indikerat AKUT psykisk kris "
                            f"i Lugn & Trygg-appen. Risknivå: KRITISK. "
                            f"Kontakta personen omedelbart eller ring 112. "
                            f"Tid: {alert.timestamp.strftime('%Y-%m-%d %H:%M')}"
                        )
                    else:
                        sms_body = (
                            f"VIKTIGT: {user_name} visar tecken på psykisk kris "
                            f"i Lugn & Trygg-appen. Risknivå: HÖG. "
                            f"Kontakta personen snarast möjligt. "
                        )

                    self._twilio_create_message(
                        body=sms_body,
                        from_=self.twilio_phone,
                        to=phone
                    )
                    logger.info(f"📱 Emergency contact SMS sent to {contact_name[:3]}***")
                    result['sms_delivered'] += 1

                except Exception as e:
                    logger.error(f"❌ Failed to SMS contact {contact_name[:3]}***: {str(e)[:50]}")
                    result['errors'].append(f"contact_sms: {str(e)[:80]}")

            # Email to contact
            if email and notify_email and self.sendgrid_client:
                try:
                    await self._send_contact_email(
                        to_email=email,
                        to_name=contact_name,
                        alert=alert,
                        user_name=user_name
                    )
                    logger.info(f"📧 Emergency contact email sent to {contact_name[:3]}***")
                    result['email_delivered'] += 1

                except Exception as e:
                    logger.error(f"❌ Failed to email contact {contact_name[:3]}***: {str(e)[:50]}")
                    result['errors'].append(f"contact_email: {str(e)[:80]}")

        return result

    async def _send_contact_email(self, to_email: str, to_name: str,
                                   alert: CrisisAlert, user_name: str):
        """Send detailed email to emergency contact."""

        subject = f"VIKTIGT: {user_name} behöver stöd - Lugn & Trygg"

        if alert.risk_level == 'critical':
            urgency_text = "KRITISKT LÄGE"
            action_text = "Kontakta personen omedelbart eller ring 112."
        else:
            urgency_text = "Högriskläge"
            action_text = "Kontakta personen snarast möjligt."

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #d32f2f;">🚨 {urgency_text}</h2>

                <p>Hej {to_name},</p>

                <p>{user_name} har visat tecken på <strong>{alert.risk_level}</strong>
                psykisk kris i Lugn & Trygg-appen för mental hälsa.</p>

                <div style="background: #ffebee; padding: 15px; border-left: 4px solid #d32f2f;">
                    <h3 style="margin-top: 0;">Information:</h3>
                    <ul>
                        <li><strong>Risknivå:</strong> {alert.risk_level.upper()}</li>
                        <li><strong>Riskpoäng:</strong> {alert.risk_score:.2f}/1.0</li>
                        <li><strong>Tid:</strong> {alert.timestamp.strftime('%Y-%m-%d %H:%M')}</li>
                    </ul>
                </div>

                <h3>Upptäckta indikatorer:</h3>
                <ul>
                    {''.join([f'<li>{ind}</li>' for ind in alert.detected_indicators[:5]])}
                </ul>

                <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Vad du bör göra:</h3>
                    <p><strong>{action_text}</strong></p>
                    <ol>
                        <li>Ring personen direkt och lyssna utan att döma</li>
                        <li>Fråga öppet om de har tankar på att skada sig</li>
                        <li>Erbjud att vara där eller hjälpa dem söka vård</li>
                        <li>Om akut fara - ring 112</li>
                    </ol>
                </div>

                <h3>Nödresurser:</h3>
                <ul>
                    <li><strong>112:</strong> Vid omedelbar fara</li>
                    <li><strong>90101:</strong> Självmordslinjen/Krisjouren (dygnet runt)</li>
                    <li><strong>1177:</strong> Vårdguiden</li>
                </ul>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

                <p style="font-size: 12px; color: #666;">
                    Detta är ett automatiskt meddelande från Lugn & Trygg.
                    Användaren har gett samtycke till att du kontaktas i krissituationer.
                </p>
            </div>
        </body>
        </html>
        """

        message = Mail(
            from_email=Email(self.from_email, "Lugn & Trygg - Krislarm"),
            to_emails=To(to_email, to_name),
            subject=subject,
            html_content=Content("text/html", html_content)
        )

        response = self._sendgrid_send_message(message)

        if response.status_code not in [200, 202]:
            raise Exception(f"SendGrid returned {response.status_code}")

    @staticmethod
    async def send_fcm(fcm_token: str | None, title: str, body: str,
                       data: dict | None = None) -> bool:
        """Send a Firebase Cloud Messaging push notification.

        Generic primitive shared by crisis escalation and proactive
        intervention pushes. Returns True on confirmed send, False when
        skipped (FCM unavailable or no device token). Raises on send failure.
        """
        if not FCM_AVAILABLE or not fcm_token:
            return False

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data or {},
            token=fcm_token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    channel_id='crisis_alerts',
                    priority='max'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title=title,
                            body=body
                        ),
                        sound='emergency_alert.caf',
                        badge=1
                    )
                )
            )
        )

        try:
            response = _fcm_send_message(message)
            logger.info(f"📲 Push notification sent: {response}")
            return True
        except Exception as e:
            logger.error(f"❌ Push notification failed: {e}")
            raise

    async def _send_push_notification(self, alert: CrisisAlert, user_data: dict) -> bool:
        """Send a crisis-specific Firebase Cloud Messaging push notification.

        Returns True on confirmed send, False when skipped (FCM unavailable or
        no device token). Raises on send failure.
        """
        if alert.risk_level == 'critical':
            title = "🚨 Viktigt meddelande"
            body = "Du verkar ha det tufft just nu. Tryck för att få stöd."
        else:
            title = "Lugn & Trygg"
            body = "Vi ser att du har det svårt. Öppna appen för hjälp."

        return await self.send_fcm(
            user_data.get('fcm_token'),
            title,
            body,
            {
                'type': 'crisis_intervention',
                'risk_level': alert.risk_level,
                'action': 'open_grounding',
            },
        )

    async def _create_dashboard_alert(self, alert: CrisisAlert, alert_id: str):
        """Create alert in clinician dashboard (Phase 6)."""
        # Store in real-time alerts collection for dashboard
        db.collection('dashboard_alerts').document(alert_id).set({
            'alert_id': alert_id,
            'user_id': alert.user_id,
            'risk_level': alert.risk_level,
            'risk_score': alert.risk_score,
            'detected_at': alert.timestamp.isoformat(),
            'status': 'pending',
            'assigned_clinician': None,
            'requires_immediate': alert.requires_immediate_action,
            'escalation_channels_used': []
        })

        logger.info(f"📊 Dashboard alert created: {alert_id}")

    async def _log_escalation(self, alert: CrisisAlert, channels: list,
                               failures: list, alert_id: str):
        """Log escalation for audit trail."""
        from ..services.audit_service import audit_log

        audit_log('CRISIS_ESCALATION', alert.user_id, {
            'alert_id': alert_id,
            'risk_level': alert.risk_level,
            'channels_used': [c.value for c in channels],
            'failures': [{'channel': c.value, 'error': e} for c, e in failures],
            'timestamp': alert.timestamp.isoformat()
        })


# Singleton instance
_escalation_service: CrisisEscalationService | None = None


def get_crisis_escalation_service() -> CrisisEscalationService:
    """Get or create the crisis escalation service singleton."""
    global _escalation_service
    if _escalation_service is None:
        _escalation_service = CrisisEscalationService()
    return _escalation_service
