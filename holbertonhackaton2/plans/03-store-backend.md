# Store Backend (Legitimate API) -- Complete Implementation Specification

## Overview

This document is a self-contained, exhaustive implementation specification for the **Store Backend** -- the legitimate e-commerce API that serves real store traffic. It uses its own PostgreSQL database `storedb`, completely separate from any gateway or honeypot logging databases.

The API is built with **FastAPI** (async), **SQLAlchemy 2.0** (async ORM), **asyncpg** (PostgreSQL driver), and **Alembic** (migrations). It follows the layered architecture pattern: **Model -> Repository -> Service -> Controller (Router)**.

---

## 1. Directory Tree

```
store-backend/
├── Dockerfile
├── requirements.txt
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 001_initial.py
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── orm.py
│   │   └── schemas.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── product_repository.py
│   │   ├── cart_repository.py
│   │   └── order_repository.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── product_service.py
│   │   ├── cart_service.py
│   │   └── order_service.py
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── product_controller.py
│   │   ├── cart_controller.py
│   │   └── order_controller.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── database.py
│   │   └── dependencies.py
│   ├── seed/
│   │   ├── __init__.py
│   │   └── seed_data.py
│   └── utils/
│       ├── __init__.py
│       └── logging.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_product_service.py
    ├── test_cart_service.py
    └── test_order_service.py
```

---

## 2. requirements.txt

Create this file at `store-backend/requirements.txt` with the following exact contents:

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.0
pydantic[email]==2.7.0
pydantic-settings==2.3.0
python-json-logger==2.0.7
```

---

## 3. Dockerfile

Create this file at `store-backend/Dockerfile` with the following exact contents:

```dockerfile
FROM python:3.11-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/
RUN useradd -r appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed.seed_data && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

### Dockerfile notes

- Two-stage build: `deps` stage installs Python packages, the final stage copies only the installed packages and application code.
- `alembic upgrade head` runs all pending migrations before the app starts.
- `python -m app.seed.seed_data` populates the products table with sample data (idempotent -- skips if products already exist).
- `uvicorn` starts on port 8000 binding to all interfaces.
- Runs as non-root user `appuser`.

---

## 4. app/__init__.py

Empty file. Marks `app` as a Python package.

```python
# app/__init__.py
```

---

## 5. app/config.py

This file defines the application settings using `pydantic-settings`. All settings can be overridden via environment variables prefixed with `STORE_`.

```python
"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    All settings for the store backend.
    Environment variables are prefixed with STORE_ (e.g., STORE_DATABASE_URL).
    """

    DATABASE_URL: str = (
        "postgresql+asyncpg://store:store@postgres-store.honeypot.svc.cluster.local:5432/storedb"
    )
    LOG_LEVEL: str = "INFO"
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Cookie settings for session tracking
    SESSION_COOKIE_NAME: str = "session_id"
    SESSION_COOKIE_MAX_AGE: int = 86400 * 30  # 30 days in seconds

    model_config = {
        "env_prefix": "STORE_",
    }


# Singleton instance -- import this throughout the app
settings = Settings()
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | `str` | `postgresql+asyncpg://store:store@postgres-store.honeypot.svc.cluster.local:5432/storedb` | Async SQLAlchemy connection string for the store database |
| `LOG_LEVEL` | `str` | `"INFO"` | Python logging level |
| `DEFAULT_PAGE_SIZE` | `int` | `20` | Default number of items per page when not specified |
| `MAX_PAGE_SIZE` | `int` | `100` | Maximum allowed `per_page` value to prevent abuse |
| `SESSION_COOKIE_NAME` | `str` | `"session_id"` | Name of the cookie used to track cart sessions |
| `SESSION_COOKIE_MAX_AGE` | `int` | `2592000` | Cookie max-age in seconds (30 days) |

---

## 6. app/core/database.py

This file sets up the async SQLAlchemy engine and session factory, plus the declarative Base class.

```python
"""Async database engine and session factory for storedb."""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


# Create the async engine
# - pool_size=10: maintain up to 10 persistent connections
# - max_overflow=20: allow up to 20 additional connections under load
# - echo=False: do not log SQL statements (set True for debugging)
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

# Session factory -- produces AsyncSession instances
async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

### Key design decisions

- `expire_on_commit=False`: prevents lazy-load issues after commit in async context. Attributes remain accessible after `session.commit()` without triggering implicit I/O.
- The `Base` class is defined here so that all ORM models import it from one place.
- The engine and session factory are module-level singletons, initialized at import time using the `settings` singleton.

---

## 7. app/models/__init__.py

Re-exports for convenience.

```python
"""ORM models and Pydantic schemas."""

from app.models.orm import Base, CartItem, Order, OrderItem, Product
from app.models.schemas import (
    CartAddRequest,
    CartItemResponse,
    CartResponse,
    CartUpdateRequest,
    OrderCreateRequest,
    OrderItemResponse,
    OrderResponse,
    PaginatedResponse,
    ProductListParams,
    ProductResponse,
)

__all__ = [
    "Base",
    "Product",
    "CartItem",
    "Order",
    "OrderItem",
    "ProductListParams",
    "CartAddRequest",
    "CartUpdateRequest",
    "OrderCreateRequest",
    "ProductResponse",
    "CartItemResponse",
    "CartResponse",
    "OrderItemResponse",
    "OrderResponse",
    "PaginatedResponse",
]
```

---

## 8. app/models/orm.py

Full SQLAlchemy ORM models for all four tables: `products`, `cart_items`, `orders`, `order_items`.

```python
"""SQLAlchemy ORM models for the store database."""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Product(Base):
    """
    Represents a product in the store catalog.

    Columns:
        id          -- auto-incrementing primary key
        name        -- product name, max 255 chars, NOT NULL
        description -- optional long-form description
        price       -- decimal price with 2 decimal places, NOT NULL
        image_url   -- optional URL to product image, max 512 chars
        category    -- optional category string, max 100 chars, indexed for filtering
        stock       -- integer stock count, NOT NULL, defaults to 0
        created_at  -- timestamp of row creation, set by DB server
    """

    __tablename__ = "products"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    name: str = Column(String(255), nullable=False)
    description: str | None = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    image_url: str | None = Column(String(512), nullable=True)
    category: str | None = Column(String(100), nullable=True, index=True)
    stock: int = Column(Integer, nullable=False, default=0)
    created_at: datetime = Column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name!r}>"


class CartItem(Base):
    """
    Represents one item in a shopping cart, identified by session_id.

    Columns:
        id          -- auto-incrementing primary key
        session_id  -- opaque session identifier (UUID string), NOT NULL, indexed
        product_id  -- FK to products.id, NOT NULL
        quantity    -- item quantity, NOT NULL, defaults to 1
        created_at  -- timestamp of row creation

    Constraints:
        unique(session_id, product_id) -- each product appears at most once per cart

    Relationships:
        product -- eagerly loaded Product via joined loading
    """

    __tablename__ = "cart_items"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    session_id: str = Column(String(64), nullable=False, index=True)
    product_id: int = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity: int = Column(Integer, nullable=False, default=1)
    created_at: datetime = Column(DateTime, server_default=func.now())

    product = relationship("Product", lazy="joined")

    __table_args__ = (
        UniqueConstraint("session_id", "product_id", name="uq_cart_session_product"),
    )

    def __repr__(self) -> str:
        return f"<CartItem id={self.id} session={self.session_id} product={self.product_id} qty={self.quantity}>"


class Order(Base):
    """
    Represents a completed order.

    Columns:
        id               -- auto-incrementing primary key
        session_id       -- the session that placed the order, NOT NULL, indexed
        customer_name    -- buyer's name, NOT NULL
        customer_email   -- buyer's email, NOT NULL
        shipping_address -- full shipping address text, NOT NULL
        total            -- order total in decimal, NOT NULL
        status           -- order status string, defaults to "pending"
        created_at       -- timestamp of row creation

    Relationships:
        items -- list of OrderItem, eagerly loaded, back-populates "order"
    """

    __tablename__ = "orders"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    session_id: str = Column(String(64), nullable=False, index=True)
    customer_name: str = Column(String(255), nullable=False)
    customer_email: str = Column(String(255), nullable=False)
    shipping_address: str = Column(Text, nullable=False)
    total = Column(Numeric(10, 2), nullable=False)
    status: str = Column(String(50), nullable=False, default="pending")
    created_at: datetime = Column(DateTime, server_default=func.now())

    items = relationship("OrderItem", back_populates="order", lazy="joined")

    def __repr__(self) -> str:
        return f"<Order id={self.id} status={self.status} total={self.total}>"


class OrderItem(Base):
    """
    Represents one line item within an order.

    Columns:
        id          -- auto-incrementing primary key
        order_id    -- FK to orders.id, NOT NULL
        product_id  -- FK to products.id, NOT NULL
        quantity    -- quantity ordered, NOT NULL
        unit_price  -- price per unit at time of order, NOT NULL

    Relationships:
        order   -- back-populates Order.items
        product -- eagerly loaded Product
    """

    __tablename__ = "order_items"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    order_id: int = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id: int = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity: int = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", lazy="joined")

    def __repr__(self) -> str:
        return f"<OrderItem id={self.id} order={self.order_id} product={self.product_id} qty={self.quantity}>"
```

---

## 9. app/models/schemas.py

Pydantic models for request validation and response serialization.

```python
"""Pydantic request/response schemas (DTOs)."""

from datetime import datetime
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, EmailStr, Field

T = TypeVar("T")


# ──────────────────────────────────────────────
# Request Schemas
# ──────────────────────────────────────────────


class ProductListParams(BaseModel):
    """Query parameters for listing products."""

    search: Optional[str] = Field(
        default=None,
        description="Search term matched against product name (case-insensitive ILIKE).",
        max_length=200,
    )
    category: Optional[str] = Field(
        default=None,
        description="Filter by exact category name.",
        max_length=100,
    )
    page: int = Field(
        default=1,
        ge=1,
        description="Page number (1-based).",
    )
    per_page: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Number of items per page (max 100).",
    )


class CartAddRequest(BaseModel):
    """Request body for adding an item to the cart."""

    product_id: int = Field(
        ...,
        gt=0,
        description="ID of the product to add.",
    )
    quantity: int = Field(
        default=1,
        ge=1,
        description="Quantity to add (must be >= 1).",
    )


class CartUpdateRequest(BaseModel):
    """Request body for updating a cart item's quantity."""

    quantity: int = Field(
        ...,
        ge=1,
        description="New quantity (must be >= 1). To remove, use DELETE instead.",
    )


class OrderCreateRequest(BaseModel):
    """Request body for placing an order (checking out)."""

    customer_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Full name of the customer.",
    )
    customer_email: EmailStr = Field(
        ...,
        description="Customer email address (validated format).",
    )
    shipping_address: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Full shipping address.",
    )


# ──────────────────────────────────────────────
# Response Schemas
# ──────────────────────────────────────────────


class ProductResponse(BaseModel):
    """Response schema for a single product."""

    id: int
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    category: Optional[str] = None
    stock: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CartItemResponse(BaseModel):
    """Response schema for a single cart item (includes nested product)."""

    id: int
    product_id: int
    quantity: int
    product: ProductResponse
    created_at: datetime

    model_config = {"from_attributes": True}


class CartResponse(BaseModel):
    """
    Response schema for the full cart.
    Computed fields: total (sum of quantity * price), item_count (sum of quantities).
    """

    items: list[CartItemResponse]
    total: float
    item_count: int


class OrderItemResponse(BaseModel):
    """Response schema for a single order line item."""

    id: int
    product_id: int
    quantity: int
    unit_price: float
    product: ProductResponse

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    """Response schema for a completed order."""

    id: int
    customer_name: str
    customer_email: str
    shipping_address: str
    total: float
    status: str
    items: list[OrderItemResponse]
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Generic paginated response wrapper.
    Used as PaginatedResponse[ProductResponse], etc.
    """

    items: list[T]
    total: int
    page: int
    per_page: int
```

---

## 10. app/repositories/__init__.py

```python
"""Repository layer -- data access objects."""
```

---

## 11. app/repositories/product_repository.py

```python
"""Data access for the products table."""

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Product


class ProductRepository:
    """
    Encapsulates all database operations on the products table.
    Each instance is scoped to a single AsyncSession (one per request).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_all(
        self,
        search: Optional[str],
        category: Optional[str],
        offset: int,
        limit: int,
    ) -> tuple[list[Product], int]:
        """
        Query products with optional filters and pagination.

        Args:
            search:   If provided, filters products whose name contains this string
                      (case-insensitive, using SQL ILIKE with wildcards on both sides).
            category: If provided, filters products with an exact category match
                      (case-insensitive comparison).
            offset:   Number of rows to skip (for pagination).
            limit:    Maximum number of rows to return.

        Returns:
            A tuple of (list_of_products, total_count).
            total_count is the count of ALL matching products (ignoring offset/limit),
            used for pagination metadata.

        Implementation:
            1. Build a base SELECT query on the Product model.
            2. If `search` is not None, append a WHERE clause:
                   Product.name.ilike(f"%{search}%")
            3. If `category` is not None, append a WHERE clause:
                   func.lower(Product.category) == category.lower()
            4. Clone the filtered query for counting:
                   count_query = select(func.count()).select_from(filtered_query.subquery())
            5. Execute count_query to get total_count.
            6. Add .order_by(Product.id) to the filtered query for deterministic ordering.
            7. Add .offset(offset).limit(limit).
            8. Execute and return (results, total_count).
        """
        ...

    async def get_by_id(self, product_id: int) -> Optional[Product]:
        """
        Get a single product by its primary key.

        Args:
            product_id: The integer ID of the product.

        Returns:
            The Product ORM instance, or None if not found.

        Implementation:
            result = await self._session.get(Product, product_id)
            return result
        """
        ...

    async def update_stock(self, product_id: int, delta: int) -> None:
        """
        Decrease the stock of a product by `delta`.

        Args:
            product_id: The product whose stock to decrease.
            delta:      The positive integer amount to subtract from stock.

        Raises:
            ValueError: If the product does not exist, or if current stock < delta.

        Implementation:
            1. Fetch the product using get_by_id. If None, raise ValueError("Product not found").
            2. If product.stock < delta, raise ValueError("Insufficient stock").
            3. product.stock -= delta
            4. self._session.add(product)
            5. await self._session.flush()
               (flush but do NOT commit -- let the caller/service handle transaction boundaries)
        """
        ...

    async def get_categories(self) -> list[str]:
        """
        Get all distinct non-null category values from the products table.

        Returns:
            A sorted list of unique category strings.

        Implementation:
            query = select(Product.category).where(Product.category.isnot(None)).distinct()
            result = await self._session.execute(query)
            categories = sorted([row[0] for row in result.all()])
            return categories
        """
        ...
```

---

## 12. app/repositories/cart_repository.py

```python
"""Data access for the cart_items table."""

from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.orm import CartItem


class CartRepository:
    """
    Encapsulates all database operations on the cart_items table.
    Cart items are identified by session_id (opaque string, typically a UUID).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_items(self, session_id: str) -> list[CartItem]:
        """
        Get all cart items for a given session, with eagerly loaded Product relation.

        Args:
            session_id: The session identifier string.

        Returns:
            List of CartItem instances with .product populated.

        Implementation:
            query = (
                select(CartItem)
                .options(joinedload(CartItem.product))
                .where(CartItem.session_id == session_id)
                .order_by(CartItem.created_at)
            )
            result = await self._session.execute(query)
            return list(result.scalars().unique().all())
        """
        ...

    async def add_item(
        self, session_id: str, product_id: int, quantity: int
    ) -> CartItem:
        """
        Add an item to the cart. If the same (session_id, product_id) already exists,
        increment the existing quantity by the given amount (upsert).

        Args:
            session_id: The session identifier.
            product_id: The product to add.
            quantity:   How many to add.

        Returns:
            The resulting CartItem (either newly created or updated).

        Implementation:
            Uses PostgreSQL INSERT ... ON CONFLICT ... DO UPDATE (via sqlalchemy
            dialects.postgresql.insert):

            1. Build an insert statement:
                   stmt = pg_insert(CartItem).values(
                       session_id=session_id,
                       product_id=product_id,
                       quantity=quantity,
                   )
            2. Add on_conflict_do_update targeting the unique constraint "uq_cart_session_product":
                   stmt = stmt.on_conflict_do_update(
                       constraint="uq_cart_session_product",
                       set_={"quantity": CartItem.quantity + stmt.excluded.quantity},
                   )
            3. Add .returning(CartItem) to get the result row back.
            4. Execute and fetch the resulting CartItem.
            5. Flush the session.
            6. Reload the CartItem with its product relationship (use session.get with
               options=[joinedload(CartItem.product)] or re-query).
            7. Return the CartItem.

            Note: An alternative simpler approach is:
            1. Query for existing CartItem matching (session_id, product_id).
            2. If found, increment quantity and flush.
            3. If not found, create a new CartItem, add to session, flush.
            4. Refresh to load the product relationship.
            Either approach is acceptable. The ON CONFLICT approach is more robust
            against race conditions.
        """
        ...

    async def update_quantity(
        self, item_id: int, session_id: str, quantity: int
    ) -> Optional[CartItem]:
        """
        Update the quantity of a specific cart item.

        Args:
            item_id:    The cart item's primary key.
            session_id: The session (for authorization -- ensure the item belongs to this session).
            quantity:   The new absolute quantity value.

        Returns:
            The updated CartItem, or None if the item was not found or does not
            belong to this session.

        Implementation:
            1. Query CartItem where id == item_id AND session_id == session_id.
            2. If not found, return None.
            3. Set cart_item.quantity = quantity.
            4. Flush.
            5. Refresh to load the product relationship.
            6. Return the cart_item.
        """
        ...

    async def remove_item(self, item_id: int, session_id: str) -> bool:
        """
        Delete a specific cart item.

        Args:
            item_id:    The cart item's primary key.
            session_id: The session (for authorization).

        Returns:
            True if the item was found and deleted, False otherwise.

        Implementation:
            stmt = (
                delete(CartItem)
                .where(CartItem.id == item_id)
                .where(CartItem.session_id == session_id)
            )
            result = await self._session.execute(stmt)
            return result.rowcount > 0
        """
        ...

    async def clear_cart(self, session_id: str) -> None:
        """
        Remove ALL items from a session's cart. Called after successful checkout.

        Args:
            session_id: The session identifier.

        Implementation:
            stmt = delete(CartItem).where(CartItem.session_id == session_id)
            await self._session.execute(stmt)
        """
        ...
```

---

## 13. app/repositories/order_repository.py

```python
"""Data access for the orders and order_items tables."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.orm import Order, OrderItem


class OrderRepository:
    """
    Encapsulates database operations for orders and their line items.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, order: Order) -> Order:
        """
        Insert a new order along with its order_items into the database.

        Args:
            order: A fully populated Order ORM instance. Its `items` relationship
                   should already contain the OrderItem instances to be persisted.

        Returns:
            The same Order instance, now with its `id` and `created_at` populated
            by the database.

        Implementation:
            1. self._session.add(order)
               (This cascades and also adds all OrderItem instances in order.items)
            2. await self._session.flush()
               (Generates the INSERT statements and populates server-generated fields)
            3. await self._session.refresh(order)
               (Reload the order to pick up server defaults like created_at)
            4. Return order.

        Note: The caller (OrderService) is responsible for calling session.commit()
        after all related operations (stock updates, cart clearing) are complete.
        """
        ...

    async def get_by_id(self, order_id: int) -> Optional[Order]:
        """
        Retrieve an order by its primary key, with all order items and their
        products eagerly loaded.

        Args:
            order_id: The integer ID of the order.

        Returns:
            The Order instance with items and products loaded, or None if not found.

        Implementation:
            query = (
                select(Order)
                .options(
                    joinedload(Order.items).joinedload(OrderItem.product)
                )
                .where(Order.id == order_id)
            )
            result = await self._session.execute(query)
            return result.scalars().unique().one_or_none()
        """
        ...
```

---

## 14. app/services/__init__.py

```python
"""Service layer -- business logic."""
```

---

## 15. app/services/product_service.py

```python
"""Business logic for products."""

from fastapi import HTTPException, status

from app.models.schemas import PaginatedResponse, ProductListParams, ProductResponse
from app.repositories.product_repository import ProductRepository


class ProductService:
    """
    Product business logic. Translates between repository results and API responses.
    """

    def __init__(self, repo: ProductRepository) -> None:
        self._repo = repo

    async def list_products(
        self, params: ProductListParams
    ) -> PaginatedResponse[ProductResponse]:
        """
        List products with pagination, optional search, and category filter.

        Args:
            params: A ProductListParams instance containing search, category, page, per_page.

        Returns:
            A PaginatedResponse[ProductResponse] with items, total, page, per_page.

        Implementation:
            1. Compute offset = (params.page - 1) * params.per_page.
            2. Call self._repo.get_all(
                   search=params.search,
                   category=params.category,
                   offset=offset,
                   limit=params.per_page,
               )
               This returns (products, total_count).
            3. Convert each Product ORM instance to ProductResponse using
               ProductResponse.model_validate(product).
            4. Return PaginatedResponse(
                   items=product_responses,
                   total=total_count,
                   page=params.page,
                   per_page=params.per_page,
               )
        """
        ...

    async def get_product(self, product_id: int) -> ProductResponse:
        """
        Get a single product by ID.

        Args:
            product_id: The product's integer ID.

        Returns:
            A ProductResponse.

        Raises:
            HTTPException(404): If the product is not found.

        Implementation:
            1. product = await self._repo.get_by_id(product_id)
            2. If product is None:
                   raise HTTPException(
                       status_code=status.HTTP_404_NOT_FOUND,
                       detail=f"Product {product_id} not found",
                   )
            3. Return ProductResponse.model_validate(product)
        """
        ...

    async def get_categories(self) -> list[str]:
        """
        Get all distinct product categories.

        Returns:
            A sorted list of category strings.

        Implementation:
            return await self._repo.get_categories()
        """
        ...
```

---

## 16. app/services/cart_service.py

```python
"""Business logic for the shopping cart."""

from decimal import Decimal

from fastapi import HTTPException, status

from app.models.schemas import (
    CartAddRequest,
    CartItemResponse,
    CartResponse,
    CartUpdateRequest,
)
from app.repositories.cart_repository import CartRepository
from app.repositories.product_repository import ProductRepository


class CartService:
    """
    Cart business logic. Validates product availability, computes totals.
    """

    def __init__(
        self,
        cart_repo: CartRepository,
        product_repo: ProductRepository,
    ) -> None:
        self._cart_repo = cart_repo
        self._product_repo = product_repo

    async def get_cart(self, session_id: str) -> CartResponse:
        """
        Get the current cart for a session, with computed total and item count.

        Args:
            session_id: The session identifier.

        Returns:
            CartResponse with items, total, item_count.

        Implementation:
            1. items = await self._cart_repo.get_items(session_id)
            2. Convert each CartItem to CartItemResponse via model_validate.
            3. Compute total = sum(item.quantity * float(item.product.price) for item in items)
            4. Compute item_count = sum(item.quantity for item in items)
            5. Return CartResponse(items=item_responses, total=total, item_count=item_count)
        """
        ...

    async def add_to_cart(
        self, session_id: str, request: CartAddRequest
    ) -> CartItemResponse:
        """
        Add a product to the cart. Validates that the product exists and has
        sufficient stock.

        Args:
            session_id: The session identifier.
            request:    CartAddRequest with product_id and quantity.

        Returns:
            CartItemResponse for the newly added/updated cart item.

        Raises:
            HTTPException(404): If the product does not exist.
            HTTPException(400): If the product does not have enough stock.

        Implementation:
            1. product = await self._product_repo.get_by_id(request.product_id)
            2. If product is None:
                   raise HTTPException(404, detail="Product not found")
            3. If product.stock < request.quantity:
                   raise HTTPException(400, detail="Insufficient stock")
            4. cart_item = await self._cart_repo.add_item(
                   session_id, request.product_id, request.quantity
               )
            5. Return CartItemResponse.model_validate(cart_item)
        """
        ...

    async def update_item(
        self, session_id: str, item_id: int, request: CartUpdateRequest
    ) -> CartItemResponse:
        """
        Update the quantity of a cart item.

        Args:
            session_id: The session identifier.
            item_id:    The cart item's primary key.
            request:    CartUpdateRequest with the new quantity.

        Returns:
            CartItemResponse for the updated item.

        Raises:
            HTTPException(404): If the cart item is not found or does not belong
                                to this session.

        Implementation:
            1. cart_item = await self._cart_repo.update_quantity(
                   item_id, session_id, request.quantity
               )
            2. If cart_item is None:
                   raise HTTPException(404, detail="Cart item not found")
            3. Return CartItemResponse.model_validate(cart_item)
        """
        ...

    async def remove_item(self, session_id: str, item_id: int) -> None:
        """
        Remove an item from the cart.

        Args:
            session_id: The session identifier.
            item_id:    The cart item's primary key.

        Raises:
            HTTPException(404): If the cart item is not found or does not belong
                                to this session.

        Implementation:
            1. deleted = await self._cart_repo.remove_item(item_id, session_id)
            2. If not deleted:
                   raise HTTPException(404, detail="Cart item not found")
        """
        ...
```

---

## 17. app/services/order_service.py

```python
"""Business logic for order creation and retrieval."""

from decimal import Decimal

from fastapi import HTTPException, status

from app.models.orm import Order, OrderItem
from app.models.schemas import OrderCreateRequest, OrderResponse
from app.repositories.cart_repository import CartRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository


class OrderService:
    """
    Order business logic. Handles the checkout flow:
    cart items -> order with stock decrements and cart clearing.
    """

    def __init__(
        self,
        order_repo: OrderRepository,
        cart_repo: CartRepository,
        product_repo: ProductRepository,
    ) -> None:
        self._order_repo = order_repo
        self._cart_repo = cart_repo
        self._product_repo = product_repo

    async def create_order(
        self, session_id: str, request: OrderCreateRequest
    ) -> OrderResponse:
        """
        Create an order from the current cart contents.

        This is the checkout operation. All steps happen within a single database
        transaction (the AsyncSession is not committed until the end, and if any
        step fails, all changes are rolled back).

        Args:
            session_id: The session identifier (identifies the cart).
            request:    OrderCreateRequest with customer_name, customer_email,
                        shipping_address.

        Returns:
            OrderResponse for the newly created order.

        Raises:
            HTTPException(400): If the cart is empty.
            HTTPException(400): If any product has insufficient stock.

        Implementation (ALL within one transaction):
            1. Fetch cart items:
                   cart_items = await self._cart_repo.get_items(session_id)
            2. Validate cart is not empty:
                   if not cart_items:
                       raise HTTPException(400, detail="Cart is empty")
            3. Build OrderItem list and compute total:
                   order_items = []
                   total = Decimal("0")
                   for cart_item in cart_items:
                       unit_price = cart_item.product.price
                       line_total = unit_price * cart_item.quantity
                       total += line_total
                       order_items.append(
                           OrderItem(
                               product_id=cart_item.product_id,
                               quantity=cart_item.quantity,
                               unit_price=unit_price,
                           )
                       )
            4. Decrease product stock for each cart item:
                   for cart_item in cart_items:
                       await self._product_repo.update_stock(
                           cart_item.product_id, cart_item.quantity
                       )
               If update_stock raises ValueError (insufficient stock), catch it
               and re-raise as HTTPException(400, detail=str(e)).
            5. Create the Order:
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
            6. Clear the cart:
                   await self._cart_repo.clear_cart(session_id)
            7. Convert and return:
                   return OrderResponse.model_validate(order)

        Transaction note: The session.commit() is NOT called here. It is called by
        the dependency injection layer (get_db context manager) after the controller
        returns successfully. If any exception propagates, the session is rolled back.
        """
        ...

    async def get_order(self, order_id: int) -> OrderResponse:
        """
        Retrieve an order by ID.

        Args:
            order_id: The order's integer ID.

        Returns:
            OrderResponse.

        Raises:
            HTTPException(404): If the order is not found.

        Implementation:
            1. order = await self._order_repo.get_by_id(order_id)
            2. If order is None:
                   raise HTTPException(404, detail=f"Order {order_id} not found")
            3. Return OrderResponse.model_validate(order)
        """
        ...
```

---

## 18. app/core/__init__.py

```python
"""Core infrastructure: database, dependency injection."""
```

---

## 19. app/core/dependencies.py

This is the dependency injection hub. FastAPI's `Depends()` system wires everything together.

```python
"""FastAPI dependency injection for sessions, services, and session_id extraction."""

import uuid
from typing import AsyncGenerator

from fastapi import Cookie, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import async_session_factory
from app.repositories.cart_repository import CartRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository
from app.services.cart_service import CartService
from app.services.order_service import OrderService
from app.services.product_service import ProductService


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an AsyncSession for the duration of one request.

    On successful completion (no exception), the session is committed.
    On exception, the session is rolled back.
    The session is always closed at the end.

    Usage in controllers:
        async def my_endpoint(db: AsyncSession = Depends(get_db)):
            ...

    Implementation:
        async with async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    """
    ...


async def get_session_id(
    request: Request,
    response: Response,
    session_id: str | None = Cookie(default=None, alias="session_id"),
) -> str:
    """
    Extract the session_id from the request cookie. If no cookie is present,
    generate a new UUID4 string and set it as a cookie on the response.

    This provides anonymous cart tracking without requiring user authentication.

    Args:
        request:    The FastAPI Request object.
        response:   The FastAPI Response object (used to set the cookie).
        session_id: The value of the "session_id" cookie, or None if not present.

    Returns:
        The session_id string (either from the existing cookie or newly generated).

    Implementation:
        if session_id is None:
            session_id = str(uuid.uuid4())
            response.set_cookie(
                key=settings.SESSION_COOKIE_NAME,
                value=session_id,
                max_age=settings.SESSION_COOKIE_MAX_AGE,
                httponly=True,
                samesite="lax",
            )
        return session_id
    """
    ...


# ──────────────────────────────────────────────
# Service dependency factories
# ──────────────────────────────────────────────


async def get_product_repository(
    db: AsyncSession = Depends(get_db),
) -> ProductRepository:
    """Create a ProductRepository scoped to the current request's DB session."""
    return ProductRepository(db)


async def get_cart_repository(
    db: AsyncSession = Depends(get_db),
) -> CartRepository:
    """Create a CartRepository scoped to the current request's DB session."""
    return CartRepository(db)


async def get_order_repository(
    db: AsyncSession = Depends(get_db),
) -> OrderRepository:
    """Create an OrderRepository scoped to the current request's DB session."""
    return OrderRepository(db)


async def get_product_service(
    repo: ProductRepository = Depends(get_product_repository),
) -> ProductService:
    """Create a ProductService with its repository dependency."""
    return ProductService(repo)


async def get_cart_service(
    cart_repo: CartRepository = Depends(get_cart_repository),
    product_repo: ProductRepository = Depends(get_product_repository),
) -> CartService:
    """Create a CartService with both cart and product repositories."""
    return CartService(cart_repo, product_repo)


async def get_order_service(
    order_repo: OrderRepository = Depends(get_order_repository),
    cart_repo: CartRepository = Depends(get_cart_repository),
    product_repo: ProductRepository = Depends(get_product_repository),
) -> OrderService:
    """Create an OrderService with all three repositories."""
    return OrderService(order_repo, cart_repo, product_repo)
```

### IMPORTANT: Shared Session Problem

The above dependency injection has a subtle issue: `get_cart_service` depends on both `get_cart_repository` and `get_product_repository`, each of which depends on `get_db`. By default, FastAPI will call `get_db` **twice**, creating **two separate sessions**. This breaks transactional consistency.

**Fix**: All repositories within a single request must share the same `AsyncSession`. FastAPI's `Depends()` caching handles this automatically because `get_db` is the same callable -- FastAPI caches the result of a dependency within a single request. So both `get_cart_repository` and `get_product_repository` will receive the **same** `AsyncSession` instance.

This is correct behavior because FastAPI's dependency injection system caches dependencies by their callable identity within a single request scope. No additional code is needed.

---

## 20. app/controllers/__init__.py

```python
"""Controller layer -- FastAPI route handlers."""
```

---

## 21. app/controllers/product_controller.py

```python
"""Product API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_product_service
from app.models.schemas import PaginatedResponse, ProductListParams, ProductResponse
from app.services.product_service import ProductService

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    search: Optional[str] = Query(default=None, max_length=200),
    category: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    service: ProductService = Depends(get_product_service),
) -> PaginatedResponse[ProductResponse]:
    """
    List products with optional search, category filter, and pagination.

    Query parameters:
        - search: case-insensitive substring match on product name
        - category: exact category filter
        - page: 1-based page number (default 1)
        - per_page: items per page, 1-100 (default 20)

    Returns:
        PaginatedResponse containing ProductResponse items, total count,
        page, and per_page.

    Implementation:
        params = ProductListParams(
            search=search, category=category, page=page, per_page=per_page
        )
        return await service.list_products(params)
    """
    ...


@router.get("/categories", response_model=list[str])
async def list_categories(
    service: ProductService = Depends(get_product_service),
) -> list[str]:
    """
    Get all distinct product categories.

    Returns:
        A sorted list of category name strings.

    Implementation:
        return await service.get_categories()
    """
    ...


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    service: ProductService = Depends(get_product_service),
) -> ProductResponse:
    """
    Get a single product by ID.

    Path parameters:
        - product_id: integer product ID

    Returns:
        ProductResponse

    Raises:
        HTTPException(404) if not found (raised by service layer)

    Implementation:
        return await service.get_product(product_id)
    """
    ...
```

### Route ordering note

The `/categories` route MUST be defined BEFORE `/{product_id}`. Otherwise, FastAPI will try to parse "categories" as an integer product_id and return a validation error.

---

## 22. app/controllers/cart_controller.py

```python
"""Cart API endpoints."""

from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_cart_service, get_session_id
from app.models.schemas import (
    CartAddRequest,
    CartItemResponse,
    CartResponse,
    CartUpdateRequest,
)
from app.services.cart_service import CartService

router = APIRouter(prefix="/api/cart", tags=["cart"])


@router.get("/", response_model=CartResponse)
async def get_cart(
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
) -> CartResponse:
    """
    Get the current cart for this session.

    The session_id is extracted from the "session_id" cookie. If no cookie
    exists, a new UUID is generated and set as a cookie.

    Returns:
        CartResponse with items list, total price, and item count.

    Implementation:
        return await service.get_cart(session_id)
    """
    ...


@router.post("/", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    request: CartAddRequest,
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
) -> CartItemResponse:
    """
    Add a product to the cart.

    Request body:
        - product_id: int (required)
        - quantity: int (default 1, must be >= 1)

    Returns:
        CartItemResponse for the added/updated item (201 Created).

    Raises:
        HTTPException(404) if product not found
        HTTPException(400) if insufficient stock

    Implementation:
        return await service.add_to_cart(session_id, request)
    """
    ...


@router.put("/{item_id}", response_model=CartItemResponse)
async def update_cart_item(
    item_id: int,
    request: CartUpdateRequest,
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
) -> CartItemResponse:
    """
    Update the quantity of a cart item.

    Path parameters:
        - item_id: the cart item's primary key

    Request body:
        - quantity: int (must be >= 1)

    Returns:
        CartItemResponse for the updated item.

    Raises:
        HTTPException(404) if cart item not found or doesn't belong to this session

    Implementation:
        return await service.update_item(session_id, item_id, request)
    """
    ...


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_cart_item(
    item_id: int,
    session_id: str = Depends(get_session_id),
    service: CartService = Depends(get_cart_service),
) -> None:
    """
    Remove an item from the cart.

    Path parameters:
        - item_id: the cart item's primary key

    Returns:
        204 No Content on success.

    Raises:
        HTTPException(404) if cart item not found or doesn't belong to this session

    Implementation:
        await service.remove_item(session_id, item_id)
    """
    ...
```

---

## 23. app/controllers/order_controller.py

```python
"""Order API endpoints."""

from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_order_service, get_session_id
from app.models.schemas import OrderCreateRequest, OrderResponse
from app.services.order_service import OrderService

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    request: OrderCreateRequest,
    session_id: str = Depends(get_session_id),
    service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    """
    Create an order from the current cart (checkout).

    This endpoint:
    1. Reads all items from the session's cart
    2. Validates stock availability for each item
    3. Decrements product stock
    4. Creates the order with order items
    5. Clears the cart
    All within a single database transaction.

    Request body:
        - customer_name: str (required)
        - customer_email: EmailStr (required, validated)
        - shipping_address: str (required)

    Returns:
        OrderResponse with full order details (201 Created).

    Raises:
        HTTPException(400) if cart is empty
        HTTPException(400) if any product has insufficient stock

    Implementation:
        return await service.create_order(session_id, request)
    """
    ...


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    """
    Retrieve an order by ID.

    Path parameters:
        - order_id: integer order ID

    Returns:
        OrderResponse with all order items and product details.

    Raises:
        HTTPException(404) if order not found

    Implementation:
        return await service.get_order(order_id)
    """
    ...
```

---

## 24. app/main.py

The FastAPI application entry point with lifespan management.

```python
"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.controllers.cart_controller import router as cart_router
from app.controllers.order_controller import router as order_router
from app.controllers.product_controller import router as product_router
from app.core.database import engine
from app.utils.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Startup:
        1. Configure structured JSON logging via setup_logging().
        2. Log that the application has started.

    Shutdown:
        1. Dispose the SQLAlchemy async engine (closes all pooled connections).
        2. Log that the application has shut down.
    """
    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info("Store backend starting up")
    yield
    await engine.dispose()
    logger.info("Store backend shut down")


app = FastAPI(
    title="Store Backend API",
    description="Legitimate e-commerce store API serving product catalog, cart, and orders.",
    version="1.0.0",
    lifespan=lifespan,
)

# ──────────────────────────────────────────────
# CORS Middleware
# ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # In production, restrict to your frontend domain
    allow_credentials=True,       # Required for cookies (session_id)
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Include Routers
# ──────────────────────────────────────────────
app.include_router(product_router)
app.include_router(cart_router)
app.include_router(order_router)


# ──────────────────────────────────────────────
# Health Check Endpoint
# ──────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint that verifies database connectivity.

    Returns:
        {"status": "healthy"} if the DB is reachable.
        {"status": "unhealthy", "detail": "..."} with status 503 if DB is unreachable.

    Implementation:
        from fastapi.responses import JSONResponse
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return {"status": "healthy"}
        except Exception as e:
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy", "detail": str(e)},
            )
    """
    from fastapi.responses import JSONResponse

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "healthy"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "detail": str(e)},
        )
```

### CORS notes

- `allow_credentials=True` is essential because the cart system relies on cookies (`session_id`). Without this, browsers will not send or accept cookies on cross-origin requests.
- `allow_origins=["*"]` combined with `allow_credentials=True` is technically non-compliant with the CORS spec (browsers reject `*` with credentials). In production, replace `"*"` with the actual frontend origin(s). For development/internal use within a Kubernetes cluster this is acceptable.

---

## 25. app/utils/__init__.py

```python
"""Utility modules."""
```

---

## 26. app/utils/logging.py

```python
"""Structured JSON logging configuration."""

import logging
import sys

from pythonjsonlogger import jsonlogger

from app.config import settings


def setup_logging() -> None:
    """
    Configure the root logger to output structured JSON to stdout.

    This uses python-json-logger to format log records as JSON objects,
    which is ideal for log aggregation systems (ELK, Datadog, etc.).

    Each log line will contain:
        - timestamp: ISO 8601 format
        - level: log level name (INFO, ERROR, etc.)
        - name: logger name (module path)
        - message: the log message
        - Any extra fields passed via logger.info("msg", extra={...})

    Implementation:
        1. Create a StreamHandler writing to sys.stdout.
        2. Create a JsonFormatter with format string:
               "%(asctime)s %(levelname)s %(name)s %(message)s"
           and set datefmt to ISO 8601 format.
        3. Set the formatter on the handler.
        4. Get the root logger, set its level to settings.LOG_LEVEL,
           clear any existing handlers, and add the new handler.
    """
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(settings.LOG_LEVEL)
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
```

---

## 27. app/seed/__init__.py

```python
"""Database seeding utilities."""
```

---

## 28. app/seed/seed_data.py

This module populates the products table with sample data. It is idempotent -- if products already exist, it skips seeding.

Run as: `python -m app.seed.seed_data`

```python
"""Seed the products table with sample data. Idempotent -- skips if products exist."""

import asyncio
import logging
from decimal import Decimal

from sqlalchemy import func, select

from app.core.database import async_session_factory, engine
from app.models.orm import Base, Product

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Sample product data
# ──────────────────────────────────────────────
PRODUCTS = [
    # Electronics
    {
        "name": "Wireless Bluetooth Headphones",
        "description": "Premium over-ear headphones with active noise cancellation, 30-hour battery life, and comfortable memory foam ear cushions.",
        "price": Decimal("79.99"),
        "image_url": "https://placehold.co/400x400?text=Headphones",
        "category": "Electronics",
        "stock": 150,
    },
    {
        "name": "USB-C Fast Charger 65W",
        "description": "Compact GaN charger with USB-C PD 3.0 support. Compatible with laptops, tablets, and smartphones.",
        "price": Decimal("34.99"),
        "image_url": "https://placehold.co/400x400?text=Charger",
        "category": "Electronics",
        "stock": 300,
    },
    {
        "name": "Mechanical Keyboard RGB",
        "description": "Full-size mechanical keyboard with Cherry MX Blue switches, per-key RGB lighting, and detachable USB-C cable.",
        "price": Decimal("89.99"),
        "image_url": "https://placehold.co/400x400?text=Keyboard",
        "category": "Electronics",
        "stock": 85,
    },
    {
        "name": "Portable Bluetooth Speaker",
        "description": "Waterproof IPX7 portable speaker with 360-degree sound and 12-hour playtime.",
        "price": Decimal("49.99"),
        "image_url": "https://placehold.co/400x400?text=Speaker",
        "category": "Electronics",
        "stock": 200,
    },
    {
        "name": "Wireless Mouse Ergonomic",
        "description": "Ergonomic vertical mouse with adjustable DPI (800-2400), Bluetooth and 2.4GHz dual mode.",
        "price": Decimal("29.99"),
        "image_url": "https://placehold.co/400x400?text=Mouse",
        "category": "Electronics",
        "stock": 250,
    },
    {
        "name": "4K Webcam with Ring Light",
        "description": "Ultra HD webcam with built-in ring light, auto-focus, and noise-canceling microphone.",
        "price": Decimal("69.99"),
        "image_url": "https://placehold.co/400x400?text=Webcam",
        "category": "Electronics",
        "stock": 120,
    },
    # Clothing
    {
        "name": "Classic Cotton T-Shirt",
        "description": "100% organic cotton crew neck t-shirt. Pre-shrunk, comfortable fit. Available in multiple colors.",
        "price": Decimal("19.99"),
        "image_url": "https://placehold.co/400x400?text=T-Shirt",
        "category": "Clothing",
        "stock": 500,
    },
    {
        "name": "Slim Fit Denim Jeans",
        "description": "Stretch denim jeans with modern slim fit. Mid-rise waist, 5-pocket styling.",
        "price": Decimal("49.99"),
        "image_url": "https://placehold.co/400x400?text=Jeans",
        "category": "Clothing",
        "stock": 200,
    },
    {
        "name": "Lightweight Running Jacket",
        "description": "Water-resistant running jacket with reflective details, mesh ventilation, and zippered pockets.",
        "price": Decimal("64.99"),
        "image_url": "https://placehold.co/400x400?text=Jacket",
        "category": "Clothing",
        "stock": 100,
    },
    {
        "name": "Wool Blend Beanie",
        "description": "Soft wool blend knit beanie with fleece lining. One size fits most.",
        "price": Decimal("14.99"),
        "image_url": "https://placehold.co/400x400?text=Beanie",
        "category": "Clothing",
        "stock": 350,
    },
    {
        "name": "Canvas Sneakers",
        "description": "Classic low-top canvas sneakers with vulcanized rubber sole. Lightweight and breathable.",
        "price": Decimal("39.99"),
        "image_url": "https://placehold.co/400x400?text=Sneakers",
        "category": "Clothing",
        "stock": 180,
    },
    # Books
    {
        "name": "Python Crash Course",
        "description": "A hands-on, project-based introduction to programming. Covers fundamentals, data visualization, and web applications.",
        "price": Decimal("29.99"),
        "image_url": "https://placehold.co/400x400?text=Python+Book",
        "category": "Books",
        "stock": 75,
    },
    {
        "name": "Clean Code",
        "description": "A handbook of agile software craftsmanship by Robert C. Martin. Essential reading for software developers.",
        "price": Decimal("34.99"),
        "image_url": "https://placehold.co/400x400?text=Clean+Code",
        "category": "Books",
        "stock": 60,
    },
    {
        "name": "Designing Data-Intensive Applications",
        "description": "The big ideas behind reliable, scalable, and maintainable systems by Martin Kleppmann.",
        "price": Decimal("44.99"),
        "image_url": "https://placehold.co/400x400?text=DDIA",
        "category": "Books",
        "stock": 45,
    },
    {
        "name": "The Pragmatic Programmer",
        "description": "Your journey to mastery. 20th anniversary edition with updated content and new topics.",
        "price": Decimal("39.99"),
        "image_url": "https://placehold.co/400x400?text=Pragmatic",
        "category": "Books",
        "stock": 55,
    },
    # Home & Kitchen
    {
        "name": "Stainless Steel Water Bottle",
        "description": "Double-wall vacuum insulated, 32oz capacity. Keeps drinks cold 24 hours or hot 12 hours.",
        "price": Decimal("24.99"),
        "image_url": "https://placehold.co/400x400?text=Water+Bottle",
        "category": "Home & Kitchen",
        "stock": 400,
    },
    {
        "name": "Ceramic Coffee Mug Set",
        "description": "Set of 4 handcrafted ceramic mugs, 12oz each. Microwave and dishwasher safe.",
        "price": Decimal("32.99"),
        "image_url": "https://placehold.co/400x400?text=Mugs",
        "category": "Home & Kitchen",
        "stock": 150,
    },
    {
        "name": "Bamboo Cutting Board",
        "description": "Large premium bamboo cutting board (18x12 inches) with juice groove and handle cutouts.",
        "price": Decimal("22.99"),
        "image_url": "https://placehold.co/400x400?text=Cutting+Board",
        "category": "Home & Kitchen",
        "stock": 180,
    },
    {
        "name": "LED Desk Lamp",
        "description": "Adjustable LED desk lamp with 5 color temperatures, 7 brightness levels, USB charging port, and memory function.",
        "price": Decimal("36.99"),
        "image_url": "https://placehold.co/400x400?text=Desk+Lamp",
        "category": "Home & Kitchen",
        "stock": 130,
    },
    {
        "name": "Cast Iron Skillet 12 inch",
        "description": "Pre-seasoned cast iron skillet. Excellent heat retention. Oven safe up to 500F.",
        "price": Decimal("29.99"),
        "image_url": "https://placehold.co/400x400?text=Skillet",
        "category": "Home & Kitchen",
        "stock": 90,
    },
    # Sports
    {
        "name": "Yoga Mat Premium",
        "description": "Extra thick (6mm) non-slip yoga mat with alignment lines. Includes carrying strap.",
        "price": Decimal("27.99"),
        "image_url": "https://placehold.co/400x400?text=Yoga+Mat",
        "category": "Sports",
        "stock": 200,
    },
    {
        "name": "Resistance Bands Set",
        "description": "Set of 5 resistance bands (light to extra heavy) with door anchor, ankle straps, and carrying bag.",
        "price": Decimal("19.99"),
        "image_url": "https://placehold.co/400x400?text=Bands",
        "category": "Sports",
        "stock": 300,
    },
    {
        "name": "Adjustable Dumbbell Pair",
        "description": "Adjustable dumbbells ranging from 5 to 25 lbs each. Quick-change weight system.",
        "price": Decimal("129.99"),
        "image_url": "https://placehold.co/400x400?text=Dumbbells",
        "category": "Sports",
        "stock": 50,
    },
    {
        "name": "Running Armband Phone Holder",
        "description": "Sweatproof armband for phones up to 6.7 inches. Reflective strip, key pocket, headphone port.",
        "price": Decimal("12.99"),
        "image_url": "https://placehold.co/400x400?text=Armband",
        "category": "Sports",
        "stock": 400,
    },
    {
        "name": "Foam Roller Muscle Recovery",
        "description": "High-density foam roller (18 inches) for deep tissue massage, muscle recovery, and flexibility.",
        "price": Decimal("18.99"),
        "image_url": "https://placehold.co/400x400?text=Foam+Roller",
        "category": "Sports",
        "stock": 220,
    },
]


async def seed_products() -> None:
    """
    Insert sample products into the database if the products table is empty.

    This function is idempotent:
    - If the products table already contains rows, it prints a message and returns.
    - If the table is empty, it inserts all products from the PRODUCTS list.

    Implementation:
        1. Open an async session.
        2. Count existing products: SELECT COUNT(*) FROM products.
        3. If count > 0, log "Products already seeded" and return.
        4. For each dict in PRODUCTS, create a Product ORM instance and add to session.
        5. Commit the session.
        6. Log the number of products seeded.
    """
    async with async_session_factory() as session:
        result = await session.execute(select(func.count()).select_from(Product))
        count = result.scalar_one()

        if count > 0:
            print(f"Products table already has {count} rows, skipping seed.")
            return

        for product_data in PRODUCTS:
            product = Product(**product_data)
            session.add(product)

        await session.commit()
        print(f"Seeded {len(PRODUCTS)} products successfully.")


def main() -> None:
    """Entry point for running as a module: python -m app.seed.seed_data"""
    asyncio.run(seed_products())


if __name__ == "__main__":
    main()
```

### Product data summary

| Category | Count | Price Range |
|---|---|---|
| Electronics | 6 | $29.99 -- $89.99 |
| Clothing | 5 | $14.99 -- $64.99 |
| Books | 4 | $29.99 -- $44.99 |
| Home & Kitchen | 5 | $22.99 -- $36.99 |
| Sports | 5 | $12.99 -- $129.99 |
| **Total** | **25** | **$12.99 -- $129.99** |

---

## 29. alembic.ini

```ini
[alembic]
script_location = alembic
# The sqlalchemy.url is overridden in env.py to use the async URL from settings.
# This placeholder is required by Alembic's config parser but is not used.
sqlalchemy.url = placeholder

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

---

## 30. alembic/env.py

Async migration environment for Alembic with asyncpg.

```python
"""Alembic async migration environment."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.core.database import Base

# Import all models so Base.metadata knows about them
import app.models.orm  # noqa: F401

# Alembic Config object
config = context.config

# Set the SQLAlchemy URL from application settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine.
    Calls to context.execute() will emit the given string to the script output.

    Implementation:
        url = config.get_main_option("sqlalchemy.url")
        context.configure(
            url=url,
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
        )
        with context.begin_transaction():
            context.run_migrations()
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """
    Helper to configure context and run migrations synchronously on a connection.
    """
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    Create an async engine and run migrations in async mode.

    Implementation:
        connectable = async_engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)
        await connectable.dispose()
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode using an async engine.
    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

## 31. alembic/versions/001_initial.py

The initial migration that creates all four tables.

```python
"""001 - Create initial tables: products, cart_items, orders, order_items.

Revision ID: 001_initial
Revises: None
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# Revision identifiers
revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create all four tables for the store backend.

    Table creation order matters due to foreign key dependencies:
    1. products   (no FKs)
    2. cart_items  (FK to products)
    3. orders      (no FKs)
    4. order_items (FK to orders and products)
    """

    # 1. products
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("image_url", sa.String(512), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_products_category", "products", ["category"])

    # 2. cart_items
    op.create_table(
        "cart_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(64), nullable=False),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "session_id", "product_id", name="uq_cart_session_product"
        ),
    )
    op.create_index("ix_cart_items_session_id", "cart_items", ["session_id"])

    # 3. orders
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(64), nullable=False),
        sa.Column("customer_name", sa.String(255), nullable=False),
        sa.Column("customer_email", sa.String(255), nullable=False),
        sa.Column("shipping_address", sa.Text(), nullable=False),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_orders_session_id", "orders", ["session_id"])

    # 4. order_items
    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "order_id",
            sa.Integer(),
            sa.ForeignKey("orders.id"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
    )


def downgrade() -> None:
    """
    Drop all four tables in reverse dependency order.
    """
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_index("ix_cart_items_session_id", table_name="cart_items")
    op.drop_table("cart_items")
    op.drop_index("ix_products_category", table_name="products")
    op.drop_table("products")
```

---

## 32. tests/conftest.py

Test fixtures using an in-memory SQLite database (via aiosqlite) for fast, isolated tests.

```python
"""Test fixtures for store backend tests."""

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.database import Base
from app.core.dependencies import get_db
from app.main import app


# Use an in-memory SQLite database for tests
# NOTE: Add "aiosqlite" to test dependencies (not production requirements.txt)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """
    Create all tables before each test, drop them after.
    This ensures complete test isolation.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a test database session."""
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Provide an async HTTP test client with the DB dependency overridden
    to use the test session.
    """

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
```

### Test dependencies (add to a separate `requirements-test.txt` or `[test]` extras):
```
pytest==8.2.0
pytest-asyncio==0.23.0
httpx==0.27.0
aiosqlite==0.20.0
```

---

## 33. tests/__init__.py

```python
"""Store backend tests."""
```

---

## 34. tests/test_product_service.py

```python
"""Tests for the product API endpoints."""

import pytest
import pytest_asyncio
from decimal import Decimal

from app.models.orm import Product


@pytest_asyncio.fixture
async def sample_products(db_session):
    """Insert sample products for testing."""
    products = [
        Product(
            name="Test Widget",
            description="A test widget",
            price=Decimal("9.99"),
            category="Electronics",
            stock=10,
        ),
        Product(
            name="Test Gadget",
            description="A test gadget",
            price=Decimal("19.99"),
            category="Electronics",
            stock=5,
        ),
        Product(
            name="Test Book",
            description="A test book",
            price=Decimal("14.99"),
            category="Books",
            stock=20,
        ),
    ]
    for p in products:
        db_session.add(p)
    await db_session.commit()
    return products


class TestListProducts:
    """Tests for GET /api/products/"""

    @pytest.mark.asyncio
    async def test_list_all_products(self, client, sample_products):
        """
        Test: GET /api/products/ returns all products with pagination metadata.
        Expected: 200 OK, items list with 3 products, total=3, page=1, per_page=20.
        """
        ...

    @pytest.mark.asyncio
    async def test_search_products(self, client, sample_products):
        """
        Test: GET /api/products/?search=widget returns only matching products.
        Expected: 200 OK, items list with 1 product named "Test Widget".
        """
        ...

    @pytest.mark.asyncio
    async def test_filter_by_category(self, client, sample_products):
        """
        Test: GET /api/products/?category=Books returns only books.
        Expected: 200 OK, items list with 1 product in "Books" category.
        """
        ...

    @pytest.mark.asyncio
    async def test_pagination(self, client, sample_products):
        """
        Test: GET /api/products/?page=2&per_page=2 returns the second page.
        Expected: 200 OK, items list with 1 product, total=3, page=2, per_page=2.
        """
        ...

    @pytest.mark.asyncio
    async def test_empty_results(self, client):
        """
        Test: GET /api/products/ with no products in DB returns empty list.
        Expected: 200 OK, items=[], total=0, page=1.
        """
        ...


class TestGetProduct:
    """Tests for GET /api/products/{product_id}"""

    @pytest.mark.asyncio
    async def test_get_existing_product(self, client, sample_products):
        """
        Test: GET /api/products/1 returns the product.
        Expected: 200 OK with product details.
        """
        ...

    @pytest.mark.asyncio
    async def test_get_nonexistent_product(self, client):
        """
        Test: GET /api/products/999 returns 404.
        Expected: 404 Not Found with detail message.
        """
        ...
```

---

## 35. tests/test_cart_service.py

```python
"""Tests for the cart API endpoints."""

import pytest
import pytest_asyncio
from decimal import Decimal

from app.models.orm import Product


@pytest_asyncio.fixture
async def product_in_db(db_session):
    """Insert a single product for cart tests."""
    product = Product(
        name="Cart Test Product",
        price=Decimal("25.00"),
        category="Test",
        stock=10,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


class TestAddToCart:
    """Tests for POST /api/cart/"""

    @pytest.mark.asyncio
    async def test_add_item_to_cart(self, client, product_in_db):
        """
        Test: POST /api/cart/ with valid product_id adds item.
        Expected: 201 Created, CartItemResponse with quantity=1.
        Also verify a session_id cookie is set on the response.
        """
        ...

    @pytest.mark.asyncio
    async def test_add_item_increments_quantity(self, client, product_in_db):
        """
        Test: POST /api/cart/ twice with the same product increments quantity.
        Expected: Second response has quantity=2.
        """
        ...

    @pytest.mark.asyncio
    async def test_add_nonexistent_product(self, client):
        """
        Test: POST /api/cart/ with invalid product_id returns 404.
        Expected: 404 Not Found.
        """
        ...

    @pytest.mark.asyncio
    async def test_add_insufficient_stock(self, client, product_in_db):
        """
        Test: POST /api/cart/ with quantity > stock returns 400.
        Expected: 400 Bad Request with "Insufficient stock" detail.
        """
        ...


class TestGetCart:
    """Tests for GET /api/cart/"""

    @pytest.mark.asyncio
    async def test_get_empty_cart(self, client):
        """
        Test: GET /api/cart/ with no items returns empty cart.
        Expected: 200 OK, items=[], total=0, item_count=0.
        """
        ...

    @pytest.mark.asyncio
    async def test_get_cart_with_items(self, client, product_in_db):
        """
        Test: Add item, then GET /api/cart/ returns it.
        Expected: 200 OK, items list with 1 item, correct total.
        """
        ...


class TestUpdateCartItem:
    """Tests for PUT /api/cart/{item_id}"""

    @pytest.mark.asyncio
    async def test_update_quantity(self, client, product_in_db):
        """
        Test: Add item, then PUT /api/cart/{item_id} with new quantity.
        Expected: 200 OK, updated quantity in response.
        """
        ...

    @pytest.mark.asyncio
    async def test_update_nonexistent_item(self, client):
        """
        Test: PUT /api/cart/999 returns 404.
        Expected: 404 Not Found.
        """
        ...


class TestRemoveCartItem:
    """Tests for DELETE /api/cart/{item_id}"""

    @pytest.mark.asyncio
    async def test_remove_item(self, client, product_in_db):
        """
        Test: Add item, then DELETE /api/cart/{item_id}.
        Expected: 204 No Content. Subsequent GET /api/cart/ has no items.
        """
        ...

    @pytest.mark.asyncio
    async def test_remove_nonexistent_item(self, client):
        """
        Test: DELETE /api/cart/999 returns 404.
        Expected: 404 Not Found.
        """
        ...
```

---

## 36. tests/test_order_service.py

```python
"""Tests for the order API endpoints."""

import pytest
import pytest_asyncio
from decimal import Decimal

from app.models.orm import Product


@pytest_asyncio.fixture
async def product_in_db(db_session):
    """Insert a product for order tests."""
    product = Product(
        name="Order Test Product",
        price=Decimal("50.00"),
        category="Test",
        stock=10,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


class TestCreateOrder:
    """Tests for POST /api/orders/"""

    @pytest.mark.asyncio
    async def test_create_order_success(self, client, product_in_db):
        """
        Test: Add item to cart, then POST /api/orders/ with customer info.
        Expected:
            - 201 Created with OrderResponse
            - Order total matches product price * quantity
            - Order status is "pending"
            - Cart is empty after checkout
            - Product stock is decremented
        Steps:
            1. POST /api/cart/ to add product (qty=2)
            2. POST /api/orders/ with customer details
            3. Verify response
            4. GET /api/cart/ to verify cart is empty
        """
        ...

    @pytest.mark.asyncio
    async def test_create_order_empty_cart(self, client):
        """
        Test: POST /api/orders/ with empty cart returns 400.
        Expected: 400 Bad Request with "Cart is empty" detail.
        """
        ...

    @pytest.mark.asyncio
    async def test_create_order_insufficient_stock(self, client, product_in_db):
        """
        Test: Add more items than stock allows, then try to checkout.
        Expected: 400 Bad Request with stock-related error.
        Note: This test may need to manipulate stock after adding to cart.
        """
        ...


class TestGetOrder:
    """Tests for GET /api/orders/{order_id}"""

    @pytest.mark.asyncio
    async def test_get_existing_order(self, client, product_in_db):
        """
        Test: Create an order, then GET /api/orders/{order_id}.
        Expected: 200 OK with full order details including items.
        """
        ...

    @pytest.mark.asyncio
    async def test_get_nonexistent_order(self, client):
        """
        Test: GET /api/orders/999 returns 404.
        Expected: 404 Not Found.
        """
        ...
```

---

## 37. API Endpoint Summary

| Method | Path | Description | Request Body | Response | Status |
|---|---|---|---|---|---|
| `GET` | `/health` | Health check (DB connectivity) | -- | `{"status": "healthy"}` | 200 / 503 |
| `GET` | `/api/products/` | List products (paginated, filterable) | -- (query params) | `PaginatedResponse[ProductResponse]` | 200 |
| `GET` | `/api/products/categories` | List distinct categories | -- | `list[str]` | 200 |
| `GET` | `/api/products/{id}` | Get single product | -- | `ProductResponse` | 200 / 404 |
| `GET` | `/api/cart/` | Get current cart | -- | `CartResponse` | 200 |
| `POST` | `/api/cart/` | Add item to cart | `CartAddRequest` | `CartItemResponse` | 201 / 400 / 404 |
| `PUT` | `/api/cart/{item_id}` | Update cart item quantity | `CartUpdateRequest` | `CartItemResponse` | 200 / 404 |
| `DELETE` | `/api/cart/{item_id}` | Remove item from cart | -- | -- | 204 / 404 |
| `POST` | `/api/orders/` | Create order (checkout) | `OrderCreateRequest` | `OrderResponse` | 201 / 400 |
| `GET` | `/api/orders/{id}` | Get order by ID | -- | `OrderResponse` | 200 / 404 |

---

## 38. Key Design Decisions and Constraints

### 38.1 Database: storedb

This service uses its **own** PostgreSQL database named `storedb`. It has no awareness of and no connection to any gateway, logging, or honeypot databases. The connection string defaults to:

```
postgresql+asyncpg://store:store@postgres-store.honeypot.svc.cluster.local:5432/storedb
```

This can be overridden via the `STORE_DATABASE_URL` environment variable.

### 38.2 Session-based cart (no authentication)

The cart is identified by a `session_id` cookie (a UUID4 string). There is no user authentication. This is intentional -- the store is a honeypot facade, and we want minimal friction for visitors (including bots).

The `session_id` cookie:
- Is generated on first request if not present
- Is `httponly` (not accessible via JavaScript)
- Has `samesite=lax`
- Has a 30-day max age

### 38.3 Transaction management

Transactions are managed at the dependency injection level (`get_db`):
- On success: `session.commit()` is called after the controller returns
- On exception: `session.rollback()` is called
- The session is always closed

This means services and repositories should use `session.flush()` (not `session.commit()`) to make changes visible within the transaction without committing.

### 38.4 Stock management

Stock is decremented only at checkout time (not when adding to cart). This is a deliberate simplification. The `update_stock` method uses a simple check-then-decrement pattern. For production-grade concurrent stock management, you would use `SELECT ... FOR UPDATE` or database-level constraints, but for this honeypot context the simple approach is sufficient.

### 38.5 Error handling

All expected errors (not found, validation, insufficient stock) are raised as `HTTPException` instances in the service layer. FastAPI handles these automatically, returning the appropriate HTTP status code and error detail.

### 38.6 No authentication

There are no authentication or authorization mechanisms. All endpoints are public. This is by design for the honeypot context.

### 38.7 Pagination

The `PaginatedResponse` generic model is used for list endpoints. It includes:
- `items`: the current page of results
- `total`: total matching records (for calculating total pages on the client)
- `page`: current page number (1-based)
- `per_page`: items per page

### 38.8 Image URLs

Product `image_url` fields use `placehold.co` placeholder images. In a real deployment, these would point to actual product images hosted on a CDN or object storage.

---

## 39. Deployment Notes

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `STORE_DATABASE_URL` | No | (see config.py) | PostgreSQL connection string |
| `STORE_LOG_LEVEL` | No | `INFO` | Logging level |
| `STORE_DEFAULT_PAGE_SIZE` | No | `20` | Default pagination size |
| `STORE_MAX_PAGE_SIZE` | No | `100` | Maximum pagination size |
| `STORE_SESSION_COOKIE_NAME` | No | `session_id` | Cookie name for sessions |
| `STORE_SESSION_COOKIE_MAX_AGE` | No | `2592000` | Cookie max-age in seconds |

### Kubernetes service name

The default database URL assumes a Kubernetes service named `postgres-store` in the `honeypot` namespace. Adjust via `STORE_DATABASE_URL` for other environments.

### Container startup sequence

1. `alembic upgrade head` -- apply all pending migrations
2. `python -m app.seed.seed_data` -- seed products (idempotent)
3. `uvicorn app.main:app --host 0.0.0.0 --port 8000` -- start the server

### Port

The application listens on port **8000**.
