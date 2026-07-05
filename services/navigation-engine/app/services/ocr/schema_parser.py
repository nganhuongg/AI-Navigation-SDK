"""Turn raw OCR text into the structured fields a session needs.

This is data-driven: it maps room codes found on the instruction form to journey
service ids using the care journey blueprint, and classifies the initial exam room
using ``locations.json`` (poi_type == "clinic"). No brittle keyword lists.

For the demo form:
    "... A203 ... Lấy máu A303 ... Siêu âm A311 ... quay lại A203"
becomes:
    initial_exam_room="A203", ordered_services=["blood_collection","general_ultrasound"],
    return_room="A203"
"""

from __future__ import annotations

import re

from app.core.errors import NotFoundError
from app.models.session import SpecializedProcess
from app.services.journey.state_manager import STANDARD_TAIL_SERVICES
from app.services.locations import location_service

CLINIC_POI_TYPE = "clinic"
NOTE_SPLIT_PATTERN = re.compile(r"\b(?:ghi chu|ghi chú|luu y|lưu ý|note)\b\s*:?", re.IGNORECASE)


def _compact_with_positions(text: str) -> tuple[str, list[int]]:
    """Return uppercase alphanumeric text plus original indexes for each char.

    OCR sometimes inserts spaces or punctuation inside room codes (for example
    "A 303" or "A-303"). Compact matching lets us still recover the catalog code.
    """
    chars: list[str] = []
    positions: list[int] = []
    for index, char in enumerate(text.upper()):
        if char.isalnum():
            chars.append(char)
            positions.append(index)
    return "".join(chars), positions


def _room_code_candidates() -> list[str]:
    """All known room/location codes from the normalized location catalog."""
    codes = {
        location.poi_id.upper()
        for location in location_service.list_locations()
        if location.poi_id
    }
    return sorted(codes, key=len, reverse=True)


def _rooms_in_order(text: str) -> list[str]:
    """Return known room/location codes in OCR order (no duplicates)."""
    compact_text, positions = _compact_with_positions(text)
    matches: list[tuple[int, str]] = []

    for code in _room_code_candidates():
        compact_code = "".join(char for char in code if char.isalnum())
        if not compact_code:
            continue

        start = 0
        while True:
            found = compact_text.find(compact_code, start)
            if found == -1:
                break
            original_position = positions[found] if found < len(positions) else found
            matches.append((original_position, code))
            start = found + 1

    seen: set[str] = set()
    ordered: list[str] = []
    for _, code in sorted(matches, key=lambda item: item[0]):
        if code not in seen:
            seen.add(code)
            ordered.append(code)
    return ordered


def _line_has_room(line: str, room_code: str) -> bool:
    compact_line, _ = _compact_with_positions(line)
    compact_code = "".join(char for char in room_code.upper() if char.isalnum())
    return compact_code in compact_line


def _clean_instruction_text(line: str, room_code: str) -> str:
    """Turn an OCR row/cell into patient-facing work-to-do text."""
    text = re.sub(rf"\b{re.escape(room_code)}\b", "", line, flags=re.IGNORECASE)
    spaced_code = r"\W*".join(re.escape(char) for char in room_code)
    text = re.sub(spaced_code, "", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*\d+[\).:-]\s*", "", text)
    text = re.sub(
        r"\b(?:phong|phòng|tai|tại|o|ở|den|đến|kham|khám)\b\s*:?",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\s*[-:;,.]\s*$", "", text)
    text = re.sub(r"^\s*[-:;,.]\s*", "", text)
    return " ".join(text.split())


def _split_description_and_note(text: str) -> tuple[str, str | None]:
    parts = NOTE_SPLIT_PATTERN.split(text, maxsplit=1)
    if len(parts) == 1:
        return text.strip(), None
    return parts[0].strip(" -:;,"), parts[1].strip(" -:;,")


def _meaningful_table_cell(cell: str) -> bool:
    stripped = cell.strip(" -:;,.")
    return bool(stripped) and not stripped.isdigit()


def _queue_number_cell(cell: str) -> str | None:
    stripped = cell.strip(" -:;,.")
    if re.fullmatch(r"\d{1,4}", stripped):
        return stripped
    return None


def _combine_description_and_note(description: str, note: str | None) -> str | None:
    description = description.strip(" -:;,.")
    note = (note or "").strip(" -:;,.")
    if description and note:
        return f"{description}. Ghi chu: {note}"
    if description:
        return description
    return note or None


def _table_row_context(line: str, room_code: str) -> tuple[str, str | None, str | None] | None:
    """Extract description/note from a tab-separated OCR table row.

    Expected medical form shape:
        step | ordered service | execution room | queue number | note

    The room code anchors the execution-room cell. The nearest meaningful cell
    before it is the service description; the nearest meaningful cell after it
    is the per-room note, skipping numeric queue cells and "-" placeholders.
    """
    if "\t" not in line:
        return None

    cells = [" ".join(cell.strip().split()) for cell in line.split("\t")]
    room_indexes = [index for index, cell in enumerate(cells) if _line_has_room(cell, room_code)]
    if not room_indexes:
        return None

    room_index = room_indexes[0]
    description = ""
    note: str | None = None
    queue_number: str | None = None

    for cell in reversed(cells[:room_index]):
        cleaned = _clean_instruction_text(cell, room_code)
        if _meaningful_table_cell(cleaned):
            description = cleaned
            break

    for cell in cells[room_index + 1 :]:
        cleaned = _clean_instruction_text(cell, room_code)
        if queue_number is None:
            queue_number = _queue_number_cell(cleaned)
            if queue_number is not None:
                continue
        if _meaningful_table_cell(cleaned):
            note = cleaned
            break

    combined_note = _combine_description_and_note(description, note)

    if not description and not combined_note:
        return None
    return description, combined_note, queue_number


def _room_context(text: str, rooms: list[str]) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Extract per-room instruction and note text from OCR lines.

    This is intentionally deterministic: room codes are the anchors. If the OCR
    line contains both the instruction and the room, use that line. If the line
    is only a room code, use the closest previous non-room line as context.
    """
    descriptions: dict[str, str] = {}
    notes: dict[str, str] = {}
    queue_numbers: dict[str, str] = {}
    recent_context = ""

    logical_lines = re.split(r"[\r\n]+|(?<=[.!?])\s+", text)
    for raw_line in logical_lines:
        if "\t" in raw_line:
            line = "\t".join(" ".join(cell.strip().split()) for cell in raw_line.strip().split("\t"))
        else:
            line = " ".join(raw_line.strip().split())
        if not line:
            continue

        matched_rooms = [room for room in rooms if _line_has_room(line, room)]
        if not matched_rooms:
            recent_context = line
            continue

        for room in matched_rooms:
            table_context = _table_row_context(line, room)
            if table_context is not None:
                description, note, queue_number = table_context
            else:
                cleaned = _clean_instruction_text(line, room)
                if not cleaned and recent_context:
                    cleaned = _clean_instruction_text(recent_context, room)
                description, note = _split_description_and_note(cleaned)
                queue_number = None
            if description and room not in descriptions:
                descriptions[room] = description
            if note and room not in notes:
                notes[room] = note
            if queue_number and room not in queue_numbers:
                queue_numbers[room] = queue_number

    return descriptions, notes, queue_numbers


def _cls_room_to_service(blueprint: SpecializedProcess) -> dict[str, str]:
    """Map CLS test room -> service_id (excludes the standard tail steps).

    e.g. {"A303": "blood_collection", "A311": "general_ultrasound"}. return_doctor
    and pharmacy are excluded because they are appended automatically, not ordered
    on the form.
    """
    return {
        service.room: service.service_id
        for service in blueprint.services
        if service.service_id not in STANDARD_TAIL_SERVICES
    }


def _is_clinic(room_code: str) -> bool:
    try:
        return location_service.get_location(room_code).poi_type == CLINIC_POI_TYPE
    except NotFoundError:
        return False


def parse_fields(text: str, blueprint: SpecializedProcess) -> dict:
    """Extract initial_exam_room, ordered_services, and return_room from OCR text."""
    rooms = _rooms_in_order(text)
    room_descriptions, room_notes, room_queue_numbers = _room_context(text, rooms)
    room_to_service = _cls_room_to_service(blueprint)

    ordered_services = [room_to_service[room] for room in rooms if room in room_to_service]

    # Initial exam room = first clinic-type room mentioned on the form.
    initial_exam_room = next((room for room in rooms if _is_clinic(room)), None)

    # For the standard outpatient flow the patient returns to the same clinic.
    return_room = initial_exam_room

    return {
        "initial_exam_room": initial_exam_room,
        "ordered_services": ordered_services,
        "return_room": return_room,
        "detected_room_codes": rooms,
        "room_descriptions": room_descriptions,
        "room_notes": room_notes,
        "room_queue_numbers": room_queue_numbers,
    }
