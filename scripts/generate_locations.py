"""Generate data/reference/locations.json using the backend importer service."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENGINE_ROOT = ROOT / "services" / "navigation-engine"
DATA_ROOT = ROOT / "data"

sys.path.insert(0, str(ENGINE_ROOT))

from app.services.data_ingestion.location_importer import import_locations_from_csv


def main() -> None:
    payload = import_locations_from_csv(DATA_ROOT)
    print(f"Wrote {payload['location_count']} locations to data/reference/locations.json")


if __name__ == "__main__":
    main()
