"""
Create or promote a Firebase user to admin role.

Usage:
  python scripts/create_admin.py                  # Creates a NEW admin user
  python scripts/create_admin.py <existing_email>  # Promotes existing user to admin
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.firebase_config import db, auth


ADMIN_EMAIL = "admin@lugn-trygg.com"
ADMIN_PASSWORD = "LugnTrygg@Admin2026!"


def create_admin(email: str = ADMIN_EMAIL, password: str = ADMIN_PASSWORD):
    """Create a new admin user or promote an existing one."""
    if db is None or auth is None:
        print("❌ Firebase not initialized. Check serviceAccountKey.json")
        return

    # Check if user already exists in Firebase Auth
    user_record = None
    try:
        user_record = auth.get_user_by_email(email)
        print(f"✅ Found existing Firebase Auth user: {user_record.uid}")
    except Exception:
        pass

    if user_record is None:
        # Create new Firebase Auth user
        try:
            user_record = auth.create_user(
                email=email,
                password=password,
                display_name="Admin",
                email_verified=True,
            )
            print(f"✅ Created new Firebase Auth user: {user_record.uid}")
        except Exception as e:
            print(f"❌ Failed to create user: {e}")
            return

    uid = user_record.uid

    # Set/update Firestore user document with admin role
    user_ref = db.collection("users").document(uid)
    user_ref.set(
        {
            "email": email,
            "display_name": "Admin",
            "role": "admin",
            "is_admin": True,
            "onboarding_completed": True,
        },
        merge=True,
    )

    # Also set Firebase custom claims for extra security
    try:
        auth.set_custom_user_claims(uid, {"admin": True, "role": "admin"})
        print("✅ Set custom auth claims: admin=True")
    except Exception as e:
        print(f"⚠️  Could not set custom claims: {e}")

    print()
    print("=" * 50)
    print("🔑 ADMIN CREDENTIALS")
    print("=" * 50)
    print(f"  Email:    {email}")
    print(f"  Password: {password}")
    print(f"  UID:      {uid}")
    print(f"  Role:     admin")
    print("=" * 50)
    print()
    print("Use these to log in via the frontend login page.")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Promote existing user
        existing_email = sys.argv[1]
        print(f"🔄 Promoting {existing_email} to admin...")
        create_admin(email=existing_email, password="(unchanged)")
    else:
        print("🆕 Creating new admin account...")
        create_admin()
