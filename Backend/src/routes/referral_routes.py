"""
Referral Program Routes
Handles user referrals, tracking, and rewards
"""
import logging
import re
from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from typing import Optional
from ..firebase_config import db
from ..services.auth_service import AuthService
from ..services.email_service import email_service
from ..services.push_notification_service import push_notification_service
from ..services.rate_limiting import rate_limit_by_endpoint
from ..services.audit_service import audit_log
from ..utils.response_utils import APIResponse
from ..utils.input_sanitization import sanitize_text
import random
import string

# FieldFilter import with fallback
try:
    from google.cloud.firestore import FieldFilter
except ImportError:
    FieldFilter = None  # type: ignore

# Validation pattern for user IDs
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

referral_bp = Blueprint("referral", __name__)
logger = logging.getLogger(__name__)


def generate_referral_code(user_id: str) -> str:
    """Generate a unique referral code for user"""
    # Use first 4 chars of user_id + 4 random uppercase letters
    code = user_id[:4].upper() + ''.join(random.choices(string.ascii_uppercase, k=4))
    return code


# CORS OPTIONS handler for all endpoints
@referral_bp.route("/generate", methods=["OPTIONS"])
@referral_bp.route("/stats", methods=["OPTIONS"])
@referral_bp.route("/invite", methods=["OPTIONS"])
@referral_bp.route("/complete", methods=["OPTIONS"])
@referral_bp.route("/leaderboard", methods=["OPTIONS"])
@referral_bp.route("/history", methods=["OPTIONS"])
@referral_bp.route("/rewards/catalog", methods=["OPTIONS"])
@referral_bp.route("/rewards/redeem", methods=["OPTIONS"])
def handle_options():
    """Handle CORS preflight requests"""
    return APIResponse.success()


@referral_bp.route("/generate", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def generate_referral():
    """Generate referral code and data for user"""
    logger.info("🎁 REFERRAL - GENERATE endpoint called")
    
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        
        logger.info(f"👤 REFERRAL - Generating for user: {user_id}")

        # Get or create referral document
        referral_ref = db.collection("referrals").document(user_id)  # type: ignore
        referral_doc = referral_ref.get()

        if not referral_doc.exists:
            # Create new referral tracking with generated code
            referral_code = generate_referral_code(user_id)
            referral_data = {
                "user_id": user_id,
                "referral_code": referral_code,
                "total_referrals": 0,
                "successful_referrals": 0,
                "pending_referrals": 0,
                "rewards_earned": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            referral_ref.set(referral_data)
            logger.info(f"✅ REFERRAL - Created new referral code {referral_code} for user {user_id}")
            
            audit_log('REFERRAL_CODE_GENERATED', user_id, {'referral_code': referral_code})
            
            return APIResponse.success({
                "userId": user_id,
                "referralCode": referral_code,
                "totalReferrals": 0,
                "successfulReferrals": 0,
                "pendingReferrals": 0,
                "rewardsEarned": 0,
                "createdAt": referral_data["created_at"]
            }, "Referral code generated")

        # Return existing referral data
        referral_data = referral_doc.to_dict() or {}
        logger.info(f"✅ REFERRAL - Returning existing referral data for user {user_id}")
        
        return APIResponse.success({
            "userId": referral_data.get("user_id"),
            "referralCode": referral_data.get("referral_code"),
            "totalReferrals": referral_data.get("total_referrals", 0),
            "successfulReferrals": referral_data.get("successful_referrals", 0),
            "pendingReferrals": referral_data.get("pending_referrals", 0),
            "rewardsEarned": referral_data.get("rewards_earned", 0),
            "createdAt": referral_data.get("created_at")
        }, "Referral data retrieved")

    except Exception as e:
        logger.exception(f"Error generating referral: {e}")
        return APIResponse.error("Failed to generate referral", "REFERRAL_ERROR", 500, str(e))


@referral_bp.route("/stats", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_referral_stats():
    """Get user's referral statistics"""
    logger.info("📊 REFERRAL - STATS endpoint called")
    
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Get user_id from query param or auth context
        user_id = request.args.get("user_id", "").strip() or current_user_id
        logger.info(f"👤 REFERRAL - Getting stats for user: {user_id}")

        # Get referral document
        referral_ref = db.collection("referrals").document(user_id)  # type: ignore
        referral_doc = referral_ref.get()

        if not referral_doc.exists:
            # Create new referral tracking
            referral_code = generate_referral_code(user_id)
            referral_data = {
                "user_id": user_id,
                "referral_code": referral_code,
                "total_referrals": 0,
                "successful_referrals": 0,
                "pending_referrals": 0,
                "rewards_earned": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            referral_ref.set(referral_data)
            
            return APIResponse.success({
                "userId": user_id,
                "referralCode": referral_code,
                "totalReferrals": 0,
                "successfulReferrals": 0,
                "pendingReferrals": 0,
                "rewardsEarned": 0,
                "createdAt": referral_data["created_at"]
            }, "Referral stats retrieved")

        referral_data = referral_doc.to_dict() or {}
        
        return APIResponse.success({
            "userId": referral_data.get("user_id"),
            "referralCode": referral_data.get("referral_code"),
            "totalReferrals": referral_data.get("total_referrals", 0),
            "successfulReferrals": referral_data.get("successful_referrals", 0),
            "pendingReferrals": referral_data.get("pending_referrals", 0),
            "rewardsEarned": referral_data.get("rewards_earned", 0),
            "createdAt": referral_data.get("created_at"),
            "lastReferralAt": referral_data.get("last_referral_at")
        }, "Referral stats retrieved")

    except Exception as e:
        logger.exception(f"Error fetching referral stats: {e}")
        return APIResponse.error("Failed to fetch referral stats", "STATS_ERROR", 500, str(e))

@referral_bp.route("/invite", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def send_invitation():
    """Send referral invitation via email"""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        
        data = request.get_json(force=True, silent=True) or {}
        email = sanitize_text(data.get("email", ""), max_length=254)
        referrer_name = sanitize_text(data.get("referrer_name", "Din vän"), max_length=100)

        if not email:
            return APIResponse.bad_request("email required")

        # Get referral data
        referral_ref = db.collection("referrals").document(user_id)  # type: ignore
        referral_doc = referral_ref.get()
        
        if not referral_doc.exists:
            return APIResponse.not_found("Referral code not found. Generate one first.")
        
        referral_data = referral_doc.to_dict() or {}
        referral_code = referral_data.get("referral_code")
        
        if not referral_code:
            return APIResponse.not_found("Referral code not found. Generate one first.")
        
        referral_link = f"https://lugn-trygg.vercel.app/register?ref={referral_code}"

        # Store invitation in pending referrals
        invitation_ref = db.collection("referral_invitations").document()  # type: ignore
        invitation_ref.set({
            "referrer_id": user_id,
            "referrer_name": referrer_name,
            "invitee_email": email,
            "referral_code": referral_code,
            "referral_link": referral_link,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat()
        })

        # Update pending referrals count
        referral_ref.update({
            "total_referrals": referral_data.get("total_referrals", 0) + 1,
            "pending_referrals": referral_data.get("pending_referrals", 0) + 1
        })

        # Send email via SendGrid
        email_result = email_service.send_referral_invitation(
            to_email=email,
            referrer_name=referrer_name,
            referral_code=referral_code,
            referral_link=referral_link
        )

        audit_log('REFERRAL_INVITATION_SENT', user_id, {'invitee_email': email})
        logger.info(f"Referral invitation sent from {user_id} to {email}")

        return APIResponse.success({
            "message": "Invitation sent successfully",
            "emailSent": email_result.get("success", False),
            "emailStatus": email_result.get("message", "Email service unavailable")
        }, "Invitation sent")

    except Exception as e:
        logger.exception(f"Error sending invitation: {e}")
        return APIResponse.error("Failed to send invitation", "INVITATION_ERROR", 500, str(e))


@referral_bp.route("/complete", methods=["POST"])
@rate_limit_by_endpoint
def complete_referral():
    """Mark a referral as completed when invitee signs up (called internally during registration)"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        referrer_id = sanitize_text(data.get("referrer_id", ""), max_length=128)
        invitee_id = sanitize_text(data.get("invitee_id", ""), max_length=128)
        invitee_name = sanitize_text(data.get("invitee_name", "New User"), max_length=100)
        invitee_email = sanitize_text(data.get("invitee_email", ""), max_length=254)

        if not referrer_id or not invitee_id:
            return APIResponse.bad_request("referrer_id and invitee_id required")

        # Update referral stats
        referral_ref = db.collection("referrals").document(referrer_id)  # type: ignore
        referral_doc = referral_ref.get()

        if referral_doc.exists:
            referral_data = referral_doc.to_dict() or {}
            successful_referrals = referral_data.get("successful_referrals", 0) + 1
            pending_referrals = max(0, referral_data.get("pending_referrals", 0) - 1)

            # Calculate rewards based on tier system
            # Each referral = 1 week premium
            # Bonus: Every 10th referral = 2 extra weeks
            base_rewards = successful_referrals  # 1 week per referral
            bonus_rewards = (successful_referrals // 10) * 2  # 2 weeks per 10 referrals
            total_weeks = base_rewards + bonus_rewards
            
            # Tier bonuses:
            # Silver (5+): +4 weeks = 1 month
            # Gold (15+): +12 weeks = 3 months  
            # Platinum (30+): +24 weeks = 6 months
            tier_bonus = 0
            if successful_referrals >= 30:
                tier_bonus = 24  # Platinum: 6 months
            elif successful_referrals >= 15:
                tier_bonus = 12  # Gold: 3 months
            elif successful_referrals >= 5:
                tier_bonus = 4   # Silver: 1 month
            
            rewards_earned = total_weeks + tier_bonus

            referral_ref.update({
                "successful_referrals": successful_referrals,
                "pending_referrals": pending_referrals,
                "rewards_earned": rewards_earned,
                "last_referral_at": datetime.now(timezone.utc).isoformat()
            })

            # Store referral history
            history_ref = db.collection("referral_history").document()  # type: ignore
            history_ref.set({
                "referrer_id": referrer_id,
                "invitee_id": invitee_id,
                "invitee_name": invitee_name,
                "invitee_email": invitee_email,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "rewards_granted": 1  # 1 week per referral
            })

            audit_log('REFERRAL_COMPLETED', referrer_id, {
                'invitee_id': invitee_id,
                'successful_referrals': successful_referrals,
                'rewards_earned': rewards_earned
            })

            # Get referrer info for email & push notifications
            try:
                referrer_doc = db.collection("users").document(referrer_id).get()  # type: ignore
                if referrer_doc.exists:
                    referrer_info = referrer_doc.to_dict() or {}
                    referrer_email = referrer_info.get("email")
                    referrer_name = referrer_info.get("name", "User")
                    fcm_token = referrer_info.get("fcm_token")
                    
                    # Send success notification email
                    if referrer_email:
                        email_service.send_referral_success_notification(
                            to_email=referrer_email,
                            referrer_name=referrer_name,
                            new_user_name=invitee_name,
                            total_referrals=successful_referrals,
                            rewards_earned=rewards_earned
                        )
                    
                    # Send push notification
                    if fcm_token:
                        push_notification_service.send_referral_success_notification(
                            user_token=fcm_token,
                            referrer_name=referrer_name,
                            new_user_name=invitee_name,
                            total_referrals=successful_referrals
                        )
                    
                    # Check for tier upgrade
                    old_tier = "Bronze"
                    if successful_referrals - 1 >= 30:
                        old_tier = "Platinum"
                    elif successful_referrals - 1 >= 15:
                        old_tier = "Gold"
                    elif successful_referrals - 1 >= 5:
                        old_tier = "Silver"
                    
                    new_tier = "Bronze"
                    if successful_referrals >= 30:
                        new_tier = "Platinum"
                    elif successful_referrals >= 15:
                        new_tier = "Gold"
                    elif successful_referrals >= 5:
                        new_tier = "Silver"
                    
                    # Send tier upgrade notification
                    if new_tier != old_tier and fcm_token:
                        push_notification_service.send_tier_upgrade_notification(
                            user_token=fcm_token,
                            new_tier=new_tier,
                            rewards_earned=rewards_earned
                        )
                        
            except Exception as notification_err:
                logger.warning(f"Could not send notifications: {notification_err}")

            logger.info(f"Referral completed: {referrer_id} -> {invitee_id}")

            return APIResponse.success({
                "successfulReferrals": successful_referrals,
                "rewardsEarned": rewards_earned,
                "notificationSent": True
            }, "Referral completed successfully")

        return APIResponse.not_found("Referrer not found")

    except Exception as e:
        logger.exception(f"Error completing referral: {e}")
        return APIResponse.error("Failed to complete referral", "COMPLETE_ERROR", 500, str(e))


@referral_bp.route("/leaderboard", methods=["GET"])
@rate_limit_by_endpoint
def get_leaderboard():
    """Get top referrers leaderboard"""
    try:
        limit = int(request.args.get("limit", 10))
        limit = min(limit, 100)  # Max 100 results

        # Query top referrers by successful_referrals
        referrals_ref = db.collection("referrals").order_by(  # type: ignore
            "successful_referrals", direction="DESCENDING"
        ).limit(limit)
        
        referrals_docs = referrals_ref.get()
        
        leaderboard = []
        for idx, doc in enumerate(referrals_docs, start=1):
            data = doc.to_dict() or {}
            user_id = data.get("user_id")
            
            # Get user info
            user_doc = db.collection("users").document(user_id).get()  # type: ignore
            user_name = "Anonymous"
            if user_doc.exists:
                user_info = user_doc.to_dict() or {}
                user_name = user_info.get("name", "Anonymous")
            
            # Calculate tier
            referrals = data.get("successful_referrals", 0)
            if referrals >= 30:
                tier = "Platinum"
                tier_emoji = "💎"
            elif referrals >= 15:
                tier = "Gold"
                tier_emoji = "🥇"
            elif referrals >= 5:
                tier = "Silver"
                tier_emoji = "🥈"
            else:
                tier = "Bronze"
                tier_emoji = "🥉"
            
            leaderboard.append({
                "rank": idx,
                "userId": user_id,
                "name": user_name,
                "successfulReferrals": referrals,
                "rewardsEarned": data.get("rewards_earned", 0),
                "tier": tier,
                "tierEmoji": tier_emoji
            })
        
        return APIResponse.success({
            "leaderboard": leaderboard,
            "totalCount": len(leaderboard)
        }, "Leaderboard retrieved")

    except Exception as e:
        logger.exception(f"Error fetching leaderboard: {e}")
        return APIResponse.error("Failed to fetch leaderboard", "LEADERBOARD_ERROR", 500, str(e))


@referral_bp.route("/history", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_referral_history():
    """Get user's referral history"""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Support both query parameter and authenticated user context
        user_id = request.args.get("user_id", "").strip() or current_user_id
        
        if not user_id:
            return APIResponse.bad_request("user_id required")

        # Get referral history (no order_by to avoid composite index requirement)
        if FieldFilter:
            history_ref = db.collection("referral_history").where(  # type: ignore
                filter=FieldFilter("referrer_id", "==", user_id)
            )
        else:
            history_ref = db.collection("referral_history").where(  # type: ignore
                "referrer_id", "==", user_id
            )
        
        history_docs = history_ref.get()
        
        history = []
        for doc in history_docs:
            data = doc.to_dict() or {}
            history.append({
                "inviteeName": data.get("invitee_name", "Unknown"),
                "inviteeEmail": data.get("invitee_email", ""),
                "completedAt": data.get("completed_at"),
                "rewardsGranted": data.get("rewards_granted", 1)
            })
        
        # Sort in memory by completed_at (most recent first)
        history.sort(
            key=lambda x: x.get("completedAt", ""),
            reverse=True
        )
        
        return APIResponse.success({
            "history": history,
            "totalCount": len(history)
        }, "Referral history retrieved")

    except Exception as e:
        logger.exception(f"Error fetching referral history: {e}")
        return APIResponse.error("Failed to fetch referral history", "HISTORY_ERROR", 500, str(e))


@referral_bp.route("/rewards/catalog", methods=["GET"])
@rate_limit_by_endpoint
def get_rewards_catalog():
    """Get available rewards catalog"""
    rewards_catalog = [
        {
            "id": "premium_1week",
            "name": "1 Week Premium",
            "description": "Access to all premium features for 1 week",
            "cost": 1,
            "emoji": "⭐",
            "type": "premium"
        },
        {
            "id": "premium_1month",
            "name": "1 Month Premium",
            "description": "Access to all premium features for 1 month",
            "cost": 4,
            "emoji": "🌟",
            "type": "premium"
        },
        {
            "id": "premium_3months",
            "name": "3 Months Premium",
            "description": "Access to all premium features for 3 months",
            "cost": 12,
            "emoji": "✨",
            "type": "premium"
        },
        {
            "id": "vip_support",
            "name": "VIP Support",
            "description": "Priority support for 1 month",
            "cost": 5,
            "emoji": "👑",
            "type": "support"
        },
        {
            "id": "custom_theme",
            "name": "Custom Theme",
            "description": "Unlock exclusive color themes",
            "cost": 3,
            "emoji": "🎨",
            "type": "customization"
        },
        {
            "id": "ai_insights_pro",
            "name": "AI Insights Pro",
            "description": "Advanced AI analytics and predictions",
            "cost": 8,
            "emoji": "🤖",
            "type": "feature"
        },
        {
            "id": "export_data",
            "name": "Data Export",
            "description": "Export all your data to PDF/CSV",
            "cost": 2,
            "emoji": "📊",
            "type": "feature"
        },
        {
            "id": "merch_tshirt",
            "name": "Lugn & Trygg T-shirt",
            "description": "Exclusive t-shirt (free shipping)",
            "cost": 20,
            "emoji": "👕",
            "type": "merchandise"
        }
    ]
    
    return APIResponse.success({
        "rewards": rewards_catalog
    }, "Rewards catalog retrieved")


@referral_bp.route("/rewards/redeem", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def redeem_reward():
    """Redeem a reward using earned weeks"""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        
        data = request.get_json(force=True, silent=True) or {}
        reward_id = sanitize_text(data.get("reward_id", ""), max_length=50)

        if not reward_id:
            return APIResponse.bad_request("reward_id required")

        # Get user's referral data
        referral_ref = db.collection("referrals").document(user_id)  # type: ignore
        referral_doc = referral_ref.get()

        if not referral_doc.exists:
            return APIResponse.not_found("No referral data found")

        referral_data = referral_doc.to_dict() or {}
        available_weeks = referral_data.get("rewards_earned", 0)

        # Get reward details (simplified - should match catalog)
        reward_costs = {
            "premium_1week": 1,
            "premium_1month": 4,
            "premium_3months": 12,
            "vip_support": 5,
            "custom_theme": 3,
            "ai_insights_pro": 8,
            "export_data": 2,
            "merch_tshirt": 20
        }

        cost = reward_costs.get(reward_id)
        if cost is None:
            return APIResponse.bad_request("Invalid reward_id")

        if available_weeks < cost:
            return APIResponse.error(
                "Insufficient rewards",
                "INSUFFICIENT_BALANCE",
                400,
                {"available": available_weeks, "required": cost}
            )

        # Deduct cost and record redemption
        new_balance = available_weeks - cost
        referral_ref.update({
            "rewards_earned": new_balance
        })

        # Record redemption history
        redemption_ref = db.collection("reward_redemptions").document()  # type: ignore
        redemption_ref.set({
            "user_id": user_id,
            "reward_id": reward_id,
            "cost": cost,
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending"
        })

        # Audit log for reward redemption
        audit_log("REWARD_REDEEMED", user_id, {
            "reward_id": reward_id,
            "cost": cost,
            "new_balance": new_balance
        })

        logger.info(f"Reward redeemed: {user_id} -> {reward_id} (cost: {cost} weeks)")

        return APIResponse.success({
            "message": "Reward redeemed successfully",
            "newBalance": new_balance,
            "rewardId": reward_id
        })

    except Exception as e:
        logger.exception(f"Error redeeming reward: {e}")
        return APIResponse.error("Internal server error", "INTERNAL_ERROR", 500)
