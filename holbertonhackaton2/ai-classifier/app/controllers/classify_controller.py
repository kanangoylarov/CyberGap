from fastapi import APIRouter, Request

from app.models.schemas import ClassifyRequest, ClassifyResponse

router = APIRouter(tags=["classify"])


@router.post("/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest, raw: Request) -> ClassifyResponse:
    service = raw.app.state.classifier
    return await service.classify(request)
