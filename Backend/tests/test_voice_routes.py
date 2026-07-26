"""Voice routes cover transcription and emotion analysis."""

import base64
from unittest.mock import MagicMock, patch


def test_transcribe_audio_succeeds(client, auth_csrf_headers, mock_auth_service, mocker):
    mocker.patch('src.routes.voice_routes.transcribe_audio_google', return_value='Hej världen')
    mocker.patch('src.routes.voice_routes.audit_log')
    audio_payload = base64.b64encode(b'test-bytes').decode('utf-8')

    response = client.post(
        '/api/v1/voice/transcribe',
        json={'audio_data': audio_payload, 'language': 'sv-SE'},
        headers=auth_csrf_headers,
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['transcript'] == 'Hej världen'
    assert data['data']['confidence'] == 0.85
    assert data['data']['language'] == 'sv-SE'


def test_transcribe_audio_handles_invalid_base64(client, auth_csrf_headers, mock_auth_service):
    response = client.post(
        '/api/v1/voice/transcribe',
        json={'audio_data': '!!!notbase64!!!'},
        headers=auth_csrf_headers,
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data['success'] is False
    assert 'Invalid base64 audio data' in data['message']


def test_analyze_voice_emotion_combines_audio_and_text(client, auth_csrf_headers, mock_auth_service, mocker):
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
    mocker.patch('src.routes.voice_routes.audit_log')

    payload = {
        'audio_data': base64.b64encode(b'audio').decode('utf-8'),
        'transcript': 'Jag känner mig glad'
    }

    response = client.post('/api/v1/voice/analyze-emotion', json=payload, headers=auth_csrf_headers)

    assert response.status_code == 200
    body = response.get_json()
    assert body['success'] is True
    assert body['data']['primaryEmotion'] == 'happy'
    assert 'emotions' in body['data']
    assert 'energyLevel' in body['data']
    assert 'speakingPace' in body['data']


def _make_professional_voice_result(**overrides):
    """Mimics the VoiceEmotionResult dataclass returned by
    analyze_voice_emotion_professional, with every field the route reads."""
    prosody = MagicMock(
        intensity_mean=0.5, intensity_range=0.2, pitch_mean=180.0,
        pitch_range=40.0, syllables_per_second=4.5, hnr=0.8,
    )
    defaults = dict(
        emotion_confidences={"happy": 0.1, "sad": 0.7, "angry": 0.0, "anxious": 0.2, "calm": 0.0, "neutral": 0.0},
        primary_emotion="sad",
        confidence=0.8,
        analysis_method="professional",
        valence=-0.5,
        arousal=0.3,
        dominance=0.2,
        prosody=prosody,
    )
    defaults.update(overrides)
    return MagicMock(**defaults)


def test_analyze_voice_emotion_crisis_transcript_enqueues_durable_escalation(
    client, auth_csrf_headers, mock_auth_service, mocker
):
    """DURABILITY: crisis detected from a voice transcript must be enqueued to
    the same durable /crisis_tasks pipeline as chat/mood-log/WebSocket — not
    just returned as a same-response crisisLevel/crisisMessage hint that is
    lost if the client never reads or acts on it."""
    mocker.patch("src.routes.voice_routes.PROFESSIONAL_VOICE_ANALYSIS", True)
    mocker.patch(
        "src.routes.voice_routes.analyze_voice_emotion_professional",
        return_value=_make_professional_voice_result(),
    )
    mocker.patch("src.routes.voice_routes.audit_log")

    high_risk_assessment = MagicMock(
        overall_risk_level="critical",
        risk_score=0.92,
        active_indicators=[],
    )
    payload = {
        "audio_data": base64.b64encode(b"audio").decode("utf-8"),
        "transcript": "Jag vill inte leva längre",
    }

    with patch(
        "src.services.crisis_intervention.crisis_intervention_service.assess_text_crisis_risk",
        return_value=high_risk_assessment,
    ), patch(
        "src.services.crisis_task_queue.enqueue_crisis_escalation",
        return_value="task-voice-1",
    ) as mock_enqueue:
        response = client.post("/api/v1/voice/analyze-emotion", json=payload, headers=auth_csrf_headers)

    assert response.status_code == 200
    body = response.get_json()
    assert body["data"]["crisisLevel"] == 2
    mock_enqueue.assert_called_once()
    enqueued_alert = mock_enqueue.call_args.args[0]
    assert enqueued_alert.risk_level == "critical"
    assert enqueued_alert.requires_immediate_action is True


def test_voice_service_status_reports_google_flag(client, mocker):
    mocker.patch('src.utils.speech_utils.initialize_google_speech', return_value=True)

    response = client.get('/api/v1/voice/status')

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['googleSpeech'] is True
    assert data['data']['emotionAnalysis'] is True
    assert 'supportedLanguages' in data['data']
