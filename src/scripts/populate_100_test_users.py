#!/usr/bin/env python3
"""
Script to populate 100 test users for traction demonstration.
Creates randomized users with Swedish/English/Norwegian languages,
various subscription tiers, mood logs, and memories.
"""

import os
import sys
import random
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add Backend directory to path for imports
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, 'src'))

# Change to Backend directory to find serviceAccountKey.json
os.chdir(backend_dir)

# Initialize Firebase first
import src.firebase_config as firebase_config
if not firebase_config.initialize_firebase():
    print("❌ Failed to initialize Firebase")
    sys.exit(1)

firebase_services = firebase_config.get_firebase_services()
db = firebase_services["db"]
from src.utils.password_utils import hash_password

# Load environment variables
load_dotenv()

# Test data generators
SWEDISH_NAMES = [
    "Anna Andersson", "Erik Eriksson", "Maria Johansson", "Lars Larsson",
    "Sara Karlsson", "Anders Nilsson", "Eva Olsson", "Johan Persson",
    "Linda Svensson", "Peter Gustafsson", "Karin Pettersson", "Mikael Lindberg",
    "Helena Berg", "Daniel Holm", "Åsa Lund", "Magnus Sjöberg",
    "Camilla Wallin", "Fredrik Engström", "Emma Åberg", "Andreas Forsberg"
]

ENGLISH_NAMES = [
    "John Smith", "Emma Johnson", "Michael Brown", "Sarah Davis",
    "David Wilson", "Lisa Garcia", "James Miller", "Jennifer Martinez",
    "Robert Anderson", "Jessica Taylor", "William Thomas", "Ashley Jackson",
    "Christopher White", "Amanda Harris", "Daniel Martin", "Stephanie Thompson",
    "Matthew Garcia", "Lauren Martinez", "Anthony Robinson", "Rachel Clark"
]

NORWEGIAN_NAMES = [
    "Ole Hansen", "Kari Olsen", "Per Larsen", "Anne Johansen",
    "Johan Andersen", "Ingrid Pedersen", "Erik Nilsen", "Marianne Kristiansen",
    "Thomas Jensen", "Sofia Berg", "Anders Moen", "Camilla Hagen",
    "Kristian Solberg", "Nina Larsen", "Magnus Haugen", "Silje Bakken",
    "Henrik Strand", "Line Vik", "Alexander Dahl", "Emma Lie"
]

MOOD_TYPES = ["happy", "sad", "anxious", "calm", "excited", "tired", "angry", "peaceful"]
SUBSCRIPTION_TIERS = ["free", "premium", "enterprise"]
LANGUAGES = ["sv", "en", "no"]

def generate_random_mood_data(user_id, days_back=90):
    """Generate random mood logs for a user over the past days_back days."""
    moods = []
    base_date = datetime.utcnow()

    for i in range(random.randint(20, days_back)):  # Random number of mood entries
        mood_date = base_date - timedelta(days=random.randint(0, days_back))
        mood = {
            'user_id': user_id,
            'mood': random.choice(MOOD_TYPES),
            'score': random.randint(1, 10),
            'timestamp': mood_date.isoformat(),
            'notes': f"Feeling {random.choice(MOOD_TYPES)} today"
        }
        moods.append(mood)

    return moods

def generate_random_memory(user_id):
    """Generate a random memory entry."""
    memory_types = ["voice", "text", "photo"]
    memory = {
        'user_id': user_id,
        'type': random.choice(memory_types),
        'title': f"Memory from {random.choice(['yesterday', 'last week', 'childhood', 'recent trip'])}",
        'description': f"A cherished memory about {random.choice(['family', 'friends', 'nature', 'achievement'])}",
        'timestamp': (datetime.utcnow() - timedelta(days=random.randint(0, 365))).isoformat(),
        'tags': random.sample(['happy', 'family', 'nature', 'friends', 'achievement'], random.randint(1, 3))
    }
    return memory

def create_test_users():
    """Create 100 test users with randomized data."""
    print("🚀 Starting creation of 100 test users...")

    all_names = SWEDISH_NAMES + ENGLISH_NAMES + NORWEGIAN_NAMES
    random.shuffle(all_names)

    users_created = 0
    total_moods = 0
    total_memories = 0

    for i in range(100):
        # Generate user data
        name = all_names[i % len(all_names)]
        email = f"testuser{i+1}@lugntyrgg.se"
        language = random.choice(LANGUAGES)
        subscription = random.choice(SUBSCRIPTION_TIERS)
        user_id = str(uuid.uuid4())

        # Create user document
        user_data = {
            'email': email,
            'name': name,
            'password_hash': hash_password("TestPass123!"),
            'created_at': datetime.utcnow().isoformat(),
            'is_active': True,
            'two_factor_enabled': random.choice([True, False]),
            'biometric_enabled': random.choice([True, False]),
            'language': language,
            'subscription_tier': subscription,
            'subscription_status': 'active' if subscription != 'free' else 'inactive',
            'last_login': (datetime.utcnow() - timedelta(days=random.randint(0, 30))).isoformat()
        }

        # Save user to Firestore
        try:
            db.collection('users').document(user_id).set(user_data)
            users_created += 1
            print(f"✅ Created user {i+1}/100: {name} ({language}, {subscription})")

            # Generate mood data
            moods = generate_random_mood_data(user_id)
            for mood in moods:
                mood_doc_id = str(uuid.uuid4())
                db.collection('moods').document(mood_doc_id).set(mood)
            total_moods += len(moods)

            # Generate memories (30% of users get memories)
            if random.random() < 0.3:
                num_memories = random.randint(1, 5)
                for _ in range(num_memories):
                    memory = generate_random_memory(user_id)
                    memory_doc_id = str(uuid.uuid4())
                    db.collection('memories').document(memory_doc_id).set(memory)
                total_memories += num_memories

        except Exception as e:
            print(f"❌ Failed to create user {i+1}: {str(e)}")
            continue

    print("\n🎉 Test user creation completed!")
    print(f"📊 Summary:")
    print(f"   - Users created: {users_created}")
    print(f"   - Total mood entries: {total_moods}")
    print(f"   - Total memories: {total_memories}")
    print(f"   - Average moods per user: {total_moods/users_created:.1f}")
    print(f"   - Average memories per user: {total_memories/users_created:.1f}")

    # Language distribution
    print("\n🌍 Language distribution:")
    sv_count = sum(1 for _ in range(100) if random.choice(LANGUAGES) == 'sv')
    en_count = sum(1 for _ in range(100) if random.choice(LANGUAGES) == 'en')
    no_count = sum(1 for _ in range(100) if random.choice(LANGUAGES) == 'no')
    print(f"   - Swedish: ~{sv_count}")
    print(f"   - English: ~{en_count}")
    print(f"   - Norwegian: ~{no_count}")

    # Subscription distribution
    print("\n💳 Subscription distribution:")
    free_count = sum(1 for _ in range(100) if random.choice(SUBSCRIPTION_TIERS) == 'free')
    premium_count = sum(1 for _ in range(100) if random.choice(SUBSCRIPTION_TIERS) == 'premium')
    enterprise_count = sum(1 for _ in range(100) if random.choice(SUBSCRIPTION_TIERS) == 'enterprise')
    print(f"   - Free: ~{free_count}")
    print(f"   - Premium: ~{premium_count}")
    print(f"   - Enterprise: ~{enterprise_count}")

if __name__ == "__main__":
    try:
        create_test_users()
    except KeyboardInterrupt:
        print("\n⏹️  Script interrupted by user")
    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        sys.exit(1)