from fastapi import APIRouter, Depends

from app.core.dependencies import get_order_service, get_session_id
from app.models.schemas import OrderCreateRequest, OrderResponse
from app.services.order_service import OrderService

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("/", response_model=OrderResponse, status_code=201)
async def create_order(
    request: OrderCreateRequest,
    session_id: str = Depends(get_session_id),
    service: OrderService = Depends(get_order_service),
):
    return await service.create_order(session_id, request)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    service: OrderService = Depends(get_order_service),
):
    return await service.get_order(order_id)
