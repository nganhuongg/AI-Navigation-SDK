"""Read/write runtime state on disk (data/runtime/).

Sessions are short-lived state that changes during a demo. Each session is one
JSON file named by its id. Analytics events live in one append-only JSON file.
"""

from __future__ import annotations

from typing import Any

from app.core.errors import NotFoundError
from app.core.paths import EVENTS_FILE, SESSIONS_DIR
from app.storage.json_store import read_json, write_json


def _session_path(session_id: str):
    return SESSIONS_DIR / f"{session_id}.json"


def save_session(session: dict[str, Any]) -> None:
    """Persist a session dict (json_store handles the atomic write + mkdir)."""
    write_json(_session_path(session["session_id"]), session)


def load_session(session_id: str) -> dict[str, Any]:
    """Load a session dict, or raise NotFoundError if it does not exist."""
    path = _session_path(session_id)
    if not path.exists():
        raise NotFoundError(f"Session not found: {session_id}")
    return read_json(path)


def delete_session(session_id: str) -> None:
    """Remove a session file if present (used by reset scripts later)."""
    path = _session_path(session_id)
    if path.exists():
        path.unlink()


def load_events() -> list[dict[str, Any]]:
    """Load analytics events. A missing event file means no events yet."""
    if not EVENTS_FILE.exists():
        return []
    payload = read_json(EVENTS_FILE)
    if isinstance(payload, list):
        return payload
    return payload.get("events", [])


def append_event(event: dict[str, Any]) -> None:
    """Append one analytics event to the runtime event log."""
    events = load_events()
    events.append(event)
    write_json(EVENTS_FILE, events)


def reset_events() -> None:
    """Clear the event log without touching reference data."""
    write_json(EVENTS_FILE, [])
