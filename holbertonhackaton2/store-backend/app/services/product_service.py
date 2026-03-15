from fastapi import HTTPException

from app.models.schemas import PaginatedResponse, ProductListParams, ProductResponse
from app.repositories.product_repository import ProductRepository


class ProductService:
    def __init__(self, repo: ProductRepository):
        self._repo = repo

    async def list_products(
        self, params: ProductListParams
    ) -> PaginatedResponse[ProductResponse]:
        offset = (params.page - 1) * params.per_page
        products, total = await self._repo.get_all(
            search=params.search,
            category=params.category,
            offset=offset,
            limit=params.per_page,
        )
        items = [ProductResponse.model_validate(p) for p in products]
        return PaginatedResponse[ProductResponse](
            items=items,
            total=total,
            page=params.page,
            per_page=params.per_page,
        )

    async def get_product(self, product_id: int) -> ProductResponse:
        product = await self._repo.get_by_id(product_id)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        return ProductResponse.model_validate(product)

    async def get_categories(self) -> list[str]:
        return await self._repo.get_categories()
