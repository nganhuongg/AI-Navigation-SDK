"""The shared API response envelope.

Every endpoint returns the same shape so the frontend can handle success and
failure uniformly:

    { "success": true,  "data": <payload>, "error": null }
    { "success": false, "data": null,      "error": "message" }
"""

from __future__ import annotations

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    error: Optional[str] = None

    @classmethod
    def ok(cls, data: Any = None) -> "APIResponse":
        """Build a success response."""
        return cls(success=True, data=data, error=None)

    @classmethod
    def fail(cls, error: str) -> "APIResponse":
        """Build a failure response."""
        return cls(success=False, data=None, error=error)
