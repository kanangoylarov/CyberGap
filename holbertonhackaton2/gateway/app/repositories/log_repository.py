from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.database import GatewayLog
from app.models.schemas import GatewayLogCreate
from app.utils.logging import logger


class LogRepository:
    """Persists gateway log entries to PostgreSQL (fire-and-forget)."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create_log(self, log_entry: GatewayLogCreate) -> None:
        """Insert a log row. Errors are swallowed so callers are never blocked."""
        try:
            async with self._session_factory() as session:
                record = GatewayLog(**log_entry.model_dump())
                session.add(record)
                await session.commit()
        except Exception as exc:
            logger.error(
                "Failed to persist gateway log",
                extra={"error": str(exc), "fingerprint": log_entry.fingerprint},
            )
