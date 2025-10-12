#!/usr/bin/env python3
"""
Script to populate Firestore with 100 test users for traction demonstration.
Creates randomized user data with moods, memories, subscriptions, and multilingual support.
"""

import os
import sys
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Firebase Admin SDK
try:
    # Try to use the firebase_config module for proper initialization
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from firebase_config import db
    print("✅ Firebase initialized successfully via config module")
except ImportError:
    try:
        cred_path = os.getenv('FIREBASE_CREDENTIALS', 'serviceAccountKey.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("✅ Firebase initialized successfully")
        else:
            print(f"❌ Firebase credentials file not found: {cred_path}")
            print("📝 For demo purposes, creating mock data instead...")
            # Create a mock implementation for demonstration
            class MockDB:
                def collection(self, name):
                    return MockCollection(name)
            class MockCollection:
                def __init__(self, name):
                    self.name = name
                    self.data = []
                def add(self, data):
                    self.data.append(data)
                    return f"mock_doc_{len(self.data)}"
                def document(self, doc_id):
                    return MockDocument(doc_id, self)
            class MockDocument:
                def __init__(self, doc_id, collection):
                    self.id = doc_id
                    self.collection = collection
                    self.doc_data = None
                def set(self, data):
                    self.doc_data = data
                    print(f"📝 Mock saved to {self.collection.name}/{self.id}")
            db = MockDB()
    except Exception as e:
        print(f"❌ Firebase initialization failed: {e}")
        sys.exit(1)

# Test data generators
LANGUAGES = ['sv', 'en', 'no']
SUBSCRIPTION_TIERS = ['free', 'premium', 'pro']
MOOD_SENTIMENTS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL']
MOOD_TEXTS = {
    'sv': {
        'POSITIVE': ['Jag känner mig glad idag!', 'Så bra energi idag', 'Mycket tacksam för dagen'],
        'NEGATIVE': ['Känner mig lite nere', 'Stressad över jobbet', 'Svårt att koncentrera'],
        'NEUTRAL': ['Ganska normal dag', 'Varken bra eller dåligt', 'Standardkänsla']
    },
    'en': {
        'POSITIVE': ['Feeling great today!', 'So much energy today', 'Very grateful for the day'],
        'NEGATIVE': ['Feeling a bit down', 'Stressed about work', 'Hard to concentrate'],
        'NEUTRAL': ['Pretty normal day', 'Neither good nor bad', 'Standard feeling']
    },
    'no': {
        'POSITIVE': ['Føler meg glad i dag!', 'Så mye energi i dag', 'Svært takknemlig for dagen'],
        'NEGATIVE': ['Føler meg litt nede', 'Stresset over jobb', 'Vanskelig å konsentrere'],
        'NEUTRAL': ['Ganske normal dag', 'Verken bra eller dårlig', 'Standardfølelse']
    }
}

MEMORY_CONTENTS = {
    'sv': ['En vacker promenad i parken', 'Träffade gamla vänner', 'Lyssnade på avslappnande musik', 'Gjorde yoga hemma'],
    'en': ['A beautiful walk in the park', 'Met old friends', 'Listened to relaxing music', 'Did yoga at home'],
    'no': ['En vakker tur i parken', 'Møtte gamle venner', 'Lytta til avslappende musikk', 'Gjorde yoga hjemme']
}

def generate_random_user(index: int) -> Dict[str, Any]:
    """Generate a random test user"""
    user_id = f"test_user_{index:03d}"
    language = random.choice(LANGUAGES)
    subscription = random.choices(SUBSCRIPTION_TIERS, weights=[0.6, 0.3, 0.1])[0]

    # Generate realistic names based on language
    if language == 'sv':
        first_names = ['Anna', 'Erik', 'Maria', 'Lars', 'Sara', 'Anders', 'Emma', 'Johan']
        last_names = ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson']
    elif language == 'no':
        first_names = ['Anne', 'Ole', 'Kari', 'Per', 'Ingrid', 'Bjørn', 'Sofie', 'Lars']
        last_names = ['Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Pedersen']
    else:  # en
        first_names = ['John', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'James', 'Anna']
        last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller']

    name = f"{random.choice(first_names)} {random.choice(last_names)}"
    email = f"{user_id}@test.lugn-trygg.se"

    return {
        'user_id': user_id,
        'email': email,
        'name': name,
        'language': language,
        'subscription_tier': subscription,
        'is_active': True,
        'created_at': datetime.utcnow() - timedelta(days=random.randint(1, 365)),
        'last_login': datetime.utcnow() - timedelta(hours=random.randint(1, 168)),
        'two_factor_enabled': random.choice([True, False]),
        'biometric_enabled': random.choice([True, False]) if random.random() < 0.3 else False,
        'consent': {
            'analytics_consent': random.choice([True, False]),
            'marketing_consent': random.choice([True, False]),
            'data_processing_consent': True,
            'consent_updated_at': datetime.utcnow().isoformat()
        }
    }

def generate_mood_logs(user_id: str, language: str, num_logs: int) -> List[Dict[str, Any]]:
    """Generate random mood logs for a user"""
    moods = []
    base_date = datetime.utcnow() - timedelta(days=30)

    for i in range(num_logs):
        sentiment = random.choice(MOOD_SENTIMENTS)
        mood_text = random.choice(MOOD_TEXTS[language][sentiment])

        # Add some AI analysis
        ai_analysis = {
            'sentiment': sentiment,
            'score': random.uniform(-1.0, 1.0),
            'emotions': random.sample(['joy', 'sadness', 'anger', 'fear', 'surprise', 'trust'], random.randint(1, 3)),
            'intensity': random.uniform(0.1, 1.0),
            'method': random.choice(['openai', 'google_nlp', 'keyword_fallback'])
        }

        mood = {
            'user_id': user_id,
            'mood_text': mood_text,
            'timestamp': (base_date + timedelta(days=i, hours=random.randint(8, 22))).isoformat(),
            'sentiment': sentiment,
            'ai_analysis': ai_analysis,
            'voice_data': random.choice([None, f"base64_audio_data_{i}"]) if random.random() < 0.3 else None
        }
        moods.append(mood)

    return moods

def generate_memories(user_id: str, language: str, num_memories: int) -> List[Dict[str, Any]]:
    """Generate random memories for a user"""
    memories = []
    base_date = datetime.utcnow() - timedelta(days=30)

    for i in range(num_memories):
        content = random.choice(MEMORY_CONTENTS[language])

        memory = {
            'user_id': user_id,
            'content': content,
            'timestamp': (base_date + timedelta(days=i*2, hours=random.randint(10, 20))).isoformat(),
            'type': random.choice(['text', 'voice']),
            'sentiment_analysis': {
                'sentiment': random.choice(MOOD_SENTIMENTS),
                'score': random.uniform(-1.0, 1.0),
                'emotions': ['joy', 'trust']
            },
            'tags': random.sample(['positive', 'social', 'relaxation', 'exercise', 'nature'], random.randint(1, 3))
        }
        memories.append(memory)

    return memories

def populate_test_users():
    """Main function to populate 100 test users"""
    print("🚀 Starting population of 100 test users...")

    users_created = 0
    moods_created = 0
    memories_created = 0

    try:
        # Clear existing test users (optional - uncomment if needed)
        # print("🧹 Clearing existing test users...")
        # test_users = db.collection('users').where('email', '>=', 'test_user_').where('email', '<', 'test_user_z').get()
        # for user in test_users:
        #     db.collection('users').document(user.id).delete()

        for i in range(1, 101):
            try:
                # Generate user data
                user_data = generate_random_user(i)
                user_id = user_data['user_id']

                # Create user document
                db.collection('users').document(user_id).set(user_data)

                # Generate and create mood logs (3-15 per user)
                num_moods = random.randint(3, 15)
                mood_logs = generate_mood_logs(user_id, user_data['language'], num_moods)
                for mood in mood_logs:
                    db.collection('moods').add(mood)
                moods_created += num_moods

                # Generate and create memories (1-8 per user)
                num_memories = random.randint(1, 8)
                memories = generate_memories(user_id, user_data['language'], num_memories)
                for memory in memories:
                    db.collection('memories').add(memory)
                memories_created += num_memories

                users_created += 1

                if users_created % 10 == 0:
                    print(f"📊 Progress: {users_created}/100 users created")

            except Exception as e:
                print(f"❌ Error creating user {i}: {e}")
                continue

        print("✅ Population completed successfully!")
        print(f"📈 Summary:")
        print(f"   • Users created: {users_created}")
        print(f"   • Mood logs created: {moods_created}")
        print(f"   • Memories created: {memories_created}")
        print(f"   • Average moods per user: {moods_created/users_created:.1f}")
        print(f"   • Average memories per user: {memories_created/users_created:.1f}")

        # Generate traction report
        generate_traction_report(users_created, moods_created, memories_created)

    except Exception as e:
        print(f"❌ Population failed: {e}")
        sys.exit(1)

def generate_traction_report(users: int, moods: int, memories: int):
    """Generate a traction report for the test users"""
    report = {
        'total_users': users,
        'total_mood_logs': moods,
        'total_memories': memories,
        'average_moods_per_user': round(moods / users, 1),
        'average_memories_per_user': round(memories / users, 1),
        'user_engagement_rate': round((moods + memories) / users, 1),
        'generated_at': datetime.utcnow().isoformat(),
        'report_type': 'test_data_traction'
    }

    # Save to Firestore
    db.collection('analytics').document('test_traction_report').set(report)

    print("📊 Traction report generated and saved to Firestore")

if __name__ == "__main__":
    populate_test_users()