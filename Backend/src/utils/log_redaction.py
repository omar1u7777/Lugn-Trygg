"""Firebase uids out of log lines.

Many routes carry the uid in the URL (/api/v1/subscription/status/<user_id>,
/api/v1/dashboard/<user_id>/summary), so the access log and any line that
prints a request path wrote it in clear text. Each uid in a log line is
replaced by its log_ref() pseudonym, the reference app log lines already use,
so one person's requests can still be followed across both logs.

Applied where lines are written, not where they are composed: the JSON
formatter every app logger uses, and gunicorn's access and error logs
(src/utils/gunicorn_logging.py). A line added later needs no extra care.
"""

import logging
import re

from src.utils.log_ref import log_ref

# A Firebase Auth uid is 28 letters and digits. Firestore document ids (20),
# request ids (hyphenated) and trace ids (32 hex) do not have that shape.
_UID = re.compile(r'(?<![A-Za-z0-9])[A-Za-z0-9]{28}(?![A-Za-z0-9])')


def redact_uids(text: str) -> str:
    """`text` with each uid replaced by its log reference."""
    return _UID.sub(lambda match: log_ref(match.group()), text)


class UidRedactionFilter(logging.Filter):
    """Rewrites a record's message so no handler writes a uid."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        redacted = redact_uids(message)
        if redacted != message:
            record.msg, record.args = redacted, None
        return True
