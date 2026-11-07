"""Biofeedback breathing: HRV analysis, patterns, the session lifecycle and routes.

Ownership of sessions is covered in test_biofeedback_session_owner.py.
"""

from datetime import datetime, timedelta

import pytest
from flask import Flask

from src.routes.biofeedback_ws_routes import _get_recommendation, biofeedback_ws_bp
from src.services.biofeedback_breathing_service import (
    BiofeedbackBreathingService,
    BreathingPattern,
    HRVAnalyzer,
    HRVMetrics,
)

PHASES = {'inhale', 'hold', 'exhale', 'hold_empty'}


def _timestamps(count):
    now = datetime.now()
    return [now - timedelta(seconds=count - i) for i in range(count)]


def _rsa_intervals(count=30):
    """R-R intervals around 1000 ms (60 BPM) with a 6-second breathing swing."""
    return [1000 + 50 * (i % 6 / 3 - 1) + i * 0.5 for i in range(count)]


@pytest.fixture
def firestore(mocker):
    mocker.patch('src.services.biofeedback_breathing_service.audit_log')
    return mocker.patch('src.services.biofeedback_breathing_service.db')


@pytest.fixture
def service(firestore):
    return BiofeedbackBreathingService()


# HRV analysis ---------------------------------------------------------------

def test_hrv_metrics_for_a_resting_heart():
    intervals = _rsa_intervals()

    metrics = HRVAnalyzer().calculate_hrv_metrics(intervals, _timestamps(len(intervals)))

    assert 50 < metrics.heart_rate < 70
    assert metrics.sdnn > 0 and metrics.rmssd > 0
    assert 0 <= metrics.resonance_score <= 100


def _history(heart_rates, resonance_scores):
    return [
        HRVMetrics(
            timestamp=datetime.now() - timedelta(minutes=i), heart_rate=hr, rr_intervals=[1000],
            sdnn=50, rmssd=30, coherence_ratio=1.5, resonance_score=score, breath_sync_quality=0.5,
        )
        for i, (hr, score) in enumerate(zip(heart_rates, resonance_scores, strict=True))
    ]


def test_resonance_rate_defaults_to_six_with_little_history():
    assert HRVAnalyzer().detect_resonance_breathing_rate(_history([60] * 4, [50] * 4)) == 6.0


def test_resonance_rate_is_kept_within_four_to_eight():
    # The best score sits at 52 BPM, which maps to 11.5 breaths/min.
    history = _history([70, 68, 66, 64, 52], [30, 35, 40, 45, 80])

    assert HRVAnalyzer().detect_resonance_breathing_rate(history) == 8.0


# Patterns -------------------------------------------------------------------

@pytest.mark.parametrize('name, pattern, cycle_seconds', [
    ('coherence', BreathingPattern.COHERENCE_6BPM, 10),  # 5 in, 5 out
    ('relax', BreathingPattern.RELAX_478, 19),           # 4 in, 7 hold, 8 out
    ('energize', BreathingPattern.ENERGIZE_555, 20),     # 5 in, 5 hold, 5 out, 5 hold
    ('sleep', BreathingPattern.SLEEP_446, 10),           # 4 in, 6 out
])
def test_short_pattern_names_and_cycle_lengths(service, name, pattern, cycle_seconds):
    session = service.start_session('user-1', name, 5)
    config = service.patterns[session.pattern]

    assert session.pattern is pattern
    assert config['inhale'] + config['hold'] + config['exhale'] + config['hold_empty'] == cycle_seconds


def test_full_and_unknown_pattern_names(service):
    assert service.start_session('user-1', 'relax_478').pattern is BreathingPattern.RELAX_478
    assert service.start_session('user-1', 'no-such-pattern').pattern is BreathingPattern.COHERENCE_6BPM


def test_every_pattern_has_recommendations():
    for pattern in BreathingPattern:
        if pattern is not BreathingPattern.CUSTOM:
            assert _get_recommendation(pattern), pattern

    coherence = _get_recommendation(BreathingPattern.COHERENCE_6BPM)
    assert 'stress_reduction' in coherence and 'hrv_optimization' in coherence


# Session lifecycle ----------------------------------------------------------

def test_session_lifecycle(service):
    session = service.start_session('user-1', 'coherence', 3)
    assert session.session_id in service.active_sessions
    assert session.target_duration == 3

    intervals = [950 + (i % 10) * 10 for i in range(20)]
    feedback = service.process_heart_rate_data(session.session_id, intervals, _timestamps(20))

    assert feedback.phase in PHASES
    assert 0 <= feedback.phase_progress <= 1
    assert 0.5 <= feedback.visualization_data['circle_scale'] <= 1.0
    assert feedback.guidance

    summary = service.end_session(session.session_id)

    assert summary['session_id'] == session.session_id
    assert summary['pattern'] == 'coherence_6bpm'
    assert summary['data_points'] == 1
    assert session.session_id not in service.active_sessions


def test_ended_session_is_saved(service, firestore):
    session = service.start_session('user-1', 'sleep', 5)

    service.end_session(session.session_id)

    firestore.collection.assert_called_with('breathing_sessions')
    saved = firestore.collection.return_value.document.return_value.set.call_args.args[0]
    assert saved['user_id'] == 'user-1'
    assert saved['pattern'] == 'sleep_446'
    assert saved['summary']['session_id'] == session.session_id


def test_unknown_session(service):
    feedback = service.process_heart_rate_data('breath_unknown', [800.0], _timestamps(1))

    assert feedback.phase in PHASES
    assert service.end_session('breath_unknown') == {}


def test_session_ids_are_unique_and_carry_no_uid(service):
    first = service.start_session('user-1').session_id
    second = service.start_session('user-1').session_id

    assert first != second
    assert 'user-1' not in first


# Routes ---------------------------------------------------------------------

def test_blueprint_routes():
    app = Flask(__name__)
    app.register_blueprint(biofeedback_ws_bp, url_prefix='/api/v1/biofeedback')

    rules = {rule.rule for rule in app.url_map.iter_rules()}

    assert {
        '/api/v1/biofeedback/patterns',
        '/api/v1/biofeedback/start',
        '/api/v1/biofeedback/data/<session_id>',
        '/api/v1/biofeedback/end/<session_id>',
        '/api/v1/biofeedback/history',
    } <= rules
