# AI Navigation SDK

AI Navigation SDK is a healthcare navigation system designed to integrate with an existing hospital application. It supports patients throughout their hospital visit by combining document extraction, voice interaction, structured journey management, and indoor routing.

The system can:

- answer operational questions through text or voice;
- extract visit instructions from hospital forms using OCR;
- ask patients or hospital staff to verify extracted information;
- update a structured, patient-specific care journey;
- generate a checklist and route to the next destination; and
- record navigation events for operational analysis.

The primary workflow is:

```text
SmartReader OCR
  -> extract structured journey fields
  -> request user confirmation
  -> update the care journey
  -> generate the next checklist item and route
```

## Design Principles

### Hospital-defined workflows remain authoritative

The system does not allow an AI model to invent or modify clinical procedures. Hospital-approved journey templates define the valid sequence of steps.

VNPT AI services are used only for bounded tasks such as OCR, intent recognition, speech processing, and operational dialogue.

### Extracted data is confirmed before use

OCR output is treated as a proposal. Extracted fields are written to the active journey only after confirmation by the patient or an authorized staff member.

### One session is the source of truth

The checklist, route, assistant, and OCR workflow all read from the same backend session. This prevents different interfaces from presenting inconsistent next steps.

### Clinical advice is out of scope

The assistant handles navigation and administrative guidance. It must not diagnose conditions, recommend treatment, or select medication. Medical questions are redirected to qualified hospital staff.

## System Architecture

```text
apps/hospital-app
  Patient-facing application and SDK integration example

apps/admin-console
  Hospital operations and integration console

services/navigation-engine
  FastAPI service for sessions, OCR, voice, assistant requests,
  journeys, maps, routing, and analytics

packages/shared-types
  Shared TypeScript contracts used by the frontends

data
  Reference catalogs, journey templates, maps, OCR fixtures,
  and temporary runtime state
```

### Components

| Component | Primary user | Responsibility |
|---|---|---|
| `apps/hospital-app` | Patient | Provides the assistant, form upload, OCR confirmation, journey checklist, and route view. |
| `apps/admin-console` | Hospital staff and integration teams | Provides OCR validation, SmartVoice and SmartBot testing, map digitization, and route preview. |
| `services/navigation-engine` | System | Coordinates sessions, journey state, OCR, voice, assistant requests, routing, maps, and analytics. |
| `packages/shared-types` | Frontend developers | Keeps frontend contracts aligned with backend response models. |
| `data/reference` | Backend | Stores room catalogs, journey templates, and schemas. Frontends do not import it directly. |
| `data/generated` | Backend and admin tools | Stores OCR fixtures and draft or verified maps. |
| `data/runtime` | Backend runtime | Stores temporary sessions and events and can be reset between test runs. |

## Core Data Flow

```text
Patient captures or uploads a hospital form
  -> POST /ocr/extract
  -> VNPT SmartReader or the mock OCR adapter
  -> parser extracts room, service, queue, and journey fields
  -> patient or staff reviews the proposed fields
  -> POST /session/{id}/confirm-ocr
  -> session.journey.extracted_fields is updated
  -> checklist, route, and assistant use the updated session
```

## Interfaces

### Patient Application

Open:

```text
http://localhost:3000
```

The patient application demonstrates how the SDK can be embedded in an existing hospital app.

Patients can:

- ask for operational help by text or voice;
- capture or upload a hospital instruction form;
- review and confirm OCR-extracted fields;
- view the current journey and remaining checklist items;
- open a route to the next room; and
- confirm arrival so the session can advance to the next step.

### Hospital Operations Console

Open:

```text
http://localhost:3001
```

Available tools:

- `/` — service status and integration overview;
- `/ocr` — OCR Journey Lab for form extraction and journey confirmation;
- `/smartvoice` — STT and TTS integration testing;
- `/smartbot` — SmartBot proxy testing, intent inspection, and response debugging;
- `/map-builder` — map digitization, map confirmation, and route preview.

## Installation

### Requirements

- Windows PowerShell
- Python 3.11 or later
- Node.js 20 or later
- pnpm 9 or later, or Corepack

From the repository root, run:

```powershell
.\scripts\install_all.ps1
```

The script:

- creates `.venv` if it does not exist;
- installs Python dependencies from `requirements.txt`;
- installs backend dependencies from `services/navigation-engine/requirements.txt`;
- creates `.env` from `.env.example` if needed;
- enables Corepack; and
- runs `pnpm install`.

To install only the Python dependencies:

```powershell
.\scripts\install_all.ps1 -NoNode
```

## Running the System

Open three PowerShell terminals from the repository root.

### 1. Navigation Engine

```powershell
pnpm dev:engine
```

The API and its OpenAPI documentation are available at:

```text
http://localhost:8001
http://localhost:8001/docs
```

### 2. Patient Application

```powershell
pnpm dev:patient
```

Open:

```text
http://localhost:3000
```

### 3. Hospital Operations Console

```powershell
pnpm dev:admin
```

Open:

```text
http://localhost:3001
```

## VNPT Integrations and Mock Mode

The repository uses mock adapters by default so the complete workflow can run without external API credentials.

Configure integrations in `.env`:

```env
USE_VNPT_SMARTREADER=false
USE_VNPT_SMARTVOICE_STT=false
USE_VNPT_SMARTVOICE_TTS=false
USE_VNPT_SMARTBOT=false
NEXT_PUBLIC_ENGINE_BASE_URL=http://localhost:8001
```

When connecting the live services:

- SmartReader OCR uses `/rpa-service/aidigdoc/v1/ocr/scan-table`;
- do not replace this endpoint with `/scan` unless the integration requirements change;
- store credentials only in `.env` and never commit that file; and
- enable and validate one service at a time to isolate integration failures.

## Testing

Run the main automated checks:

```powershell
.\scripts\test_all.ps1
```

This command runs:

- backend unit tests with `pytest`;
- an integration smoke test covering health check, session creation, OCR, OCR confirmation, and routing; and
- TypeScript type checks for the shared types, patient application, and operations console.

Include production frontend builds:

```powershell
.\scripts\test_all.ps1 -Build
```

Individual commands:

```powershell
pnpm test:unit
pnpm test:integration
pnpm typecheck
pnpm build
```

Run backend unit tests directly:

```powershell
cd services\navigation-engine
..\..\.venv\Scripts\python -m pytest -q
```

Run the integration smoke test directly:

```powershell
.\.venv\Scripts\python scripts\integration_smoke.py
```

## Benchmarks and Validation

These results describe the current repository test sets. They are engineering validation results, not clinical validation or estimates of performance across all hospitals, document formats, accents, and deployment conditions.

### OCR Extraction Benchmark

The current OCR dataset contains 36 forms and 186 evaluated journey rows.

The benchmark reports:

- **165/186 passing rows**
- **88.7% row-level pass rate**
- **30/36 forms passing all required checks**

<img width="1704" height="718" alt="Hackaithon" src="https://github.com/user-attachments/assets/d992c990-e770-4d68-a1c1-3482b134fc18" />


A row passes when the required fields—such as initial examination room, return room, sequence, room code, or queue number—match the expected structured values.

The form-level result is stricter: a form passes only when all required checks for that form pass.

### SmartBot Batch Validation

The current batch contains 47 operational assistant cases covering supported routes, paraphrased route requests, and out-of-scope medical safety behavior.

The recorded run reports:

- **47/47 cases executed**
- **34/47 automatically passing**
- **72% automatic pass rate**
- **4,711 ms average latency**

<img width="847" height="371" alt="Screenshot 2026-10-06 132237" src="https://github.com/user-attachments/assets/5f776f66-b040-4fa3-8ad9-a7826c7e7111" />


The automatic pass rate reflects the current expected-intent and expected-destination checks. Failed cases remain visible for error analysis and are not excluded from the aggregate result.

### Interpreting the Results

The benchmarks provide a reproducible snapshot of the current test suite, but the datasets remain limited.

Before deployment in a real hospital, validation should be expanded to include:

- additional hospital form layouts and image-quality conditions;
- field-level precision, recall, and exact-match reporting;
- confidence calibration and review thresholds for uncertain OCR output;
- noisy environments, speaker variation, and Vietnamese accent coverage;
- per-intent SmartBot accuracy and latency percentiles;
- route correctness across all verified maps and accessibility constraints;
- privacy and security testing;
- failure-recovery testing; and
- human-handoff testing.

## Utility Scripts

```powershell
python scripts\seed_demo_data.py
python scripts\reset_runtime_state.py
python scripts\cleanup_expired_sessions.py --dry-run
python scripts\cleanup_expired_sessions.py
```

- `seed_demo_data.py` prepares a deterministic local dataset.
- `reset_runtime_state.py` clears temporary sessions and events.
- `cleanup_expired_sessions.py --dry-run` lists expired sessions without deleting them.
- `cleanup_expired_sessions.py` removes expired sessions.

## Data Protection and Safety Boundaries

The current implementation follows these rules:

- Never commit `.env` files or VNPT credentials.
- Do not use real patient names, phone numbers, national ID numbers, or medical-record identifiers in development fixtures.
- Treat the session ID as an anonymous application token.
- Apply OCR output to a journey only after explicit confirmation.
- Store only structured OCR fields in `data/runtime/sessions`.
- Do not retain raw images, complete OCR text, or full SmartReader responses as chatbot memory.
- Send SmartBot only the minimum operational context: session, current step, destination, and next action.
- Redact phone numbers, national IDs, medical-record identifiers, health-insurance-like IDs, labelled dates of birth, and labelled patient names before assistant or SmartBot requests.
- Redirect diagnostic and treatment questions to hospital staff or a clinician.

These safeguards reduce exposure in the current implementation, but they do not establish compliance with healthcare privacy or security regulations.

A production deployment requires an organization-specific security review, access-control model, retention policy, audit process, and threat assessment.

## Repository Structure

```text
AI-Navigation-SDK/
├── apps/
│   ├── hospital-app/        # Patient application and SDK integration example
│   └── admin-console/       # Hospital operations and integration console
├── services/
│   └── navigation-engine/   # FastAPI backend
├── packages/
│   └── shared-types/        # Shared TypeScript contracts
├── data/
│   ├── raw/                 # Source maps and documents
│   ├── reference/           # Locations, templates, schemas, and form samples
│   ├── generated/           # OCR fixtures and draft or verified maps
│   └── runtime/             # Temporary sessions and events
├── scripts/                 # Installation, testing, seeding, reset, and cleanup
├── docs/                    # Architecture, validation, and report assets
├── ARCHITECTURE.md          # High-level architecture
├── requirements.txt         # Root and backend Python dependencies
└── package.json             # Workspace scripts
```

## End-to-End Verification Workflow

1. Start the Navigation Engine with `pnpm dev:engine`.
2. Start the operations console with `pnpm dev:admin`.
3. Open `http://localhost:3001`.
4. Open `/map-builder`, digitize or load a map, verify it, and preview a route.
5. Open `/ocr`, create a session, and upload a sample from `data/reference/phieukham`.
6. Run OCR and confirm the extracted fields.
7. Start the patient application with `pnpm dev:patient`.
8. Open `http://localhost:3000`.
9. Upload or capture a hospital form.
10. Review and confirm the extracted journey information.
11. Verify that the checklist and route point to the same next destination.
12. Confirm arrival and verify that the session advances to the next step.

## Current Scope

This repository provides a working reference implementation for hospital navigation workflows and integration testing.

It is not a medical device, clinical decision-support system, or replacement for hospital staff.

Production use requires:

- integration with hospital identity and authorization systems;
- verified indoor maps;
- operational ownership of journey templates;
- deployment monitoring;
- privacy and security review; and
- validation with the target hospital’s workflows and data.
