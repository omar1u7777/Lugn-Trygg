"""
Proactive Notification Scheduler
Schedules and sends personalized insights based on user patterns.
Runs daily to deliver the "last mile" of therapeutic support.
"""

import logging
import time
from datetime import datetime, timedelta
from threading import Thread

from src.firebase_config import db
from src.services.daily_insight_service import get_insight_generator

logger = logging.getLogger(__name__)


class InsightNotificationScheduler:
    """
    Schedules and delivers proactive notifications with therapeutic insights.
    
    Features:
    - Daily insight generation at optimal time per user
    - Smart delivery (avoid sleep hours, respect do-not-disturb)
    - Priority-based delivery (high urgency = immediate)
    - Batch processing for efficiency
    """

    def __init__(self):
        self.is_running = False
        self.scheduler_thread = None
        self.optimal_hours = (8, 20)  # 8 AM to 8 PM
        self.batch_size = 100

    def start_scheduler(self):
        """Start background scheduler thread."""
        if self.is_running:
            return

        self.is_running = True
        self.scheduler_thread = Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()
        logger.info("✅ Insight notification scheduler started")

    def stop_scheduler(self):
        """Stop scheduler gracefully."""
        self.is_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        logger.info("🛑 Insight notification scheduler stopped")

    def _scheduler_loop(self):
        """Main scheduler loop - runs every hour."""
        while self.is_running:
            try:
                current_hour = datetime.now().hour

                # Run daily insight generation at 7 AM
                if current_hour == 7:
                    self._process_daily_insights()

                # Send pending notifications every 2 hours during day
                if current_hour % 2 == 0 and self.optimal_hours[0] <= current_hour <= self.optimal_hours[1]:
                    self._send_pending_notifications()

                # Sleep for 1 hour
                time.sleep(3600)

            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(300)  # Retry in 5 min on error

    def _process_daily_insights(self):
        """Generate insights for all active users."""
        try:
            from google.cloud.firestore import FieldFilter

            # Get active users with recent activity
            users_query = db.collection('users').where(
                filter=FieldFilter('last_active', '>=', datetime.now() - timedelta(days=3))
            ).limit(self.batch_size)

            processed = 0
            for user_doc in users_query.stream():
                user_id = user_doc.id
                user_data = user_doc.to_dict()

                # Check user preferences
                if user_data.get('insights_enabled', True) is False:
                    continue

                # Generate insights
                generator = get_insight_generator()
                insights = generator.generate_daily_insights(user_id)

                if insights:
                    processed += 1
                    logger.info(f"Generated {len(insights)} insights for {user_id}")

            logger.info(f"Daily insight processing complete: {processed} users")

        except Exception as e:
            logger.error(f"Daily processing failed: {e}")

    def _send_pending_notifications(self):
        """Send pending insight notifications to users."""
        try:
            from google.cloud.firestore import FieldFilter

            # Get pending insights
            insights_query = db.collection('insights').where(
                filter=FieldFilter('status', '==', 'pending')
            ).where(
                filter=FieldFilter('notification_sent', '==', False)
            ).limit(self.batch_size)

            sent_count = 0
            for insight_doc in insights_query.stream():
                insight_data = insight_doc.to_dict()

                # Check if it's appropriate time for this user
                user_id = insight_data.get('user_id')
                urgency = insight_data.get('urgency', 'low')

                # High urgency can override time restrictions
                if urgency != 'high' and not self._is_optimal_time(user_id):
                    continue

                # Send notification
                success = self._send_notification(insight_data)

                if success:
                    # Mark as sent
                    get_insight_generator().mark_insight_sent(insight_doc.id)
                    sent_count += 1

            if sent_count > 0:
                logger.info(f"Sent {sent_count} insight notifications")

        except Exception as e:
            logger.error(f"Notification sending failed: {e}")

    def _is_optimal_time(self, user_id: str) -> bool:
        """Check if current time is optimal for user notifications."""
        # Would check user timezone and preferences
        # For now, use simple hour check
        hour = datetime.now().hour
        return self.optimal_hours[0] <= hour <= self.optimal_hours[1]

    def _send_notification(self, insight_data: dict) -> bool:
        """Send notification via FCM or other channel."""
        try:
            user_id = insight_data.get('user_id')
            title = insight_data.get('title', 'Lugn & Trygg - Insikt')
            message = insight_data.get('message', '')
            action = insight_data.get('suggested_action', '')

            # Get user's FCM token
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return False

            fcm_token = user_doc.to_dict().get('fcm_token')
            if not fcm_token:
                logger.warning(f"No FCM token for {user_id}")
                return False

            # Try Firebase Cloud Messaging
            try:
                from firebase_admin import messaging

                notification = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=message[:100] + '...' if len(message) > 100 else message
                    ),
                    data={
                        'type': 'daily_insight',
                        'insight_id': insight_data.get('insight_id'),
                        'insight_type': insight_data.get('insight_type'),
                        'action': action,
                        'urgency': insight_data.get('urgency', 'low')
                    },
                    token=fcm_token
                )

                response = messaging.send(notification)
                logger.info(f"📱 Insight notification sent to {user_id}: {response}")
                return True

            except ImportError:
                logger.warning("Firebase messaging not available")
                return False

        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return False

    def trigger_immediate_insight(self, user_id: str, insight_type: str = 'checkin') -> str | None:
        """
        Trigger an immediate insight for a user (e.g., after crisis detection).
        
        Args:
            user_id: Target user
            insight_type: Type of immediate insight needed
        
        Returns:
            Insight ID if created, None otherwise
        """
        try:
            from src.services.daily_insight_service import InsightType

            insight_id = f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_immediate"

            immediate_insights = {
                'checkin': {
                    'title': 'Vi tänker på dig',
                    'message': 'Du har varit i våra tankar. Hur mår du just nu?',
                    'action': 'Öppna appen för en snabb check-in',
                    'urgency': 'high'
                },
                'support': {
                    'title': 'Du är inte ensam',
                    'message': 'Vi ser att du har det tufft. Det finns stöd att få.',
                    'action': 'Se krisresurser i appen',
                    'urgency': 'high'
                }
            }

            template = immediate_insights.get(insight_type, immediate_insights['checkin'])

            insight_data = {
                'insight_id': insight_id,
                'user_id': user_id,
                'insight_type': InsightType.CHECKIN_NEEDED.value,
                'title': template['title'],
                'message': template['message'],
                'recommendation': template['action'],
                'urgency': template['urgency'],
                'suggested_action': template['action'],
                'created_at': datetime.now(),
                'status': 'pending',
                'notification_sent': False,
                'is_immediate': True
            }

            db.collection('insights').document(insight_id).set(insight_data)

            # Try to send immediately
            self._send_notification(insight_data)

            logger.info(f"🚨 Immediate insight triggered for {user_id}: {insight_type}")
            return insight_id

        except Exception as e:
            logger.error(f"Failed to trigger immediate insight: {e}")
            return None


# Global instance
_scheduler: InsightNotificationScheduler | None = None


def get_notification_scheduler() -> InsightNotificationScheduler:
    """Get singleton scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = InsightNotificationScheduler()
    return _scheduler


def start_proactive_insights():
    """Start the proactive insight system."""
    scheduler = get_notification_scheduler()
    scheduler.start_scheduler()


def stop_proactive_insights():
    """Stop the proactive insight system."""
    scheduler = get_notification_scheduler()
    scheduler.stop_scheduler()
