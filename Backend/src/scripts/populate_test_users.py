#!/usr/bin/env python3
"""
Populate Test Users Script for Lugn-Trygg

This script creates 100 test users in Firestore with randomized data:
- 33 Swedish (sv), 33 English (en), 34 Norwegian (no)
- Randomized moods, memories, subscriptions (10% premium), and activity logs

Usage: python populate_test_users.py
"""

import os
import sys
import random
from datetime import datetime, timedelta, timezone
from firebase_admin import auth
from src.firebase_config import initialize_firebase, db

# Language distributions
LANGUAGE_DISTRIBUTION = {
    'sv': 3,  # Swedish
    'en': 3,  # English
    'no': 4   # Norwegian
}

# Mood categories from mood_routes.py
ALL_MOODS = [
    "ledsen", "arg", "stressad", "deppig", "frustrerad", "irriterad", "orolig",
    "glad", "lycklig", "nöjd", "tacksam", "positiv"
]

# Sample names by language
SWEDISH_NAMES = [
    ("Anna Andersson", "anna.andersson"),
    ("Erik Eriksson", "erik.eriksson"),
    ("Maria Pettersson", "maria.pettersson"),
    ("Lars Larsson", "lars.larsson"),
    ("Sara Johansson", "sara.johansson"),
    ("Anders Nilsson", "anders.nilsson"),
    ("Emma Karlsson", "emma.karlsson"),
    ("Johan Olsson", "johan.olsson"),
    ("Linda Svensson", "linda.svensson"),
    ("Peter Gustafsson", "peter.gustafsson"),
    ("Karin Persson", "karin.persson"),
    ("Mikael Holm", "mikael.holm"),
    ("Helena Lindberg", "helena.lindberg"),
    ("Daniel Berg", "daniel.berg"),
    ("Camilla Forsberg", "camilla.forsberg"),
    ("Fredrik Lund", "fredrik.lund"),
    ("Åsa Wallin", "asa.wallin"),
    ("Magnus Sjöberg", "magnus.sjoberg"),
    ("Eva Nyström", "eva.nystrom"),
    ("Henrik Dahl", "henrik.dahl"),
    ("Ingrid Axelsson", "ingrid.axelsson"),
    ("Olof Björk", "olof.bjork"),
    ("Birgitta Sandström", "birgitta.sandstrom"),
    ("Gustav Ek", "gustav.ek"),
    ("Sofia Åberg", "sofia.aberg"),
    ("Nils Holmgren", "nils.holmgren"),
    ("Elin Lind", "elin.lind"),
    ("Tobias Falk", "tobias.falk"),
    ("Anneli Strand", "anneli.strand"),
    ("Rolf Werner", "rolf.werner"),
    ("Ulla Möller", "ulla.moller"),
    ("Björn Viklund", "bjorn.viklund"),
    ("Kristina Löfgren", "kristina.lofgren")
]

ENGLISH_NAMES = [
    ("John Smith", "john.smith"),
    ("Sarah Johnson", "sarah.johnson"),
    ("Michael Brown", "michael.brown"),
    ("Emily Davis", "emily.davis"),
    ("David Wilson", "david.wilson"),
    ("Jessica Taylor", "jessica.taylor"),
    ("Christopher Anderson", "christopher.anderson"),
    ("Amanda Thomas", "amanda.thomas"),
    ("James Jackson", "james.jackson"),
    ("Olivia White", "olivia.white"),
    ("William Harris", "william.harris"),
    ("Sophia Martin", "sophia.martin"),
    ("Benjamin Thompson", "benjamin.thompson"),
    ("Isabella Garcia", "isabella.garcia"),
    ("Alexander Martinez", "alexander.martinez"),
    ("Mia Robinson", "mia.robinson"),
    ("Ethan Clark", "ethan.clark"),
    ("Charlotte Rodriguez", "charlotte.rodriguez"),
    ("Daniel Lewis", "daniel.lewis"),
    ("Ava Lee", "ava.lee"),
    ("Matthew Walker", "matthew.walker"),
    ("Harper Hall", "harper.hall"),
    ("Joseph Allen", "joseph.allen"),
    ("Evelyn Young", "evelyn.young"),
    ("Andrew King", "andrew.king"),
    ("Abigail Wright", "abigail.wright"),
    ("Anthony Lopez", "anthony.lopez"),
    ("Elizabeth Hill", "elizabeth.hill"),
    ("Joshua Scott", "joshua.scott"),
    ("Sofia Green", "sofia.green"),
    ("Samuel Adams", "samuel.adams"),
    ("Grace Baker", "grace.baker")
]

NORWEGIAN_NAMES = [
    ("Ole Hansen", "ole.hansen"),
    ("Kari Olsen", "kari.olsen"),
    ("Per Larsen", "per.larsen"),
    ("Anne Johansen", "anne.johansen"),
    ("Jan Andersen", "jan.andersen"),
    ("Ingrid Nilsen", "ingrid.nilsen"),
    ("Bjørn Pedersen", "bjorn.pedersen"),
    ("Marianne Kristiansen", "marianne.kristiansen"),
    ("Lars Jensen", "lars.jensen"),
    ("Hilde Thomassen", "hilde.thomassen"),
    ("Erik Karlsen", "erik.karlsen"),
    ("Turid Eriksen", "turid.eriksen"),
    ("Svein Berg", "svein.berg"),
    ("Liv Hagen", "liv.hagen"),
    ("Arne Bakken", "arne.bakken"),
    ("Grete Solberg", "grete.solberg"),
    ("Tor Johansen", "tor.johansen"),
    ("Wenche Larsen", "wenche.larsen"),
    ("Geir Andersen", "geir.andersen"),
    ("Bente Nilsen", "bente.nilsen"),
    ("Rune Pedersen", "rune.pedersen"),
    ("Heidi Kristiansen", "heidi.kristiansen"),
    ("Terje Jensen", "terje.jensen"),
    ("Unni Thomassen", "unni.thomassen"),
    ("Odd Karlsen", "odd.karlsen"),
    ("Tone Eriksen", "tone.eriksen"),
    ("Kjell Berg", "kjell.berg"),
    ("May Hagen", "may.hagen"),
    ("Roar Bakken", "roar.bakken"),
    ("Elin Solberg", "elin.solberg"),
    ("Finn Johansen", "finn.johansen"),
    ("Sissel Larsen", "sissel.larsen"),
    ("Harald Andersen", "harald.andersen")
]

NAMES_BY_LANGUAGE = {
    'sv': SWEDISH_NAMES,
    'en': ENGLISH_NAMES,
    'no': NORWEGIAN_NAMES
}

def generate_random_moods(user_id, language, num_entries=20):
    """Generate random mood entries for a user"""
    moods = []
    base_date = datetime.now(timezone.utc) - timedelta(days=30)

    for i in range(num_entries):
        # Random timestamp within last 30 days
        timestamp = base_date + timedelta(
            days=random.randint(0, 29),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )

        mood = random.choice(ALL_MOODS)

        # Generate score based on mood category
        if mood in ["glad", "lycklig", "nöjd", "tacksam", "positiv"]:
            score = random.uniform(0.1, 1.0)
        elif mood in ["ledsen", "arg", "stressad", "deppig", "frustrerad", "irriterad", "orolig"]:
            score = random.uniform(-1.0, -0.1)
        else:
            score = random.uniform(-0.5, 0.5)

        mood_data = {
            "mood": mood,
            "score": round(score, 2),
            "timestamp": timestamp.isoformat(),
            "source": "random_test_data",
            "decrypted_mood": mood
        }

        moods.append((timestamp.isoformat(), mood_data))

    return moods

def generate_random_memories(user_id, language, num_entries=3):
    """Generate random memory entries for a user"""
    memories = []
    base_date = datetime.now(timezone.utc) - timedelta(days=30)

    for i in range(num_entries):
        timestamp = base_date + timedelta(
            days=random.randint(0, 29),
            hours=random.randint(0, 23)
        )

        memory_data = {
            "user_id": user_id,
            "file_path": f"memories/{user_id}/memory_{i+1}.mp3",
            "timestamp": timestamp.isoformat()
        }

        memories.append(memory_data)

    return memories

def generate_subscription(user_id):
    """Generate subscription data (10% premium)"""
    is_premium = random.random() < 0.1

    if is_premium:
        return {
            "status": "active",
            "plan": "premium",
            "start_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 365))).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    else:
        return {
            "status": "free",
            "plan": "free"
        }

def generate_activity_logs(user_id, num_entries=15):
    """Generate activity log entries"""
    activities = []
    base_date = datetime.now(timezone.utc) - timedelta(days=30)

    activity_types = [
        "login", "mood_logged", "memory_uploaded", "chat_message",
        "profile_updated", "subscription_viewed", "weekly_analysis_viewed"
    ]

    for i in range(num_entries):
        timestamp = base_date + timedelta(
            days=random.randint(0, 29),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )

        activity_data = {
            "user_id": user_id,
            "activity_type": random.choice(activity_types),
            "timestamp": timestamp.isoformat(),
            "ip_address": f"192.168.1.{random.randint(1, 255)}",
            "user_agent": "TestData/1.0"
        }

        activities.append(activity_data)

    return activities

def create_test_user(email, password, display_name, language):
    """Create a user in Firebase Auth"""
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name
        )
        return user.uid
    except Exception as e:
        print(f"Failed to create user {email}: {e}")
        return None

def populate_user_data(user_id, email, display_name, language):
    """Populate Firestore data for a user"""
    try:
        # User document
        user_data = {
            "email": email,
            "email_punycode": email,  # Simplified
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))).isoformat(),
            "email_verified": random.choice([True, False]),
            "language": language,
            "subscription": generate_subscription(user_id)
        }

        db.collection("users").document(user_id).set(user_data)

        # Mood logs
        moods = generate_random_moods(user_id, language)
        for timestamp, mood_data in moods:
            db.collection("users").document(user_id).collection("moods").document(timestamp).set(mood_data)

        # Memories
        memories = generate_random_memories(user_id, language)
        for memory in memories:
            db.collection("memories").document(f"{user_id}_{memory['timestamp']}").set(memory)

        # Activity logs
        activities = generate_activity_logs(user_id)
        for activity in activities:
            db.collection("audit_logs").document(f"{user_id}_{activity['timestamp']}").set(activity)

        return True
    except Exception as e:
        print(f"Failed to populate data for user {user_id}: {e}")
        return False

def main():
    """Main function to create test users"""
    print("🚀 Starting population of 10 test users...")
    print("=" * 60)

    # Initialize Firebase
    if not initialize_firebase():
        print("❌ Firebase initialization failed")
        return

    total_created = 0
    password = "TestPass123!"  # Default password for test users

    for language, count in LANGUAGE_DISTRIBUTION.items():
        print(f"\n🌍 Creating {count} users for language: {language}")

        names = NAMES_BY_LANGUAGE[language]
        selected_names = random.sample(names, count)

        for display_name, email_prefix in selected_names:
            email = f"{email_prefix}@test.{language}"

            # Create Firebase Auth user
            user_id = create_test_user(email, password, display_name, language)
            if not user_id:
                continue

            # Populate Firestore data
            if populate_user_data(user_id, email, display_name, language):
                total_created += 1
                print(f"  ✅ Created user: {display_name} ({email}) - UID: {user_id}")
            else:
                # Clean up failed user
                try:
                    auth.delete_user(user_id)
                except:
                    pass

    print("=" * 60)
    print(f"✅ Successfully created {total_created} test users!")
    print("\n📊 Data Summary:")
    print("  • Users distributed across languages (sv:3, en:3, no:4)")
    print("  • Each user has 20 randomized mood entries")
    print("  • Each user has 3 memory entries")
    print("  • 10% of users have premium subscriptions")
    print("  • Each user has 15 activity log entries")
    print("\n🔐 Default login credentials:")
    print("  Password: TestPass123!")
    print("\n🎯 Ready for traction analysis and testing!")

if __name__ == "__main__":
    main()