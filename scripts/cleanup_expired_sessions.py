"""Delete expired runtime session JSON files.

Run from the repository root:
    .\\.venv\\Scripts\\python scripts\\cleanup_expired_sessions.py

Use --dry-run to see what would be deleted without modifying files.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SESSIONS_DIR = REPO_ROOT / "data" / "runtime" / "sessions"


def _parse_expires_at(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _is_expired(path: Path, now: datetime) -> bool:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        expires_at = payload.get("expires_at")
        return bool(expires_at and _parse_expires_at(str(expires_at)) <= now)
    except Exception:
        return False


def cleanup(dry_run: bool) -> list[Path]:
    if not SESSIONS_DIR.exists():
        return []

    now = datetime.now(timezone.utc)
    expired = sorted(
        path for path in SESSIONS_DIR.glob("*.json") if _is_expired(path, now)
    )
    if not dry_run:
        for path in expired:
            path.unlink()
    return expired


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete expired runtime sessions.")
    parser.add_argument("--dry-run", action="store_true", help="Only print expired files.")
    args = parser.parse_args()

    expired = cleanup(dry_run=args.dry_run)
    action = "would delete" if args.dry_run else "deleted"
    print(f"{action}: {len(expired)} expired session(s)")
    for path in expired:
        print(path.relative_to(REPO_ROOT))


if __name__ == "__main__":
    main()
