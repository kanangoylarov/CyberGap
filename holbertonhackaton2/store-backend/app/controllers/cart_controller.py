from fastapi import APIRouter, Depends, Response

from app.core.dependencies import get_cart_service, get_session_id
from app.models.schemas import (
    CartAddRequest,
    CartItemResponse,
    CartResponse,
    CartUpdateRequest,
)
from app.services.cart_service import CartService

router = APIRouter(prefix="/api/cart", tags=["cart"])


@router.get("/", response_model=CartResponse)
async def get_cart(
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
):
    return await service.get_cart(session_id)


@router.post("/", response_model=CartItemResponse, status_code=201)
async def add_to_cart(
    request: CartAddRequest,
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
):
    return await service.add_to_cart(session_id, request)


@router.put("/{item_id}", response_model=CartItemResponse)
async def update_cart_item(
    item_id: int,
    request: CartUpdateRequest,
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
):
    return await service.update_item(session_id, item_id, request)


@router.delete("/{item_id}", status_code=204)
async def remove_cart_item(
    item_id: int,
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
):
    await service.remove_item(session_id, item_id)
    return Response(status_code=204)
