import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.models.schemas import AddToCartRequest, UpdateCartItemRequest

router = APIRouter(prefix="/api/cart", tags=["cart"])


def _get_session_id(request: Request, response: Response) -> str:
    """Get session_id from cookie or generate a new one."""
    session_id = request.cookies.get("store_session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        response.set_cookie(
            "store_session_id",
            session_id,
            httponly=True,
            samesite="lax",
            max_age=86400 * 30,
        )
    return session_id


@router.get("")
async def get_cart(request: Request, response: Response):
    session_id = _get_session_id(request, response)
    service = request.app.state.store_service
    return await service.get_cart(session_id)


@router.post("", status_code=201)
async def add_to_cart(body: AddToCartRequest, request: Request, response: Response):
    session_id = _get_session_id(request, response)
    service = request.app.state.store_service
    try:
        return await service.add_to_cart(session_id, body.product_id, body.quantity)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.put("/{item_id}")
async def update_cart_item(
    item_id: int, body: UpdateCartItemRequest, request: Request, response: Response
):
    session_id = _get_session_id(request, response)
    service = request.app.state.store_service
    result = await service.update_cart_item(session_id, item_id, body.quantity)
    if not result:
        raise HTTPException(404, "Cart item not found")
    return result


@router.delete("/{item_id}", status_code=204)
async def remove_cart_item(item_id: int, request: Request, response: Response):
    session_id = _get_session_id(request, response)
    service = request.app.state.store_service
    if not await service.remove_cart_item(session_id, item_id):
        raise HTTPException(404, "Cart item not found")
