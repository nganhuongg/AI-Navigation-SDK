# Data Description

This document describes the datasets currently available under `data/` and how they support the AI Navigation SDK demo. It is based on `ARCHITECTURE.md`, `docs/ai_navigation_sdk.md`, and the files currently present in this repository.

The project treats the backend as the single source of truth for data. Frontend apps should call backend APIs instead of importing these files directly.

## Current Data Inventory

```text
data/
├── DATA_DESCRIPTION.md
├── raw/
│   ├── SƠ ĐỒ BỆNH VIỆN - data_benh_vien.csv
│   ├── SƠ ĐỒ BỆNH VIỆN - TANG 1.pdf
│   ├── SƠ ĐỒ BỆNH VIỆN - TANG 2.pdf
│   └── SƠ ĐỒ BỆNH VIỆN - TANG 3.pdf
├── reference/
│   ├── care_journey_templates/
│   │   └── standard_outpatient_v1.json
│   └── schemas/
│       └── care_journey_template.schema.json
└── generated/
    ├── maps/
    └── ocr_results/
```

`generated/maps/` and `generated/ocr_results/` are currently empty placeholders. They are reserved for outputs created by map digitization, OCR mocks, routing previews, and demo seed scripts.

## Raw Datasets

### `raw/SƠ ĐỒ BỆNH VIỆN - data_benh_vien.csv`

This is the main location/POI catalog for the simulated hospital dataset. It is the authoritative list of rooms, counters, hallways, elevators, stairs, waiting areas, pharmacy locations, and other patient-facing or navigation-relevant points.

Current shape:

| Property | Value |
|---|---|
| Usable rows | 121 |
| Floors covered | 1, 2, 3 |
| Floor 1 rows | 40 |
| Floor 2 rows | 41 |
| Floor 3 rows | 40 |
| Unique POI types | 32 |
| Patient destinations | 114 marked `Có`, 7 marked `Không/ít` |
| Wheelchair support | 24 marked `Có`, 97 marked `Theo tuyến` |

Columns:

| Column | Meaning | System use |
|---|---|---|
| `Mã` | Stable POI/location code, such as `A203`, `A303`, `A124`, `ELEV-2A`. | Primary lookup key for locations, OCR mapping, route targets, and care journey steps. |
| `Tầng` | Floor number. | Used to group POIs by floor and connect them to floor map PDFs. |
| `Khu` | Functional area/floor grouping. | Used for labels, filtering, and admin map review. |
| `Tên điểm/Phòng` | Human-readable room or POI name. | Patient-facing display name and assistant responses. |
| `Chức năng` | What the POI is used for. | Helps classify care journey steps and assistant answers. |
| `Nhóm màu` | Visual/function category from the map design. | Useful for map legend and UI grouping. |
| `Loại POI` | Machine-friendly POI category, such as `clinic`, `lab`, `diagnostic`, `pharmacy`, `elevator`. | Used for filtering, route behavior, and fallback logic. |
| `Điểm đến bệnh nhân` | Whether this is normally a patient destination. | Helps avoid routing patients to internal-only rooms. |
| `Hỗ trợ xe lăn` | Accessibility support marker. | Future routing can prefer wheelchair-friendly paths. |
| `Alias giọng nói` | Natural language phrase for voice matching. | Used by voice assistant intent/location matching. |
| `Từ khoá phiếu khám/OCR` | Keywords expected on appointment/instruction forms. | Used to map OCR text to POI codes or services. |
| `Ghi chú` | Extra notes. | Human review context. |

Important ingestion note: the CSV contains a leading blank row. Parsers should skip empty rows before using `csv.DictReader`; otherwise the header may be read incorrectly.

Representative POIs used by the current demo:

| Code | Name | Floor | Role in demo |
|---|---|---:|---|
| `A101` | Quầy hướng dẫn | 1 | Journey start/support point. |
| `A103` | Quầy xác thực CCCD/VNeID | 1 | Identity verification checkpoint. |
| `A115` | Quầy thanh toán 1 | 1 | Payment checkpoint. |
| `A203` | PK Tim mạch 1 | 2 | Initial exam and return doctor room. |
| `A303` | Phòng lấy máu 1 | 3 | Blood collection service. |
| `A311` | Phòng siêu âm tổng quát 1 | 3 | General ultrasound service. |
| `A124` | Nhà thuốc | 1 | Pharmacy / medicine pickup. |

### `raw/SƠ ĐỒ BỆNH VIỆN - TANG 1.pdf`

One-page floor plan PDF for floor 1. It contains the reception/service layer of the simulated hospital.

Primary content:

- Main entrance and guidance point.
- Registration, identity verification, insurance, cashier/payment counters.
- Pharmacy-related POIs.
- Waiting areas.
- Elevators, stairs, hallways, and restrooms.

System use:

- Source material for map digitization.
- Human reference for placing POIs on a digital graph.
- Floor context for `A101`, `A103`, `A115`, `A124`, and other floor-1 POIs.

### `raw/SƠ ĐỒ BỆNH VIỆN - TANG 2.pdf`

One-page floor plan PDF for floor 2. It contains the clinical examination layer.

Primary content:

- Clinical examination rooms such as internal medicine, cardiology, respiratory, digestion, dermatology, ENT, eye, dental, obstetrics/gynecology, pediatrics, and support rooms.
- Waiting areas.
- Elevators, stairs, hallways, and restrooms.

System use:

- Source material for map digitization.
- Human reference for the before-SDK static floor map and future route graph.
- Floor context for `A203` (`PK Tim mạch 1`), the current demo initial exam / return doctor room.

### `raw/SƠ ĐỒ BỆNH VIỆN - TANG 3.pdf`

One-page floor plan PDF for floor 3. It contains laboratory, diagnostic, and imaging services.

Primary content:

- Blood collection rooms.
- Laboratory rooms.
- ECG, ultrasound, X-ray, CT, MRI, endoscopy, and other diagnostic areas.
- Waiting areas.
- Elevators, stairs, hallways, and restrooms.

System use:

- Source material for map digitization.
- Human reference for placing clinical-service POIs in the route graph.
- Floor context for `A303` (`Phòng lấy máu 1`) and `A311` (`Phòng siêu âm tổng quát 1`).

## Reference Datasets

### `reference/care_journey_templates/standard_outpatient_v1.json`

This is the current care journey template. It is intentionally a blank patient-journey state template, not a fully completed patient record.

Purpose:

- Represent the standard outpatient process in a structured JSON shape.
- Provide a blank `patient_journey_template` that can be copied into a per-patient/per-session state.
- Allow missing fields to be filled later from hospital app APIs, HIS data, OCR from paper forms, or patient confirmation.
- Keep AI from inventing medical workflow. AI should only extract and fill allowed fields.

Key sections:

| Section | Description |
|---|---|
| `privacy` | Declares that the template does not store legal patient identity and only allows specific extracted fields. |
| `update_modes` | Lists the two supported data update modes: `hospital_app_api` and `paper_form_ocr`. |
| `patient_journey_template` | Blank state copied into a new session. Starts with `specialized_process_updated: false`, `specialized_process: null`, `current_step: "waiting_for_doctor"`, and `next_action: "Khám ban đầu"`. |
| `specialized_process_blueprint` | Service sequence that can be copied into `specialized_process` after OCR/API extraction confirms the ordered services. |
| `example_after_update` | Example of a personalized session after extraction/update. |
| `fallbacks` | Safe responses for low OCR confidence, unknown location, and medical-advice questions. |

Current demo process:

1. Register/support at `A101`.
2. Verify identity at `A103`.
3. Pay at `A115`.
4. Initial exam / return doctor at `A203`.
5. Blood collection at `A303`.
6. General ultrasound at `A311`.
7. Pharmacy pickup at `A124`.

This template reflects the SDK concept described in `docs/ai_navigation_sdk.md`: the system knows the patient's current step, pending steps, completed steps, and next action, while preserving privacy and avoiding unsupported medical reasoning.

### `reference/schemas/care_journey_template.schema.json`

JSON Schema for validating `standard_outpatient_v1.json`.

Purpose:

- Ensures the care journey template has the expected top-level sections.
- Validates blank patient journey state.
- Validates specialized service definitions.
- Validates fallback records.
- Prevents accidental schema drift while the backend and shared TypeScript types evolve.

Expected usage:

```bash
python scripts/validate_data.py
```

or direct validation using Python `jsonschema`.

## Generated Data Placeholders

### `generated/maps/`

Reserved for digital map outputs. It is currently empty.

Expected future contents:

| Expected file type | Description |
|---|---|
| Draft graph JSON | Initial graph generated from floor-plan PDFs or a precomputed demo graph. Visible only in admin console. |
| Verified map JSON | Human-approved graph used by patient app and routing engine. Must have `status: "verified"`. |
| Walkable mask images | Binary/visual masks showing detected walkable regions. |
| Skeleton images | Thinned corridor skeletons used to derive graph nodes/edges. |
| Graph overlay images | Visual debug overlays for map builder review. |
| Route preview JSON | Precomputed example routes such as `A203 → A303` and `A303 → A311`. |

The architecture requires patient-facing route computation to use verified maps only.

### `generated/ocr_results/`

Reserved for OCR outputs and mock OCR fixtures. It is currently empty.

Expected future contents:

| Expected file | Description |
|---|---|
| `ocr_result_001.json` | Successful extraction from a clear sample instruction form. Expected fields include `initial_exam_room: A203`, ordered services such as `blood_collection` and `general_ultrasound`, and `return_room: A203`. |
| `ocr_result_blurry_low_confidence.json` | Low-confidence extraction fixture for fallback testing. |

## Missing But Planned Datasets

The architecture references several datasets that are not present yet:

| Planned dataset | Purpose |
|---|---|
| `reference/hospitals.json` | Demo hospital metadata. |
| `reference/buildings.json` | Building/khu records. |
| `reference/floors.json` | Floor records pointing to raw map files. |
| `reference/departments.json` | Department/category records. |
| `reference/locations.json` | Normalized JSON version of the CSV POI catalog. |
| `reference/room_aliases.json` | Natural language and voice aliases mapped to location IDs. |
| `runtime/sessions/` | Active per-session patient journey state. |
| `runtime/events/events.json` | Anonymous analytics events. |
| `runtime/dashboard_cache/` | Precomputed dashboard summaries. |
| `fixtures/demo_scenarios/` | Stable test scenarios for happy path and fallbacks. |
| `seed/` | Resettable demo state. |

## Data Quality Notes

- The raw CSV is usable and consistent enough for a demo POI catalog.
- POI codes are unique in the current CSV.
- Vietnamese text is valid UTF-8. If PowerShell displays mojibake, set `PYTHONIOENCODING=utf-8` or use an editor with UTF-8 support.
- The CSV has one leading blank line and should be cleaned or skipped during ingestion.
- The floor PDFs are good human references but are not yet routable maps. Routing still requires generated graph nodes, edges, POI-to-node mappings, and verification status.
- The current care journey template is a template/state blueprint. It is not real patient data and should be copied into runtime session state before being updated with extracted fields.

## How The Datasets Work Together

1. Admin uploads or reviews raw floor PDFs.
2. Map digitization creates draft graph data under `generated/maps/`.
3. A human assigns CSV POIs to graph nodes and publishes a verified map.
4. Patient starts a session from `standard_outpatient_v1.json`.
5. Hospital app data or OCR fills missing journey fields.
6. Assistant uses session state to answer "what should I do next?"
7. Routing uses the verified map and POI codes to guide the patient to the next room.
8. Anonymous events are written for dashboard analytics.
