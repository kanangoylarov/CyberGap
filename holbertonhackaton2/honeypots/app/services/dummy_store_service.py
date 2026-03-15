import math
from typing import Optional
from app.repositories.dummy_data_repository import DummyDataRepository
from app.services.behavior.base import BaseBehavior


class DummyStoreService:
    def __init__(self, repo: DummyDataRepository, behavior: BaseBehavior):
        self._repo = repo
        self._behavior = behavior

    async def list_products(self, search, category, page, per_page) -> dict:
        offset = (page - 1) * per_page
        products, total = self._repo.get_products(search, category, offset, per_page)
        products = self._behavior.modify_product_response(products)
        pages = max(1, math.ceil(total / per_page))
        return {
            "items": products,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
        }

    async def get_product(self, product_id) -> Optional[dict]:
        return self._repo.get_product(product_id)

    async def get_cart(self, session_id) -> dict:
        items = self._repo.get_cart(session_id)
        total = sum(item["product"]["price"] * item["quantity"] for item in items)
        item_count = sum(item["quantity"] for item in items)
        return {"items": items, "total": round(total, 2), "item_count": item_count}

    async def add_to_cart(self, session_id, product_id, quantity) -> dict:
        return self._repo.add_to_cart(session_id, product_id, quantity)

    async def update_cart_item(self, session_id, item_id, quantity) -> Optional[dict]:
        return self._repo.update_cart_item(session_id, item_id, quantity)

    async def remove_cart_item(self, session_id, item_id) -> bool:
        return self._repo.remove_cart_item(session_id, item_id)

    async def create_order(
        self, session_id, customer_name, customer_email, shipping_address
    ) -> dict:
        return self._repo.create_order(
            session_id, customer_name, customer_email, shipping_address
        )

    async def get_order(self, order_id) -> Optional[dict]:
        return self._repo.get_order(order_id)
