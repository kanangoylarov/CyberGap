from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.repositories.log_repository import LogRepository
from app.models.schemas import PaginatedLogs, LogEntry
from app.core.dependencies import get_log_repository

router = APIRouter(prefix="/api/admin/logs", tags=["logs"])


@router.get("/", response_model=PaginatedLogs)
async def get_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    attack_type: Optional[int] = Query(None, ge=0),
    source_ip: Optional[str] = Query(None),
    fingerprint: Optional[str] = Query(None),
    repo: LogRepository = Depends(get_log_repository),
):
    """Paginated, filterable log listing."""
    items, total = await repo.get_logs(page, per_page, attack_type, source_ip, fingerprint)
    return PaginatedLogs(
        items=[LogEntry.model_validate(row) for row in items],
        total=total,
        page=page,
        per_page=per_page,
    )
