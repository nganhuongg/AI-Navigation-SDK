"""Import hospital location data from raw CSV into normalized JSON."""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Any


DEFAULT_CSV_GLOB = "locations.csv"
DEFAULT_HOSPITAL_ID = "bachmai_demo"
DEFAULT_BUILDING_ID = "building_main_a"


def import_locations_from_csv(
    data_root: Path,
    csv_glob: str = DEFAULT_CSV_GLOB,
    hospital_id: str = DEFAULT_HOSPITAL_ID,
    building_id: str = DEFAULT_BUILDING_ID,
) -> dict[str, Any]:
    """Read the raw POI CSV and write data/reference/locations.json."""

    csv_file = find_location_csv(data_root / "raw", csv_glob)
    rows = load_location_rows(csv_file)
    locations = [
        to_location(row, hospital_id=hospital_id, building_id=building_id)
        for row in rows
    ]
    ensure_unique_locations(locations)

    payload: dict[str, Any] = {
        "schema_version": 1,
        "source_file": str(csv_file.relative_to(data_root.parent)).replace("\\", "/"),
        "hospital_id": hospital_id,
        "building_id": building_id,
        "location_count": len(locations),
        "locations": locations,
    }

    output_file = data_root / "reference" / "locations.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return payload


def find_location_csv(raw_dir: Path, csv_glob: str) -> Path:
    matches = sorted(raw_dir.glob(csv_glob))
    if not matches and csv_glob == DEFAULT_CSV_GLOB:
        matches = sorted(raw_dir.glob("*data_benh_vien.csv"))
    if not matches and csv_glob == DEFAULT_CSV_GLOB:
        csv_files = sorted(raw_dir.glob("*.csv"))
        if len(csv_files) == 1:
            matches = csv_files
    if not matches:
        raise FileNotFoundError(f"No CSV matching {csv_glob!r} found in {raw_dir}")
    if len(matches) > 1:
        raise RuntimeError(f"Multiple matching CSV files found: {matches}")
    return matches[0]


def load_location_rows(csv_file: Path) -> list[dict[str, str]]:
    with csv_file.open("r", encoding="utf-8-sig", newline="") as handle:
        raw_rows = [row for row in csv.reader(handle) if any(cell.strip() for cell in row)]

    if not raw_rows:
        return []

    header = [normalize_key(cell) for cell in raw_rows[0]]
    rows: list[dict[str, str]] = []
    for raw_row in raw_rows[1:]:
        cleaned = {
            key: (raw_row[index].strip() if index < len(raw_row) else "")
            for index, key in enumerate(header)
            if key
        }
        if cleaned.get("ma"):
            rows.append(cleaned)
    return rows


def to_location(
    row: dict[str, str],
    hospital_id: str,
    building_id: str,
) -> dict[str, Any]:
    code = row["ma"]
    floor_number = int(row["tang"])
    category = row.get("nhom_mau", "")

    return {
        "location_id": f"loc_{code}",
        "poi_id": code,
        "hospital_id": hospital_id,
        "building_id": building_id,
        "floor_id": f"floor_{floor_number}",
        "floor_number": floor_number,
        "department_id": slugify(category),
        "area": row.get("khu", ""),
        "label": f"{code} - {row.get('ten_diem_phong', '')}",
        "name": row.get("ten_diem_phong", ""),
        "function": row.get("chuc_nang", ""),
        "category": category,
        "poi_type": row.get("loai_poi", ""),
        "opening_hours": "",
        "is_patient_destination": yes_no(row.get("diem_den_benh_nhan", "")),
        "wheelchair_access": row.get("ho_tro_xe_lan", ""),
        "voice_aliases": split_terms(row.get("alias_giong_noi", "")),
        "ocr_keywords": split_terms(row.get("tu_khoa_phieu_kham_ocr", "")),
        "notes": row.get("ghi_chu", ""),
    }


def ensure_unique_locations(locations: list[dict[str, Any]]) -> None:
    seen: set[str] = set()
    duplicates: list[str] = []
    for location in locations:
        location_id = str(location["location_id"])
        if location_id in seen:
            duplicates.append(location_id)
        seen.add(location_id)
    if duplicates:
        raise RuntimeError(f"Duplicate location IDs found: {duplicates}")


def normalize_key(value: str) -> str:
    value = value.replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    key = re.sub(r"[^a-zA-Z0-9]+", "_", ascii_value).strip("_").lower()
    return key


def slugify(value: str) -> str:
    slug = normalize_key(value)
    return slug or "unknown"


def split_terms(value: str) -> list[str]:
    terms = re.split(r"[,;/|]+", value or "")
    return [term.strip() for term in terms if term.strip()]


def yes_no(value: str) -> bool:
    return normalize_key(value) == "co"
