"""
End-to-End Test for Lugn & Trygg
Tests ALL backend endpoints comprehensively
"""
import requests
import random
import sys
import time

BASE = 'http://localhost:5001'

def test_core_flows():
    print("=" * 70)
    print("🧪 LUGN & TRYGG - COMPREHENSIVE E2E TEST")
    print("=" * 70)
    
    email = f'e2etest{random.randint(10000, 99999)}@test.com'
    password = 'TestPassword123!'
    results = {"passed": 0, "failed": 0, "warnings": 0}
    
    def log_pass(msg):
        results["passed"] += 1
        print(f"   ✅ {msg}")
    
    def log_fail(msg):
        results["failed"] += 1
        print(f"   ❌ {msg}")
    
    def log_warn(msg):
        results["warnings"] += 1
        print(f"   ⚠️ {msg}")
    
    # ========== SECTION 1: AUTH ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 1: AUTHENTICATION")
    print("=" * 70)
    
    # 1.1 Register
    print("\n1.1 REGISTER NEW USER")
    r = requests.post(f'{BASE}/api/auth/register', json={
        'email': email,
        'password': password,
        'name': 'E2E Test User',
        'accept_terms': True,
        'accept_privacy': True
    })
    if r.json().get('success'):
        log_pass(f"Registration successful: {email}")
    else:
        log_fail(f"Registration failed: {r.json()}")
        return results
    
    # 1.2 Login
    print("\n1.2 LOGIN")
    r = requests.post(f'{BASE}/api/auth/login', json={
        'email': email,
        'password': password
    })
    if r.status_code == 200 and r.json().get('success'):
        data = r.json()['data']
        token = data['access_token']
        refresh_token = data['refresh_token']
        user_id = data['user_id']
        log_pass(f"Login successful, user_id: {user_id[:20]}...")
    else:
        log_fail(f"Login failed: {r.json()}")
        return results
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # 1.3 Token Refresh
    print("\n1.3 TOKEN REFRESH")
    r = requests.post(f'{BASE}/api/auth/refresh', json={
        'refresh_token': refresh_token
    })
    if r.status_code == 200 and r.json().get('success'):
        new_token = r.json().get('data', {}).get('access_token', r.json().get('access_token'))
        if new_token:
            token = new_token
            headers = {'Authorization': f'Bearer {token}'}
            log_pass("Token refresh successful")
        else:
            log_warn("Refresh returned but no new token")
    else:
        log_warn(f"Token refresh: {r.status_code}")
    
    # 1.4 Get Profile
    print("\n1.4 GET USER PROFILE")
    r = requests.get(f'{BASE}/api/auth/profile', headers=headers)
    if r.status_code == 200:
        log_pass("Profile retrieved")
    else:
        log_warn(f"Profile: {r.status_code}")
    
    # ========== SECTION 2: MOOD TRACKING ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 2: MOOD TRACKING")
    print("=" * 70)
    
    # 2.1 Log Mood
    print("\n2.1 LOG MOOD")
    r = requests.post(f'{BASE}/api/mood/log', json={
        'score': 8,
        'note': 'Feeling great during E2E test!',
        'emotions': ['happy', 'calm', 'grateful']
    }, headers=headers)
    if r.status_code in [200, 201] and r.json().get('success'):
        mood_id = r.json().get('data', {}).get('mood_id', r.json().get('mood_id', 'unknown'))
        log_pass(f"Mood logged: {mood_id}")
    else:
        log_fail(f"Mood log failed: {r.json()}")
    
    # 2.2 Get Moods
    print("\n2.2 GET MOOD HISTORY")
    r = requests.get(f'{BASE}/api/mood', headers=headers)
    if r.status_code == 200:
        moods = r.json().get('moods', [])
        log_pass(f"Retrieved {len(moods)} mood(s)")
    else:
        log_fail(f"Get moods failed: {r.json()}")
    
    # 2.3 Today's Mood
    print("\n2.3 GET TODAY'S MOOD")
    r = requests.get(f'{BASE}/api/mood/today', headers=headers)
    if r.status_code == 200:
        log_pass("Today's mood retrieved")
    else:
        log_warn(f"Today's mood: {r.status_code}")
    
    # 2.4 Mood Statistics
    print("\n2.4 GET MOOD STATISTICS")
    r = requests.get(f'{BASE}/api/mood/statistics', headers=headers)
    if r.status_code == 200:
        log_pass("Mood statistics retrieved")
    else:
        log_warn(f"Mood statistics: {r.status_code}")
    
    # 2.5 Weekly Analysis
    print("\n2.5 GET WEEKLY ANALYSIS")
    r = requests.get(f'{BASE}/api/mood/weekly-analysis', headers=headers)
    if r.status_code == 200:
        log_pass("Weekly analysis retrieved")
    else:
        log_warn(f"Weekly analysis: {r.status_code}")
    
    # 2.6 Mood Streaks
    print("\n2.6 GET MOOD STREAKS")
    r = requests.get(f'{BASE}/api/mood/streaks', headers=headers)
    if r.status_code == 200:
        log_pass("Mood streaks retrieved")
    else:
        log_warn(f"Mood streaks: {r.status_code}")
    
    # ========== SECTION 3: DASHBOARD ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 3: DASHBOARD")
    print("=" * 70)
    
    # 3.1 Dashboard Summary
    print("\n3.1 GET DASHBOARD SUMMARY")
    r = requests.get(f'{BASE}/api/dashboard/{user_id}/summary', headers=headers)
    if r.status_code == 200:
        log_pass("Dashboard summary loaded")
    else:
        log_warn(f"Dashboard summary: {r.status_code}")
    
    # 3.2 Quick Stats
    print("\n3.2 GET QUICK STATS")
    r = requests.get(f'{BASE}/api/dashboard/{user_id}/quick-stats', headers=headers)
    if r.status_code == 200:
        log_pass("Quick stats loaded")
    else:
        log_warn(f"Quick stats: {r.status_code}")
    
    # ========== SECTION 4: JOURNAL ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 4: JOURNAL")
    print("=" * 70)
    
    # 4.1 Create Journal Entry
    print("\n4.1 CREATE JOURNAL ENTRY")
    r = requests.post(f'{BASE}/api/journal/{user_id}/journal', json={
        'title': 'E2E Test Entry',
        'content': 'This is a test journal entry from comprehensive E2E test.',
        'mood_score': 8,
        'tags': ['test', 'e2e']
    }, headers=headers)
    if r.status_code in [200, 201]:
        entry_data = r.json()
        journal_id = entry_data.get('id', entry_data.get('entry_id', 'unknown'))
        log_pass(f"Journal entry created: {journal_id}")
    else:
        log_warn(f"Journal create: {r.status_code}")
        journal_id = None
    
    # 4.2 Get Journal Entries
    print("\n4.2 GET JOURNAL ENTRIES")
    r = requests.get(f'{BASE}/api/journal/{user_id}/journal', headers=headers)
    if r.status_code == 200:
        entries = r.json() if isinstance(r.json(), list) else r.json().get('entries', [])
        log_pass(f"Retrieved {len(entries) if isinstance(entries, list) else 'some'} journal entries")
    else:
        log_warn(f"Journal get: {r.status_code}")
    
    # ========== SECTION 5: AI & CHATBOT ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 5: AI & CHATBOT")
    print("=" * 70)
    
    # 5.1 AI Chat
    print("\n5.1 AI CHAT")
    r = requests.post(f'{BASE}/api/chatbot/chat', json={
        'message': 'Hej! Jag mår bra idag.',
        'user_id': user_id
    }, headers=headers)
    if r.status_code == 200:
        response = r.json().get('response', '')[:50]
        log_pass(f"AI responded: {response}...")
    else:
        log_warn(f"AI Chat: {r.status_code}")
    
    # 5.2 AI Analyze Mood
    print("\n5.2 AI ANALYZE MOOD")
    r = requests.post(f'{BASE}/api/ai/analyze', json={
        'text': 'Jag känner mig glad och tacksam idag',
        'user_id': user_id
    }, headers=headers)
    if r.status_code == 200:
        log_pass("AI mood analysis completed")
    else:
        log_warn(f"AI analyze: {r.status_code}")
    
    # 5.3 Generate Story
    print("\n5.3 GENERATE THERAPEUTIC STORY")
    r = requests.post(f'{BASE}/api/stories/generate', json={
        'theme': 'relaxation',
        'mood_score': 7
    }, headers=headers)
    if r.status_code == 200:
        log_pass("Story generated")
    else:
        log_warn(f"Story generation: {r.status_code}")
    
    # ========== SECTION 6: ACHIEVEMENTS & GAMIFICATION ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 6: ACHIEVEMENTS & GAMIFICATION")
    print("=" * 70)
    
    # 6.1 Get Achievements
    print("\n6.1 GET ACHIEVEMENTS")
    r = requests.get(f'{BASE}/api/achievements', headers=headers)
    if r.status_code == 200:
        achievements = r.json().get('achievements', r.json())
        count = len(achievements) if isinstance(achievements, list) else 'some'
        log_pass(f"Retrieved {count} achievements")
    else:
        log_warn(f"Achievements: {r.status_code}")
    
    # 6.2 Get Rewards
    print("\n6.2 GET REWARDS")
    r = requests.get(f'{BASE}/api/rewards', headers=headers)
    if r.status_code == 200:
        log_pass("Rewards retrieved")
    else:
        log_warn(f"Rewards: {r.status_code}")
    
    # 6.3 Get Challenges
    print("\n6.3 GET CHALLENGES")
    r = requests.get(f'{BASE}/api/challenges', headers=headers)
    if r.status_code == 200:
        log_pass("Challenges retrieved")
    else:
        log_warn(f"Challenges: {r.status_code}")
    
    # ========== SECTION 7: SOCIAL & REFERRALS ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 7: SOCIAL & REFERRALS")
    print("=" * 70)
    
    # 7.1 Get Referral Status
    print("\n7.1 GET REFERRAL STATUS")
    r = requests.get(f'{BASE}/api/referral/status', headers=headers)
    if r.status_code == 200:
        log_pass("Referral status retrieved")
    else:
        log_warn(f"Referral status: {r.status_code}")
    
    # 7.2 Generate Referral Code
    print("\n7.2 GENERATE REFERRAL CODE")
    r = requests.post(f'{BASE}/api/referral/generate', headers=headers)
    if r.status_code in [200, 201]:
        code = r.json().get('referral_code', r.json().get('code', 'generated'))
        log_pass(f"Referral code: {code}")
    else:
        log_warn(f"Referral generate: {r.status_code}")
    
    # ========== SECTION 8: MEMORIES ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 8: MEMORIES")
    print("=" * 70)
    
    # 8.1 List Memories
    print("\n8.1 LIST MEMORIES")
    r = requests.get(f'{BASE}/api/memory/list', headers=headers)
    if r.status_code == 200:
        memories = r.json().get('memories', [])
        log_pass(f"Retrieved {len(memories)} memories")
    else:
        log_warn(f"Memory list: {r.status_code}")
    
    # ========== SECTION 9: NOTIFICATIONS ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 9: NOTIFICATIONS")
    print("=" * 70)
    
    # 9.1 Get Notification Settings
    print("\n9.1 GET NOTIFICATION SETTINGS")
    r = requests.get(f'{BASE}/api/notifications/settings', headers=headers)
    if r.status_code == 200:
        log_pass("Notification settings retrieved")
    else:
        log_warn(f"Notification settings: {r.status_code}")
    
    # ========== SECTION 10: INTEGRATIONS ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 10: HEALTH INTEGRATIONS")
    print("=" * 70)
    
    # 10.1 Get Integration Status
    print("\n10.1 GET INTEGRATION STATUS")
    r = requests.get(f'{BASE}/api/integration/status', headers=headers)
    if r.status_code == 200:
        log_pass("Integration status retrieved")
    else:
        log_warn(f"Integration status: {r.status_code}")
    
    # ========== SECTION 11: FEEDBACK ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 11: FEEDBACK")
    print("=" * 70)
    
    # 11.1 Submit Feedback
    print("\n11.1 SUBMIT FEEDBACK")
    r = requests.post(f'{BASE}/api/feedback/submit', json={
        'type': 'general',
        'message': 'E2E test feedback submission',
        'rating': 5
    }, headers=headers)
    if r.status_code in [200, 201]:
        log_pass("Feedback submitted")
    else:
        log_warn(f"Feedback submit: {r.status_code}")
    
    # ========== SECTION 12: PRIVACY & CONSENT ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 12: PRIVACY & CONSENT")
    print("=" * 70)
    
    # 12.1 Get Consent Status
    print("\n12.1 GET CONSENT STATUS")
    r = requests.get(f'{BASE}/api/auth/consent', headers=headers)
    if r.status_code == 200:
        log_pass("Consent status retrieved")
    else:
        log_warn(f"Consent status: {r.status_code}")
    
    # 12.2 Export User Data (GDPR)
    print("\n12.2 REQUEST DATA EXPORT (GDPR)")
    r = requests.post(f'{BASE}/api/auth/export-data', headers=headers)
    if r.status_code == 200:
        log_pass("Data export initiated")
    else:
        log_warn(f"Data export: {r.status_code}")
    
    # ========== SECTION 13: SYSTEM HEALTH ==========
    print("\n" + "=" * 70)
    print("📋 SECTION 13: SYSTEM HEALTH")
    print("=" * 70)
    
    # 13.1 Health Check
    print("\n13.1 HEALTH CHECK")
    r = requests.get(f'{BASE}/health')
    if r.status_code == 200 and r.json().get('status') == 'healthy':
        log_pass("System healthy")
    else:
        log_warn(f"Health check: {r.status_code}")
    
    # ========== FINAL SUMMARY ==========
    print("\n" + "=" * 70)
    print("📊 FINAL RESULTS")
    print("=" * 70)
    print(f"\n   ✅ PASSED:   {results['passed']}")
    print(f"   ❌ FAILED:   {results['failed']}")
    print(f"   ⚠️ WARNINGS: {results['warnings']}")
    print(f"\n   TOTAL TESTS: {results['passed'] + results['failed'] + results['warnings']}")
    
    success_rate = results['passed'] / (results['passed'] + results['failed'] + results['warnings']) * 100
    print(f"   SUCCESS RATE: {success_rate:.1f}%")
    
    print("\n" + "=" * 70)
    if results['failed'] == 0:
        print("🎉 ALL CRITICAL TESTS PASSED!")
    else:
        print(f"⚠️ {results['failed']} CRITICAL TEST(S) FAILED")
    print("=" * 70)
    
    print(f"\n📧 Test user: {email}")
    print(f"🔑 Password: {password}")
    print(f"🆔 User ID: {user_id}")
    print("\n🌐 Login at: http://localhost:3001")
    
    return results

if __name__ == '__main__':
    try:
        results = test_core_flows()
        sys.exit(0 if results['failed'] == 0 else 1)
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Backend not running!")
        print("   Start it with: cd Backend && python main.py")
        sys.exit(1)
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
