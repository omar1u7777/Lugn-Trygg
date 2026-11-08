"""What a person writes or says in the app stays out of logs and Sentry.

The mood log wrote the note and the mood text into the server log
("📝 Mood log data: score=10, note='allt går bra', mood_text='Super'"), the
voice log wrote the transcript, the chat wrote the first 50 characters of each
message, and the goal routes wrote the goals. Render keeps those lines, and the
Sentry logging integration attaches them as breadcrumbs to error events.

Sentry also received the local variables of every frame in a stack trace, so
an exception inside log_mood would have sent the note itself.
"""

import ast
import logging
import sys
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sentry_sdk.consts import DEFAULT_OPTIONS
from sentry_sdk.utils import event_from_exception

from src.monitoring import sentry_config
from tests.test_mood_routes import mock_firestore  # noqa: F401  (fixture)

NOTE = 'Jag har inte sovit på tre nätter'
MOOD_TEXT = 'Ensam och rädd'
TRANSCRIPT = 'Jag orkar inte gå till jobbet'
CHAT_MESSAGE = 'Min sambo vet inte att jag mår så här'


@pytest.fixture
def log_lines(monkeypatch):
    """Every line any logger is asked to write, at every level."""
    lines: list[str] = []
    handle = logging.Logger.handle

    def recording_handle(self, record):
        lines.append(record.getMessage())
        return handle(self, record)

    monkeypatch.setattr(logging.Logger, 'isEnabledFor', lambda self, level: True)
    monkeypatch.setattr(logging.Logger, 'handle', recording_handle)
    return lines


def _leaks(lines, *secrets):
    return [line for line in lines if any(secret in line for secret in secrets)]


def test_logging_a_mood_does_not_log_the_note_or_mood_text(
    client, mock_firestore, mocker, auth_csrf_headers, mock_auth_service, log_lines  # noqa: F811
):
    ai = mocker.patch('src.services.ai_service.ai_services')
    ai.analyze_sentiment.return_value = {'sentiment': 'NEGATIVE', 'score': -0.7, 'emotions': ['sadness']}

    response = client.post('/api/mood/log', json={
        'score': 2, 'note': NOTE, 'mood_text': MOOD_TEXT,
    }, headers=auth_csrf_headers)

    assert response.status_code == 201
    assert log_lines, 'the fixture recorded nothing, so the assertion below would prove nothing'
    assert _leaks(log_lines, NOTE, MOOD_TEXT) == []


def test_logging_a_mood_by_voice_does_not_log_the_transcript(
    client, mock_firestore, mocker, auth_csrf_headers, mock_auth_service, log_lines  # noqa: F811
):
    ai = mocker.patch('src.services.ai_service.ai_services')
    ai.analyze_voice_emotion.return_value = {
        'primary_emotion': 'sad', 'confidence': 0.8, 'transcript': TRANSCRIPT,
    }
    mocker.patch('src.utils.speech_utils.transcribe_audio_google', return_value=TRANSCRIPT)

    response = client.post('/api/mood/log', headers=auth_csrf_headers,
                           content_type='multipart/form-data',
                           data={'audio': (BytesIO(b'fake audio'), 'mood.wav'), 'mood_text': ''})

    assert response.status_code in (200, 201)
    assert _leaks(log_lines, TRANSCRIPT) == []


def test_the_chat_does_not_log_the_message(mocker, log_lines):
    from src.services.ai.conversation_engine import ConversationEngine

    framework = mocker.patch('src.services.therapeutic_framework.get_therapeutic_framework').return_value
    framework.analyze_input.return_value = {
        'recommended_modality': None, 'recommended_technique': None,
        'detected_distortions': [], 'avoidance_detected': False,
    }
    framework.generate_therapeutic_prompt.return_value = ''
    svc = MagicMock()
    svc.openai_available = True
    svc.enhanced_sentiment_analysis.return_value = {'sentiment': 'NEGATIVE'}
    svc.detect_crisis_indicators.return_value = {'requires_immediate_attention': False}
    svc.client.chat.completions.create.return_value.choices = [MagicMock()]

    ConversationEngine(svc).generate_therapeutic_conversation(CHAT_MESSAGE, [])

    assert log_lines
    assert _leaks(log_lines, CHAT_MESSAGE, CHAT_MESSAGE[:50]) == []


# ── Every logger call in src ────────────────────────────────────────────────

SRC = Path(__file__).resolve().parent.parent / 'src'

# Names that hold what a person wrote or said, or what they chose to work on.
PRIVATE = {
    'note', 'notes', 'mood_text', 'final_mood_text', 'transcript', 'transcript_text',
    'user_message', 'text', 'text_to_analyze', 'crisis_text', 'full_text', 'content',
    'goals', 'wellness_goals', 'validated_goals', 'step_text', 'voice_analysis',
}
# How much there is, or whether there is any, says nothing about what it is.
METADATA = {'len', 'bool', 'type'}
LEVELS = {'debug', 'info', 'warning', 'warn', 'error', 'exception', 'critical', 'log'}


def _private_names(node, inside_metadata=False):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in METADATA:
        inside_metadata = True
    if isinstance(node, ast.Name) and node.id in PRIVATE and not inside_metadata:
        yield node.id
    for child in ast.iter_child_nodes(node):
        yield from _private_names(child, inside_metadata)


def _logger_calls(tree):
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in LEVELS):
            owner = node.func.value
            name = owner.id if isinstance(owner, ast.Name) else getattr(owner, 'attr', '')
            if 'log' in name.lower():
                yield node


def test_no_logger_call_in_src_writes_private_content():
    offenders = []
    for path in sorted(SRC.rglob('*.py')):
        tree = ast.parse(path.read_text(encoding='utf-8-sig'))
        for call in _logger_calls(tree):
            names = {name for arg in [*call.args, *(k.value for k in call.keywords)]
                     for name in _private_names(arg)}
            if names:
                offenders.append(f'{path.relative_to(SRC.parent)}:{call.lineno} {sorted(names)}')

    assert offenders == []


def test_the_scan_finds_a_private_name_and_allows_its_length():
    leaky = ast.parse('logger.info(f"note={note}")')
    counted = ast.parse('logger.info(f"note: {len(note)} chars")')

    assert [n for c in _logger_calls(leaky) for a in c.args for n in _private_names(a)] == ['note']
    assert [n for c in _logger_calls(counted) for a in c.args for n in _private_names(a)] == []


# ── Sentry ──────────────────────────────────────────────────────────────────

def _exception_in_log_mood():
    def log_mood():
        note = NOTE  # noqa: F841  (the local variable Sentry would read)
        raise ValueError('Firestore write failed')

    try:
        log_mood()
    except ValueError:
        return sys.exc_info()
    raise AssertionError('unreachable')


def _frame_vars(event):
    return [frame.get('vars') for value in event['exception']['values']
            for frame in value['stacktrace']['frames'] if frame.get('vars')]


def test_sentry_is_configured_not_to_read_local_variables(monkeypatch):
    options = {}
    monkeypatch.setenv('SENTRY_DSN', 'https://key@o0.ingest.sentry.io/0')
    monkeypatch.setattr(sentry_config.sentry_sdk, 'init', lambda **kwargs: options.update(kwargs))

    sentry_config.init_sentry()
    event, _ = event_from_exception(_exception_in_log_mood(), client_options={**DEFAULT_OPTIONS, **options})

    assert options, 'init_sentry did not reach sentry_sdk.init'
    assert _frame_vars(event) == []


def test_sentry_events_lose_any_local_variables_before_they_are_sent():
    event, _ = event_from_exception(
        _exception_in_log_mood(), client_options={**DEFAULT_OPTIONS, 'include_local_variables': True},
    )
    assert _frame_vars(event), 'the event carries no locals, so the filter has nothing to remove'
    event['threads'] = {'values': [{'stacktrace': {'frames': [{'function': 'log_mood', 'vars': {'note': NOTE}}]}}]}

    filtered = sentry_config.before_send_filter(event, None)

    assert _frame_vars(filtered) == []
    assert NOTE not in repr(filtered)
