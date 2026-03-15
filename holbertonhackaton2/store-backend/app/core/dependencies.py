import uuid
from typing import AsyncGenerator

from fastapi import Cookie, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import async_session
from app.repositories.cart_repository import CartRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository
from app.services.cart_service import CartService
from app.services.order_service import OrderService
from app.services.product_service import ProductService


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Async generator yielding a database session. Commits on success, rolls back on error."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_session_id(
    request: Request,
    response: Response,
    store_session_id: str | None = Cookie(default=None),
) -> str:
    """Extract session ID from cookie or generate a new UUID4 and set the cookie."""
    if store_session_id:
        return store_session_id
    new_session_id = str(uuid.uuid4())
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=new_session_id,
        httponly=True,
        samesite="lax",
        max_age=settings.SESSION_COOKIE_MAX_AGE,
    )
    return new_session_id


# ── Repository dependencies ─────────────────────────────────────────────────


def get_product_repository(
    db: AsyncSession = Depends(get_db),
) -> ProductRepository:
    return ProductRepository(db)


def get_cart_repository(
    db: AsyncSession = Depends(get_db),
) -> CartRepository:
    return CartRepository(db)


def get_order_repository(
    db: AsyncSession = Depends(get_db),
) -> OrderRepository:
    return OrderRepository(db)


# ── Service dependencies ────────────────────────────────────────────────────


def get_product_service(
    repo: ProductRepository = Depends(get_product_repository),
) -> ProductService:
    return ProductService(repo)


def get_cart_service(
    cart_repo: CartRepository = Depends(get_cart_repository),
    product_repo: ProductRepository = Depends(get_product_repository),
) -> CartService:
    return CartService(cart_repo, product_repo)


def get_order_service(
    order_repo: OrderRepository = Depends(get_order_repository),
    cart_repo: CartRepository = Depends(get_cart_repository),
    product_repo: ProductRepository = Depends(get_product_repository),
) -> OrderService:
    return OrderService(order_repo, cart_repo, product_repo)
