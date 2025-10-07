#!/usr/bin/env python3
"""
Test Data Population Script for Lugn-Trygg AI Features

This script populates the database with realistic test data to validate
all AI features including sentiment analysis, crisis detection, mood patterns,
and chatbot conversations.

Usage: python populate_test_data.py
"""

import os
import sys
from datetime import datetime, timedelta
from firebase_admin import credentials, firestore, initialize_app
import random
import json

# Note: AI services will be tested separately
# This script focuses on creating realistic test data for the database

def generate_mock_sentiment_analysis(text: str) -> dict:
    """Generate mock sentiment analysis for testing"""
    text_lower = text.lower()

    # Simple keyword-based sentiment analysis for testing
    positive_words = ["glad", "lycklig", "bra", "positiv", "tacksam", "nöjd", "härligt", "fantastiskt", "underbart"]
    negative_words = ["ledsen", "arg", "stressad", "deppig", "frustrerad", "irriterad", "orolig", "dålig", "trött"]

    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)

    if positive_count > negative_count:
        sentiment = "POSITIVE"
        score = min(positive_count * 0.2, 1.0)
    elif negative_count > positive_count:
        sentiment = "NEGATIVE"
        score = -min(negative_count * 0.2, 1.0)
    else:
        sentiment = "NEUTRAL"
        score = 0.0

    return {
        "sentiment": sentiment,
        "score": score,
        "magnitude": max(positive_count + negative_count, 1.0),
        "confidence": 0.7,
        "emotions": ["joy"] if sentiment == "POSITIVE" else (["sadness"] if sentiment == "NEGATIVE" else ["neutral"]),
        "intensity": abs(score)
    }

def generate_mock_crisis_analysis(text: str) -> dict:
    """Generate mock crisis analysis for testing"""
    crisis_keywords = ["döda mig", "skada mig själv", "hopplöst", "inte orka längre", "ge upp"]

    text_lower = text.lower()
    detected_indicators = [word for word in crisis_keywords if word in text_lower]

    risk_level = "LOW"
    if len(detected_indicators) >= 2:
        risk_level = "HIGH"
    elif len(detected_indicators) >= 1:
        risk_level = "MEDIUM"

    return {
        "risk_level": risk_level,
        "severity_score": len(detected_indicators) * 2,
        "indicators": detected_indicators,
        "requires_immediate_attention": risk_level in ["HIGH"],
        "recommended_actions": [
            "Ring 112 för akut hjälp" if risk_level == "HIGH" else "Kontakta din vårdcentral",
            "Prata med någon du litar på",
            "Ring Självmordslinjen: 90101" if risk_level in ["MEDIUM", "HIGH"] else "Överväg professionell hjälp"
        ]
    }

def generate_mock_crisis_response(crisis_analysis: dict) -> str:
    """Generate mock crisis response for testing"""
    risk_level = crisis_analysis["risk_level"]

    if risk_level == "HIGH":
        return """Jag är allvarligt oroad över ditt mående just nu. Detta är en akut situation som kräver omedelbar professionell hjälp.

Vänligen ring 112 direkt för akut hjälp, eller kontakta närmaste akutmottagning.

Du kan också ringa:
- Självmordslinjen: 90101 (öppen dygnet runt)
- Jourhavande präst: 112 (för akuta samtal)

Du är inte ensam i detta. Professionell hjälp finns tillgänglig just nu."""

    elif risk_level == "MEDIUM":
        return """Jag hör att du mår väldigt dåligt just nu och behöver stöd. Detta är allvarligt och du bör söka hjälp snarast.

Rekommenderade åtgärder:
1. Kontakta din vårdcentral eller terapeut idag
2. Ring Självmordslinjen: 90101 för stöd
3. Prata med någon du litar på

Vill du att jag hjälper dig att formulera hur du ska kontakta vården?"""

    else:
        return """Jag hör att du har det svårt just nu. Dina känslor är viktiga och förtjänar uppmärksamhet.

Överväg att kontakta:
- Din vårdcentral för rådgivning
- En terapeut eller psykolog
- Någon du litar på för stöd

Vill du prata mer om vad som känns svårt just nu?"""

def generate_mock_pattern_analysis(mood_history: list) -> dict:
    """Generate mock pattern analysis for testing"""
    if len(mood_history) < 3:
        return {"trend_direction": "insufficient_data", "confidence": 0.0, "volatility": 0.0}

    # Simple trend analysis based on sentiment scores
    scores = [entry.get("sentiment_score", 0) for entry in mood_history[-10:]]
    if not scores:
        return {"trend_direction": "no_data", "confidence": 0.0, "volatility": 0.0}

    # Calculate trend
    trend = sum(scores[i] - scores[i-1] for i in range(1, len(scores))) / len(scores)

    trend_direction = "stable"
    if trend > 0.1:
        trend_direction = "improving"
    elif trend < -0.1:
        trend_direction = "declining"

    # Calculate volatility
    volatility = sum(abs(score) for score in scores) / len(scores)

    return {
        "trend_direction": trend_direction,
        "confidence": min(0.8, len(mood_history) / 10.0),
        "volatility": volatility,
        "trend_strength": abs(trend)
    }

def generate_mock_weekly_insights(mood_history: list) -> dict:
    """Generate mock weekly insights for testing"""
    if not mood_history:
        return {
            "insights": "Otillräcklig data för analys",
            "confidence": 0.0,
            "ai_generated": False
        }

    positive_count = sum(1 for entry in mood_history if entry.get("sentiment") == "POSITIVE")
    negative_count = sum(1 for entry in mood_history if entry.get("sentiment") == "NEGATIVE")

    insights = f"""
Denna vecka visar {positive_count} positiva och {negative_count} negativa humörloggar.
Mönsteranalys indikerar {'positiv trend' if positive_count > negative_count else 'utmanande period'}.
Fortsätt med regelbunden loggning för bättre insikter.
    """.strip()

    return {
        "insights": insights,
        "confidence": 0.7,
        "ai_generated": True,
        "comprehensive": True
    }

# Initialize Firebase
def initialize_firebase():
    """Initialize Firebase connection"""
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        initialize_app(cred)
        print("✅ Firebase initialized successfully")
        return firestore.client()
    except Exception as e:
        print(f"❌ Firebase initialization failed: {e}")
        print("Note: Make sure serviceAccountKey.json exists and is properly configured")
        return None

# Test user profiles
TEST_USERS = [
    {
        "user_id": "test_user_1",
        "email": "anna.andersson@test.se",
        "name": "Anna Andersson",
        "profile": "improving_moods"
    },
    {
        "user_id": "test_user_2",
        "email": "erik.eriksson@test.se",
        "name": "Erik Eriksson",
        "profile": "declining_moods"
    },
    {
        "user_id": "test_user_3",
        "email": "maria.pettersson@test.se",
        "name": "Maria Pettersson",
        "profile": "volatile_moods"
    },
    {
        "user_id": "test_user_4",
        "email": "lars.larsson@test.se",
        "name": "Lars Larsson",
        "profile": "crisis_scenarios"
    }
]

# Mood progression patterns for different user types
MOOD_PROGRESSIONS = {
    "improving_moods": [
        "ledsen", "ledsen", "stressad", "nöjd", "glad", "glad", "lycklig", "lycklig",
        "tacksam", "positiv", "glad", "lycklig", "tacksam", "glad"
    ],
    "declining_moods": [
        "glad", "glad", "nöjd", "stressad", "stressad", "ledsen", "deppig", "arg",
        "frustrerad", "orolig", "ledsen", "deppig", "ledsen", "orolig"
    ],
    "volatile_moods": [
        "glad", "ledsen", "arg", "lycklig", "deppig", "stressad", "nöjd", "frustrerad",
        "tacksam", "orolig", "positiv", "ledsen", "glad", "deppig"
    ],
    "crisis_scenarios": [
        "glad", "nöjd", "stressad", "orolig", "ledsen", "deppig", "ledsen", "orolig",
        "stressad", "frustrerad", "ledsen", "deppig", "ledsen", "orolig"
    ]
}

# Sample mood transcripts in Swedish
MOOD_TRANSCRIPTS = {
    "glad": [
        "Idag känner jag mig verkligen glad och tacksam för allt jag har",
        "Vilken underbar dag! Allt känns lätt och positivt",
        "Jag är så lycklig över mina nära och kära"
    ],
    "ledsen": [
        "Jag känner mig så ledsen idag, allt känns tungt och grått",
        "Idag är en sådan där dag när tårarna bara kommer",
        "Jag önskar att jag kunde känna mig gladare just nu"
    ],
    "stressad": [
        "Jag har så mycket att göra, känner mig helt stressad",
        "Tiden räcker inte till och jag känner mig pressad",
        "Arbete och privatliv tar all min energi"
    ],
    "orolig": [
        "Jag känner mig orolig och ängslig inför framtiden",
        "Osäkerheten gör mig nervös och rastlös",
        "Jag ligger vaken på nätterna och oroar mig"
    ],
    "arg": [
        "Jag är så arg och frustrerad över situationen",
        "Allting går emot mig idag, jag blir så irriterad",
        "Varför måste allt vara så komplicerat?"
    ],
    "nöjd": [
        "Jag känner mig nöjd och tillfreds med dagen",
        "Små saker gör mig glad och tacksam idag",
        "Livet känns balanserat och harmoniskt"
    ],
    "lycklig": [
        "Jag är verkligen lycklig och känner stor tacksamhet",
        "Allting känns perfekt och jag njuter av stunden",
        "Vilken fantastisk känsla av lycka och frid"
    ],
    "tacksam": [
        "Jag känner mig så tacksam för allt det positiva i mitt liv",
        "Små saker gör mig lycklig och tacksam idag",
        "Jag uppskattar verkligen mina nära och kära"
    ],
    "positiv": [
        "Jag har en positiv känsla och ser möjligheter överallt",
        "Framtiden känns ljus och jag är optimistisk",
        "Jag tror på mig själv och mina förmågor"
    ],
    "deppig": [
        "Jag känner mig deppig och nedstämd idag",
        "Allting känns meningslöst och grått",
        "Jag orkar knappt ta mig ur sängen"
    ],
    "frustrerad": [
        "Jag är frustrerad och irriterad över situationen",
        "Varför går ingenting som jag vill?",
        "Jag känner mig missförstådd och arg"
    ]
}

# Crisis-related conversations for testing
CRISIS_CONVERSATIONS = [
    {
        "user_messages": [
            "Jag mår så dåligt att jag inte vet vad jag ska göra",
            "Jag tänker på att skada mig själv",
            "Jag känner att allt är hopplöst"
        ],
        "expected_crisis_level": "HIGH"
    },
    {
        "user_messages": [
            "Idag känns allt bara tungt och meningslöst",
            "Jag har inte energi till något längre",
            "Jag vet inte hur jag ska fortsätta"
        ],
        "expected_crisis_level": "MEDIUM"
    }
]

# Regular conversations for testing AI responses
REGULAR_CONVERSATIONS = [
    {
        "messages": [
            {"role": "user", "content": "Jag känner mig stressad över jobbet"},
            {"role": "assistant", "content": "Jag hör att du känner dig stressad över jobbet. Stress är vanligt och det finns sätt att hantera det. Vill du berätta mer om vad som stressar dig?"},
            {"role": "user", "content": "Jag har för mycket att göra och deadlines närmar sig"},
            {"role": "assistant", "content": "Det låter som en tuff situation. När vi känner oss överväldigade kan det hjälpa att bryta ner uppgifterna i mindre steg. Vad är det första du kan göra för att komma igång?"}
        ]
    },
    {
        "messages": [
            {"role": "user", "content": "Jag känner mig glad idag"},
            {"role": "assistant", "content": "Vad kul att höra att du känner dig glad! Vad är det som gör dig glad idag?"},
            {"role": "user", "content": "Jag har träffat en vän och vi hade det trevligt"},
            {"role": "assistant", "content": "Sociala kontakter är verkligen viktiga för vårt välmående. Det är underbart att du kunde spendera tid med din vän. Vill du berätta mer om er träff?"}
        ]
    }
]

def create_test_users(db):
    """Create test users in the database"""
    print("👥 Creating test users...")

    for user in TEST_USERS:
        user_ref = db.collection("users").document(user["user_id"])
        user_ref.set({
            "email": user["email"],
            "name": user["name"],
            "email_punycode": user["email"],  # Simplified for testing
            "created_at": datetime.now(),
            "is_active": True,
            "profile_type": user["profile"]
        })
        print(f"  ✅ Created user: {user['name']} ({user['email']})")

def generate_mood_logs(db):
    """Generate realistic mood logs for testing AI analysis"""
    print("📊 Generating mood logs...")

    # Start date 30 days ago
    start_date = datetime.now() - timedelta(days=30)

    for user in TEST_USERS:
        user_id = user["user_id"]
        mood_progression = MOOD_PROGRESSIONS[user["profile"]]
        user_ref = db.collection("users").document(user_id)

        print(f"  📈 Generating mood data for {user['name']} ({user['profile']})")

        for i, mood in enumerate(mood_progression):
            # Create timestamp for each mood entry
            timestamp = (start_date + timedelta(days=i)).isoformat()

            # Get random transcript for this mood
            transcripts = MOOD_TRANSCRIPTS.get(mood, ["Jag känner mig " + mood])
            transcript = random.choice(transcripts)

            # Generate mock AI sentiment analysis (would use ai_services in production)
            sentiment_analysis = generate_mock_sentiment_analysis(transcript)

            # Create mood log entry
            mood_ref = user_ref.collection("moods").document(timestamp)
            mood_ref.set({
                "mood": mood,
                "transcript": transcript,
                "timestamp": timestamp,
                "ai_analysis": sentiment_analysis,
                "source": "text",
                "user_id": user_id
            })

        print(f"    ✅ Generated {len(mood_progression)} mood entries")

def generate_chat_conversations(db):
    """Generate chat conversations for testing chatbot AI"""
    print("💬 Generating chat conversations...")

    for user in TEST_USERS:
        user_id = user["user_id"]
        conversation_ref = db.collection("users").document(user_id).collection("conversations")

        # Add regular conversations
        for conv in REGULAR_CONVERSATIONS:
            base_timestamp = datetime.now() - timedelta(hours=random.randint(1, 72))

            for i, msg in enumerate(conv["messages"]):
                timestamp = (base_timestamp + timedelta(minutes=i*2)).isoformat()

                # Generate AI analysis for user messages
                if msg["role"] == "user":
                    sentiment_analysis = generate_mock_sentiment_analysis(msg["content"])
                    crisis_analysis = generate_mock_crisis_analysis(msg["content"])

                    conversation_ref.document(f"msg_{timestamp}").set({
                        "role": msg["role"],
                        "content": msg["content"],
                        "timestamp": timestamp,
                        "emotions_detected": sentiment_analysis.get("emotions", []),
                        "crisis_detected": crisis_analysis["requires_immediate_attention"],
                        "crisis_analysis": crisis_analysis,
                        "ai_generated": False
                    })
                else:
                    # AI response
                    conversation_ref.document(f"msg_{timestamp}").set({
                        "role": msg["role"],
                        "content": msg["content"],
                        "timestamp": timestamp,
                        "ai_generated": True,
                        "model_used": "test_data"
                    })

        # Add crisis conversations for crisis test user
        if user["profile"] == "crisis_scenarios":
            for crisis_conv in CRISIS_CONVERSATIONS:
                base_timestamp = datetime.now() - timedelta(hours=random.randint(1, 48))

                for i, user_msg in enumerate(crisis_conv["user_messages"]):
                    timestamp = (base_timestamp + timedelta(minutes=i*3)).isoformat()

                    # User message with crisis indicators
                    sentiment_analysis = generate_mock_sentiment_analysis(user_msg)
                    crisis_analysis = generate_mock_crisis_analysis(user_msg)

                    conversation_ref.document(f"crisis_{timestamp}").set({
                        "role": "user",
                        "content": user_msg,
                        "timestamp": timestamp,
                        "emotions_detected": sentiment_analysis.get("emotions", []),
                        "crisis_detected": crisis_analysis["requires_immediate_attention"],
                        "crisis_analysis": crisis_analysis,
                        "ai_generated": False
                    })

                    # AI crisis response
                    if crisis_analysis["requires_immediate_attention"]:
                        crisis_response = generate_mock_crisis_response(crisis_analysis)
                        response_timestamp = (base_timestamp + timedelta(minutes=i*3 + 1)).isoformat()

                        conversation_ref.document(f"crisis_response_{response_timestamp}").set({
                            "role": "assistant",
                            "content": crisis_response,
                            "timestamp": response_timestamp,
                            "crisis_detected": True,
                            "crisis_analysis": crisis_analysis,
                            "ai_generated": True,
                            "model_used": "gpt-4"
                        })

        print(f"  ✅ Generated conversations for {user['name']}")

def generate_memories(db):
    """Generate memory entries for testing analytics"""
    print("🧠 Generating memory entries...")

    memories_data = [
        {
            "user_id": "test_user_1",
            "file_path": "memory_1.mp3",
            "transcript": "Idag hade jag en underbar promenad i parken med min familj",
            "timestamp": (datetime.now() - timedelta(days=5)).isoformat()
        },
        {
            "user_id": "test_user_2",
            "file_path": "memory_2.mp3",
            "transcript": "Jag känner mig tacksam för stödet från mina vänner",
            "timestamp": (datetime.now() - timedelta(days=3)).isoformat()
        },
        {
            "user_id": "test_user_3",
            "file_path": "memory_3.mp3",
            "transcript": "En jobbig dag men jag klarade av den ändå",
            "timestamp": (datetime.now() - timedelta(days=1)).isoformat()
        }
    ]

    for memory in memories_data:
        memory_ref = db.collection("memories").document()
        memory_ref.set(memory)
        print(f"  ✅ Created memory: {memory['transcript'][:50]}...")

def run_pattern_analysis_test(db):
    """Test the AI pattern analysis with generated data"""
    print("🧪 Testing AI pattern analysis...")

    for user in TEST_USERS:
        user_id = user["user_id"]

        # Get mood history
        moods_ref = db.collection("users").document(user_id).collection("moods")
        mood_docs = moods_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(30).stream()

        mood_history = []
        for doc in mood_docs:
            data = doc.to_dict()
            mood_history.append({
                "sentiment": data.get("ai_analysis", {}).get("sentiment", "NEUTRAL"),
                "sentiment_score": data.get("ai_analysis", {}).get("score", 0),
                "timestamp": data.get("timestamp"),
                "note": data.get("transcript", "")
            })

        if mood_history:
            # Test pattern analysis (mock for testing script)
            pattern_analysis = generate_mock_pattern_analysis(mood_history)

            print(f"  📊 Pattern analysis for {user['name']}:")
            print(f"    Trend: {pattern_analysis.get('trend_direction', 'unknown')}")
            print(f"    Confidence: {pattern_analysis.get('confidence', 0):.1%}")
            print(f"    Volatility: {pattern_analysis.get('volatility', 0):.3f}")

            # Test weekly insights (mock for testing script)
            weekly_insights = generate_mock_weekly_insights(mood_history)

            print(f"    AI Insights confidence: {weekly_insights.get('confidence', 0):.1%}")
            print(f"    AI Generated: {weekly_insights.get('ai_generated', False)}")

def main():
    """Main function to populate test data"""
    print("🚀 Starting test data population for Lugn-Trygg AI features...")
    print("=" * 60)

    # Initialize Firebase
    db = initialize_firebase()
    if not db:
        print("❌ Cannot proceed without Firebase connection")
        return

    try:
        # Create test users
        create_test_users(db)

        # Generate mood logs
        generate_mood_logs(db)

        # Generate chat conversations
        generate_chat_conversations(db)

        # Generate memories
        generate_memories(db)

        # Test AI analysis features
        run_pattern_analysis_test(db)

        print("=" * 60)
        print("✅ Test data population completed successfully!")
        print("\n📋 Summary of generated data:")
        print(f"  • {len(TEST_USERS)} test users")
        print("  • Mood logs for different user patterns (improving, declining, volatile, crisis)")
        print("  • Chat conversations including crisis scenarios")
        print("  • Memory entries for analytics testing")
        print("  • AI pattern analysis validation")
        print("\n🎯 You can now test all AI features:")
        print("  • Mood pattern analysis: /api/chatbot/analyze-patterns")
        print("  • Crisis detection in chat: /api/chatbot/chat")
        print("  • Weekly AI insights: /api/mood/weekly-analysis")
        print("  • Voice emotion analysis: /api/mood/analyze-voice")

    except Exception as e:
        print(f"❌ Error during test data population: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()