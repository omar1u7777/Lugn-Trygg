#!/usr/bin/env python3
"""
Setup Test Authentication for Lugn-Trygg AI Testing

⚠️  WARNING: THIS SCRIPT IS FOR DEVELOPMENT/TESTING ONLY!
⚠️  DO NOT RUN IN PRODUCTION ENVIRONMENT!
⚠️  Contains hardcoded test passwords - for test/demo purposes only!

This script creates proper Firebase Auth users for testing the AI features.
Run this before testing the login functionality.

Usage: python setup_test_auth.py
"""

import os
import sys
from datetime import datetime

# PRODUCTION SAFETY CHECK
if os.getenv('FLASK_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production':
    print("❌ ERROR: Cannot run setup_test_auth.py in PRODUCTION environment!")
    print("❌ This script contains test data and hardcoded passwords.")
    print("❌ Set FLASK_ENV=development or ENVIRONMENT=development to proceed.")
    sys.exit(1)

print("⚠️  WARNING: Running test setup script with hardcoded passwords!")
print("⚠️  This is for DEVELOPMENT/TESTING only - NOT for production!")
print("")

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def setup_firebase_auth():
    """Set up Firebase Auth with test users"""
    try:
        # Initialize Firebase
        from firebase_admin import credentials, auth, initialize_app

        cred = credentials.Certificate("serviceAccountKey.json")
        initialize_app(cred)

        print("🔐 Setting up Firebase Auth test users...")

        # Test users with proper authentication
        test_users = [
            {
                "email": "anna.andersson@test.se",
                "password": "Test123!",
                "name": "Anna Andersson",
                "uid": "test_user_1"
            },
            {
                "email": "erik.eriksson@test.se",
                "password": "Test123!",
                "name": "Erik Eriksson",
                "uid": "test_user_2"
            },
            {
                "email": "maria.pettersson@test.se",
                "password": "Test123!",
                "name": "Maria Pettersson",
                "uid": "test_user_3"
            },
            {
                "email": "lars.larsson@test.se",
                "password": "Test123!",
                "name": "Lars Larsson",
                "uid": "test_user_4"
            }
        ]

        for user in test_users:
            try:
                # Try to create user in Firebase Auth
                auth_user = auth.create_user(
                    email=user["email"],
                    password=user["password"],
                    display_name=user["name"],
                    uid=user["uid"]
                )
                print(f"  ✅ Created auth user: {user['name']} ({user['email']})")

            except auth.EmailAlreadyExistsError:
                print(f"  ℹ️ User already exists: {user['email']}")
            except Exception as e:
                print(f"  ❌ Error creating user {user['email']}: {e}")

        print("\n🎯 Test users ready for login!")
        return True

    except Exception as e:
        print(f"❌ Firebase Auth setup failed: {e}")
        return False

def test_login_functionality():
    """Test the login API endpoint with test users"""
    print("\n🧪 Testing login functionality...")

    import requests
    import json

    # Test login for each user
    test_users = [
        ("anna.andersson@test.se", "Test123!"),
        ("erik.eriksson@test.se", "Test123!"),
        ("maria.pettersson@test.se", "Test123!"),
        ("lars.larsson@test.se", "Test123!")
    ]

    for email, password in test_users:
        try:
            response = requests.post(
                "http://localhost:54112/api/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                print(f"  ✅ Login successful for {email}")
                print(f"    Token: {data.get('access_token')[:50]}...")
                print(f"    User ID: {data.get('user', {}).get('user_id')}")
            else:
                print(f"  ❌ Login failed for {email}: {response.status_code}")
                print(f"    Error: {response.text}")

        except requests.exceptions.ConnectionError:
            print(f"  ⚠️ Cannot connect to backend server at localhost:54112")
            print("    Make sure the backend server is running: python Backend/main.py")
            break
        except Exception as e:
            print(f"  ❌ Error testing login for {email}: {e}")

def main():
    """Main setup function"""
    print("🚀 Setting up test authentication for Lugn-Trygg AI features...")
    print("=" * 60)

    # Setup Firebase Auth users
    auth_success = setup_firebase_auth()

    if auth_success:
        # Test login functionality if backend is running
        test_login_functionality()

        print("\n" + "=" * 60)
        print("✅ Test authentication setup completed!")
        print("\n📋 You can now log in with:")
        print("  Email: anna.andersson@test.se")
        print("  Password: Test123!")
        print("  (or any of the other test accounts)")

        print("\n🔗 Available test accounts:")
        print("  • anna.andersson@test.se (Test123!) - Improving moods")
        print("  • erik.eriksson@test.se (Test123!) - Declining moods")
        print("  • maria.pettersson@test.se (Test123!) - Volatile moods")
        print("  • lars.larsson@test.se (Test123!) - Crisis scenarios")

    else:
        print("\n❌ Authentication setup failed")
        print("Please check your Firebase configuration and serviceAccountKey.json")

if __name__ == "__main__":
    main()