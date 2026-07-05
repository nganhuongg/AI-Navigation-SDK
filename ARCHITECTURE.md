# AI Navigation SDK — Architecture Report

> Hackathon submission note: this document describes the system as it exists today and how the pieces fit together. It is written as a presentation-style architecture brief, not as a build plan.

## Table of Contents

1. System overview
2. Product surfaces
3. End-to-end data flow
4. Backend architecture
5. Frontend architecture
6. Data model and persistence
7. Strengths and weaknesses
8. Security and privacy
9. Demo readiness
10. Environment and ports

## 1. System Overview

AI Navigation SDK is a hospital-navigation layer built for a patient app and a separate admin console, with one FastAPI backend acting as the source of truth.

The system solves one core problem: hospitals often have fragmented wayfinding, paper instruction forms, and inconsistent patient guidance. The SDK combines:

- indoor routing on verified maps
- OCR for instruction forms
- a conversational assistant
- a journey checklist that drives the next action
- safe fallback behavior when the system is uncertain

The architecture is intentionally split into clear boundaries:

- `apps/hospital-app` is the patient-facing app
- `apps/admin-console` is the hospital/admin console
- `services/navigation-engine` is the backend engine
- `data/` stores maps, reference catalogs, and runtime state

The most important rule in the system is simple: the frontend never invents patient flow. It only renders state and actions returned by the backend.

## 2. Product Surfaces

### Patient App

The patient app is the visible SDK experience. It includes:

- before-SDK home and appointment views
- after-SDK assistant flow
- scan form upload
- OCR confirmation
- journey checklist
- route map
- arrival confirmation

This app is the patient-facing entry point. It is designed for older patients and busy clinic conditions, so controls are large, text is high-contrast, and the flow stays linear.

### Admin Console

The admin console is the operational tool for hospital staff. It includes:

- OCR Journey Lab
- SmartBot test panel
- SmartVoice test panel
- Map Builder

This surface is for hospital IT and operations staff, not patients. Its role is to inspect maps, verify routes, test OCR, and validate the backend integrations before the patient app uses them.

### Navigation Engine

The backend owns all state and behavior:

- session creation
- journey progression
- OCR parsing
- route computation
- assistant normalization
- event logging
- map digitization

This separation keeps the frontend light and keeps business rules in one place.

## 3. End-to-End Data Flow

The normal journey is:

1. Patient opens the app.
2. Patient asks what to do next.
3. The app can request OCR if the journey needs a paper instruction form.
4. OCR returns extracted fields.
5. The patient confirms the fields.
6. The backend updates the journey state.
7. The app shows the next checklist step.
8. The app opens the verified map and route.
9. The patient confirms arrival.
10. The backend advances to the next step or completes the journey.

The important point is that every transition is driven by the backend session model, not by ad hoc frontend logic.

## 4. Backend Architecture

### Role

`services/navigation-engine` is a FastAPI service. It is the system’s policy and state layer.

It owns:

- route rules
- session lifecycle
- OCR normalization
- assistant responses
- session persistence
- anonymous analytics
- map verification data

### Structure

The backend is organized in thin layers:

- `app/core` for configuration, paths, errors, logging, and security helpers
- `app/routers` for HTTP entry points
- `app/services` for business logic
- `app/adapters` for real and mock VNPT integrations
- `app/models` for Pydantic schemas
- `app/storage` for JSON file access and runtime persistence

### Why this structure works

The backend is easy to test because the HTTP layer is thin. Real behavior lives in services, not in route handlers. This makes it practical to keep mock adapters and real VNPT adapters side by side without changing the API contract.

### Strengths

- Clear separation of HTTP, business logic, adapters, and storage
- Backend is the single source of truth for journey progression
- Mock and real VNPT integrations share the same response shape
- JSON-based persistence is simple to inspect in a demo setting
- Route and OCR behavior are testable in isolation

### Weaknesses

- JSON file persistence is suitable for a hackathon and demo, but it is not a durable production database
- The backend still depends on local file structure and seeded reference data
- Real integrations can fail or return incomplete payloads, so the backend must stay defensive
- Advanced hospital-specific workflows are still encoded as template-driven logic rather than a fully configurable rules engine

### Backend service responsibilities

- `routers/health.py`: service health and integration status
- `routers/sessions.py`: session start, confirmation, and arrival
- `routers/ocr.py`: upload and extract instruction forms
- `routers/route.py`: compute navigation over verified maps
- `routers/assistant.py` and `routers/chatbot.py`: question handling and SmartBot normalization
- `routers/maps.py`: digitize, verify, and serve maps
- `routers/events.py`: anonymous event logging

## 5. Frontend Architecture

### Patient App

The patient app is a Next.js frontend with a strong demo-first UI model. It has two visible modes:

- before-SDK mode for the baseline hospital experience
- after-SDK mode for the guided navigation experience

The app is structured around screen-based flow rather than a sprawling dashboard. That keeps the journey understandable for patients under stress.

### Admin Console

The admin console is also a Next.js frontend, but it is deliberately denser. It focuses on tools and diagnostics rather than patient simplicity. Its main job is to expose operational capability without requiring direct backend access.

### Shared design choices

- React component reuse for large buttons, readable cards, and flow steps
- consistent backend API helpers
- verified-map-only rendering in the patient app
- read-aloud support for route steps and assistant answers
- phone-frame layout for patient screens

### Strengths

- Patient UI is guided and narrow in scope, which reduces cognitive load
- The app uses large controls and clear branching for elderly users
- The after-SDK flow is visible and easy to demo
- Read-aloud and voice input are integrated into real workflows
- Admin tools are separated from the patient experience

### Weaknesses

- The patient UI is still highly opinionated and demo-shaped; it is not yet a full hospital super-app
- The navigation screen assumes a verified map and a known journey context
- Some flows remain stateful and sensitive to the current session state, so the UI is less forgiving than a general-purpose consumer app
- The admin console is functional, but it is not a polished enterprise ops platform

### Frontend roles by app

- `apps/hospital-app`: patient journey, assistant, OCR, route, and arrival
- `apps/admin-console`: map inspection, OCR testing, SmartBot/SmartVoice validation, and route preview

## 6. Data Model and Persistence

The system keeps its operational data in `data/`. The important categories are:

- `data/reference`: normalized hospital knowledge such as locations and care journey templates
- `data/generated`: derived outputs such as verified maps
- `data/runtime`: transient session and analytics state
- `data/raw`: source assets such as floor-plan images and sample documents

This makes the repository easy to inspect, but also makes state management explicit. Runtime data is not hidden in a database; it is visible and resettable.

### Main data objects

- care journey templates define allowed steps and routing behavior
- session state holds the patient’s current step and next action
- OCR results store extracted fields and confidence
- digital maps store nodes, edges, floors, and POIs
- analytics events track anonymous usage patterns

### Strengths

- Easy to inspect and reset in a demo environment
- Transparent to reviewers and judges
- Simple schema-based storage keeps the data model understandable
- Verified maps separate safe patient data from draft map data

### Weaknesses

- File-based persistence does not scale to many concurrent users
- The current model is not optimized for transactional updates or audit-heavy enterprise workflows
- Long-term storage, search, and reporting would need a real database layer

## 7. Strengths And Weaknesses

### Frontend strengths

- Clear before/after SDK story
- Very obvious patient flow
- Large, legible controls suitable for older users
- Read-aloud and voice input are integrated into the actual flow, not bolted on
- Patient and admin roles are visually separated

### Frontend weaknesses

- The patient experience is intentionally narrow and can feel rigid
- The app depends on a working backend session to feel complete
- Some screens remain demo-oriented rather than product-polished
- Accessibility is good for size and contrast, but the UI still assumes a guided hospital setting

### Backend strengths

- One backend owns session and routing truth
- Services are thinly separated and testable
- Mock and real VNPT adapters share a stable shape
- Verified maps reduce unsafe routing risk
- OCR and routing are both normalized through session state instead of being handled separately in the client

### Backend weaknesses

- File-based state is practical for a hackathon but not robust enough for production load
- External service behavior can be inconsistent and needs defensive fallback logic
- Journey templates still encode hospital flow assumptions in data files, which is manageable for one demo hospital but not yet a configurable enterprise platform
- A real production deployment would need stronger observability, retries, and storage durability

## 8. Security And Privacy

The architecture deliberately avoids storing real patient data in the demo flow.

Security and privacy rules in the current system:

- session IDs are anonymous demo tokens
- OCR redaction removes obvious sensitive identifiers before processing
- runtime sessions expire
- verified maps are separated from draft maps
- real VNPT credentials are loaded from environment variables, not committed into the repo
- the frontend never receives raw secrets

### What this protects against

- accidental leakage of patient identifiers into events
- frontend code reading raw hospital reference files directly
- patient app using unverified or draft routing data
- hardcoding credentials in source code

### Residual risk

- file-based runtime state is easier to inspect than a production database
- secret handling depends on local environment discipline
- the demo is safer than a fully open prototype, but not yet production hardened

## 9. Demo Readiness

The system is ready for a hackathon-style submission because the story is coherent:

- the patient app shows the problem
- the assistant and OCR flow show the SDK value
- the route engine shows verified navigation
- the admin console proves the hospital can inspect and validate the setup

The strongest demo sequence is:

1. open the patient app
2. enable after-SDK mode
3. ask what to do next
4. scan the instruction form
5. confirm the extracted fields
6. see the journey checklist update
7. open the route map
8. confirm arrival

This sequence demonstrates the full value chain without requiring a human operator to explain each technical step.

## 10. Environment And Ports

Local development uses consistent ports:

- Patient app: `http://localhost:3000`
- Admin console: `http://localhost:3001`
- Backend engine: `http://localhost:8001`
- API docs: `http://localhost:8001/docs`

The backend is configured around `ENGINE_PORT=8001`, and the frontend helpers point to that same base URL.

## 11. Repository Roles

For reviewers, the file-level responsibilities are:

- `apps/hospital-app`: patient UI and SDK flow
- `apps/admin-console`: operational console and validation tools
- `services/navigation-engine`: backend rules and integrations
- `data/`: maps, templates, runtime state, and raw assets
- `scripts/`: install, test, cleanup, and smoke-test automation

## 12. Bottom Line

This repository demonstrates a practical hospital-navigation SDK with a clear split between patient experience, admin tooling, and backend control. The design is strong because it is constrained: the frontend stays presentation-only, the backend owns behavior, and the data model is explicit.

Its main tradeoff is that it is still demo-shaped and file-backed. That is acceptable for the current submission because the architecture is easy to audit, easy to run locally, and easy to explain to reviewers.
