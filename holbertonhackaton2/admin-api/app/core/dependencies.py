from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.repositories.stats_repository import StatsRepository
from app.repositories.log_repository import LogRepository
from app.services.stats_service import StatsService
from app.services.fingerprint_service import FingerprintService
from app.services.live_stream_service import LiveStreamService


def get_stats_repository(session: AsyncSession = Depends(get_session)) -> StatsRepository:
    return StatsRepository(session)


def get_log_repository(session: AsyncSession = Depends(get_session)) -> LogRepository:
    return LogRepository(session)


def get_stats_service(repo: StatsRepository = Depends(get_stats_repository)) -> StatsService:
    return StatsService(repo)


def get_fingerprint_service(repo: LogRepository = Depends(get_log_repository)) -> FingerprintService:
    return FingerprintService(repo)


def get_live_stream_service() -> LiveStreamService:
    return LiveStreamService()
