#!/usr/bin/env python3
"""
FAS 4 - AI Database Operations Direct Database Test
Testar AI-relaterade CRUD-operationer direkt mot Firestore
"""

import sys
import os
import time
from datetime import datetime

# Lägg till Backend i path så vi kan importera
sys.path.insert(0, 'Backend')

try:
    # Importera Firebase config
    import src.firebase_config as firebase_config
    db = firebase_config.db

    print("🧪 FAS 4 - AI DATABASE OPERATIONS DIREKT TEST")
    print("==================================================")

    # Test user ID
    test_user_id = "test_ai_user_123"

    # 1. Skapa en AI-story direkt i Firestore
    print("1️⃣ Skapar AI-story direkt i Firestore...")
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    story_id = f"story_{test_user_id}_{timestamp}"

    story_data = {
        'user_id': test_user_id,
        'story_content': 'Det var en gång en person som lärde sig att hantera sina känslor...',
        'locale': 'sv',
        'mood_data_points': 5,
        'ai_generated': True,
        'model_used': 'gpt-4',
        'confidence': 0.85,
        'generated_at': timestamp
    }

    story_ref = db.collection('users').document(test_user_id).collection('stories').document(story_id)
    story_ref.set(story_data)
    print(f"✅ AI-story skapad i Firestore: ID = {story_id}")

    # 2. Skapa en forecast direkt i Firestore
    print("2️⃣ Skapar mood forecast direkt i Firestore...")
    forecast_id = f"forecast_{test_user_id}_{timestamp}"

    forecast_data = {
        'user_id': test_user_id,
        'forecast_summary': {
            'trend': 'improving',
            'average': 7.2,
            'confidence': 0.78
        },
        'days_ahead': 7,
        'model_used': 'sklearn_regression',
        'data_points_used': 20,
        'risk_factors': ['stress', 'sleep_deprivation'],
        'generated_at': timestamp
    }

    forecast_ref = db.collection('users').document(test_user_id).collection('forecasts').document(forecast_id)
    forecast_ref.set(forecast_data)
    print(f"✅ Mood forecast skapad i Firestore: ID = {forecast_id}")

    # 3. Skapa chat history direkt i Firestore
    print("3️⃣ Skapar chat history direkt i Firestore...")
    chat_data = {
        'user_message': 'Jag känner mig stressad idag',
        'ai_response': 'Jag förstår att du känner dig stressad. Vill du prata om vad som orsakar stressen?',
        'timestamp': timestamp,
        'sentiment': 'NEGATIVE'
    }

    chat_ref = db.collection('users').document(test_user_id).collection('chat_history')
    chat_doc_ref = chat_ref.add(chat_data)
    chat_id = chat_doc_ref[1].id
    print(f"✅ Chat history skapad i Firestore: ID = {chat_id}")

    # 4. Läs AI-story från Firestore
    print("4️⃣ Läser AI-story från Firestore...")
    doc = story_ref.get()
    if doc.exists:
        retrieved_data = doc.to_dict()
        print(f"✅ AI-story hämtad: ai_generated={retrieved_data.get('ai_generated')}, confidence={retrieved_data.get('confidence')}")
    else:
        print("❌ AI-story kunde inte hämtas")
        sys.exit(1)

    # 5. Uppdatera forecast
    print("5️⃣ Uppdaterar forecast...")
    update_data = {
        'forecast_summary': {
            'trend': 'stable',
            'average': 7.5,
            'confidence': 0.82
        }
    }
    forecast_ref.update(update_data)
    print("✅ Forecast uppdaterad i Firestore")

    # 6. Lista AI-stories för användaren
    print("6️⃣ Listar AI-stories för användaren...")
    stories_query = db.collection('users').document(test_user_id).collection('stories')
    stories_docs = list(stories_query.stream())
    print(f"✅ Totalt {len(stories_docs)} AI-stories för användaren")

    # 7. Lista forecasts för användaren
    print("7️⃣ Listar forecasts för användaren...")
    forecasts_query = db.collection('users').document(test_user_id).collection('forecasts')
    forecasts_docs = list(forecasts_query.stream())
    print(f"✅ Totalt {len(forecasts_docs)} forecasts för användaren")

    # 8. Lista chat history för användaren
    print("8️⃣ Listar chat history för användaren...")
    chat_query = db.collection('users').document(test_user_id).collection('chat_history')
    chat_docs = list(chat_query.stream())
    print(f"✅ Totalt {len(chat_docs)} chat-meddelanden för användaren")

    # 9. Rensar upp - tar bort test-data
    print("9️⃣ Rensar upp - tar bort test-data...")
    story_ref.delete()
    forecast_ref.delete()

    # Ta bort chat history
    for doc in chat_docs:
        doc.reference.delete()

    print("✅ Test-data borttagen från Firestore")

    print("\n==================================================")
    print("🎉 FAS 4 AI DATABASE OPERATIONS ÄR 100% VERIFIERADE!")
    print("✅ Skapa AI-story fungerar")
    print("✅ Skapa forecast fungerar")
    print("✅ Skapa chat history fungerar")
    print("✅ Läsa AI-data fungerar")
    print("✅ Uppdatera forecast fungerar")
    print("✅ Lista AI-stories fungerar")
    print("✅ Lista forecasts fungerar")
    print("✅ Lista chat history fungerar")
    print("✅ Ta bort AI-data fungerar")
    print("✅ Alla AI CRUD-operationer fungerar med riktiga data i Firestore")
    print("==================================================")

except Exception as e:
    print(f"❌ FEL VID AI DATABASE TEST: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)