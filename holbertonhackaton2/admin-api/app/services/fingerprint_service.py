from typing import Optional

from app.repositories.log_repository import LogRepository
from app.models.schemas import FingerprintSummary, FingerprintDetail


class FingerprintService:
    def __init__(self, repo: LogRepository):
        self.repo = repo

    async def list_fingerprints(
        self, page: int = 1, per_page: int = 20
    ) -> tuple[list[FingerprintSummary], int]:
        """
        Returns paginated list of fingerprints with aggregated stats.
        Validates page >= 1 and per_page between 1 and 100.
        Maps raw rows to FingerprintSummary objects.
        """
        page = max(1, page)
        per_page = max(1, min(100, per_page))

        rows, total = await self.repo.get_fingerprint_summary(page, per_page)

        items = [
            FingerprintSummary(
                fingerprint=row["fingerprint"],
                source_ip=row["source_ip"],
                attack_type=row["attack_type"],
                attack_label=row["attack_label"],
                confidence=round(row["confidence"], 4),
                hit_count=row["hit_count"],
                first_seen=row["first_seen"],
                last_seen=row["last_seen"],
            )
            for row in rows
        ]

        return items, total

    async def get_detail(self, fingerprint_hash: str) -> Optional[FingerprintDetail]:
        """
        Returns detailed info for a single fingerprint.
        Returns None if not found.
        """
        raw = await self.repo.get_fingerprint_detail(fingerprint_hash)

        if raw is None:
            return None

        return FingerprintDetail(
            fingerprint=raw["fingerprint"],
            source_ips=raw["source_ips"],
            attack_type=raw["attack_type"],
            attack_label=raw["attack_label"],
            avg_confidence=round(raw["avg_confidence"], 4),
            total_requests=raw["total_requests"],
            first_seen=raw["first_seen"],
            last_seen=raw["last_seen"],
            recent_paths=raw["recent_paths"],
            methods_used=raw["methods_used"],
        )
