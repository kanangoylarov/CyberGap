import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.models.schemas import CreateOrderRequest

router = APIRouter(prefix="/api/orders", tags=["orders"])


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


@router.post("", status_code=201)
async def create_order(body: CreateOrderRequest, request: Request, response: Response):
    session_id = _get_session_id(request, response)
    service = request.app.state.store_service
    try:
        return await service.create_order(
            session_id,
            body.customer_name,
            body.customer_email,
            body.shipping_address,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{order_id}")
async def get_order(order_id: int, request: Request):
    service = request.app.state.store_service
    order = await service.get_order(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order
