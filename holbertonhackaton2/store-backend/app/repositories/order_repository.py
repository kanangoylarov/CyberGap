from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.orm import Order, OrderItem


class OrderRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, order: Order) -> Order:
        """Persist a new order and return it with server-generated fields populated."""
        self._session.add(order)
        await self._session.flush()
        await self._session.refresh(order)
        return order

    async def get_by_id(self, order_id: int) -> Optional[Order]:
        """Return an order with its items and their products eagerly loaded."""
        query = (
            select(Order)
            .options(
                joinedload(Order.items).joinedload(OrderItem.product)
            )
            .where(Order.id == order_id)
        )
        result = await self._session.execute(query)
        return result.scalars().unique().one_or_none()
