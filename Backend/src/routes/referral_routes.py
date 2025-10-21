"""
Referral Program Routes
Handles user referrals, tracking, and rewards
"""
import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from src.firebase_config import db
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
    if request.method == "OPTIONS":
        # Handle CORS preflight
        return "", 204
    
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        
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
            return jsonify(referral_data), 200

        # Return existing referral data
        referral_data = referral_doc.to_dict()
        return jsonify(referral_data), 200

    except Exception as e:
        logger.exception(f"Error generating referral: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route("/stats", methods=["GET", "OPTIONS"])
def get_referral_stats():
    """Get user's referral statistics"""
    if request.method == "OPTIONS":
        # Handle CORS preflight
        return "", 204
    
    try:
        user_id = request.args.get("user_id", "").strip()
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
        referral_link = data.get("referral_link", "")

        if not user_id or not email:
            return jsonify({"error": "user_id and email required"}), 400

        # Store invitation in pending referrals
        invitation_ref = db.collection("referral_invitations").document()
        invitation_ref.set({
            "referrer_id": user_id,
            "invitee_email": email,
            "referral_link": referral_link,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat()
        })

        # Update pending referrals count
        referral_ref = db.collection("referrals").document(user_id)
        referral_doc = referral_ref.get()
        if referral_doc.exists:
            referral_data = referral_doc.to_dict()
            referral_ref.update({
                "total_referrals": referral_data.get("total_referrals", 0) + 1,
                "pending_referrals": referral_data.get("pending_referrals", 0) + 1
            })

        # TODO: Send actual email via SendGrid/AWS SES
        logger.info(f"Referral invitation sent from {user_id} to {email}")

        return jsonify({
            "success": True,
            "message": "Invitation sent successfully"
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

        if not referrer_id or not invitee_id:
            return jsonify({"error": "referrer_id and invitee_id required"}), 400

        # Update referral stats
        referral_ref = db.collection("referrals").document(referrer_id)
        referral_doc = referral_ref.get()

        if referral_doc.exists:
            referral_data = referral_doc.to_dict()
            successful_referrals = referral_data.get("successful_referrals", 0) + 1
            pending_referrals = max(0, referral_data.get("pending_referrals", 0) - 1)

            # Calculate rewards (1 week premium per 5 successful referrals)
            rewards_earned = successful_referrals // 5

            referral_ref.update({
                "successful_referrals": successful_referrals,
                "pending_referrals": pending_referrals,
                "rewards_earned": rewards_earned,
                "last_referral_at": datetime.now(timezone.utc).isoformat()
            })

            logger.info(f"Referral completed: {referrer_id} -> {invitee_id}")

            return jsonify({
                "success": True,
                "successful_referrals": successful_referrals,
                "rewards_earned": rewards_earned
            }), 200

        return jsonify({"error": "Referrer not found"}), 404

    except Exception as e:
        logger.exception(f"Error completing referral: {e}")
        return jsonify({"error": "Internal server error"}), 500
