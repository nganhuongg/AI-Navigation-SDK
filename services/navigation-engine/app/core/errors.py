"""Expected, user-safe backend errors.

Raising one of these from a service lets ``main.py`` convert it into the standard
``{success, data, error}`` JSON envelope with the right HTTP status code, instead
of leaking a raw 500 stack trace.
"""

from __future__ import annotations


class EngineError(Exception):
    """Base class for expected errors whose message is safe to show the user."""

    status_code: int = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(EngineError):
    """Requested resource does not exist (HTTP 404)."""

    status_code = 404


class ValidationError(EngineError):
    """Input failed a business rule (HTTP 422)."""

    status_code = 422
