# Root conftest for Backend
# Prevent pytest from collecting non-test files
collect_ignore_glob = ["*.txt", "*.md", "*.json", "*.html", "*.cfg"]

# Standalone verification scripts that are not real pytest test modules.
# They contain top-level exit() calls which cause INTERNALERROR on import.
collect_ignore = [
    "tests/e2e_live_test.py",
    "tests/test_ai_music.py",
    "tests/test_biofeedback_breathing.py",
    "tests/test_biofeedback_quick.py",
    "tests/test_complete_system.py",
    "tests/test_crisis_nlp.py",
    "tests/test_daily_insights_comprehensive.py",
    "tests/test_import_validation.py",
    "tests/test_memory_journal.py",
    "tests/test_memory_journal_complete.py",
    "tests/test_memory_quick.py",
    "tests/test_mood.py",
    "tests/test_mood_final.py",
    "tests/test_mood_simple.py",
    "tests/test_mood_tracking.py",
    "tests/test_mood_working.py",
    "tests/test_voice_emotion.py",
    "tests/test_voice_live_http.py",
    "tests/test_voice_service_only.py",
]
