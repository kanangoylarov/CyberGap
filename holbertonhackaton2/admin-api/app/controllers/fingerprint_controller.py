from fastapi import APIRouter, Depends, Query, HTTPException

from app.models.schemas import FingerprintDetail
from app.services.fingerprint_service import FingerprintService
from app.core.dependencies import get_fingerprint_service

router = APIRouter(prefix="/api/admin/fingerprints", tags=["fingerprints"])


@router.get("/")
async def list_fingerprints(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service: FingerprintService = Depends(get_fingerprint_service),
):
    """Paginated list of fingerprints with aggregated stats."""
    items, total = await service.list_fingerprints(page, per_page)
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/{fingerprint_hash}", response_model=FingerprintDetail)
async def get_fingerprint_detail(
    fingerprint_hash: str,
    service: FingerprintService = Depends(get_fingerprint_service),
):
    """Detailed view of a single fingerprint. Returns 404 if not found."""
    detail = await service.get_detail(fingerprint_hash)
    if not detail:
        raise HTTPException(status_code=404, detail="Fingerprint not found")
    return detail
