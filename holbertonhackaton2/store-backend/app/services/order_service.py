from decimal import Decimal

from fastapi import HTTPException

from app.models.orm import Order, OrderItem
from app.models.schemas import OrderCreateRequest, OrderResponse
from app.repositories.cart_repository import CartRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository


class OrderService:
    def __init__(
        self,
        order_repo: OrderRepository,
        cart_repo: CartRepository,
        product_repo: ProductRepository,
    ):
        self._order_repo = order_repo
        self._cart_repo = cart_repo
        self._product_repo = product_repo

    async def create_order(
        self, session_id: str, request: OrderCreateRequest
    ) -> OrderResponse:
        # 1. Get cart items
        cart_items = await self._cart_repo.get_items(session_id)
        if not cart_items:
            raise HTTPException(status_code=400, detail="Cart is empty")

        # 2. Build OrderItems and compute total
        order_items: list[OrderItem] = []
        total = Decimal("0.00")
        for cart_item in cart_items:
            unit_price = cart_item.product.price
            line_total = Decimal(str(cart_item.quantity)) * unit_price
            total += line_total
            order_items.append(
                OrderItem(
                    product_id=cart_item.product_id,
                    quantity=cart_item.quantity,
                    unit_price=unit_price,
                )
            )

        # 3. Decrease stock for each item
        for cart_item in cart_items:
            try:
                await self._product_repo.update_stock(
                    cart_item.product_id, cart_item.quantity
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

        # 4. Create the order
        order = Order(
            session_id=session_id,
            customer_name=request.customer_name,
            customer_email=request.customer_email,
            shipping_address=request.shipping_address,
            total=total,
            status="pending",
            items=order_items,
        )
        order = await self._order_repo.create(order)

        # 5. Clear the cart
        await self._cart_repo.clear_cart(session_id)

        # 6. Re-fetch the order with eager-loaded relationships
        full_order = await self._order_repo.get_by_id(order.id)
        return OrderResponse.model_validate(full_order)

    async def get_order(self, order_id: int) -> OrderResponse:
        order = await self._order_repo.get_by_id(order_id)
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        return OrderResponse.model_validate(order)
