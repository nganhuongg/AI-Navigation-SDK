"""FastAPI application entrypoint for the AI Navigation Engine.

This is Layer 3 (the Backend Orchestrator). It wires together the routers and
converts expected backend errors into the shared ``{success, data, error}``
response envelope. Business logic lives in ``app/services``, not here.

Run locally (from services/navigation-engine):
    ../../.venv/Scripts/python -m uvicorn app.main:app --reload --port 8001
Then open http://localhost:8001/docs
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.errors import EngineError
from app.core.logging import configure_logging, get_logger
from app.models.common import APIResponse
from app.routers import (
    assistant,
    chatbot,
    dashboard,
    events,
    health,
    journeys,
    locations,
    maps,
    ocr,
    route,
    sessions,
    voice,
)

configure_logging()
logger = get_logger("navigation-engine")

app = FastAPI(
    title="AI Navigation Engine",
    version="0.1.0",
    description="Backend Orchestrator for the AI Navigation SDK (voice, OCR, chatbot).",
)

# CORS: for the demo we allow all origins so the two Next.js apps (ports 3000/3001)
# can call the API. Tighten this to specific origins before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(EngineError)
async def handle_engine_error(request: Request, exc: EngineError) -> JSONResponse:
    """Turn an expected backend error into the standard failure envelope."""
    logger.info("EngineError on %s: %s", request.url.path, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content=APIResponse.fail(exc.message).model_dump(),
    )


# Register routers. Each router owns one area of the API.
app.include_router(health.router)
app.include_router(locations.router)
app.include_router(maps.router)
app.include_router(journeys.router)
app.include_router(sessions.router)
app.include_router(ocr.router)
app.include_router(assistant.router)
app.include_router(chatbot.router)
app.include_router(voice.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(route.router)


@app.get("/", tags=["health"])
def root() -> APIResponse:
    """Root pointer to the interactive docs."""
    return APIResponse.ok({"service": "navigation-engine", "docs": "/docs"})
