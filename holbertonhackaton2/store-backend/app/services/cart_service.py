from decimal import Decimal

from fastapi import HTTPException

from app.models.schemas import (
    CartAddRequest,
    CartItemResponse,
    CartResponse,
    CartUpdateRequest,
)
from app.repositories.cart_repository import CartRepository
from app.repositories.product_repository import ProductRepository


class CartService:
    def __init__(self, cart_repo: CartRepository, product_repo: ProductRepository):
        self._cart_repo = cart_repo
        self._product_repo = product_repo

    async def get_cart(self, session_id: str) -> CartResponse:
        items = await self._cart_repo.get_items(session_id)
        cart_items = [CartItemResponse.model_validate(item) for item in items]
        total = sum(
            Decimal(str(item.quantity)) * item.product.price for item in items
        )
        item_count = sum(item.quantity for item in items)
        return CartResponse(items=cart_items, total=total, item_count=item_count)

    async def add_to_cart(
        self, session_id: str, request: CartAddRequest
    ) -> CartItemResponse:
        product = await self._product_repo.get_by_id(request.product_id)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        if product.stock < request.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock: available={product.stock}, requested={request.quantity}",
            )
        cart_item = await self._cart_repo.add_item(
            session_id=session_id,
            product_id=request.product_id,
            quantity=request.quantity,
        )
        return CartItemResponse.model_validate(cart_item)

    async def update_item(
        self, session_id: str, item_id: int, request: CartUpdateRequest
    ) -> CartItemResponse:
        updated = await self._cart_repo.update_quantity(
            item_id=item_id, session_id=session_id, quantity=request.quantity
        )
        if updated is None:
            raise HTTPException(status_code=404, detail="Cart item not found")
        return CartItemResponse.model_validate(updated)

    async def remove_item(self, session_id: str, item_id: int) -> None:
        deleted = await self._cart_repo.remove_item(
            item_id=item_id, session_id=session_id
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="Cart item not found")
