from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.orm import CartItem


class CartRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_items(self, session_id: str) -> list[CartItem]:
        """Return all cart items for the given session, with products eagerly loaded."""
        query = (
            select(CartItem)
            .options(joinedload(CartItem.product))
            .where(CartItem.session_id == session_id)
            .order_by(CartItem.created_at)
        )
        result = await self._session.execute(query)
        return list(result.scalars().unique().all())

    async def add_item(
        self, session_id: str, product_id: int, quantity: int
    ) -> CartItem:
        """Add a product to the cart or increment its quantity if it already exists."""
        # Check for an existing row with the same (session_id, product_id)
        query = select(CartItem).where(
            CartItem.session_id == session_id,
            CartItem.product_id == product_id,
        )
        result = await self._session.execute(query)
        existing: Optional[CartItem] = result.scalars().first()

        if existing is not None:
            existing.quantity += quantity
            await self._session.flush()
            # Refresh to pick up any server-side defaults and load the product
            await self._session.refresh(existing, attribute_names=["product"])
            return existing

        new_item = CartItem(
            session_id=session_id,
            product_id=product_id,
            quantity=quantity,
        )
        self._session.add(new_item)
        await self._session.flush()
        await self._session.refresh(new_item, attribute_names=["product"])
        return new_item

    async def update_quantity(
        self, item_id: int, session_id: str, quantity: int
    ) -> Optional[CartItem]:
        """Update the quantity of a specific cart item. Returns None if not found."""
        query = select(CartItem).where(
            CartItem.id == item_id,
            CartItem.session_id == session_id,
        )
        result = await self._session.execute(query)
        item: Optional[CartItem] = result.scalars().first()

        if item is None:
            return None

        item.quantity = quantity
        await self._session.flush()
        await self._session.refresh(item, attribute_names=["product"])
        return item

    async def remove_item(self, item_id: int, session_id: str) -> bool:
        """Delete a cart item. Returns True if a row was actually deleted."""
        stmt = delete(CartItem).where(
            CartItem.id == item_id,
            CartItem.session_id == session_id,
        )
        result = await self._session.execute(stmt)
        return result.rowcount > 0  # type: ignore[union-attr]

    async def clear_cart(self, session_id: str) -> None:
        """Remove every cart item belonging to the given session."""
        stmt = delete(CartItem).where(CartItem.session_id == session_id)
        await self._session.execute(stmt)
