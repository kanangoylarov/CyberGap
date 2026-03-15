from datetime import datetime
from typing import Optional

from sqlalchemy import select, func, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import GatewayLog


class StatsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_overview(self, since: Optional[datetime] = None) -> dict:
        """
        Single query returning all overview statistics:
        total_requests, total_attacks, unique_ips, unique_fingerprints, avg_confidence.
        """
        attack_case = case(
            (GatewayLog.attack_type > 0, 1),
        )
        confidence_case = case(
            (GatewayLog.attack_type > 0, GatewayLog.confidence),
        )

        stmt = select(
            func.count().label("total_requests"),
            func.count(attack_case).label("total_attacks"),
            func.count(func.distinct(GatewayLog.source_ip)).label("unique_ips"),
            func.count(func.distinct(GatewayLog.fingerprint)).label("unique_fingerprints"),
            func.coalesce(func.avg(confidence_case), 0.0).label("avg_confidence"),
        )

        if since is not None:
            stmt = stmt.where(GatewayLog.timestamp >= since)

        result = await self.session.execute(stmt)
        row = result.one()

        return {
            "total_requests": row.total_requests,
            "total_attacks": row.total_attacks,
            "unique_ips": row.unique_ips,
            "unique_fingerprints": row.unique_fingerprints,
            "avg_confidence": float(row.avg_confidence),
        }

    async def get_attack_breakdown(self, since: Optional[datetime] = None) -> list[dict]:
        """
        Attack type distribution grouped by attack_type and attack_label.
        Returns list of dicts with attack_type, attack_label, count.
        """
        stmt = (
            select(
                GatewayLog.attack_type,
                GatewayLog.attack_label,
                func.count().label("count"),
            )
            .where(GatewayLog.attack_type > 0)
            .group_by(GatewayLog.attack_type, GatewayLog.attack_label)
            .order_by(func.count().desc())
        )

        if since is not None:
            stmt = stmt.where(GatewayLog.timestamp >= since)

        result = await self.session.execute(stmt)
        rows = result.all()

        return [
            {
                "attack_type": row.attack_type,
                "attack_label": row.attack_label,
                "count": row.count,
            }
            for row in rows
        ]

    async def get_timeseries(self, since: datetime, bucket: str = "5m") -> list[dict]:
        """
        Time-bucketed counts for line charts.
        Supports 1m, 5m, 1h, 1d bucket sizes.
        """
        attack_case = case(
            (GatewayLog.attack_type > 0, 1),
        )
        normal_case = case(
            (GatewayLog.attack_type == 0, 1),
        )

        if bucket == "1m":
            bucket_expr = func.date_trunc("minute", GatewayLog.timestamp)
        elif bucket == "5m":
            # 5-minute intervals via floor(epoch / 300) * 300, then to_timestamp
            epoch = func.extract("epoch", GatewayLog.timestamp)
            bucket_expr = func.to_timestamp(func.floor(epoch / 300) * 300)
        elif bucket == "1h":
            bucket_expr = func.date_trunc("hour", GatewayLog.timestamp)
        elif bucket == "1d":
            bucket_expr = func.date_trunc("day", GatewayLog.timestamp)
        else:
            bucket_expr = func.date_trunc("hour", GatewayLog.timestamp)

        bucket_col = bucket_expr.label("bucket_time")

        stmt = (
            select(
                bucket_col,
                func.count().label("total"),
                func.count(attack_case).label("attacks"),
                func.count(normal_case).label("normal"),
            )
            .where(GatewayLog.timestamp >= since)
            .group_by(bucket_col)
            .order_by(bucket_col.asc())
        )

        result = await self.session.execute(stmt)
        rows = result.all()

        return [
            {
                "timestamp": row.bucket_time,
                "total": row.total,
                "attacks": row.attacks,
                "normal": row.normal,
            }
            for row in rows
        ]
