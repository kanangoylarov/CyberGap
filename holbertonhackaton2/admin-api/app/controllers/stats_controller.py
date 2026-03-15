from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.models.schemas import OverviewStats, AttackBreakdown, TimeSeriesResponse
from app.services.stats_service import StatsService
from app.core.dependencies import get_stats_service

router = APIRouter(prefix="/api/admin/stats", tags=["stats"])


@router.get("/overview", response_model=OverviewStats)
async def get_overview(
    since: Optional[datetime] = Query(None, description="Start of time range (ISO 8601)"),
    service: StatsService = Depends(get_stats_service),
):
    """Returns aggregate overview statistics."""
    return await service.get_overview(since)


@router.get("/breakdown", response_model=list[AttackBreakdown])
async def get_breakdown(
    since: Optional[datetime] = Query(None, description="Start of time range (ISO 8601)"),
    service: StatsService = Depends(get_stats_service),
):
    """Returns attack type breakdown."""
    return await service.get_breakdown(since)


@router.get("/timeseries", response_model=TimeSeriesResponse)
async def get_timeseries(
    since: Optional[datetime] = Query(None, description="Start of time range (ISO 8601)"),
    bucket: str = Query("5m", pattern="^(1m|5m|1h|1d)$", description="Bucket size: 1m, 5m, 1h, 1d"),
    service: StatsService = Depends(get_stats_service),
):
    """Returns time-bucketed counts for charts."""
    return await service.get_timeseries(since, bucket)
