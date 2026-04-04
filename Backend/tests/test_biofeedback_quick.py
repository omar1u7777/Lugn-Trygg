"""Quick biofeedback service test - no ML stack, no Flask app."""
import sys
sys.path.insert(0, '.')

from src.services.biofeedback_breathing_service import (
    BreathingPattern, HRVAnalyzer, BiofeedbackBreathingService
)
from datetime import datetime, timedelta

# Test 1: HRV analysis
hrv = HRVAnalyzer()
rr = [800, 810, 790, 820, 830, 800, 810, 820, 800, 790]
timestamps = [datetime.now() - timedelta(seconds=i) for i in range(len(rr))]
metrics = hrv.calculate_hrv_metrics(rr, timestamps)
print(f'OK HRVAnalyzer: SDNN={metrics.sdnn:.1f}ms RMSSD={metrics.rmssd:.1f}ms resonance={metrics.resonance_score:.1f}')

# Test 2: session lifecycle
svc = BiofeedbackBreathingService()
sess = svc.start_session('test_user', 'coherence', 5)
print(f'OK Session start: {sess.session_id}, pattern={sess.pattern.value}')

# Test 3: timedelta fix - this was the crashing line in biofeedback_ws_routes.py line 229
rr_intervals = [800, 810, 790, 820]
timestamps = [datetime.now() - timedelta(seconds=i) for i in range(len(rr_intervals))]
feedback = svc.process_heart_rate_data(sess.session_id, rr_intervals, timestamps)
print(f'OK HRV feedback: phase={feedback.phase}, coherence={feedback.coherence_indicator:.1f}pct')

# Test 4: end session
summary = svc.end_session(sess.session_id)
print(f'OK Session end: summary keys={list(summary.keys())}')

# Test 5: all 4 patterns create correct cycle times
pattern_expected = {
    'coherence': 10,  # 5+0+5+0
    'relax': 19,      # 4+7+8+0
    'energize': 20,   # 5+5+5+5
    'sleep': 10,      # 4+0+6+0
}
for pat_name, expected_cycle in pattern_expected.items():
    s = svc.start_session('u', pat_name, 5)
    config = svc.patterns.get(s.pattern, {})
    cycle = config.get('inhale', 0) + config.get('hold', 0) + config.get('exhale', 0) + config.get('hold_empty', 0)
    assert cycle == expected_cycle, f'Pattern {pat_name}: expected {expected_cycle}s cycle, got {cycle}s'
    print(f'OK Pattern {pat_name}: {cycle}s cycle ({s.pattern.value})')
    svc.end_session(s.session_id)

print('\nALL BIOFEEDBACK TESTS PASSED')
