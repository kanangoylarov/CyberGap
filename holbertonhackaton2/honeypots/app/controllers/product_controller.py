from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from app.models.schemas import PaginatedProductResponse

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=PaginatedProductResponse)
async def list_products(
    request: Request,
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    service = request.app.state.store_service
    behavior = request.app.state.behavior

    # pre_response_hook (for fuzzers random errors, dos delay)
    hook_result = await behavior.pre_response_hook(request)
    if hook_result:
        return JSONResponse(
            status_code=hook_result["status_code"], content=hook_result["body"]
        )

    return await service.list_products(search, category, page, per_page)


@router.get("/categories")
async def list_categories(request: Request):
    return ["Electronics", "Clothing", "Books", "Home & Kitchen", "Sports"]


@router.get("/{product_id}")
async def get_product(product_id: int, request: Request):
    service = request.app.state.store_service
    behavior = request.app.state.behavior

    hook_result = await behavior.pre_response_hook(request)
    if hook_result:
        return JSONResponse(
            status_code=hook_result["status_code"], content=hook_result["body"]
        )

    product = await service.get_product(product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return product
