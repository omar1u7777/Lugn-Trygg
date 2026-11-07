"""Swedish mood analysis: polarity, negation, clinical risk markers and the mood score."""

import pytest

from src.services.mood_nlp_service import SwedishMoodNLP


@pytest.fixture(scope='module')
def nlp():
    return SwedishMoodNLP()


@pytest.mark.parametrize('text', [
    'Jag känner mig glad och energisk idag',
    'Jag känner mig lugn och tillfreds',
    'Jag är så tacksam och stolt',
])
def test_positive_text(nlp, text):
    result = nlp.analyze_mood_text(text)

    assert result.valence > 0
    assert result.primary_emotion == 'positive'


@pytest.mark.parametrize('text', [
    'Jag är stressad och orolig',
    'Jag är ledsen och nedstämd',
    'Jag känner mig olycklig och ensam',
    'Jag känner mig inte glad',     # negation
    'Allt känns glädjelöst',        # "-lös" means "-less"
])
def test_negative_text(nlp, text):
    result = nlp.analyze_mood_text(text)

    assert result.valence < 0
    assert result.primary_emotion == 'negative'


@pytest.mark.parametrize('text', [
    'Jag vill inte leva längre',
    'Jag vill inte leva längre, allt känns hopplöst',
    'Jag tänker på att ta mitt liv',
    'Jag har självmordstankar',
])
def test_suicidal_statements_are_negative_and_high_risk(nlp, text):
    result = nlp.analyze_mood_text(text)

    assert result.valence <= -0.5
    assert result.primary_emotion == 'negative'
    # advanced_mood_routes reports high_clinical_risk when any indicator > 0.5
    assert result.clinical_indicators['suicidal_ideation'] > 0.5
    assert nlp.extract_mood_score(text) <= 3


def test_hopelessness_is_negative(nlp):
    result = nlp.analyze_mood_text('Allt känns hopplöst')

    assert result.valence < 0
    assert result.clinical_indicators['hopelessness'] > 0


def test_ordinary_words_raise_no_suicide_marker(nlp):
    # "dö" used to match inside "dörren" and "döttrar".
    result = nlp.analyze_mood_text('Jag stängde dörren och åt middag med mina döttrar')

    assert result.clinical_indicators['suicidal_ideation'] == 0


def test_mood_score_follows_the_text(nlp):
    assert nlp.extract_mood_score('Jag känner mig glad') >= 7
    assert nlp.extract_mood_score('Jag är ledsen och nedstämd') <= 3


def test_empty_text_is_neutral(nlp):
    result = nlp.analyze_mood_text('   ')

    assert result.valence == 0.0
    assert result.primary_emotion == 'neutral'
    assert result.confidence == 0.0


@pytest.mark.parametrize('text, high_risk', [
    ('Jag vill inte leva längre', True),
    ('Jag känner mig glad idag', False),
])
def test_analyze_endpoint_reports_clinical_risk(client, auth_csrf_headers, mock_auth_service, mocker, text, high_risk):
    mocker.patch('src.routes.advanced_mood_routes.audit_log')

    response = client.post('/api/v1/advanced-mood/analyze', json={'text': text}, headers=auth_csrf_headers)

    assert response.status_code == 200
    data = response.get_json()['data']
    assert data['high_clinical_risk'] is high_risk
    assert (data['valence'] < 0) is high_risk
