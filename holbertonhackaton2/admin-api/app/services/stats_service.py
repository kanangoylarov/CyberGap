from datetime import datetime, timedelta, timezone
from typing import Optional

from app.repositories.stats_repository import StatsRepository
from app.models.schemas import OverviewStats, AttackBreakdown, TimeSeriesPoint, TimeSeriesResponse


class StatsService:
    def __init__(self, repo: StatsRepository):
        self.repo = repo

    async def get_overview(self, since: Optional[datetime] = None) -> OverviewStats:
        """
        Returns aggregate overview statistics.
        Defaults `since` to 24 hours ago if not provided.
        Computes attack_rate and gets top_attack_type from breakdown.
        """
        if since is None:
            since = datetime.now(timezone.utc) - timedelta(hours=24)

        overview = await self.repo.get_overview(since)
        breakdown = await self.repo.get_attack_breakdown(since)

        total_requests = overview["total_requests"]
        total_attacks = overview["total_attacks"]

        if total_requests > 0:
            attack_rate = round((total_attacks / total_requests) * 100, 2)
        else:
            attack_rate = 0.0

        if breakdown:
            top_attack_type = breakdown[0]["attack_label"]
            top_attack_count = breakdown[0]["count"]
        else:
            top_attack_type = "none"
            top_attack_count = 0

        return OverviewStats(
            total_requests=total_requests,
            total_attacks=total_attacks,
            attack_rate=attack_rate,
            unique_ips=overview["unique_ips"],
            unique_fingerprints=overview["unique_fingerprints"],
            top_attack_type=top_attack_type,
            top_attack_count=top_attack_count,
            avg_confidence=round(overview["avg_confidence"], 4),
        )

    async def get_breakdown(self, since: Optional[datetime] = None) -> list[AttackBreakdown]:
        """
        Returns attack type breakdown with percentages.
        Defaults `since` to 24 hours ago.
        """
        if since is None:
            since = datetime.now(timezone.utc) - timedelta(hours=24)

        rows = await self.repo.get_attack_breakdown(since)

        total_count = sum(r["count"] for r in rows)

        result = []
        for row in rows:
            percentage = round((row["count"] / total_count) * 100, 2) if total_count > 0 else 0.0
            result.append(
                AttackBreakdown(
                    attack_type=row["attack_type"],
                    attack_label=row["attack_label"],
                    count=row["count"],
                    percentage=percentage,
                )
            )

        return result

    async def get_timeseries(
        self, since: Optional[datetime] = None, bucket: str = "5m"
    ) -> TimeSeriesResponse:
        """
        Returns time-bucketed counts for charts.
        Default `since` depends on bucket size:
          1m  -> 6 hours ago
          5m  -> 24 hours ago
          1h  -> 7 days ago
          1d  -> 30 days ago
        Validates bucket is one of: 1m, 5m, 1h, 1d.
        """
        valid_buckets = {"1m", "5m", "1h", "1d"}
        if bucket not in valid_buckets:
            bucket = "5m"

        if since is None:
            default_ranges = {
                "1m": timedelta(hours=6),
                "5m": timedelta(hours=24),
                "1h": timedelta(days=7),
                "1d": timedelta(days=30),
            }
            since = datetime.now(timezone.utc) - default_ranges[bucket]

        rows = await self.repo.get_timeseries(since, bucket)

        points = [
            TimeSeriesPoint(
                timestamp=row["timestamp"],
                total=row["total"],
                attacks=row["attacks"],
                normal=row["normal"],
            )
            for row in rows
        ]

        return TimeSeriesResponse(points=points, bucket_size=bucket)
