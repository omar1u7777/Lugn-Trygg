"""A voice recording logged with a mood is never made public.

The recording was uploaded and then made public, and its public address was
saved on the mood entry: anyone holding the address could listen to a person
describing how they feel, with no sign-in. Nothing in the app plays the
recording back, so nothing needed the address. The file now stays private in
the bucket and the entry keeps only its path there.
"""

from io import BytesIO
from unittest.mock import Mock

import pytest

from src.services.subscription_service import SubscriptionService
from tests.test_mood_routes import mock_firestore  # noqa: F401  (fixture)


@pytest.fixture
def logged(client, auth_csrf_headers, mock_auth_service, mock_firestore, mocker):  # noqa: F811
    mocker.patch('src.routes.mood_routes.db', mock_firestore)
    mocker.patch.object(SubscriptionService, 'consume_quota', return_value={'mood_logs': 1})
    ai = mocker.patch('src.services.ai_service.ai_services')
    ai.analyze_voice_emotion.return_value = {'primary_emotion': 'joy', 'confidence': 0.9}
    mocker.patch('src.utils.speech_utils.transcribe_audio_google', return_value='Glad idag')
    blob = Mock()
    blob.public_url = 'https://storage.googleapis.com/bucket/users/u/voice/x.webm'
    storage = mocker.patch('src.routes.mood_routes.firebase_storage')
    storage.bucket.return_value.blob.return_value = blob
    moods = mock_firestore.collection.return_value.document.return_value.collection.return_value
    moods.where.return_value.order_by.return_value.limit.return_value.stream.return_value = []

    response = client.post('/api/mood/log', headers=auth_csrf_headers, content_type='multipart/form-data',
                           data={'audio': (BytesIO(b'voice'), 'voice.webm'), 'mood_text': ''})
    assert response.status_code == 200
    return blob, storage.bucket.return_value.blob.call_args.args[0], moods.add.call_args.args[0]


def test_the_recording_is_uploaded_but_not_made_public(logged):
    blob, _path, _entry = logged

    blob.upload_from_string.assert_called_once()
    blob.make_public.assert_not_called()


def test_the_entry_holds_the_path_and_no_public_address(logged):
    _blob, path, entry = logged

    assert entry['voice_path'] == path
    assert path.startswith('users/testuser1234567890ab/voice/')
    assert 'voice_url' not in entry
    assert 'storage.googleapis.com' not in str(entry)
