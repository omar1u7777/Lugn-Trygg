"""Gunicorn's logger with Firebase uids replaced by log references.

gunicorn_config.py names this class in `logger_class`. The access log's
request line ("GET /api/v1/subscription/status/<uid> HTTP/1.1") and
error lines such as "Error handling request <path>" otherwise print the uid.
"""

from gunicorn.glogging import Logger

from src.utils.log_redaction import UidRedactionFilter


class RedactingLogger(Logger):
    def setup(self, cfg):
        # setup() replaces gunicorn's handlers, so the filter goes on each new one.
        super().setup(cfg)
        for log in (self.access_log, self.error_log):
            for handler in log.handlers:
                if not any(isinstance(f, UidRedactionFilter) for f in handler.filters):
                    handler.addFilter(UidRedactionFilter())
