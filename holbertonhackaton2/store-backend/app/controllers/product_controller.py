from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_product_service
from app.models.schemas import PaginatedResponse, ProductResponse
from app.services.product_service import ProductService

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1),
    service: ProductService = Depends(get_product_service),
):
    from app.models.schemas import ProductListParams

    params = ProductListParams(
        search=search, category=category, page=page, per_page=per_page
    )
    return await service.list_products(params)


@router.get("/categories", response_model=list[str])
async def get_categories(
    service: ProductService = Depends(get_product_service),
):
    return await service.get_categories()


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    service: ProductService = Depends(get_product_service),
):
    return await service.get_product(product_id)
