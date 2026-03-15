from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductResponse(BaseModel):
    id: int
    name: str
    description: str
    price: float
    image_url: str
    category: str
    stock: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Cart
# ---------------------------------------------------------------------------

class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    product: ProductResponse
    created_at: datetime


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    total: float
    item_count: int


class AddToCartRequest(BaseModel):
    product_id: int
    quantity: int = 1


class UpdateCartItemRequest(BaseModel):
    quantity: int


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------

class OrderItemResponse(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    price: float


class OrderResponse(BaseModel):
    id: int
    customer_name: str
    customer_email: str
    shipping_address: str
    total: float
    status: str
    items: list[OrderItemResponse]
    created_at: datetime


class CreateOrderRequest(BaseModel):
    customer_name: str
    customer_email: str
    shipping_address: str


# ---------------------------------------------------------------------------
# Paginated products
# ---------------------------------------------------------------------------

class PaginatedProductResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Forensic logging
# ---------------------------------------------------------------------------

class ForensicLogEntry(BaseModel):
    event: str
    honeypot_type: str
    timestamp: str
    source_ip: str
    method: str
    path: str
    headers: dict
    query_params: dict
    body: str
    body_size: int
    response_status: int
    response_body_preview: str
    latency_ms: float
