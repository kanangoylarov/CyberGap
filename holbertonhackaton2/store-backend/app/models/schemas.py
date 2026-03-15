import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.config import settings

T = TypeVar("T")


# ── Request DTOs ──────────────────────────────────────────────────────────────


class ProductListParams(BaseModel):
    search: str | None = None
    category: str | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=settings.DEFAULT_PAGE_SIZE, ge=1)

    @field_validator("per_page")
    @classmethod
    def clamp_per_page(cls, v: int) -> int:
        if v > settings.MAX_PAGE_SIZE:
            return settings.MAX_PAGE_SIZE
        return v


class CartAddRequest(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1)


class CartUpdateRequest(BaseModel):
    quantity: int = Field(ge=1)


class OrderCreateRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=255)
    customer_email: EmailStr
    shipping_address: str = Field(min_length=1)


# ── Response DTOs ─────────────────────────────────────────────────────────────


class ProductResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float
    image_url: str | None = None
    category: str
    stock: int
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class CartItemResponse(BaseModel):
    id: int
    session_id: str
    product_id: int
    quantity: int
    created_at: datetime.datetime
    product: ProductResponse

    model_config = {"from_attributes": True}


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    total: float
    item_count: int


class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    product_id: int
    quantity: int
    unit_price: float
    product: ProductResponse

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: int
    session_id: str
    customer_name: str
    customer_email: str
    shipping_address: str
    total: float
    status: str
    created_at: datetime.datetime
    items: list[OrderItemResponse] = []

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int
