"""
Referral Program Routes
Handles user referrals, tracking, and rewards
"""
import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from ..firebase_config import db
from ..services.email_service import email_service
from ..services.push_notification_service import push_notification_service
import random
import string

referral_bp = Blueprint("referral", __name__)
logger = logging.getLogger(__name__)

def generate_referral_code(user_id: str) -> str:
    """Generate a unique referral code for user"""
    # Use first 4 chars of user_id + 4 random uppercase letters
    code = user_id[:4].upper() + ''.join(random.choices(string.ascii_uppercase, k=4))
    return code

@referral_bp.route("/generate", methods=["POST", "OPTIONS"])
def generate_referral():
    """Generate referral code and data for user"""
    logger.info("🎁 REFERRAL - GENERATE endpoint called")
    if request.method == "OPTIONS":
        logger.info("✅ REFERRAL - OPTIONS preflight")
        # Handle CORS preflight
        return "", 204
    
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        logger.info(f"👤 REFERRAL - Generating for user: {user_id}")
        
        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        # Get or create referral document
        referral_ref = db.collection("referrals").document(user_id)
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
            return jsonify(referral_data), 200

        # Return existing referral data
        referral_data = referral_doc.to_dict()
        logger.info(f"✅ REFERRAL - Returning existing referral data for user {user_id}")
        return jsonify(referral_data), 200

    except Exception as e:
        logger.exception(f"Error generating referral: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route("/stats", methods=["GET", "OPTIONS"])
def get_referral_stats():
    """Get user's referral statistics"""
    logger.info("📊 REFERRAL - STATS endpoint called")
    if request.method == "OPTIONS":
        logger.info("✅ REFERRAL - OPTIONS preflight")
        # Handle CORS preflight
        return "", 204
    
    try:
        user_id = request.args.get("user_id", "").strip()
        logger.info(f"👤 REFERRAL - Getting stats for user: {user_id}")
        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        # Get referral document
        referral_ref = db.collection("referrals").document(user_id)
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
            return jsonify(referral_data), 200

        referral_data = referral_doc.to_dict()
        return jsonify(referral_data), 200

    except Exception as e:
        logger.exception(f"Error fetching referral stats: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route("/invite", methods=["POST", "OPTIONS"])
def send_invitation():
    """Send referral invitation via email"""
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        email = data.get("email", "").strip()
        referrer_name = data.get("referrer_name", "Din vän").strip()

        if not user_id or not email:
            return jsonify({"error": "user_id and email required"}), 400

        # Get referral data
        referral_ref = db.collection("referrals").document(user_id)
        referral_doc = referral_ref.get()
        
        if not referral_doc.exists:
            return jsonify({"error": "Referral code not found. Generate one first."}), 404
        
        referral_data = referral_doc.to_dict()
        referral_code = referral_data.get("referral_code")
        referral_link = f"https://lugn-trygg.vercel.app/register?ref={referral_code}"

        # Store invitation in pending referrals
        invitation_ref = db.collection("referral_invitations").document()
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

        logger.info(f"Referral invitation sent from {user_id} to {email}")

        return jsonify({
            "success": True,
            "message": "Invitation sent successfully",
            "email_sent": email_result.get("success", False),
            "email_status": email_result.get("message", "Email service unavailable")
        }), 200

    except Exception as e:
        logger.exception(f"Error sending invitation: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route("/complete", methods=["POST", "OPTIONS"])
def complete_referral():
    """Mark a referral as completed when invitee signs up"""
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        data = request.get_json(force=True, silent=True) or {}
        referrer_id = data.get("referrer_id", "").strip()
        invitee_id = data.get("invitee_id", "").strip()
        invitee_name = data.get("invitee_name", "New User").strip()
        invitee_email = data.get("invitee_email", "").strip()

        if not referrer_id or not invitee_id:
            return jsonify({"error": "referrer_id and invitee_id required"}), 400

        # Update referral stats
        referral_ref = db.collection("referrals").document(referrer_id)
        referral_doc = referral_ref.get()

        if referral_doc.exists:
            referral_data = referral_doc.to_dict()
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
            history_ref = db.collection("referral_history").document()
            history_ref.set({
                "referrer_id": referrer_id,
                "invitee_id": invitee_id,
                "invitee_name": invitee_name,
                "invitee_email": invitee_email,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "rewards_granted": 1  # 1 week per referral
            })

            # Get referrer info for email & push notifications
            try:
                referrer_doc = db.collection("users").document(referrer_id).get()
                if referrer_doc.exists:
                    referrer_info = referrer_doc.to_dict()
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

            return jsonify({
                "success": True,
                "successful_referrals": successful_referrals,
                "rewards_earned": rewards_earned,
                "notification_sent": True
            }), 200

        return jsonify({"error": "Referrer not found"}), 404

    except Exception as e:
        logger.exception(f"Error completing referral: {e}")
        return jsonify({"error": "Internal server error"}), 500


@referral_bp.route("/leaderboard", methods=["GET", "OPTIONS"])
def get_leaderboard():
    """Get top referrers leaderboard"""
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        limit = int(request.args.get("limit", 10))
        limit = min(limit, 100)  # Max 100 results

        # Query top referrers by successful_referrals
        referrals_ref = db.collection("referrals").order_by(
            "successful_referrals", direction="DESCENDING"
        ).limit(limit)
        
        referrals_docs = referrals_ref.get()
        
        leaderboard = []
        for idx, doc in enumerate(referrals_docs, start=1):
            data = doc.to_dict()
            user_id = data.get("user_id")
            
            # Get user info
            user_doc = db.collection("users").document(user_id).get()
            user_name = "Anonymous"
            if user_doc.exists:
                user_info = user_doc.to_dict()
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
                "user_id": user_id,
                "name": user_name,
                "successful_referrals": referrals,
                "rewards_earned": data.get("rewards_earned", 0),
                "tier": tier,
                "tier_emoji": tier_emoji
            })
        
        return jsonify({
            "success": True,
            "leaderboard": leaderboard,
            "total_count": len(leaderboard)
        }), 200

    except Exception as e:
        logger.exception(f"Error fetching leaderboard: {e}")
        return jsonify({"error": "Internal server error"}), 500


@referral_bp.route("/history", methods=["GET", "OPTIONS"])
def get_referral_history():
    """Get user's referral history"""
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        # Support both query parameter and authenticated user context
        user_id = request.args.get("user_id", "").strip()
        
        # Try to get from Flask g context if not in query params
        if not user_id:
            from flask import g
            user_id = getattr(g, 'user_id', None)
        
        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        # Get referral history (no order_by to avoid composite index requirement)
        from google.cloud.firestore import FieldFilter
        history_ref = db.collection("referral_history").where(
            filter=FieldFilter("referrer_id", "==", user_id)
        )
        
        history_docs = history_ref.get()
        
        history = []
        for doc in history_docs:
            data = doc.to_dict()
            history.append({
                "invitee_name": data.get("invitee_name", "Unknown"),
                "invitee_email": data.get("invitee_email", ""),
                "completed_at": data.get("completed_at"),
                "rewards_granted": data.get("rewards_granted", 1)
            })
        
        # Sort in memory by completed_at (most recent first)
        history.sort(
            key=lambda x: x.get("completed_at", ""),
            reverse=True
        )
        
        return jsonify({
            "success": True,
            "history": history,
            "total_count": len(history)
        }), 200

    except Exception as e:
        logger.exception(f"Error fetching referral history: {e}")
        return jsonify({"error": "Internal server error"}), 500


@referral_bp.route("/rewards/catalog", methods=["GET", "OPTIONS"])
def get_rewards_catalog():
    """Get available rewards catalog"""
    if request.method == "OPTIONS":
        return "", 204
    
    rewards_catalog = [
        {
            "id": "premium_1week",
            "name": "1 Vecka Premium",
            "description": "Tillgång till alla premium-funktioner i 1 vecka",
            "cost": 1,
            "emoji": "⭐",
            "type": "premium"
        },
        {
            "id": "premium_1month",
            "name": "1 Månad Premium",
            "description": "Tillgång till alla premium-funktioner i 1 månad",
            "cost": 4,
            "emoji": "🌟",
            "type": "premium"
        },
        {
            "id": "premium_3months",
            "name": "3 Månader Premium",
            "description": "Tillgång till alla premium-funktioner i 3 månader",
            "cost": 12,
            "emoji": "✨",
            "type": "premium"
        },
        {
            "id": "vip_support",
            "name": "VIP Support",
            "description": "Prioriterad support i 1 månad",
            "cost": 5,
            "emoji": "👑",
            "type": "support"
        },
        {
            "id": "custom_theme",
            "name": "Anpassat Tema",
            "description": "Låsa upp exklusiva färgteman",
            "cost": 3,
            "emoji": "🎨",
            "type": "customization"
        },
        {
            "id": "ai_insights_pro",
            "name": "AI Insights Pro",
            "description": "Avancerade AI-analyser och prediktioner",
            "cost": 8,
            "emoji": "🤖",
            "type": "feature"
        },
        {
            "id": "export_data",
            "name": "Data Export",
            "description": "Exportera all din data till PDF/CSV",
            "cost": 2,
            "emoji": "📊",
            "type": "feature"
        },
        {
            "id": "merch_tshirt",
            "name": "Lugn & Trygg T-shirt",
            "description": "Exklusiv t-shirt (gratis frakt)",
            "cost": 20,
            "emoji": "👕",
            "type": "merchandise"
        }
    ]
    
    return jsonify({
        "success": True,
        "rewards": rewards_catalog
    }), 200


@referral_bp.route("/rewards/redeem", methods=["POST", "OPTIONS"])
def redeem_reward():
    """Redeem a reward using earned weeks"""
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        reward_id = data.get("reward_id", "").strip()

        if not user_id or not reward_id:
            return jsonify({"error": "user_id and reward_id required"}), 400

        # Get user's referral data
        referral_ref = db.collection("referrals").document(user_id)
        referral_doc = referral_ref.get()

        if not referral_doc.exists:
            return jsonify({"error": "No referral data found"}), 404

        referral_data = referral_doc.to_dict()
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
            return jsonify({"error": "Invalid reward_id"}), 400

        if available_weeks < cost:
            return jsonify({
                "error": "Insufficient rewards",
                "available": available_weeks,
                "required": cost
            }), 400

        # Deduct cost and record redemption
        new_balance = available_weeks - cost
        referral_ref.update({
            "rewards_earned": new_balance
        })

        # Record redemption history
        redemption_ref = db.collection("reward_redemptions").document()
        redemption_ref.set({
            "user_id": user_id,
            "reward_id": reward_id,
            "cost": cost,
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending"
        })

        logger.info(f"Reward redeemed: {user_id} -> {reward_id} (cost: {cost} weeks)")

        return jsonify({
            "success": True,
            "message": "Reward redeemed successfully",
            "new_balance": new_balance,
            "reward_id": reward_id
        }), 200

    except Exception as e:
        logger.exception(f"Error redeeming reward: {e}")
        return jsonify({"error": "Internal server error"}), 500
