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

# Language distributions for 100 users
LANGUAGE_DISTRIBUTION = {
    'sv': 33,  # Swedish
    'en': 33,  # English
    'no': 34   # Norwegian
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

def generate_random_moods(user_id, language, num_entries=None):
    """Generate random mood entries for a user (30-90 days of data)"""
    moods = []
    # Random period between 30-90 days
    days_back = random.randint(30, 90)
    base_date = datetime.now(timezone.utc) - timedelta(days=days_back)

    # Random number of entries between 50-200
    if num_entries is None:
        num_entries = random.randint(50, 200)

    for i in range(num_entries):
        # Random timestamp within the period
        timestamp = base_date + timedelta(
            days=random.randint(0, days_back-1),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )

        mood = random.choice(ALL_MOODS)

        # Generate score based on mood category with more variation
        if mood in ["glad", "lycklig", "nöjd", "tacksam", "positiv"]:
            score = random.uniform(0.2, 1.0)
        elif mood in ["ledsen", "arg", "stressad", "deppig", "frustrerad", "irriterad", "orolig"]:
            score = random.uniform(-1.0, -0.2)
        else:
            score = random.uniform(-0.8, 0.8)

        # Add some sentiment analysis data
        sentiment = "POSITIVE" if score > 0.1 else "NEGATIVE" if score < -0.1 else "NEUTRAL"
        emotions = []
        if sentiment == "POSITIVE":
            emotions = random.sample(["joy", "happiness", "contentment", "gratitude"], random.randint(1, 3))
        elif sentiment == "NEGATIVE":
            emotions = random.sample(["sadness", "anger", "stress", "worry", "frustration"], random.randint(1, 3))
        else:
            emotions = random.sample(["calm", "neutral", "balanced"], random.randint(1, 2))

        mood_data = {
            "mood": mood,
            "score": round(score, 2),
            "timestamp": timestamp.isoformat(),
            "source": "random_test_data",
            "decrypted_mood": mood,
            "sentiment_analysis": {
                "sentiment": sentiment,
                "score": abs(score),
                "emotions": emotions,
                "confidence": round(random.uniform(0.7, 0.95), 2)
            }
        }

        moods.append((timestamp.isoformat(), mood_data))

    return moods

def generate_random_memories(user_id, language, num_entries=None):
    """Generate random memory entries with voice transcriptions"""
    memories = []
    base_date = datetime.now(timezone.utc) - timedelta(days=90)

    # Random number of memories between 5-20
    if num_entries is None:
        num_entries = random.randint(5, 20)

    # Sample transcriptions by language
    transcriptions = {
        'sv': [
            "Idag känner jag mig lugn och avslappnad efter en lång promenad i skogen.",
            "Jag är tacksam för alla vänner som stöttat mig genom tuffa tider.",
            "Stressen från jobbet känns överväldigande idag, behöver hitta sätt att hantera det.",
            "Glad att få spendera tid med familjen, det betyder mycket för mig.",
            "Känner oro inför framtiden, men försöker ta ett steg i taget.",
            "Mycket nöjd med dagens prestationer på jobbet.",
            "Frustration över att saker inte går som planerat.",
            "Lycklig över små saker i livet som gör dagen bättre."
        ],
        'en': [
            "Today I feel calm and relaxed after a long walk in the forest.",
            "I'm grateful for all the friends who have supported me through difficult times.",
            "The stress from work feels overwhelming today, need to find ways to manage it.",
            "Happy to spend time with family, it means a lot to me.",
            "Feeling anxious about the future, but trying to take it one step at a time.",
            "Very satisfied with today's work achievements.",
            "Frustration over things not going as planned.",
            "Happy about the little things in life that make the day better."
        ],
        'no': [
            "I dag føler jeg meg rolig og avslappet etter en lang tur i skogen.",
            "Jeg er takknemlig for alle venner som har støttet meg gjennom tøffe tider.",
            "Stresset fra jobben føles overveldende i dag, må finne måter å håndtere det på.",
            "Glad for å tilbringe tid med familien, det betyr mye for meg.",
            "Føler uro for fremtiden, men prøver å ta ett skritt om gangen.",
            "Svært fornøyd med dagens prestasjoner på jobben.",
            "Frustrasjon over at ting ikke går som planlagt.",
            "Lykkelig over små ting i livet som gjør dagen bedre."
        ]
    }

    for i in range(num_entries):
        timestamp = base_date + timedelta(
            days=random.randint(0, 89),
            hours=random.randint(0, 23)
        )

        transcription = random.choice(transcriptions.get(language, transcriptions['en']))

        memory_data = {
            "user_id": user_id,
            "file_path": f"memories/{user_id}/memory_{i+1}.mp3",
            "timestamp": timestamp.isoformat(),
            "transcription": transcription,
            "duration_seconds": random.randint(30, 300),  # 30 seconds to 5 minutes
            "sentiment_score": round(random.uniform(-1.0, 1.0), 2)
        }

        memories.append(memory_data)

    return memories

def generate_subscription(user_id):
    """Generate subscription data with realistic distribution (70% free, 25% premium, 5% enterprise)"""
    rand = random.random()
    if rand < 0.05:  # 5% enterprise
        return {
            "status": "active",
            "plan": "enterprise",
            "start_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 365))).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    elif rand < 0.30:  # 25% premium (0.05 + 0.25)
        return {
            "status": "active",
            "plan": "premium",
            "start_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 365))).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    else:  # 70% free
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

def generate_consent_records(user_id, language):
    """Generate GDPR consent records"""
    consents = []
    base_date = datetime.now(timezone.utc) - timedelta(days=365)

    consent_types = [
        "data_processing",
        "analytics_cookies",
        "marketing_emails",
        "voice_data_processing",
        "ai_personalization"
    ]

    for consent_type in consent_types:
        granted_date = base_date + timedelta(days=random.randint(0, 364))
        consents.append({
            "user_id": user_id,
            "consent_type": consent_type,
            "granted": random.choice([True, True, True, False]),  # 75% grant rate
            "granted_at": granted_date.isoformat(),
            "version": "1.0",
            "ip_address": f"192.168.1.{random.randint(1, 255)}",
            "user_agent": "Mozilla/5.0 (Test Browser)"
        })

    return consents

def generate_achievements_and_streaks(user_id):
    """Generate achievement badges and streaks data"""
    badges = [
        {"name": "first_mood_log", "earned_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 90))).isoformat()},
        {"name": "week_streak", "earned_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))).isoformat()},
        {"name": "memory_master", "earned_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat()},
        {"name": "ai_story_lover", "earned_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 45))).isoformat()},
    ]

    # Randomly select some badges to be earned
    earned_badges = random.sample(badges, random.randint(1, len(badges)))

    current_streak = random.randint(0, 30)
    longest_streak = max(current_streak + random.randint(0, 20), current_streak)

    return {
        "badges": earned_badges,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_mood_log_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 7))).isoformat()
    }

def generate_ai_chat_history(user_id, language):
    """Generate AI chat history"""
    chats = []
    base_date = datetime.now(timezone.utc) - timedelta(days=60)

    chat_topics = {
        'sv': ["stresshantering", "sömnproblem", "ångest", "depression", "självkänsla", "relationer"],
        'en': ["stress management", "sleep issues", "anxiety", "depression", "self-esteem", "relationships"],
        'no': ["stresshåndtering", "søvnproblemer", "angst", "depresjon", "selvfølelse", "relasjoner"]
    }

    topics = chat_topics.get(language, chat_topics['en'])

    for i in range(random.randint(5, 25)):
        timestamp = base_date + timedelta(days=random.randint(0, 59))
        topic = random.choice(topics)

        chat = {
            "user_id": user_id,
            "timestamp": timestamp.isoformat(),
            "topic": topic,
            "messages": [
                {"role": "user", "content": f"Jag behöver hjälp med {topic}" if language == 'sv' else f"I need help with {topic}"},
                {"role": "assistant", "content": f"Här är några tips för {topic}..." if language == 'sv' else f"Here are some tips for {topic}..."}
            ],
            "rating": random.choice([None, 4, 5]),
            "helpful": random.choice([True, False, None])
        }
        chats.append(chat)

    return chats

def generate_story_preferences(user_id, language):
    """Generate AI story preferences"""
    categories = ["healing", "motivation", "relaxation", "adventure", "meditation", "nature"]
    moods = ["calm", "hopeful", "peaceful", "joyful", "reflective", "inspired"]

    return {
        "preferred_categories": random.sample(categories, random.randint(2, 4)),
        "preferred_moods": random.sample(moods, random.randint(2, 3)),
        "favorite_stories": [f"story_{random.randint(1, 100)}" for _ in range(random.randint(0, 5))],
        "story_duration_preference": random.choice(["short", "medium", "long"]),
        "language": language
    }

def generate_wearables_data(user_id):
    """Generate optional wearables data integration"""
    if random.random() < 0.3:  # 30% of users have wearables
        base_date = datetime.now(timezone.utc) - timedelta(days=30)
        data_points = []

        for i in range(random.randint(100, 500)):  # 100-500 data points
            timestamp = base_date + timedelta(minutes=random.randint(0, 43200))  # 30 days in minutes
            data_points.append({
                "timestamp": timestamp.isoformat(),
                "heart_rate": random.randint(60, 120),
                "steps": random.randint(0, 500),
                "calories": random.randint(0, 10),
                "sleep_quality": random.choice(["poor", "fair", "good", "excellent"]) if random.random() < 0.1 else None
            })

        return {
            "device_type": random.choice(["fitbit", "apple_watch", "garmin", "samsung"]),
            "connected_since": (datetime.now(timezone.utc) - timedelta(days=random.randint(30, 365))).isoformat(),
            "data_points": data_points
        }
    return None

def populate_user_data(user_id, email, display_name, language):
    """Populate comprehensive Firestore data for a user"""
    try:
        # User document with enhanced profile
        user_data = {
            "email": email,
            "email_punycode": email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))).isoformat(),
            "email_verified": random.choice([True, False]),
            "language": language,
            "subscription": generate_subscription(user_id),
            "profile": {
                "display_name": display_name,
                "age_group": random.choice(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]),
                "gender": random.choice(["male", "female", "other", "prefer_not_to_say"]),
                "occupation": random.choice(["student", "professional", "healthcare", "education", "retired", "other"]),
                "timezone": "Europe/Stockholm"
            },
            "preferences": {
                "notifications": random.choice([True, False]),
                "weekly_reports": random.choice([True, False]),
                "ai_recommendations": random.choice([True, False])
            },
            "achievements": generate_achievements_and_streaks(user_id),
            "story_preferences": generate_story_preferences(user_id, language)
        }

        # Add wearables data if applicable
        wearables = generate_wearables_data(user_id)
        if wearables:
            user_data["wearables"] = wearables

        db.collection("users").document(user_id).set(user_data)

        # Mood logs
        moods = generate_random_moods(user_id, language)
        for timestamp, mood_data in moods:
            db.collection("users").document(user_id).collection("moods").document(timestamp).set(mood_data)

        # Memories
        memories = generate_random_memories(user_id, language)
        for memory in memories:
            db.collection("memories").document(f"{user_id}_{memory['timestamp']}").set(memory)

        # Consent records
        consents = generate_consent_records(user_id, language)
        for consent in consents:
            consent_id = f"{user_id}_{consent['consent_type']}_{consent['granted_at'][:10]}"
            db.collection("consents").document(consent_id).set(consent)

        # AI chat history
        chats = generate_ai_chat_history(user_id, language)
        for chat in chats:
            chat_id = f"{user_id}_{chat['timestamp']}"
            db.collection("ai_chats").document(chat_id).set(chat)

        # Activity logs
        activities = generate_activity_logs(user_id)
        for activity in activities:
            db.collection("audit_logs").document(f"{user_id}_{activity['timestamp']}").set(activity)

        return True
    except Exception as e:
        print(f"Failed to populate data for user {user_id}: {e}")
        return False

def main():
    """Main function to create 100 comprehensive test users"""
    print("🚀 Starting population of 100 comprehensive test users...")
    print("=" * 80)

    # Initialize Firebase
    if not initialize_firebase():
        print("❌ Firebase initialization failed")
        return

    total_created = 0
    password = "TestPass123!"  # Default password for test users

    for language, count in LANGUAGE_DISTRIBUTION.items():
        print(f"\n🌍 Creating {count} users for language: {language}")

        names = NAMES_BY_LANGUAGE[language]
        # Ensure we have enough names by cycling through them
        selected_names = []
        name_index = 0
        while len(selected_names) < count:
            if name_index >= len(names):
                # Create additional names if needed
                base_name = names[name_index % len(names)]
                display_name = f"{base_name[0]} {random.randint(100, 999)}"
                email_prefix = f"{base_name[1]}.{random.randint(100, 999)}"
                selected_names.append((display_name, email_prefix))
            else:
                selected_names.append(names[name_index])
            name_index += 1

        for display_name, email_prefix in selected_names:
            email = f"{email_prefix}@test.{language}"

            # Create Firebase Auth user
            user_id = create_test_user(email, password, display_name, language)
            if not user_id:
                continue

            # Populate comprehensive Firestore data
            if populate_user_data(user_id, email, display_name, language):
                total_created += 1
                print(f"  ✅ Created user: {display_name} ({email}) - UID: {user_id}")
            else:
                # Clean up failed user
                try:
                    auth.delete_user(user_id)
                except:
                    pass

    print("=" * 80)
    print(f"✅ Successfully created {total_created} comprehensive test users!")
    print("\n📊 Comprehensive Data Summary:")
    print("  • Users distributed across languages (sv:33, en:33, no:34)")
    print("  • Each user has 50-200 mood entries over 30-90 days")
    print("  • Each user has 5-20 memory entries with voice transcriptions")
    print("  • Subscription tiers: 70% free, 25% premium, 5% enterprise")
    print("  • GDPR consent records for all users")
    print("  • Achievement badges and streak tracking")
    print("  • AI chat history (5-25 conversations per user)")
    print("  • Story preferences and personalization")
    print("  • 30% of users have wearables data integration")
    print("  • Comprehensive activity logging")
    print("\n🔐 Default login credentials:")
    print("  Password: TestPass123!")
    print("\n🎯 Ready for comprehensive traction analysis and 1M SEK valuation demonstration!")

if __name__ == "__main__":
    main()