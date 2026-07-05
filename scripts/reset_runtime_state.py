"""Reset mutable demo runtime state.

Reference data is left untouched. This clears session files, uploaded files, and
analytics events so every demo starts from a predictable baseline.
"""

from __future__ import annotations

import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DIR = REPO_ROOT / "data" / "runtime"
SESSIONS_DIR = RUNTIME_DIR / "sessions"
UPLOADS_DIR = RUNTIME_DIR / "uploads"
EVENTS_FILE = RUNTIME_DIR / "events" / "events.json"


def _clear_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for child in path.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()


def main() -> None:
    _clear_dir(SESSIONS_DIR)
    _clear_dir(UPLOADS_DIR)
    EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVENTS_FILE.write_text("[]\n", encoding="utf-8")
    print(f"Runtime state reset under {RUNTIME_DIR}")


if __name__ == "__main__":
    main()
