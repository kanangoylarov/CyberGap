from typing import Optional

from sqlalchemy import select, func, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import GatewayLog


class LogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_logs(
        self,
        page: int,
        per_page: int,
        attack_type: Optional[int] = None,
        source_ip: Optional[str] = None,
        fingerprint: Optional[str] = None,
    ) -> tuple[list, int]:
        """
        Paginated, filterable query on gateway_logs.
        Returns (rows, total_count).
        """
        base_filter = []

        if attack_type is not None:
            base_filter.append(GatewayLog.attack_type == attack_type)
        if source_ip is not None:
            base_filter.append(GatewayLog.source_ip == source_ip)
        if fingerprint is not None:
            base_filter.append(GatewayLog.fingerprint == fingerprint)

        # Count query
        count_stmt = select(func.count()).select_from(GatewayLog)
        for f in base_filter:
            count_stmt = count_stmt.where(f)

        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar_one()

        # Data query
        offset = (page - 1) * per_page
        data_stmt = (
            select(GatewayLog)
            .order_by(desc(GatewayLog.timestamp))
            .offset(offset)
            .limit(per_page)
        )
        for f in base_filter:
            data_stmt = data_stmt.where(f)

        result = await self.session.execute(data_stmt)
        rows = result.scalars().all()

        return rows, total

    async def get_latest_id(self) -> int:
        """
        For WebSocket polling -- get the maximum ID in the table.
        """
        stmt = select(func.coalesce(func.max(GatewayLog.id), 0))
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_logs_after_id(self, last_id: int, limit: int = 50) -> list:
        """
        For WebSocket -- get new logs since last_id.
        Returns up to `limit` new entries ordered by id ascending.
        """
        stmt = (
            select(GatewayLog)
            .where(GatewayLog.id > last_id)
            .order_by(GatewayLog.id.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_fingerprint_summary(
        self, page: int, per_page: int
    ) -> tuple[list, int]:
        """
        Aggregated fingerprint table.
        Groups by fingerprint, gets most recent source_ip, most common attack_type,
        avg confidence, count, first/last seen.
        """
        # Count distinct fingerprints for pagination
        count_stmt = select(func.count(func.distinct(GatewayLog.fingerprint)))
        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar_one()

        offset = (page - 1) * per_page

        # Use raw SQL for mode() and array_agg which are PostgreSQL-specific
        # and not easily expressed in SQLAlchemy core
        stmt = text("""
            SELECT
                fingerprint,
                (array_agg(source_ip ORDER BY timestamp DESC))[1] AS source_ip,
                mode() WITHIN GROUP (ORDER BY attack_type) AS attack_type,
                mode() WITHIN GROUP (ORDER BY attack_label) AS attack_label,
                avg(confidence) AS confidence,
                count(*) AS hit_count,
                min(timestamp) AS first_seen,
                max(timestamp) AS last_seen
            FROM gateway_logs
            GROUP BY fingerprint
            ORDER BY hit_count DESC
            OFFSET :offset LIMIT :limit
        """)

        result = await self.session.execute(
            stmt, {"offset": offset, "limit": per_page}
        )
        rows = result.all()

        return [
            {
                "fingerprint": row.fingerprint,
                "source_ip": row.source_ip,
                "attack_type": row.attack_type,
                "attack_label": row.attack_label,
                "confidence": float(row.confidence) if row.confidence else 0.0,
                "hit_count": row.hit_count,
                "first_seen": row.first_seen,
                "last_seen": row.last_seen,
            }
            for row in rows
        ], total

    async def get_fingerprint_detail(self, fingerprint_hash: str) -> Optional[dict]:
        """
        Full detail for a single fingerprint.
        Runs multiple queries: aggregate stats, distinct IPs, distinct methods, recent paths.
        """
        # 1. Aggregate stats
        stats_stmt = text("""
            SELECT
                fingerprint,
                mode() WITHIN GROUP (ORDER BY attack_type) AS attack_type,
                mode() WITHIN GROUP (ORDER BY attack_label) AS attack_label,
                avg(confidence) AS avg_confidence,
                count(*) AS total_requests,
                min(timestamp) AS first_seen,
                max(timestamp) AS last_seen
            FROM gateway_logs
            WHERE fingerprint = :fp
            GROUP BY fingerprint
        """)
        stats_result = await self.session.execute(
            stats_stmt, {"fp": fingerprint_hash}
        )
        stats_row = stats_result.first()

        if stats_row is None:
            return None

        # 2. Distinct source IPs
        ips_stmt = (
            select(func.distinct(GatewayLog.source_ip))
            .where(GatewayLog.fingerprint == fingerprint_hash)
        )
        ips_result = await self.session.execute(ips_stmt)
        source_ips = [row[0] for row in ips_result.all()]

        # 3. Distinct methods
        methods_stmt = (
            select(func.distinct(GatewayLog.method))
            .where(GatewayLog.fingerprint == fingerprint_hash)
        )
        methods_result = await self.session.execute(methods_stmt)
        methods_used = [row[0] for row in methods_result.all()]

        # 4. Recent 20 paths
        paths_stmt = (
            select(GatewayLog.path)
            .where(GatewayLog.fingerprint == fingerprint_hash)
            .order_by(desc(GatewayLog.timestamp))
            .limit(20)
        )
        paths_result = await self.session.execute(paths_stmt)
        recent_paths = [row[0] for row in paths_result.all()]

        return {
            "fingerprint": stats_row.fingerprint,
            "source_ips": source_ips,
            "attack_type": stats_row.attack_type,
            "attack_label": stats_row.attack_label,
            "avg_confidence": float(stats_row.avg_confidence) if stats_row.avg_confidence else 0.0,
            "total_requests": stats_row.total_requests,
            "first_seen": stats_row.first_seen,
            "last_seen": stats_row.last_seen,
            "recent_paths": recent_paths,
            "methods_used": methods_used,
        }
