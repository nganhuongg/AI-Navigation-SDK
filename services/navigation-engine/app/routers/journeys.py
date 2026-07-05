"""Care journey template endpoints: list and get one."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.common import APIResponse
from app.services.journey import template_loader

router = APIRouter(prefix="/journey-templates", tags=["journeys"])


@router.get("")
def list_templates() -> APIResponse:
    """List all care journey templates (summaries)."""
    return APIResponse.ok(template_loader.list_template_summaries())


@router.get("/{template_id}")
def get_template(template_id: str) -> APIResponse:
    """Get one full care journey template by id."""
    return APIResponse.ok(template_loader.get_template(template_id))
