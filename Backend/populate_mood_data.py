#!/usr/bin/env python3
"""
Script to populate test mood data for a specific user
Usage: python populate_mood_data.py <user_id> <num_entries>
"""

import sys
import os
import random
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, firestore

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def populate_mood_data(user_id, num_entries=10):
    """Populate mood data for a specific user"""

    # Initialize Firebase if not already done
    if not firebase_admin._apps:
        # Try to find service account key
        key_path = os.getenv('FIREBASE_CREDENTIALS', 'serviceAccountKey.json')
        if not os.path.exists(key_path):
            key_path = os.path.join(os.path.dirname(__file__), key_path)

        if os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
        else:
            print(f"❌ Firebase credentials not found at {key_path}")
            return

    db = firestore.client()

    # Mood data templates
    mood_templates = [
        {"text": "Känner mig glad och energisk idag!", "sentiment": "POSITIVE", "score": 0.8},
        {"text": "Lite stressad över jobbet, men det går", "sentiment": "NEGATIVE", "score": -0.3},
        {"text": "Neutral dag, inget speciellt händer", "sentiment": "NEUTRAL", "score": 0.0},
        {"text": "Mycket trött idag, behöver vila", "sentiment": "NEGATIVE", "score": -0.6},
        {"text": "Fantastisk dag! Träffade gamla vänner", "sentiment": "POSITIVE", "score": 0.9},
        {"text": "Känner mig orolig över framtiden", "sentiment": "NEGATIVE", "score": -0.5},
        {"text": "Bra balans idag, känner mig lugn", "sentiment": "POSITIVE", "score": 0.6},
        {"text": "Väldigt nedstämd, behöver stöd", "sentiment": "NEGATIVE", "score": -0.8},
        {"text": "Motiverad att börja nya projekt", "sentiment": "POSITIVE", "score": 0.7},
        {"text": "Tråkig dag, saknar motivation", "sentiment": "NEGATIVE", "score": -0.4},
        {"text": "Känner mig uppskattad på jobbet", "sentiment": "POSITIVE", "score": 0.8},
        {"text": "Irriterad över småsaker idag", "sentiment": "NEGATIVE", "score": -0.3},
        {"text": "Harmonisk dag, allt känns rätt", "sentiment": "POSITIVE", "score": 0.7},
        {"text": "Känner mig ensam och isolerad", "sentiment": "NEGATIVE", "score": -0.7},
        {"text": "Upprymd över kommande helg", "sentiment": "POSITIVE", "score": 0.8}
    ]

    print(f"📊 Populating {num_entries} mood entries for user {user_id}")

    # Create mood entries
    for i in range(num_entries):
        # Random template
        template = random.choice(mood_templates)

        # Random date within last 30 days
        days_ago = random.randint(0, 29)
        hours_ago = random.randint(0, 23)
        timestamp = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)

        mood_data = {
            'user_id': user_id,
            'mood_text': template['text'],
            'timestamp': timestamp.isoformat(),
            'sentiment': template['sentiment'],
            'score': template['score'],
            'emotions_detected': ['joy'] if template['sentiment'] == 'POSITIVE' else ['sadness', 'worry'] if template['sentiment'] == 'NEGATIVE' else ['calm'],
            'ai_analysis': {
                'sentiment': template['sentiment'],
                'score': template['score'],
                'emotions': ['joy'] if template['sentiment'] == 'POSITIVE' else ['sadness', 'worry'] if template['sentiment'] == 'NEGATIVE' else ['calm']
            }
        }

        # Add to Firestore
        try:
            doc_ref = db.collection('users').document(user_id).collection('moods').document()
            doc_ref.set(mood_data)
            print(f"✅ Added mood entry {i+1}/{num_entries}: {template['text'][:30]}...")
        except Exception as e:
            print(f"❌ Failed to add mood entry {i+1}: {str(e)}")

    print(f"🎉 Successfully populated {num_entries} mood entries for user {user_id}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python populate_mood_data.py <user_id> <num_entries>")
        sys.exit(1)

    user_id = sys.argv[1]
    num_entries = int(sys.argv[2])

    populate_mood_data(user_id, num_entries)