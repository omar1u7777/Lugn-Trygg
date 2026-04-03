"""
CBT API tests using the project's conftest fixtures (mocked Firebase + JWT).
Auth: conftest patches jwt_required to set g.user_id='testuser1234567890ab'.
Subscription: conftest mocks Firestore/user docs to allow premium/trial access.
"""
import json
import os
import sys

import pytest

# Add Backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault('SKIP_BACKGROUND_SERVICES', '1')


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _json(response):
    return json.loads(response.data)


@pytest.fixture(autouse=True)
def _allow_cbt_access(monkeypatch):
    """Keep tests focused on CBT logic instead of subscription-plan fixtures."""
    monkeypatch.setattr("src.routes.cbt_routes._check_cbt_access", lambda user_id: (True, ""))


# ─────────────────────────────────────────────────────────────────────────────
# Module listing
# ─────────────────────────────────────────────────────────────────────────────

def test_get_cbt_modules_returns_three_modules(client):
    r = client.get('/api/v1/cbt/modules')
    assert r.status_code == 200
    data = _json(r)
    assert data['success'] is True
    modules = data['data']['modules']
    assert len(modules) == 3
    ids = {m['moduleId'] for m in modules}
    assert ids == {'anxiety_basics', 'depression_cognitive', 'stress_management'}


def test_get_cbt_modules_includes_completion_status(client):
    r = client.get('/api/v1/cbt/modules')
    assert r.status_code == 200
    modules = _json(r)['data']['modules']
    for m in modules:
        assert 'isCompleted' in m
        assert 'isLocked' in m


# ─────────────────────────────────────────────────────────────────────────────
# Module detail
# ─────────────────────────────────────────────────────────────────────────────

def test_get_anxiety_module_detail(client):
    r = client.get('/api/v1/cbt/modules/anxiety_basics')
    assert r.status_code == 200
    m = _json(r)['data']['module']
    assert m['moduleId'] == 'anxiety_basics'
    assert 'exercises' in m
    assert 'swedishContent' in m


def test_get_stress_module_detail(client):
    r = client.get('/api/v1/cbt/modules/stress_management')
    assert r.status_code == 200
    m = _json(r)['data']['module']
    assert m['moduleId'] == 'stress_management'
    # Fixed title (no extra 'e')
    assert m['title'] == 'Stresshantering och Problemlösning'


def test_get_nonexistent_module_returns_404(client):
    r = client.get('/api/v1/cbt/modules/does_not_exist')
    assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Personalized session
# ─────────────────────────────────────────────────────────────────────────────

def test_get_session_default_mood(client):
    r = client.get('/api/v1/cbt/session')
    assert r.status_code == 200
    session = _json(r)['data']['session']
    assert 'exercises' in session
    assert len(session['exercises']) > 0
    assert 'guidance' in session


def test_get_session_high_anxiety_mood(client):
    r = client.get('/api/v1/cbt/session?mood=high_anxiety')
    assert r.status_code == 200
    session = _json(r)['data']['session']
    assert session['sessionTheme'] == 'anxiety_management'


def test_get_session_depression_mood(client):
    r = client.get('/api/v1/cbt/session?mood=depression')
    assert r.status_code == 200
    session = _json(r)['data']['session']
    assert session['sessionTheme'] == 'behavioral_activation'


# ─────────────────────────────────────────────────────────────────────────────
# Exercises listing
# ─────────────────────────────────────────────────────────────────────────────

def test_get_exercises_returns_all_three(client):
    r = client.get('/api/v1/cbt/exercises')
    assert r.status_code == 200
    exercises = _json(r)['data']['exercises']
    assert len(exercises) == 3
    ids = {e['exerciseId'] for e in exercises}
    assert ids == {'thought_record_basic', 'behavioral_activation', 'worry_time'}


def test_get_exercises_filter_by_module(client):
    r = client.get('/api/v1/cbt/exercises?module=anxiety_basics')
    assert r.status_code == 200
    exercises = _json(r)['data']['exercises']
    for ex in exercises:
        assert ex['moduleId'] == 'anxiety_basics'


# ─────────────────────────────────────────────────────────────────────────────
# Insights
# ─────────────────────────────────────────────────────────────────────────────

def test_get_insights_structure(client):
    r = client.get('/api/v1/cbt/insights')
    assert r.status_code == 200
    insights = _json(r)['data']['insights']
    assert 'overallProgress' in insights
    assert 'streak' in insights
    assert 'recommendedNextSteps' in insights


# ─────────────────────────────────────────────────────────────────────────────
# Progress update
# ─────────────────────────────────────────────────────────────────────────────

def test_progress_thought_record_basic(client, csrf_headers):
    r = client.post('/api/v1/cbt/progress', json={
        'exerciseId': 'thought_record_basic',
        'successRate': 0.8,
        'timeSpent': 15,
        'difficultyRating': 2,
    }, headers=csrf_headers)
    assert r.status_code == 200
    d = _json(r)['data']
    assert 'skillMastery' in d
    assert 'streakCount' in d


def test_progress_behavioral_activation(client, csrf_headers):
    r = client.post('/api/v1/cbt/progress', json={
        'exerciseId': 'behavioral_activation',
        'successRate': 0.9,
        'timeSpent': 20,
        'difficultyRating': 2,
    }, headers=csrf_headers)
    assert r.status_code == 200


def test_progress_worry_time(client, csrf_headers):
    r = client.post('/api/v1/cbt/progress', json={
        'exerciseId': 'worry_time',
        'successRate': 0.85,
        'timeSpent': 25,
        'difficultyRating': 3,
    }, headers=csrf_headers)
    assert r.status_code == 200


def test_progress_missing_exercise_id_returns_400(client, csrf_headers):
    r = client.post('/api/v1/cbt/progress', json={'successRate': 0.5}, headers=csrf_headers)
    assert r.status_code == 400


def test_progress_unknown_exercise_returns_404(client, csrf_headers):
    r = client.post('/api/v1/cbt/progress', json={
        'exerciseId': 'not_a_real_exercise',
        'successRate': 0.5,
        'timeSpent': 5,
        'difficultyRating': 3,
    }, headers=csrf_headers)
    assert r.status_code == 404


def test_streak_not_double_incremented_same_day(client, csrf_headers):
    """Completing two exercises in one day must not add >1 to streak."""
    # First exercise
    r1 = client.post('/api/v1/cbt/progress', json={
        'exerciseId': 'thought_record_basic',
        'successRate': 0.8, 'timeSpent': 15, 'difficultyRating': 2,
    }, headers=csrf_headers)
    assert r1.status_code == 200
    streak1 = _json(r1)['data']['streakCount']

    # Second exercise same mocked day
    r2 = client.post('/api/v1/cbt/progress', json={
        'exerciseId': 'behavioral_activation',
        'successRate': 0.9, 'timeSpent': 20, 'difficultyRating': 2,
    }, headers=csrf_headers)
    assert r2.status_code == 200
    streak2 = _json(r2)['data']['streakCount']

    # Same calendar day: streak must not increase
    assert streak2 == streak1, (
        f"Streak should not increase within the same day (got {streak1} → {streak2})"
    )

