"""An error whose message is written for the client.

Code raises ClientError only with text it composed itself: a validation
rule, "Challenge not found", "Not enough XP". Routes return such an error
as it is (APIResponse.from_client_error) and send every other exception to
the log with a fixed reply, so text from a library or a backend never
reaches a client.

It subclasses ValueError so existing `except ValueError` callers still
catch it.
"""

from typing import Any


class ClientError(ValueError):
    def __init__(
        self,
        message: str,
        status: int = 400,
        code: str = 'BAD_REQUEST',
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.details = details
