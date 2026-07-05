"""All JSON reads and writes go through this module.

Keeping disk I/O in one place means the rest of the code never touches ``open()``
directly, and every write is atomic (safe against half-written files).
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from app.core.errors import NotFoundError


def read_json(path: Path) -> Any:
    """Read and parse a JSON file. Raises NotFoundError if it is missing."""
    if not path.exists():
        raise NotFoundError(f"Data file not found: {path.name}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    """Write JSON atomically.

    We write to a temporary file in the same folder, then ``os.replace`` it over
    the target. ``os.replace`` is atomic on the same filesystem, so a reader never
    sees a partially written file even if the process is killed mid-write.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(tmp_name, path)
    except Exception:
        # Best-effort cleanup of the temp file if anything went wrong.
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        raise
