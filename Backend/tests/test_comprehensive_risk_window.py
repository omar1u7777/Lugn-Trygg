"""GET /advanced-mood/assess/comprehensive: assessment window, factor codes and
patient-facing actions (UI audit S-2)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from src.services.clinical_assessment import ClinicalRiskStratification, RiskLevel

URL = '/api/v1/advanced-mood/assess/comprehensive'

# Orders for a clinician, never shown as the patient's own to-do list.
CLINICIAN_ONLY = {
    'URGENT_REFERRAL_PSYCHIATRY', 'MEDICATION_EVALUATION', 'REMOVE_MEANS_SELF_HARM',
    'IMMEDIATE_CRISIS_INTERVENTION', 'URGENT_THERAPY_REFERRAL', 'CBT_THERAPY_REFERRAL',
    'DAILY_MONITORING', 'WEEKLY_MONITORING',
}


def _doc(data):
    doc = MagicMock()
    doc.to_dict.return_value = data
    return doc


def _phq9(days_ago, q9=3, total=3, timestamp=None):
    ts = timestamp if timestamp is not None else (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()
    return {
        'type': 'phq9', 'timestamp': ts, 'total_score': total, 'severity': 'minimal',
        'risk_level': 'crisis' if q9 else 'none', 'item_scores': {'self_harm': q9},
        'suicidal_ideation': bool(q9), 'self_harm_score': q9,
    }


def _gad7(days_ago, total=1):
    return {
        'type': 'gad7', 'timestamp': (datetime.now(UTC) - timedelta(days=days_ago)).isoformat(),
        'total_score': total, 'severity': 'minimal', 'risk_level': 'none', 'item_scores': {},
    }


def _fake_db(assessments, moods=()):
    def collection(name):
        users = MagicMock()

        def document(_uid):
            user = MagicMock()

            def sub(sub_name):
                q = MagicMock()
                docs = assessments if sub_name == 'clinical_assessments' else moods
                q.order_by.return_value.limit.return_value.get.return_value = [_doc(d) for d in docs]
                return q
            user.collection.side_effect = sub
            return user
        users.document.side_effect = document
        return users
    db = MagicMock()
    db.collection.side_effect = collection
    return db


def _get(client, assessments):
    with patch('src.routes.advanced_mood_routes.db', _fake_db(assessments)):
        res = client.get(URL)
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def test_current_q9_answer_is_crisis_with_patient_actions(client):
    data = _get(client, [_phq9(days_ago=2), _gad7(days_ago=2)])

    assert data['composite_risk'] == 'crisis'
    assert data['stale_assessments'] == []
    assert {'code': 'SUICIDAL_IDEATION', 'params': {'q9': 3}} in data['risk_factor_details']
    assert data['patient_interventions'][0] == 'CONTACT_CRISIS_SUPPORT'
    assert not CLINICIAN_ONLY & set(data['patient_interventions'])
    # The full list is still returned for clinical consumers.
    assert 'URGENT_REFERRAL_PSYCHIATRY' in data['suggested_interventions']


def test_assessment_outside_window_no_longer_drives_acute_risk(client):
    data = _get(client, [_phq9(days_ago=45), _gad7(days_ago=2)])

    assert data['composite_risk'] != 'crisis'
    assert [s['type'] for s in data['stale_assessments']] == ['phq9']
    assert not any(d['code'] == 'SUICIDAL_IDEATION' for d in data['risk_factor_details'])
    assert data['assessment_window_days'] == 30


def test_unreadable_timestamp_counts_as_current(client):
    # Dropping a possibly-flagged result on a parsing failure would be the
    # unsafe direction.
    data = _get(client, [_phq9(days_ago=0, timestamp='not-a-date'), _gad7(days_ago=2)])

    assert data['composite_risk'] == 'crisis'
    assert data['stale_assessments'] == []


@pytest.mark.parametrize('level', list(RiskLevel))
def test_patient_interventions_never_include_clinician_orders(level):
    actions = ClinicalRiskStratification.patient_interventions(level, [])
    assert actions
    assert not CLINICIAN_ONLY & set(actions)


def test_suicidal_ideation_always_yields_crisis_actions():
    actions = ClinicalRiskStratification.patient_interventions(RiskLevel.MILD, ['suicidal_ideation'])
    assert actions[0] == 'CONTACT_CRISIS_SUPPORT'


def test_factor_details_mirror_text_factors():
    from src.services.clinical_assessment import PHQ9Result

    phq9 = PHQ9Result(
        total_score=16, severity='moderately_severe', risk_level=RiskLevel.SEVERE,
        item_scores={'self_harm': 0}, suicidal_ideation_flag=False, self_harm_score=0,
        interpretation='', recommendations=[], follow_up_timeframe='1_week',
    )
    result = ClinicalRiskStratification.assess_comprehensive_risk(user_id='u', phq9_result=phq9)

    assert len(result.risk_factor_details) == len(result.risk_factors)
    assert result.risk_factor_details[0] == {
        'code': 'PHQ9_SCORE', 'params': {'score': 16, 'severity': 'moderately_severe'}}
