"""
Regression coverage for CrisisInterventionService.get_emergency_protocol().

Every existing crisis route test mocks this method directly (see
test_crisis_routes.py), so a key-construction bug here was invisible to CI:
production returned 404 for 'low' and 'medium' risk levels for as long as
this method existed, because it guessed a protocol dict key
(f'{risk_level}_risk_crisis') that never matched the real stored keys
(low_risk_support, medium_risk_intervention). Found via a live Postman run
against production. This test exercises the real, unmocked method.
"""
from src.services.crisis_intervention import CrisisInterventionService


def test_get_emergency_protocol_returns_a_protocol_for_every_valid_risk_level():
    svc = CrisisInterventionService()
    for level in ['low', 'medium', 'high', 'critical']:
        protocol = svc.get_emergency_protocol(level)
        assert protocol is not None, f"no protocol found for risk_level={level!r}"
        assert protocol.risk_level == level


def test_get_emergency_protocol_returns_none_for_unknown_risk_level():
    svc = CrisisInterventionService()
    assert svc.get_emergency_protocol('not_a_real_level') is None
