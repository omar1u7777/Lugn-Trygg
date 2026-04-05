"""
Push Notification Service
Handles Firebase Cloud Messaging (FCM) notifications
"""
import logging
import os
from typing import Any

from firebase_admin import messaging

logger = logging.getLogger(__name__)
_IS_PRODUCTION = os.getenv('FLASK_ENV', 'development').lower() == 'production'

class PushNotificationService:
    """Service for sending push notifications via FCM"""

    def __init__(self):
        self.enabled = os.getenv('FCM_ENABLED', 'true').lower() == 'true'
        if self.enabled:
            logger.info("✅ Push Notification Service initialized")
            # [F3] The backend uses firebase-admin (service account) for FCM messaging.
            # Frontend PWA push requires VITE_FIREBASE_VAPID_KEY (Web Push VAPID public key)
            # to be set in the frontend .env — without it, browser push subscriptions fail
            # silently and users never receive notifications in PWA mode.
            if _IS_PRODUCTION:
                logger.info(
                    "[F3] FCM backend ready. Reminder: VITE_FIREBASE_VAPID_KEY must be set "
                    "in the frontend environment for PWA browser push notifications. "
                    "Get it from: Firebase Console → Project Settings → Cloud Messaging → "
                    "Web Push certificates → Key pair."
                )
        else:
            logger.warning("⚠️ Push Notifications disabled")

    def send_referral_success_notification(
        self,
        user_token: str,
        referrer_name: str,
        new_user_name: str,
        total_referrals: int
    ) -> dict[str, Any]:
        """Send notification when someone uses user's referral code"""

        if not self.enabled:
            return {"success": False, "error": "Push notifications disabled"}

        if not user_token:
            return {"success": False, "error": "No FCM token provided"}

        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title="🎉 Ny referral!",
                    body=f"{new_user_name} använde din kod! Nu har du {total_referrals} referenser.",
                ),
                data={
                    "type": "referral_success",
                    "new_user": new_user_name,
                    "total_referrals": str(total_referrals),
                    "click_action": "/referral"
                },
                token=user_token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        icon='ic_notification',
                        color='#667eea',
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                )
            )

            response = messaging.send(message)
            logger.info(f"✅ Referral notification sent to {referrer_name}: {response}")

            return {
                "success": True,
                "message_id": response
            }

        except Exception as e:
            logger.exception(f"❌ Failed to send push notification: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def send_tier_upgrade_notification(
        self,
        user_token: str,
        new_tier: str,
        rewards_earned: int
    ) -> dict[str, Any]:
        """Notify user when they reach a new tier"""

        if not self.enabled or not user_token:
            return {"success": False}

        tier_emojis = {
            "Silver": "🥈",
            "Gold": "🥇",
            "Platinum": "💎"
        }

        try:
            emoji = tier_emojis.get(new_tier, "🌟")

            message = messaging.Message(
                notification=messaging.Notification(
                    title=f"{emoji} Nivå uppnådd: {new_tier}!",
                    body=f"Grattis! Du har låst upp {new_tier} och fått {rewards_earned} veckor premium!",
                ),
                data={
                    "type": "tier_upgrade",
                    "tier": new_tier,
                    "rewards": str(rewards_earned),
                    "click_action": "/referral"
                },
                token=user_token,
                android=messaging.AndroidConfig(priority='high'),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound='default', badge=1)
                    )
                )
            )

            response = messaging.send(message)
            logger.info(f"✅ Tier upgrade notification sent: {new_tier}")

            return {"success": True, "message_id": response}

        except Exception as e:
            logger.exception(f"❌ Failed to send tier notification: {e}")
            return {"success": False, "error": str(e)}

    def send_reward_redemption_notification(
        self,
        user_token: str,
        reward_name: str,
        reward_emoji: str = "🎁"
    ) -> dict[str, Any]:
        """Notify user when reward is redeemed"""

        if not self.enabled or not user_token:
            return {"success": False}

        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=f"{reward_emoji} Belöning inlöst!",
                    body=f"Din {reward_name} är nu aktiv! Njut av din belöning.",
                ),
                data={
                    "type": "reward_redeemed",
                    "reward_name": reward_name,
                    "click_action": "/dashboard"
                },
                token=user_token
            )

            response = messaging.send(message)
            logger.info("✅ Reward redemption notification sent")

            return {"success": True, "message_id": response}

        except Exception as e:
            logger.exception(f"❌ Failed to send reward notification: {e}")
            return {"success": False, "error": str(e)}

    def send_bulk_notifications(
        self,
        tokens: list[str],
        title: str,
        body: str,
        data: dict[str, str] | None = None
    ) -> dict[str, Any]:
        """Send notification to multiple users (max 500 tokens per batch)"""

        if not self.enabled or not tokens:
            return {"success": False}

        try:
            # FCM allows max 500 tokens per multicast
            batch_size = 500
            total_success = 0
            total_failure = 0

            for i in range(0, len(tokens), batch_size):
                batch_tokens = tokens[i:i + batch_size]

                message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title=title,
                        body=body
                    ),
                    data=data or {},
                    tokens=batch_tokens
                )

                batch_response = messaging.send_each_for_multicast(message)  # type: ignore[attr-defined]
                total_success += batch_response.success_count
                total_failure += batch_response.failure_count

                logger.info(f"Batch {i//batch_size + 1}: {batch_response.success_count} success, {batch_response.failure_count} failure")

            return {
                "success": True,
                "total_success": total_success,
                "total_failure": total_failure
            }

        except Exception as e:
            logger.exception(f"❌ Failed to send bulk notifications: {e}")
            return {"success": False, "error": str(e)}

# Singleton instance
push_notification_service = PushNotificationService()
