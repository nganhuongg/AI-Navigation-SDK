"""Central registry of every filesystem path the backend uses.

No other module should hardcode a path under ``/data``. If a path is needed,
add it here. This makes it trivial to see (and change) where data lives.
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings

# navigation-engine root = two directories above this file:
#   navigation-engine/app/core/paths.py -> parents[2] = navigation-engine
NAV_ENGINE_ROOT = Path(__file__).resolve().parents[2]

# Resolve DATA_ROOT to an absolute path regardless of the current working directory.
_data_root = Path(settings.data_root)
DATA_ROOT = (
    _data_root if _data_root.is_absolute() else (NAV_ENGINE_ROOT / _data_root).resolve()
)

# ── Reference data (stable, human-authored or ingested) ──────────────────────
REFERENCE_DIR = DATA_ROOT / "reference"
LOCATIONS_FILE = REFERENCE_DIR / "locations.json"
CARE_JOURNEY_TEMPLATES_DIR = REFERENCE_DIR / "care_journey_templates"
SCHEMAS_DIR = REFERENCE_DIR / "schemas"

# ── Runtime state (mutated during a demo; reset before each run) ─────────────
RUNTIME_DIR = DATA_ROOT / "runtime"
SESSIONS_DIR = RUNTIME_DIR / "sessions"
EVENTS_FILE = RUNTIME_DIR / "events" / "events.json"
UPLOADS_DIR = RUNTIME_DIR / "uploads"

# ── Generated outputs (OCR results now; maps later) ──────────────────────────
GENERATED_DIR = DATA_ROOT / "generated"
OCR_RESULTS_DIR = GENERATED_DIR / "ocr_results"
MAPS_DIR = GENERATED_DIR / "maps"
DRAFT_MAPS_DIR = MAPS_DIR / "draft_maps"
VERIFIED_MAPS_DIR = MAPS_DIR / "verified_maps"

# Raw floor-plan assets.
RAW_DIR = DATA_ROOT / "raw"
