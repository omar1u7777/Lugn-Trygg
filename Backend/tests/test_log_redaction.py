"""Firebase uids stay out of log lines, the access log included.

Routes such as /api/v1/subscription/status/<user_id> carry the uid in the
URL, so the access log and the request log printed it. A uid in a log line
is replaced by its log_ref() pseudonym, the reference app log lines already
use, so a person's requests can still be followed.
"""

import ast
import json
import logging
import pathlib
from datetime import timedelta
from types import SimpleNamespace

import pytest

from src.utils.log_redaction import redact_uids
from src.utils.log_ref import log_ref
from src.utils.structured_logging import JSONFormatter, clear_context, set_user_id

# Shaped like a Firebase Auth uid: 28 letters and digits.
UID = 'FakeFirebaseUid0123456789ABC'
GUNICORN_CONFIG = pathlib.Path(__file__).resolve().parents[1] / 'gunicorn_config.py'


@pytest.mark.parametrize('text', [
    f'GET /api/v1/subscription/status/{UID} HTTP/1.1',
    f'/api/v1/dashboard/{UID}/summary',
    f'/api/v1/feedback/my-feedback?user_id={UID}',
    f'Login for {UID}',
])
def test_a_uid_becomes_its_log_ref(text):
    redacted = redact_uids(text)

    assert UID not in redacted
    assert redacted == text.replace(UID, log_ref(UID))


@pytest.mark.parametrize('text', [
    '/api/v1/mood/AbCdEfGhIjKlMnOpQrSt',            # Firestore document id (20)
    'request_id 5744a4a3-6fa8-4fbf-a46d-7ce493644d06',
    'trace 202905e3a8104465b99709ca4238e146',        # 32 hex characters
    f'already {log_ref(UID)}',
    '/api/v1/mood?limit=100&offset=0',
    'A' * 29,                                          # longer run: not a uid
])
def test_other_identifiers_are_left_alone(text):
    assert redact_uids(text) == text


def test_json_log_lines_carry_no_uid():
    record = logging.LogRecord('main', logging.INFO, __file__, 1, 'Login for %s', (UID,), None)
    record.extra_fields = {'method': 'GET', 'path': f'/api/v1/dashboard/{UID}/summary'}
    record.context = {'user_id': UID}
    set_user_id(UID)
    try:
        line = JSONFormatter().format(record)
    finally:
        clear_context()

    assert UID not in line
    entry = json.loads(line)
    assert entry['path'] == f'/api/v1/dashboard/{log_ref(UID)}/summary'
    assert entry['message'] == f'Login for {log_ref(UID)}'


@pytest.fixture
def gunicorn_logger(tmp_path):
    from gunicorn.config import Config

    from src.utils.gunicorn_logging import RedactingLogger

    cfg = Config()
    cfg.set('accesslog', str(tmp_path / 'access.log'))
    cfg.set('errorlog', str(tmp_path / 'error.log'))
    cfg.set('access_log_format', _config_value('access_log_format'))
    logger = RedactingLogger(cfg)
    yield logger
    for log in (logger.access_log, logger.error_log):
        for handler in list(log.handlers):
            log.removeHandler(handler)
            handler.close()


def _written(logger, log):
    for handler in log.handlers:
        handler.flush()
    return pathlib.Path(logger.cfg.accesslog if log is logger.access_log else logger.cfg.errorlog).read_text()


def _config_value(name):
    """A setting from gunicorn_config.py, read without running the file."""
    for node in ast.parse(GUNICORN_CONFIG.read_text(encoding='utf-8')).body:
        if isinstance(node, ast.Assign) and any(getattr(t, 'id', None) == name for t in node.targets):
            return ast.literal_eval(node.value)
    raise AssertionError(f'{name} is not set in gunicorn_config.py')


def test_gunicorn_config_uses_the_redacting_logger():
    from gunicorn.util import load_class

    from src.utils.gunicorn_logging import RedactingLogger

    configured = _config_value('logger_class')

    assert load_class(configured, section='gunicorn.loggers') is RedactingLogger


def test_access_log_carries_no_uid(gunicorn_logger):
    environ = {
        'REQUEST_METHOD': 'GET',
        'RAW_URI': f'/api/v1/subscription/status/{UID}?user_id={UID}',
        'PATH_INFO': f'/api/v1/subscription/status/{UID}',
        'QUERY_STRING': f'user_id={UID}',
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'REMOTE_ADDR': '10.0.0.1',
        'HTTP_REFERER': 'https://lugn-trygg.vercel.app/',
        'HTTP_USER_AGENT': 'pytest',
    }
    response = SimpleNamespace(status='200 OK', headers=[], sent=984)

    gunicorn_logger.access(response, SimpleNamespace(headers=[]), environ, timedelta(milliseconds=5))

    line = _written(gunicorn_logger, gunicorn_logger.access_log)
    assert UID not in line
    assert f'"GET /api/v1/subscription/status/{log_ref(UID)}?user_id={log_ref(UID)} HTTP/1.1" 200 984' in line


def test_server_error_log_carries_no_uid(gunicorn_logger):
    gunicorn_logger.error('Error handling request /api/v1/dashboard/%s/summary', UID)

    output = _written(gunicorn_logger, gunicorn_logger.error_log)
    assert UID not in output
    assert log_ref(UID) in output
