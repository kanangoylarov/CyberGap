from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Product


class ProductRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_all(
        self,
        search: Optional[str],
        category: Optional[str],
        offset: int,
        limit: int,
    ) -> tuple[list[Product], int]:
        """Return a paginated list of products and the total matching count."""
        base_query = select(Product)

        if search:
            base_query = base_query.where(Product.name.ilike(f"%{search}%"))

        if category:
            base_query = base_query.where(
                func.lower(Product.category) == category.lower()
            )

        # Total count of matching rows
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self._session.execute(count_query)
        total_count: int = total_result.scalar_one()

        # Paginated results
        rows_query = base_query.order_by(Product.id).offset(offset).limit(limit)
        result = await self._session.execute(rows_query)
        products: list[Product] = list(result.scalars().all())

        return products, total_count

    async def get_by_id(self, product_id: int) -> Optional[Product]:
        """Return a single product by primary key, or None."""
        return await self._session.get(Product, product_id)

    async def update_stock(self, product_id: int, delta: int) -> None:
        """Decrement stock by *delta* units.  Raises ValueError if insufficient."""
        product = await self._session.get(Product, product_id)
        if product is None:
            raise ValueError(f"Product {product_id} not found")
        if product.stock < delta:
            raise ValueError(
                f"Insufficient stock for product {product_id}: "
                f"available={product.stock}, requested={delta}"
            )
        product.stock -= delta
        await self._session.flush()

    async def get_categories(self) -> list[str]:
        """Return a sorted list of distinct non-null categories."""
        query = (
            select(Product.category)
            .where(Product.category.is_not(None))
            .distinct()
            .order_by(Product.category)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())
