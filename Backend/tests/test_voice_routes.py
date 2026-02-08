"""Voice routes cover transcription and emotion analysis."""

import base64


def test_transcribe_audio_succeeds(client, auth_headers, mock_auth_service, mocker):
    mocker.patch('src.routes.voice_routes.transcribe_audio_google', return_value='Hej världen')
    mocker.patch('src.routes.voice_routes.audit_log')  # Mock audit_log
    audio_payload = base64.b64encode(b'test-bytes').decode('utf-8')

    response = client.post(
        '/api/voice/transcribe',
        json={'audio_data': audio_payload, 'language': 'sv-SE'},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['transcript'] == 'Hej världen'
    assert data['data']['confidence'] == 0.85
    assert data['data']['language'] == 'sv-SE'


def test_transcribe_audio_handles_invalid_base64(client, auth_headers, mock_auth_service):
    response = client.post(
        '/api/voice/transcribe',
        json={'audio_data': '!!!notbase64!!!'},
        headers=auth_headers,
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data['success'] is False
    assert 'Invalid base64 audio data' in data['message']


def test_analyze_voice_emotion_combines_audio_and_text(client, auth_headers, mock_auth_service, mocker):
    mocker.patch('src.routes.voice_routes.analyze_audio_features', return_value={
        'energy_level': 'high',
        'pace': 'fast',
        'volume_variation': 'high'
    })
    mocker.patch('src.routes.voice_routes.analyze_text_sentiment', return_value={
        'scores': {'happy': 1.0},
        'primary': 'happy'
    })
    mocker.patch('src.routes.voice_routes.combine_emotion_analysis', return_value={
        'all': {'happy': 0.9, 'neutral': 0.1},
        'primary': 'happy'
    })
    mocker.patch('src.routes.voice_routes.audit_log')  # Mock audit_log

    payload = {
        'audio_data': base64.b64encode(b'audio').decode('utf-8'),
        'transcript': 'Jag känner mig glad'
    }

    response = client.post('/api/voice/analyze-emotion', json=payload, headers=auth_headers)

    assert response.status_code == 200
    body = response.get_json()
    assert body['success'] is True
    assert body['data']['primaryEmotion'] == 'happy'
    assert 'emotions' in body['data']
    assert 'energyLevel' in body['data']
    assert 'speakingPace' in body['data']


def test_voice_service_status_reports_google_flag(client, mocker):
    mocker.patch('src.utils.speech_utils.initialize_google_speech', return_value=True)

    response = client.get('/api/voice/status')

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['googleSpeech'] is True
    assert data['data']['emotionAnalysis'] is True
    assert 'supportedLanguages' in data['data']
