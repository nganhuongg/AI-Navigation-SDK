"""Security / privacy helpers.

For the MVP we generate a random, anonymous session id. The vòng-1 §4.4.2 scheme
(device fingerprint + hospital code + date + daily salt, hashed) is a later
enhancement; the important property today — no personal identity in the id — holds
either way.

Redaction helpers (vòng-1 §4.4.1 Data Protection Layer) arrive in Phase 4.
"""

from __future__ import annotations

import uuid


def new_session_id() -> str:
    """Return a fresh anonymous session id, e.g. 'sess_9f2a...'."""
    return "sess_" + uuid.uuid4().hex[:16]
