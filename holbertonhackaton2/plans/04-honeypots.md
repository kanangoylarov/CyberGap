# Plan 04 — Honeypot Services

## Purpose

This document is a self-contained prompt for generating all code for the Honeypot Services component. Feed this entire file to Claude and it will produce every file described below.

---

## Critical Design Principle

Honeypots are **NOT** fake vulnerable services. They are **clones of the real store** that look identical to the legitimate store but serve **dummy product data** and **log every interaction forensically**. An attacker routed to a honeypot sees the same API, same response format, same endpoints — but the products are fake and everything they do is recorded.

The goal: an attacker cannot distinguish a honeypot from the real store. The honeypot mirrors the real store's API surface perfectly. Meanwhile, every header, every byte of body, every timing detail is captured for forensic analysis.

---

## Architecture Pattern

```
Model (Pydantic schemas) → Repository (in-memory data) → Service (business logic) → Controller (FastAPI Router)
```

- **Model layer**: Pydantic schemas that match the real store-backend response format exactly.
- **Repository layer**: In-memory fake data store. No database. No persistence. Products, carts, and orders live in Python dicts and lists.
- **Service layer**: Business logic that wraps the repository, applies per-attack-type behavioral modifications, and handles forensic logging.
- **Controller layer**: FastAPI routers that expose the exact same HTTP endpoints as the real store-backend.

Single Docker image. Behavior is driven entirely by the `HONEYPOT_TYPE` environment variable. Nine possible values: `generic`, `exploits`, `fuzzers`, `dos`, `reconnaissance`, `analysis`, `backdoor`, `shellcode`, `worms`.

---

## Directory Tree

Generate every file listed below. Do not skip any file. Do not add files not listed here.

```
honeypots/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   └── dummy_data_repository.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── dummy_store_service.py
│   │   ├── forensic_logger_service.py
│   │   └── behavior/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── generic.py
│   │       ├── exploits.py
│   │       ├── fuzzers.py
│   │       ├── dos.py
│   │       ├── reconnaissance.py
│   │       ├── analysis.py
│   │       ├── backdoor.py
│   │       ├── shellcode.py
│   │       └── worms.py
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── product_controller.py
│   │   ├── cart_controller.py
│   │   ├── order_controller.py
│   │   └── bait_controller.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── forensic_middleware.py
│   └── utils/
│       ├── __init__.py
│       └── logging.py
└── tests/
    ├── __init__.py
    └── test_dummy_store.py
```

---

## File-by-File Specifications

### `requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
pydantic==2.7.0
pydantic-settings==2.3.0
python-json-logger==2.0.7
```

No other dependencies. The honeypot is deliberately lightweight — no database drivers, no Redis, no external service clients.

---

### `Dockerfile`

```dockerfile
FROM python:3.11-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY app/ ./app/
RUN useradd -r appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Multi-stage build. Non-root user. Port 8000. No volumes, no secrets, no database connections.

---

### `app/__init__.py`

Empty file. Just makes the directory a Python package.

---

### `app/config.py`

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    HONEYPOT_TYPE: str = "generic"
    LOG_LEVEL: str = "DEBUG"
    RESPONSE_DELAY_MS: int = 0

    class Config:
        env_prefix = "HONEYPOT_"
```

#### Field details:

- **`HONEYPOT_TYPE`**: One of `generic`, `exploits`, `fuzzers`, `dos`, `reconnaissance`, `analysis`, `backdoor`, `shellcode`, `worms`. Controls which behavior class is loaded at startup. Default: `"generic"`. The environment variable is `HONEYPOT_HONEYPOT_TYPE` due to the env_prefix, BUT override this: set `env_prefix = ""` so the env var is just `HONEYPOT_TYPE`. Actually, to avoid confusion, define the config as:

```python
class Settings(BaseSettings):
    HONEYPOT_TYPE: str = "generic"
    LOG_LEVEL: str = "DEBUG"
    RESPONSE_DELAY_MS: int = 0

    model_config = {"env_prefix": ""}
```

This way the env vars are `HONEYPOT_TYPE`, `LOG_LEVEL`, `RESPONSE_DELAY_MS` — no prefix doubling.

- **`LOG_LEVEL`**: Always `"DEBUG"` for forensics. Every single interaction is logged.
- **`RESPONSE_DELAY_MS`**: Base delay in milliseconds added before responding. Default 0. The `dos` behavior overrides this dynamically (1000-5000ms range) for tarpitting.

Create a module-level singleton:

```python
settings = Settings()
```

Import this singleton everywhere: `from app.config import settings`.

---

### `app/models/__init__.py`

Empty file.

---

### `app/models/schemas.py`

Define Pydantic models that produce **the exact same JSON response format** as the real store-backend. An attacker comparing responses from the real store and the honeypot should see identical structure.

#### Product schemas:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProductResponse(BaseModel):
    id: int
    name: str
    description: str
    price: float
    image_url: str
    category: str
    stock: int
    created_at: datetime
```

- `id`: integer, sequential starting from 1
- `name`: realistic product name string
- `description`: 1-3 sentence product description
- `price`: float, two decimal places (e.g., 89.99)
- `image_url`: string, use placeholder URLs like `"https://picsum.photos/seed/{product_id}/400/400"` so they actually resolve to images
- `category`: one of `"Electronics"`, `"Clothing"`, `"Books"`, `"Home & Kitchen"`, `"Sports"`
- `stock`: integer 0-500
- `created_at`: datetime, generate realistic-looking past dates spread over the last 6 months

#### Cart schemas:

```python
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
```

- `CartItemResponse.id`: unique cart item ID (not the product ID)
- `CartItemResponse.product`: full nested ProductResponse object
- `CartResponse.total`: sum of (item.product.price * item.quantity) for all items
- `CartResponse.item_count`: total quantity across all items

#### Order schemas:

```python
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
```

- `OrderResponse.id`: integer starting from 1000
- `OrderResponse.status`: one of `"pending"`, `"processing"`, `"shipped"`, `"delivered"`
- `OrderResponse.items`: list of `OrderItemResponse` objects

#### Paginated list response:

```python
class PaginatedProductResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    per_page: int
    pages: int
```

#### Request body schemas (for accepting attacker input):

```python
class AddToCartRequest(BaseModel):
    product_id: int
    quantity: int = 1


class UpdateCartItemRequest(BaseModel):
    quantity: int


class CreateOrderRequest(BaseModel):
    customer_name: str
    customer_email: str
    shipping_address: str
```

#### Forensic log schema:

```python
class ForensicLogEntry(BaseModel):
    event: str = "honeypot_interaction"
    honeypot_type: str
    timestamp: datetime
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
```

- `headers`: full dict of all request headers
- `body`: full request body as string (up to 10KB; truncate with `"[TRUNCATED]"` suffix if larger)
- `body_size`: original body size in bytes before truncation
- `response_body_preview`: first 500 characters of the response body
- `latency_ms`: time from request received to response sent, in milliseconds, one decimal place

---

### `app/repositories/__init__.py`

Empty file.

---

### `app/repositories/dummy_data_repository.py`

This is the in-memory data store. No database. No persistence. Data is generated at startup and lives in memory. When the pod restarts, data resets. This is intentional — honeypots are disposable.

```python
from typing import Optional
from datetime import datetime, timedelta
import random
import threading


class DummyDataRepository:
    """In-memory store of fake products, carts, orders. No real database needed."""

    def __init__(self):
        self._products: list[dict] = self._generate_products()
        self._carts: dict[str, list[dict]] = {}   # session_id -> list of cart item dicts
        self._orders: dict[int, dict] = {}
        self._order_counter: int = 1000
        self._cart_item_counter: int = 1
        self._lock = threading.Lock()
```

#### `_generate_products(self) -> list[dict]`

Generate exactly 28 realistic-looking fake products. These must look completely real. An attacker browsing the store should believe these are genuine products.

Hardcode all 28 products. Do NOT generate them randomly at startup — they must be deterministic so that repeated requests return the same data (an attacker comparing responses would notice randomized data).

Product data to generate:

**Electronics (6 products):**
1. id=1, name="Wireless Bluetooth Headphones Pro X3", price=89.99, stock=145, description="Premium over-ear wireless headphones with active noise cancellation, 40-hour battery life, and Hi-Res Audio support. Foldable design with memory foam ear cushions."
2. id=2, name="USB-C Fast Charging Hub 7-in-1", price=45.99, stock=312, description="Multi-port USB-C hub featuring 4K HDMI output, 3x USB 3.0 ports, SD/TF card reader, and 100W power delivery passthrough. Compatible with all USB-C laptops."
3. id=3, name="Smart LED Desk Lamp with Wireless Charger", price=62.50, stock=89, description="Adjustable LED desk lamp with 5 color temperature modes, built-in Qi wireless charging pad, and touch-sensitive controls. USB port for additional device charging."
4. id=4, name="Portable SSD 1TB External Drive", price=109.99, stock=203, description="Ultra-fast portable solid state drive with USB 3.2 Gen 2 interface. Read speeds up to 1050MB/s. Shock-resistant aluminum enclosure with hardware encryption."
5. id=5, name="Mechanical Gaming Keyboard RGB", price=129.99, stock=67, description="Full-size mechanical keyboard with Cherry MX Blue switches, per-key RGB backlighting, detachable wrist rest, and programmable macro keys. Aircraft-grade aluminum frame."
6. id=6, name="4K Webcam with Ring Light", price=79.99, stock=178, description="Ultra HD 4K webcam with built-in adjustable ring light, auto-focus, and dual noise-cancelling microphones. Privacy shutter and universal monitor mount included."

**Clothing (6 products):**
7. id=7, name="Organic Cotton Classic T-Shirt", price=24.99, stock=456, description="100% GOTS-certified organic cotton crew neck tee. Pre-shrunk, double-needle stitching throughout. Available in 12 colors. Machine washable."
8. id=8, name="Slim Fit Stretch Chino Pants", price=54.99, stock=234, description="Modern slim fit chinos with 2% elastane for comfortable stretch. Washed cotton twill fabric, zip fly with button closure. Four-pocket styling."
9. id=9, name="Waterproof Hiking Jacket", price=149.99, stock=98, description="3-layer waterproof breathable shell jacket with sealed seams. Adjustable hood, pit zips for ventilation, and multiple secured pockets. Rated for extreme conditions."
10. id=10, name="Merino Wool Quarter-Zip Pullover", price=89.99, stock=167, description="Premium 100% merino wool mid-layer with quarter-zip design. Naturally temperature-regulating, moisture-wicking, and odor-resistant. Ribbed cuffs and hem."
11. id=11, name="Classic Leather Belt", price=34.99, stock=389, description="Full-grain Italian leather belt with brushed nickel buckle. 35mm width, suitable for both casual and dress wear. Edges burnished by hand."
12. id=12, name="Performance Running Shorts", price=38.99, stock=278, description="Lightweight 5-inch running shorts with built-in compression liner. Quick-dry fabric, reflective details, and zippered back pocket for keys."

**Books (5 products):**
13. id=13, name="Advanced Python Programming Guide", price=49.99, stock=134, description="Comprehensive guide covering advanced Python concepts including metaprogramming, concurrency, design patterns, and performance optimization. 680 pages with practical exercises."
14. id=14, name="The Art of Clean Architecture", price=44.99, stock=89, description="Learn to build maintainable, scalable software systems. Covers hexagonal architecture, domain-driven design, and microservices patterns with real-world case studies."
15. id=15, name="Data Structures and Algorithms Illustrated", price=39.99, stock=212, description="Visual approach to learning DSA with over 400 diagrams and illustrations. Covers arrays, trees, graphs, dynamic programming, and common interview problems."
16. id=16, name="Machine Learning Engineering in Practice", price=54.99, stock=156, description="Bridge the gap between ML research and production systems. Covers MLOps, model serving, feature stores, monitoring, and A/B testing at scale."
17. id=17, name="Creative Writing: Finding Your Voice", price=19.99, stock=345, description="A practical workshop-style guide to developing your unique writing voice. Includes 50 writing exercises, examples from published authors, and self-editing techniques."

**Home & Kitchen (6 products):**
18. id=18, name="Stainless Steel French Press 34oz", price=29.99, stock=267, description="Double-wall insulated stainless steel French press with 4-level filtration system. Keeps coffee hot for 2+ hours. Dishwasher safe components."
19. id=19, name="Non-Stick Ceramic Cookware Set 10-Piece", price=189.99, stock=78, description="Complete cookware set with PFOA-free ceramic coating. Includes 2 frying pans, 2 saucepans with lids, Dutch oven with lid, and 2 utensils. Oven safe to 450F."
20. id=20, name="Bamboo Cutting Board Set (3-Pack)", price=32.99, stock=423, description="Set of 3 organic bamboo cutting boards in small, medium, and large sizes. Deep juice grooves, easy-grip handles, and antimicrobial surface. BPA-free."
21. id=21, name="Smart WiFi Instant Pot 6-Quart", price=119.99, stock=145, description="Programmable multi-cooker with WiFi connectivity and app control. 13 cooking programs including pressure cook, slow cook, sous vide, and yogurt maker."
22. id=22, name="Egyptian Cotton Bath Towel Set", price=59.99, stock=198, description="Set of 4 luxury 700 GSM Egyptian cotton bath towels. Double-stitched hems, ultra-absorbent ring-spun cotton. Oeko-Tex certified. Available in 8 colors."
23. id=23, name="Vacuum Insulated Water Bottle 32oz", price=27.99, stock=367, description="Triple-wall vacuum insulated stainless steel bottle. Keeps drinks cold 24 hours or hot 12 hours. Leak-proof lid, fits standard cup holders. BPA-free."

**Sports (5 products):**
24. id=24, name="Yoga Mat Premium 6mm Non-Slip", price=44.99, stock=289, description="Extra-thick 6mm yoga mat with dual-texture non-slip surface. Closed-cell construction resists moisture and bacteria. Includes carrying strap. 72 x 26 inches."
25. id=25, name="Adjustable Dumbbell Set 5-52.5 lbs", price=349.99, stock=34, description="Space-saving adjustable dumbbells replacing 15 sets of weights. Quick-change mechanism for seamless weight transitions. Steel construction with molded grip."
26. id=26, name="Resistance Bands Set (5-Pack)", price=22.99, stock=445, description="Set of 5 natural latex resistance bands with varying tension levels (5-50 lbs). Includes door anchor, ankle straps, and carrying bag. Color-coded by resistance."
27. id=27, name="GPS Running Watch with Heart Rate", price=199.99, stock=112, description="Advanced GPS running watch with wrist-based heart rate monitor. VO2 max estimation, training load tracking, and smart notifications. 14-day battery life in smartwatch mode."
28. id=28, name="Foam Roller High-Density 18-Inch", price=19.99, stock=334, description="High-density EVA foam roller for deep tissue massage and myofascial release. Textured surface with multi-zone design for targeted muscle recovery. Lightweight and portable."

For each product, also generate:
- `image_url`: `f"https://picsum.photos/seed/product{id}/400/400"`
- `category`: as listed above per group
- `created_at`: distribute dates across the last 180 days. Use a deterministic formula: `datetime(2026, 3, 15) - timedelta(days=(product_id * 7) % 180)` so that products have varied but repeatable creation dates.

Store each product as a plain dict with these keys: `id`, `name`, `description`, `price`, `image_url`, `category`, `stock`, `created_at`.

#### `get_products(self, search: Optional[str] = None, category: Optional[str] = None, offset: int = 0, limit: int = 20) -> tuple[list[dict], int]`

1. Start with all products.
2. If `search` is not None and not empty, filter to products where `search.lower()` appears in `name.lower()` or `description.lower()`.
3. If `category` is not None and not empty, filter to products where `category.lower() == product["category"].lower()`.
4. Get total count of filtered results.
5. Slice `[offset : offset + limit]`.
6. Return `(sliced_list, total_count)`.

#### `get_product(self, product_id: int) -> Optional[dict]`

Linear search through `self._products` for matching `id`. Return the dict or `None`.

#### `get_cart(self, session_id: str) -> list[dict]`

Return `self._carts.get(session_id, [])`. Each cart item dict has keys: `id` (cart item id), `product_id`, `quantity`, `product` (full product dict), `created_at`.

#### `add_to_cart(self, session_id: str, product_id: int, quantity: int) -> dict`

1. Look up the product by `product_id`. If not found, raise `ValueError("Product not found")`.
2. Use `self._lock` for thread safety.
3. If `session_id` not in `self._carts`, initialize to empty list.
4. Check if product already in cart for this session. If yes, increment quantity.
5. If no, create new cart item dict: `{"id": self._cart_item_counter, "product_id": product_id, "quantity": quantity, "product": product_dict, "created_at": datetime.utcnow()}`. Increment `self._cart_item_counter`.
6. Return the cart item dict.

#### `update_cart_item(self, session_id: str, item_id: int, quantity: int) -> Optional[dict]`

1. Find the cart item with matching `id` in `self._carts[session_id]`.
2. If not found, return `None`.
3. If `quantity <= 0`, remove the item and return `None`.
4. Update quantity, return updated cart item dict.

#### `remove_cart_item(self, session_id: str, item_id: int) -> bool`

1. Find and remove the cart item with matching `id`.
2. Return `True` if found and removed, `False` otherwise.

#### `create_order(self, session_id: str, customer_name: str, customer_email: str, shipping_address: str) -> dict`

1. Get cart items for session. If empty, raise `ValueError("Cart is empty")`.
2. Use `self._lock`.
3. Calculate total from cart items.
4. Create order dict:
```python
{
    "id": self._order_counter,
    "customer_name": customer_name,
    "customer_email": customer_email,
    "shipping_address": shipping_address,
    "total": total,
    "status": "pending",
    "items": [{"product_id": item["product_id"], "product_name": item["product"]["name"], "quantity": item["quantity"], "price": item["product"]["price"]} for item in cart_items],
    "created_at": datetime.utcnow()
}
```
5. Increment `self._order_counter`.
6. Store order in `self._orders`.
7. Clear the cart for this session.
8. Return the order dict.

#### `get_order(self, order_id: int) -> Optional[dict]`

Return `self._orders.get(order_id)`.

---

### `app/services/__init__.py`

Empty file.

---

### `app/services/forensic_logger_service.py`

```python
import json
import logging
from datetime import datetime, timezone
from fastapi import Request
from app.config import settings


logger = logging.getLogger("honeypot.forensic")


class ForensicLoggerService:
    """Logs every single interaction in maximum detail for forensic analysis."""

    def __init__(self):
        self._honeypot_type = settings.HONEYPOT_TYPE

    async def log_request(
        self,
        request: Request,
        request_body: bytes,
        response_status: int,
        response_body: str,
        latency_ms: float,
    ) -> None:
        ...
```

#### `log_request` implementation details:

1. Extract `source_ip` from `request.client.host` if available, else `"unknown"`.
2. Extract all headers as a dict: `dict(request.headers)`.
3. Extract query params: `dict(request.query_params)`.
4. Decode request body to string. If body exceeds 10240 bytes, truncate to 10240 and append `"[TRUNCATED]"`.
5. Get body_size as `len(request_body)`.
6. Truncate response_body to first 500 characters for the preview.
7. Build a dict:
```python
{
    "event": "honeypot_interaction",
    "honeypot_type": self._honeypot_type,
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "source_ip": source_ip,
    "method": request.method,
    "path": str(request.url.path),
    "headers": headers_dict,
    "query_params": query_params,
    "body": body_str,
    "body_size": body_size,
    "response_status": response_status,
    "response_body_preview": response_body_preview,
    "latency_ms": round(latency_ms, 1),
}
```
8. Log this dict as a JSON string using `logger.info(json.dumps(log_entry))`.

This structured JSON log gets picked up by Filebeat and sent to ELK for analysis.

---

### `app/services/dummy_store_service.py`

```python
from typing import Optional
from app.repositories.dummy_data_repository import DummyDataRepository
from app.services.behavior.base import BaseBehavior
import math


class DummyStoreService:
    """Business logic for the fake store. Wraps DummyDataRepository."""

    def __init__(self, repo: DummyDataRepository, behavior: BaseBehavior):
        self._repo = repo
        self._behavior = behavior
```

#### Methods:

##### `async def list_products(self, search: Optional[str], category: Optional[str], page: int, per_page: int) -> dict`

1. Calculate `offset = (page - 1) * per_page`.
2. Call `self._repo.get_products(search=search, category=category, offset=offset, limit=per_page)`.
3. Get back `(products, total)`.
4. Pass products through `self._behavior.modify_product_response(products)`.
5. Calculate `pages = math.ceil(total / per_page)` (minimum 1).
6. Return dict matching `PaginatedProductResponse` schema:
```python
{
    "items": modified_products,
    "total": total,
    "page": page,
    "per_page": per_page,
    "pages": pages,
}
```

##### `async def get_product(self, product_id: int) -> Optional[dict]`

1. Call `self._repo.get_product(product_id)`.
2. If None, return None.
3. Return the product dict. (Single product responses are not modified by behavior — only listings are.)

##### `async def get_cart(self, session_id: str) -> dict`

1. Get cart items from repo.
2. Calculate total: `sum(item["product"]["price"] * item["quantity"] for item in items)`.
3. Calculate item_count: `sum(item["quantity"] for item in items)`.
4. Return:
```python
{
    "items": items,
    "total": round(total, 2),
    "item_count": item_count,
}
```

##### `async def add_to_cart(self, session_id: str, product_id: int, quantity: int) -> dict`

Call `self._repo.add_to_cart(session_id, product_id, quantity)` and return the cart item dict.

##### `async def update_cart_item(self, session_id: str, item_id: int, quantity: int) -> Optional[dict]`

Call `self._repo.update_cart_item(session_id, item_id, quantity)`.

##### `async def remove_cart_item(self, session_id: str, item_id: int) -> bool`

Call `self._repo.remove_cart_item(session_id, item_id)`.

##### `async def create_order(self, session_id: str, customer_name: str, customer_email: str, shipping_address: str) -> dict`

Call `self._repo.create_order(session_id, customer_name, customer_email, shipping_address)`. Return the order dict.

##### `async def get_order(self, order_id: int) -> Optional[dict]`

Call `self._repo.get_order(order_id)`.

---

### `app/services/behavior/__init__.py`

```python
from app.services.behavior.base import BaseBehavior
from app.services.behavior.generic import GenericBehavior
from app.services.behavior.exploits import ExploitsBehavior
from app.services.behavior.fuzzers import FuzzersBehavior
from app.services.behavior.dos import DosBehavior
from app.services.behavior.reconnaissance import ReconnaissanceBehavior
from app.services.behavior.analysis import AnalysisBehavior
from app.services.behavior.backdoor import BackdoorBehavior
from app.services.behavior.shellcode import ShellcodeBehavior
from app.services.behavior.worms import WormsBehavior


BEHAVIOR_MAP: dict[str, type[BaseBehavior]] = {
    "generic": GenericBehavior,
    "exploits": ExploitsBehavior,
    "fuzzers": FuzzersBehavior,
    "dos": DosBehavior,
    "reconnaissance": ReconnaissanceBehavior,
    "analysis": AnalysisBehavior,
    "backdoor": BackdoorBehavior,
    "shellcode": ShellcodeBehavior,
    "worms": WormsBehavior,
}


def get_behavior(honeypot_type: str) -> BaseBehavior:
    """Factory function. Returns the behavior instance for the given honeypot type."""
    behavior_class = BEHAVIOR_MAP.get(honeypot_type)
    if behavior_class is None:
        raise ValueError(f"Unknown honeypot type: {honeypot_type}. Valid types: {list(BEHAVIOR_MAP.keys())}")
    return behavior_class()
```

---

### `app/services/behavior/base.py`

```python
from abc import ABC, abstractmethod
from typing import Any
from fastapi import APIRouter, Request


class BaseBehavior(ABC):
    """Base class for per-attack-type behavioral modifications.

    Every honeypot type extends this class. The base class provides sensible
    defaults — subclasses override only the hooks they need.
    """

    @abstractmethod
    def get_type_name(self) -> str:
        """Return the behavior type name (e.g., 'exploits', 'dos').
        Used in forensic logs to identify which honeypot handled the request."""
        ...

    def modify_product_response(self, products: list[dict]) -> list[dict]:
        """Hook to modify the product listing before it is returned.
        Default: no modification. Override to inject fake data, add fields, etc."""
        return products

    def get_extra_router(self) -> APIRouter | None:
        """Return an additional FastAPI APIRouter with extra bait routes specific
        to this behavior type. Default: None (no extra routes).
        The router will be included in the FastAPI app at startup."""
        return None

    async def pre_response_hook(self, request: Request) -> dict | None:
        """Called before the normal handler sends its response.
        Return None to proceed normally.
        Return a dict with {"status_code": int, "body": dict} to short-circuit
        and return that response instead (used by fuzzers to inject random errors).
        DoS behavior uses this to add delay via asyncio.sleep.
        Default: no-op, returns None."""
        return None

    def modify_headers(self, headers: dict) -> dict:
        """Modify response headers to add realistic-looking server headers.
        Default: add Apache/PHP headers to look like a typical LAMP stack."""
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        return headers
```

---

### `app/services/behavior/generic.py`

```python
from app.services.behavior.base import BaseBehavior


class GenericBehavior(BaseBehavior):
    """Standard fake store. No special modifications. Logs everything via
    the forensic middleware. This is the baseline honeypot."""

    def get_type_name(self) -> str:
        return "generic"
```

No overrides. All default behavior from BaseBehavior. The generic honeypot is a plain clone of the store that simply logs.

---

### `app/services/behavior/exploits.py`

```python
import random
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from app.services.behavior.base import BaseBehavior


class ExploitsBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "exploits"

    def modify_product_response(self, products: list[dict]) -> list[dict]:
        ...

    def get_extra_router(self) -> APIRouter:
        ...

    def modify_headers(self, headers: dict) -> dict:
        ...
```

#### `modify_product_response` details:

Occasionally (randomly, ~20% of requests) append an extra fake product to the list that has a suspicious-looking description containing a SQL-like string. This is bait to make an attacker think the site is vulnerable to SQL injection:

```python
bait_product = {
    "id": 9999,
    "name": "Special Offer - Limited Time",
    "description": "Error: SELECT * FROM products WHERE category = '' OR '1'='1' -- returned unexpected results. Contact admin@store.local.",
    "price": 0.01,
    "image_url": "https://picsum.photos/seed/error/400/400",
    "category": "Uncategorized",
    "stock": 1,
    "created_at": "2026-03-10T00:00:00Z",
}
```

Use `random.random() < 0.2` to decide whether to inject this. Make a copy of the products list before appending.

#### `get_extra_router` details:

Create an `APIRouter()` with these routes:

1. `GET /wp-admin/` — Return an HTMLResponse with a fake WordPress login page:
```html
<html><head><title>WordPress - Log In</title></head>
<body><h1>WordPress</h1><form method="POST" action="/wp-admin/">
<label>Username</label><input name="log" type="text">
<label>Password</label><input name="pwd" type="password">
<button type="submit">Log In</button></form></body></html>
```

2. `POST /wp-admin/` — Accept the form submission, log the credentials (they come in as form data: `log` and `pwd` fields), return the same login page with "Invalid credentials" message. The forensic middleware will capture the posted credentials.

3. `GET /phpmyadmin/` — Return an HTMLResponse with a fake phpMyAdmin login:
```html
<html><head><title>phpMyAdmin</title></head>
<body><h1>phpMyAdmin</h1><form method="POST" action="/phpmyadmin/">
<label>Username</label><input name="pma_username" type="text">
<label>Password</label><input name="pma_password" type="password">
<button type="submit">Go</button></form></body></html>
```

4. `POST /phpmyadmin/` — Same pattern: accept form, return "Access denied" page.

#### `modify_headers` details:

Call `super().modify_headers(headers)` first, then add:
```python
headers["X-Debug-Token"] = "a3f8b2c1d4e5"
headers["X-Debug-Token-Link"] = "/_profiler/a3f8b2c1d4e5"
```

These fake debug headers look like a Symfony/Laravel debug mode leak, enticing attackers to probe further.

---

### `app/services/behavior/fuzzers.py`

```python
import random
from fastapi import Request
from app.services.behavior.base import BaseBehavior


class FuzzersBehavior(BaseBehavior):
    """Behavioral tweaks for engaging fuzzers. Randomly returns error responses
    to keep the fuzzer thinking it's finding real bugs."""

    def get_type_name(self) -> str:
        return "fuzzers"

    async def pre_response_hook(self, request: Request) -> dict | None:
        ...

    def modify_headers(self, headers: dict) -> dict:
        ...
```

#### `pre_response_hook` details:

On each request, with 10% probability (`random.random() < 0.1`), return a random error response instead of the normal response:

```python
error_responses = [
    {"status_code": 400, "body": {"detail": "Bad Request: malformed input"}},
    {"status_code": 403, "body": {"detail": "Forbidden: insufficient permissions"}},
    {"status_code": 500, "body": {"detail": "Internal Server Error: unexpected condition"}},
    {"status_code": 502, "body": {"detail": "Bad Gateway: upstream server error"}},
    {"status_code": 503, "body": {"detail": "Service Unavailable: try again later"}},
]
return random.choice(error_responses)
```

Return `None` the other 90% of the time to let the normal handler proceed.

#### `modify_headers` details:

Randomly vary the `Server` header to look like different web servers:

```python
servers = [
    "Apache/2.4.41 (Ubuntu)",
    "nginx/1.18.0",
    "Microsoft-IIS/10.0",
    "Apache/2.4.52 (Debian)",
    "nginx/1.21.6",
]
headers["Server"] = random.choice(servers)
```

Remove the `X-Powered-By` header (don't set it) to vary the fingerprint.

---

### `app/services/behavior/dos.py`

```python
import asyncio
import random
from fastapi import Request
from app.services.behavior.base import BaseBehavior


class DosBehavior(BaseBehavior):
    """Tarpitting behavior for DoS attackers. Adds artificial delays to
    slow down flood attacks and waste attacker resources."""

    def get_type_name(self) -> str:
        return "dos"

    async def pre_response_hook(self, request: Request) -> dict | None:
        ...
```

#### `pre_response_hook` details:

Add a random delay between 1 and 5 seconds before responding:

```python
delay_seconds = random.uniform(1.0, 5.0)
await asyncio.sleep(delay_seconds)
return None  # proceed with normal response after delay
```

This is **tarpitting**: the attacker sends requests expecting fast responses, but the honeypot deliberately slows down, consuming the attacker's connection resources while barely using any server CPU.

No other overrides. The dos honeypot uses default headers and default product responses — it just responds slowly.

---

### `app/services/behavior/reconnaissance.py`

```python
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from app.services.behavior.base import BaseBehavior


class ReconnaissanceBehavior(BaseBehavior):
    """Extra bait data for reconnaissance attackers. Serves fake sensitive files
    and endpoints that scanners typically look for."""

    def get_type_name(self) -> str:
        return "reconnaissance"

    def modify_product_response(self, products: list[dict]) -> list[dict]:
        ...

    def get_extra_router(self) -> APIRouter:
        ...
```

#### `modify_product_response` details:

For each product, add extra metadata fields that look like they shouldn't be exposed publicly:

```python
for product in products:
    product = dict(product)  # copy to avoid mutating original
    product["_internal_sku"] = f"SKU-{product['id']:05d}-PROD"
    product["_supplier_code"] = f"SUP-{random.randint(1000, 9999)}"
    product["_cost_price"] = round(product["price"] * 0.4, 2)
    product["_warehouse_location"] = f"Rack {random.choice('ABCDEF')}-{random.randint(1, 50)}"
```

Return the modified list. These extra fields look like internal data leaking through the API.

IMPORTANT: Make copies of the product dicts, do not mutate the originals in the repository.

#### `get_extra_router` details:

Create an `APIRouter()` with these routes:

1. `GET /robots.txt` — Return a PlainTextResponse with juicy-looking paths:
```
User-agent: *
Disallow: /admin/
Disallow: /api/internal/
Disallow: /api/debug/
Disallow: /backup/
Disallow: /.env
Disallow: /wp-admin/
Disallow: /api/users/
Disallow: /phpmyadmin/
Sitemap: https://store.example.com/sitemap.xml
```

2. `GET /.env` — Return a PlainTextResponse with fake credentials:
```
APP_NAME=StoreBackend
APP_ENV=production
APP_KEY=base64:k8Jf3kL9mN2pQ5sT7vW0xY3zA6cE8gI1jL4nP6rS9u=
APP_DEBUG=false
DB_CONNECTION=mysql
DB_HOST=db-primary.internal.store.com
DB_PORT=3306
DB_DATABASE=store_production
DB_USERNAME=store_app
DB_PASSWORD=Pr0d_$t0r3_2024!xK9m
REDIS_HOST=redis.internal.store.com
REDIS_PASSWORD=R3d1s_S3cur3_P@ss!
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=store-uploads-prod
STRIPE_SECRET_KEY=sk_test_51H7example000000000000000000000000
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_USERNAME=postmaster@store.example.com
MAIL_PASSWORD=M@1lgun_P@ss_2024!
JWT_SECRET=super_secret_jwt_key_do_not_share_2024
```
All of these are completely fake. The attacker will try to use them and fail, but the attempt is logged.

3. `GET /admin/` — Return an HTMLResponse with a fake admin login page:
```html
<html><head><title>Admin Panel - Login</title></head>
<body><h1>Store Administration</h1>
<form method="POST" action="/admin/login">
<label>Username</label><input name="username" type="text">
<label>Password</label><input name="password" type="password">
<button type="submit">Sign In</button>
</form></body></html>
```

4. `POST /admin/login` — Accept form submission, return JSON `{"error": "Invalid credentials", "attempts_remaining": 3}`.

5. `GET /backup/` — Return a JSONResponse listing fake backup files:
```python
{
    "files": [
        {"name": "db_backup_2026-03-14.sql.gz", "size": "245MB", "modified": "2026-03-14T02:00:00Z"},
        {"name": "db_backup_2026-03-13.sql.gz", "size": "243MB", "modified": "2026-03-13T02:00:00Z"},
        {"name": "store_files_2026-03-14.tar.gz", "size": "1.2GB", "modified": "2026-03-14T03:00:00Z"},
        {"name": "config_backup.zip", "size": "4.5MB", "modified": "2026-03-10T12:00:00Z"},
    ]
}
```

6. `GET /backup/{filename}` — For any filename, return a PlainTextResponse with `"Access denied: authentication required"` and status 403.

---

### `app/services/behavior/analysis.py`

```python
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.services.behavior.base import BaseBehavior
import random


class AnalysisBehavior(BaseBehavior):
    """Serves extra 'sensitive' fake data to engage analysis-type attackers.
    Looks like internal APIs leaking data."""

    def get_type_name(self) -> str:
        return "analysis"

    def modify_product_response(self, products: list[dict]) -> list[dict]:
        ...

    def get_extra_router(self) -> APIRouter:
        ...
```

#### `modify_product_response` details:

For each product, add fake internal business fields (make copies, do not mutate originals):

```python
product["cost_price"] = round(product["price"] * random.uniform(0.3, 0.5), 2)
product["supplier"] = random.choice(["Shenzhen Electronics Co.", "GlobalTex Industries", "Pacific Print House", "HomeGoods Direct", "SportGear Manufacturing"])
product["profit_margin"] = round((product["price"] - product["cost_price"]) / product["price"] * 100, 1)
product["last_restocked"] = "2026-03-10T08:30:00Z"
product["total_sold"] = random.randint(50, 5000)
product["return_rate"] = round(random.uniform(0.5, 8.0), 1)
```

#### `get_extra_router` details:

Create an `APIRouter()` with these routes:

1. `GET /api/internal/users` — Return a fake user list:
```python
{
    "users": [
        {"id": 1, "username": "admin", "email": "admin@store.internal", "role": "superadmin", "last_login": "2026-03-15T08:30:00Z"},
        {"id": 2, "username": "jsmith", "email": "j.smith@store.example.com", "role": "manager", "last_login": "2026-03-14T17:45:00Z"},
        {"id": 3, "username": "mwilson", "email": "m.wilson@store.example.com", "role": "support", "last_login": "2026-03-15T09:00:00Z"},
        {"id": 4, "username": "api_service", "email": "api@store.internal", "role": "service_account", "last_login": "2026-03-15T12:00:00Z"},
        {"id": 5, "username": "dbadmin", "email": "dba@store.internal", "role": "database_admin", "last_login": "2026-03-13T22:15:00Z"},
    ]
}
```

2. `GET /api/internal/config` — Return fake application configuration:
```python
{
    "database": {"host": "db-primary.internal", "port": 3306, "name": "store_prod", "pool_size": 20},
    "cache": {"host": "redis.internal", "port": 6379, "ttl": 3600},
    "storage": {"provider": "s3", "bucket": "store-assets-prod", "region": "us-east-1"},
    "features": {"enable_reviews": True, "enable_wishlist": False, "maintenance_mode": False},
}
```

3. `GET /api/internal/stats` — Return fake business metrics:
```python
{
    "orders_today": random.randint(150, 300),
    "revenue_today": round(random.uniform(15000, 45000), 2),
    "active_users": random.randint(500, 2000),
    "conversion_rate": round(random.uniform(2.0, 5.0), 2),
    "avg_order_value": round(random.uniform(45, 120), 2),
}
```

---

### `app/services/behavior/backdoor.py`

```python
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from app.services.behavior.base import BaseBehavior
import random


class BackdoorBehavior(BaseBehavior):
    """Fake command execution endpoints. Looks like a compromised server
    with a web shell. Logs all commands attackers try to run."""

    def get_type_name(self) -> str:
        return "backdoor"

    def get_extra_router(self) -> APIRouter:
        ...
```

#### `get_extra_router` details:

Create an `APIRouter()` with these routes:

1. `POST /api/exec` — Accept JSON body `{"cmd": "..."}`. Extract the command string. Generate a fake plausible output based on the command. The forensic middleware logs the exact command attempted.

Fake output generation logic:
```python
async def fake_exec(request: Request):
    body = await request.json()
    cmd = body.get("cmd", "")

    # Generate plausible-looking fake output
    fake_outputs = {
        "id": "uid=33(www-data) gid=33(www-data) groups=33(www-data)",
        "whoami": "www-data",
        "uname": "Linux store-web-01 5.4.0-150-generic #167-Ubuntu SMP x86_64 GNU/Linux",
        "uname -a": "Linux store-web-01 5.4.0-150-generic #167-Ubuntu SMP Mon Oct 2 17:29:44 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux",
        "pwd": "/var/www/html",
        "ls": "app/\nconfig/\npublic/\nvendor/\n.env\ncomposer.json\ncomposer.lock",
        "ls -la": "total 48\ndrwxr-xr-x  8 www-data www-data 4096 Mar 14 12:00 .\ndrwxr-xr-x  3 root     root     4096 Jan 15 09:00 ..\n-rw-r--r--  1 www-data www-data  567 Mar 10 08:30 .env\ndrwxr-xr-x  5 www-data www-data 4096 Mar 14 12:00 app\n-rw-r--r--  1 www-data www-data 2341 Feb 20 14:00 composer.json\ndrwxr-xr-x  3 www-data www-data 4096 Mar 14 12:00 config\ndrwxr-xr-x  2 www-data www-data 4096 Mar 14 12:00 public\ndrwxr-xr-x 45 www-data www-data 4096 Feb 20 14:05 vendor",
        "cat /etc/passwd": "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nmysql:x:27:27:MySQL Server:/var/lib/mysql:/bin/false",
        "ifconfig": "eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 10.0.2.15  netmask 255.255.255.0  broadcast 10.0.2.255",
        "ps aux": "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.1 169316 11888 ?        Ss   Mar14   0:03 /sbin/init\nwww-data   456  0.1  1.2 456789 98765 ?        S    Mar14   1:23 php-fpm: pool www\nmysql      789  0.5  5.4 1234567 432100 ?      Sl   Mar14  12:34 /usr/sbin/mysqld",
        "env": "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nHOME=/var/www\nAPP_ENV=production\nDB_HOST=db-primary.internal\nDB_PASSWORD=Pr0d_$t0r3_2024!xK9m",
    }

    # Check for exact or partial matches
    output = fake_outputs.get(cmd.strip())
    if output is None:
        # Check for partial matches (command starts with known command)
        for known_cmd, known_output in fake_outputs.items():
            if cmd.strip().startswith(known_cmd.split()[0]):
                output = known_output
                break
    if output is None:
        output = f"sh: 1: {cmd.split()[0] if cmd.split() else cmd}: not found"

    return PlainTextResponse(output)
```

2. `GET /api/shell` — Return an HTMLResponse with a fake web shell interface:
```html
<html><head><title>Web Shell</title></head>
<body style="background:#000;color:#0f0;font-family:monospace;">
<h3>$ Web Shell v2.1</h3>
<form method="POST" action="/api/exec">
<input name="cmd" type="text" style="width:80%;background:#000;color:#0f0;border:1px solid #0f0;" placeholder="Enter command...">
<button type="submit" style="background:#0f0;color:#000;">Run</button>
</form></body></html>
```

3. `POST /api/shell` — Same as `/api/exec`, accept `cmd` field from form data or JSON.

4. `POST /api/upload` — Accept file upload (any file). Log the filename and size. Return `{"status": "uploaded", "path": "/var/www/html/uploads/" + filename}`. Do not actually save the file.

---

### `app/services/behavior/shellcode.py`

```python
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.services.behavior.base import BaseBehavior
import binascii


class ShellcodeBehavior(BaseBehavior):
    """Accepts binary payloads without error. Logs hex dumps of received
    shellcode for analysis. Returns fake execution results."""

    def get_type_name(self) -> str:
        return "shellcode"

    def get_extra_router(self) -> APIRouter:
        ...
```

#### `get_extra_router` details:

Create an `APIRouter()` with these routes:

1. `POST /api/execute` — Accept raw binary body. Read the full body bytes. Create a hex dump for logging. Return:
```python
{
    "status": "success",
    "execution_time_ms": random.randint(10, 500),
    "output": "Process completed successfully",
    "pid": random.randint(10000, 65535),
    "return_code": 0,
}
```

The hex dump logging should be done by reading the raw body:
```python
async def execute_payload(request: Request):
    body = await request.body()
    hex_dump = binascii.hexlify(body).decode("ascii") if body else ""
    # The forensic middleware captures the raw body automatically
    # But we also log the hex representation explicitly
    import logging
    logger = logging.getLogger("honeypot.shellcode")
    logger.warning(f"Received binary payload: size={len(body)} bytes, hex_preview={hex_dump[:200]}")
    ...
```

2. `POST /api/inject` — Same behavior as `/api/execute` but with different response:
```python
{
    "status": "injected",
    "target_pid": random.randint(1000, 9999),
    "bytes_written": len(body),
    "memory_address": f"0x{random.randint(0x400000, 0x7fffff):08x}",
}
```

3. `POST /api/payload` — Accept any content type. Return:
```python
{
    "status": "received",
    "size": len(body),
    "hash": hashlib.md5(body).hexdigest() if body else "d41d8cd98f00b204e9800998ecf8427e",
    "queued": True,
}
```

Import `hashlib` at the top of the file.

---

### `app/services/behavior/worms.py`

```python
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.services.behavior.base import BaseBehavior
import random


class WormsBehavior(BaseBehavior):
    """Fake propagation endpoints. Looks like an infected server that accepts
    worm propagation commands. Logs all payloads and returns fake success."""

    def get_type_name(self) -> str:
        return "worms"

    def get_extra_router(self) -> APIRouter:
        ...
```

#### `get_extra_router` details:

Create an `APIRouter()` with these routes:

1. `POST /api/propagate` — Accept JSON body with target info. Return fake propagation results:
```python
async def propagate(request: Request):
    body = await request.json()
    targets = body.get("targets", [])

    # Generate fake results for each target
    results = []
    for target in targets[:10]:  # limit to 10 to prevent memory issues
        results.append({
            "target": str(target),
            "status": random.choice(["infected", "already_infected", "unreachable", "timeout"]),
            "time_ms": random.randint(50, 3000),
        })

    # If no targets provided, generate fake ones
    if not results:
        results = [
            {"target": f"10.0.{random.randint(1,254)}.{random.randint(1,254)}", "status": "infected", "time_ms": random.randint(100, 2000)}
            for _ in range(random.randint(1, 5))
        ]

    return JSONResponse({
        "propagation_id": f"prop-{random.randint(10000, 99999)}",
        "total_targets": len(results),
        "successful": sum(1 for r in results if r["status"] == "infected"),
        "results": results,
    })
```

2. `POST /api/infect` — Accept JSON body with payload data. Return:
```python
{
    "status": "payload_deployed",
    "infection_id": f"inf-{random.randint(10000, 99999)}",
    "persistence": random.choice(["crontab", "systemd", "rc.local", "init.d"]),
    "c2_callback": f"http://10.0.{random.randint(1,254)}.{random.randint(1,254)}:8443/beacon",
}
```

3. `GET /api/status` — Return fake botnet status:
```python
{
    "node_id": f"node-{random.randint(1000, 9999)}",
    "uptime_hours": random.randint(1, 720),
    "infected_hosts": random.randint(3, 50),
    "last_c2_contact": "2026-03-15T11:55:00Z",
    "version": "2.1.4",
    "os": "Linux 5.4.0-150-generic",
}
```

4. `POST /api/download` — Accept any body. Return fake download confirmation:
```python
{
    "status": "downloaded",
    "filename": f"payload_{random.randint(1000, 9999)}.bin",
    "size": len(body),
    "installed": True,
}
```

---

### `app/controllers/__init__.py`

Empty file.

---

### `app/controllers/product_controller.py`

```python
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from app.services.dummy_store_service import DummyStoreService


router = APIRouter(prefix="/api/products", tags=["products"])

# The service instance is injected at app startup via a module-level variable
_service: DummyStoreService = None  # Set by main.py
_behavior = None  # Set by main.py


def init(service: DummyStoreService, behavior):
    global _service, _behavior
    _service = service
    _behavior = behavior
```

#### Routes:

1. `GET /api/products/` — List products with optional filtering:

```python
@router.get("/")
async def list_products(
    request: Request,
    search: Optional[str] = None,
    category: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
):
    # Call behavior pre_response_hook
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    result = await _service.list_products(search, category, page, per_page)
    return result
```

2. `GET /api/products/{product_id}` — Get single product:

```python
@router.get("/{product_id}")
async def get_product(request: Request, product_id: int):
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    product = await _service.get_product(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
```

---

### `app/controllers/cart_controller.py`

```python
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from app.services.dummy_store_service import DummyStoreService
from app.models.schemas import AddToCartRequest, UpdateCartItemRequest
import uuid


router = APIRouter(prefix="/api/cart", tags=["cart"])

_service: DummyStoreService = None
_behavior = None


def init(service: DummyStoreService, behavior):
    global _service, _behavior
    _service = service
    _behavior = behavior
```

#### Session ID handling:

Extract session ID from either:
- A cookie named `session_id`
- A header named `X-Session-ID`
- If neither exists, generate a new UUID and use it

```python
def _get_session_id(request: Request) -> str:
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = request.headers.get("x-session-id")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id
```

#### Routes:

1. `GET /api/cart/` — Get current cart:

```python
@router.get("/")
async def get_cart(request: Request):
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    session_id = _get_session_id(request)
    return await _service.get_cart(session_id)
```

2. `POST /api/cart/items` — Add item to cart:

```python
@router.post("/items", status_code=201)
async def add_to_cart(request: Request, data: AddToCartRequest):
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    session_id = _get_session_id(request)
    try:
        return await _service.add_to_cart(session_id, data.product_id, data.quantity)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

3. `PUT /api/cart/items/{item_id}` — Update cart item quantity:

```python
@router.put("/items/{item_id}")
async def update_cart_item(request: Request, item_id: int, data: UpdateCartItemRequest):
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    session_id = _get_session_id(request)
    result = await _service.update_cart_item(session_id, item_id, data.quantity)
    if result is None:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return result
```

4. `DELETE /api/cart/items/{item_id}` — Remove cart item:

```python
@router.delete("/items/{item_id}", status_code=204)
async def remove_cart_item(request: Request, item_id: int):
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    session_id = _get_session_id(request)
    removed = await _service.remove_cart_item(session_id, item_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return None
```

---

### `app/controllers/order_controller.py`

```python
from fastapi import APIRouter, HTTPException, Request
from app.services.dummy_store_service import DummyStoreService
from app.models.schemas import CreateOrderRequest


router = APIRouter(prefix="/api/orders", tags=["orders"])

_service: DummyStoreService = None
_behavior = None


def init(service: DummyStoreService, behavior):
    global _service, _behavior
    _service = service
    _behavior = behavior
```

#### Routes:

1. `POST /api/orders/` — Create order:

```python
@router.post("/", status_code=201)
async def create_order(request: Request, data: CreateOrderRequest):
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    session_id = _get_session_id(request)
    try:
        return await _service.create_order(
            session_id, data.customer_name, data.customer_email, data.shipping_address
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

Use the same `_get_session_id` helper as cart_controller (import or duplicate it).

2. `GET /api/orders/{order_id}` — Get order:

```python
@router.get("/{order_id}")
async def get_order(request: Request, order_id: int):
    override = await _behavior.pre_response_hook(request)
    if override is not None:
        raise HTTPException(status_code=override["status_code"], detail=override["body"].get("detail", "Error"))

    order = await _service.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
```

---

### `app/controllers/bait_controller.py`

This controller is a passthrough that registers the extra routes from the behavior's `get_extra_router()` method. It does not define its own routes.

```python
from fastapi import APIRouter
from app.services.behavior.base import BaseBehavior


def get_bait_router(behavior: BaseBehavior) -> APIRouter | None:
    """Get the extra bait router from the behavior, if any."""
    return behavior.get_extra_router()
```

This is called in `main.py` to conditionally include behavior-specific routes.

---

### `app/middleware/__init__.py`

Empty file.

---

### `app/middleware/forensic_middleware.py`

```python
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi.responses import StreamingResponse
from app.services.forensic_logger_service import ForensicLoggerService
from app.services.behavior.base import BaseBehavior


class ForensicMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, forensic_logger: ForensicLoggerService, behavior: BaseBehavior):
        super().__init__(app)
        self._forensic_logger = forensic_logger
        self._behavior = behavior

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()

        # Read and cache request body
        request_body = await request.body()

        # Process the request
        response = await call_next(request)

        # Read response body
        response_body_bytes = b""
        async for chunk in response.body_iterator:
            response_body_bytes += chunk if isinstance(chunk, bytes) else chunk.encode()

        # Calculate latency
        latency_ms = (time.perf_counter() - start_time) * 1000

        # Log forensically
        response_body_str = response_body_bytes.decode("utf-8", errors="replace")
        await self._forensic_logger.log_request(
            request=request,
            request_body=request_body,
            response_status=response.status_code,
            response_body=response_body_str,
            latency_ms=latency_ms,
        )

        # Modify response headers via behavior
        new_headers = dict(response.headers)
        new_headers = self._behavior.modify_headers(new_headers)

        # Create new response with modified headers and consumed body
        return Response(
            content=response_body_bytes,
            status_code=response.status_code,
            headers=new_headers,
            media_type=response.media_type,
        )
```

#### Important implementation details:

1. **Request body caching**: The body can only be read once from a Starlette request. After reading it in the middleware, downstream handlers won't be able to read it. To fix this, override `request._receive` to return the cached body:

```python
# After reading the body, re-inject it for downstream handlers
async def receive():
    return {"type": "http.request", "body": request_body}
request._receive = receive
```

Put this right after `request_body = await request.body()`.

2. **Response body capture**: The response body_iterator can also only be consumed once. After reading it, reconstruct the response with the captured bytes.

3. **Error handling**: Wrap the entire dispatch in try/except. If an exception occurs, still log what we can (the request details, with response_status=500 and empty response_body).

4. **Skip health endpoint**: Do not log requests to `/health` or `/healthz` — these are Kubernetes probes and would flood the logs:

```python
if request.url.path in ("/health", "/healthz"):
    return await call_next(request)
```

---

### `app/utils/__init__.py`

Empty file.

---

### `app/utils/logging.py`

```python
import logging
import sys
from pythonjsonlogger import jsonlogger
from app.config import settings


def setup_logging():
    """Configure structured JSON logging for the entire application."""

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG))

    # Remove default handlers
    root_logger.handlers.clear()

    # JSON formatter
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # Stdout handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Set uvicorn loggers to use our format too
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        uv_logger = logging.getLogger(logger_name)
        uv_logger.handlers.clear()
        uv_logger.addHandler(handler)
        uv_logger.propagate = False
```

---

### `app/main.py`

```python
import logging
from fastapi import FastAPI
from app.config import settings
from app.utils.logging import setup_logging
from app.repositories.dummy_data_repository import DummyDataRepository
from app.services.dummy_store_service import DummyStoreService
from app.services.forensic_logger_service import ForensicLoggerService
from app.services.behavior import get_behavior
from app.controllers import product_controller, cart_controller, order_controller
from app.controllers.bait_controller import get_bait_router
from app.middleware.forensic_middleware import ForensicMiddleware


# Setup logging first
setup_logging()
logger = logging.getLogger("honeypot.main")

# Load behavior based on HONEYPOT_TYPE
behavior = get_behavior(settings.HONEYPOT_TYPE)
logger.info(f"Starting honeypot with behavior: {behavior.get_type_name()}")

# Initialize repository and service
repo = DummyDataRepository()
service = DummyStoreService(repo, behavior)
forensic_logger = ForensicLoggerService()

# Create FastAPI app
# Title and description mimic a real store API to further deceive attackers
app = FastAPI(
    title="Store API",
    description="E-commerce Store Backend API",
    version="1.0.0",
    docs_url=None,    # Disable Swagger UI — real stores typically don't expose this
    redoc_url=None,   # Disable ReDoc too
    openapi_url=None, # Disable OpenAPI schema
)

# Initialize controllers with service and behavior
product_controller.init(service, behavior)
cart_controller.init(service, behavior)
order_controller.init(service, behavior)

# Register standard store routes
app.include_router(product_controller.router)
app.include_router(cart_controller.router)
app.include_router(order_controller.router)

# Register behavior-specific bait routes (if any)
bait_router = get_bait_router(behavior)
if bait_router is not None:
    app.include_router(bait_router)

# Add forensic middleware (must be added after routes)
app.add_middleware(ForensicMiddleware, forensic_logger=forensic_logger, behavior=behavior)


# Health endpoint (not logged by forensic middleware)
@app.get("/health")
async def health():
    return {"status": "healthy", "type": settings.HONEYPOT_TYPE}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
```

#### Key design decisions in main.py:

1. **Swagger/ReDoc disabled**: A real e-commerce store would not expose API docs publicly. Disabling these makes the honeypot indistinguishable from a real production API.

2. **Title mimics real store**: The FastAPI title says "Store API" — if anything leaks, it looks normal.

3. **Module-level initialization**: The behavior, repo, service, and logger are created at module level (on import/startup). This is fine because there's only one behavior per container instance.

4. **Controller init pattern**: Controllers use a module-level `init()` function to receive the service and behavior instances. This avoids complex dependency injection while keeping things testable.

---

### `tests/__init__.py`

Empty file.

---

### `tests/test_dummy_store.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)
```

#### Test cases to implement:

1. **`test_health_endpoint`**: `GET /health` returns 200 with `{"status": "healthy", ...}`.

2. **`test_list_products`**: `GET /api/products/` returns 200 with JSON containing `items` (list), `total` (int), `page` (int), `per_page` (int), `pages` (int). Items should be non-empty.

3. **`test_list_products_with_search`**: `GET /api/products/?search=bluetooth` returns products with "bluetooth" in name or description.

4. **`test_list_products_with_category`**: `GET /api/products/?category=Electronics` returns only electronics products.

5. **`test_get_product`**: `GET /api/products/1` returns 200 with product data matching id=1.

6. **`test_get_product_not_found`**: `GET /api/products/99999` returns 404.

7. **`test_get_empty_cart`**: `GET /api/cart/` returns 200 with `{"items": [], "total": 0, "item_count": 0}`.

8. **`test_add_to_cart`**: `POST /api/cart/items` with `{"product_id": 1, "quantity": 2}` returns 201 with cart item data.

9. **`test_add_to_cart_invalid_product`**: `POST /api/cart/items` with `{"product_id": 99999, "quantity": 1}` returns 404.

10. **`test_create_order`**: Add item to cart, then `POST /api/orders/` with customer data. Returns 201 with order data including `id`, `status` = `"pending"`.

11. **`test_create_order_empty_cart`**: `POST /api/orders/` without adding to cart first returns 400.

12. **`test_products_response_format`**: Verify each product in the response has all required fields: `id`, `name`, `description`, `price`, `image_url`, `category`, `stock`, `created_at`.

All tests should be runnable with `pytest tests/` from the `honeypots/` directory.

---

## Kubernetes Deployment Specifications

### Deployment Pattern

Nine separate Deployments, all using the same Docker image (`honeypot:latest`), differentiated only by the `HONEYPOT_TYPE` environment variable.

#### Template for each deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: honeypot-{type}
  namespace: honeypots
  labels:
    app: honeypot
    honeypot-type: {type}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: honeypot
      honeypot-type: {type}
  template:
    metadata:
      labels:
        app: honeypot
        honeypot-type: {type}
    spec:
      containers:
        - name: honeypot
          image: honeypot:latest
          ports:
            - containerPort: 8000
          env:
            - name: HONEYPOT_TYPE
              value: "{type}"
            - name: LOG_LEVEL
              value: "DEBUG"
          resources:
            requests:
              cpu: "25m"
              memory: "32Mi"
            limits:
              cpu: "50m"
              memory: "64Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 3
            periodSeconds: 10
```

#### Nine deployments:

| Deployment Name | HONEYPOT_TYPE | Purpose |
|---|---|---|
| `honeypot-generic` | `generic` | Standard fake store, baseline logging |
| `honeypot-exploits` | `exploits` | SQL injection bait, fake admin panels |
| `honeypot-fuzzers` | `fuzzers` | Random error responses to engage fuzzers |
| `honeypot-dos` | `dos` | Tarpitting with 1-5s delays |
| `honeypot-recon` | `reconnaissance` | Fake .env, robots.txt, backup files |
| `honeypot-analysis` | `analysis` | Fake internal APIs and business data |
| `honeypot-backdoor` | `backdoor` | Fake web shell and command execution |
| `honeypot-shellcode` | `shellcode` | Binary payload acceptance and logging |
| `honeypot-worms` | `worms` | Fake propagation and infection endpoints |

#### Service for each deployment:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: honeypot-{type}
  namespace: honeypots
  labels:
    app: honeypot
    honeypot-type: {type}
spec:
  type: ClusterIP
  selector:
    app: honeypot
    honeypot-type: {type}
  ports:
    - port: 8000
      targetPort: 8000
      protocol: TCP
```

These ClusterIP services are accessed internally by the AI router. External traffic never hits honeypots directly — the AI router decides which honeypot (if any) to forward a request to based on threat analysis.

#### Resource limits rationale:

- **50m CPU, 64Mi RAM**: Honeypots are extremely lightweight. They do no real computation, no database queries, no file I/O. They receive a request, look up in-memory data, format a response, log it, and return. Even the DoS honeypot only uses `asyncio.sleep()` which is nearly zero-cost.
- **1 replica each**: Honeypots are disposable. If one goes down, Kubernetes restarts it. No scaling needed — if an attacker is flooding a honeypot, that's fine (they're wasting their time on a fake).

---

## Integration with the AI Router

The AI router (not part of this service) classifies incoming requests and decides routing:

- **Legitimate traffic** → real store-backend
- **Suspicious traffic** → one of the 9 honeypots based on attack classification

The AI router communicates with honeypots via their ClusterIP services:
- `http://honeypot-generic.honeypots:8000/api/products/`
- `http://honeypot-exploits.honeypots:8000/api/products/`
- etc.

The honeypot receives the proxied request, processes it identically to how the real store would (same endpoints, same response format), and additionally logs everything forensically.

From the attacker's perspective, there is no difference. They see the same API, same data structure, same HTTP status codes. They don't know they've been routed to a honeypot.

---

## Logging and Observability

### Log format

All forensic logs are structured JSON, written to stdout. Example:

```json
{
  "event": "honeypot_interaction",
  "honeypot_type": "exploits",
  "timestamp": "2026-03-15T12:00:00+00:00",
  "source_ip": "192.168.1.100",
  "method": "POST",
  "path": "/api/orders/",
  "headers": {
    "host": "store.example.com",
    "user-agent": "Mozilla/5.0 (compatible; sqlmap/1.6)",
    "content-type": "application/json",
    "accept": "*/*"
  },
  "query_params": {},
  "body": "{\"customer_name\": \"' OR 1=1 --\", \"customer_email\": \"test@test.com\", \"shipping_address\": \"123 Fake St\"}",
  "body_size": 102,
  "response_status": 201,
  "response_body_preview": "{\"id\": 1001, \"customer_name\": \"' OR 1=1 --\", \"status\": \"pending\", ...}",
  "latency_ms": 12.3
}
```

### Log pipeline

```
Honeypot (stdout JSON) → Filebeat sidecar → Elasticsearch → Kibana dashboards
```

Filebeat configuration is not part of this service — it's handled by the infrastructure layer. The honeypot's only responsibility is writing structured JSON to stdout.

### What gets logged:

- **Every single request**, including:
  - Full headers (User-Agent is especially valuable for fingerprinting tools like sqlmap, nikto, etc.)
  - Full request body (attacker payloads, injection attempts, credential guesses)
  - Full query parameters
  - Source IP
  - Response status and body preview
  - Request latency
  - Honeypot type that handled it

This data enables:
- Identifying attacker tools by User-Agent
- Capturing credential guesses
- Analyzing attack patterns
- Building attacker profiles
- Correlating attacks across honeypot types

---

## Security Considerations

1. **No real data**: Honeypots contain zero real data. All products, users, credentials are fake. Even if an attacker fully compromises a honeypot container, they get nothing of value.

2. **No database connections**: Honeypots have no database credentials, no connection strings, no access to real data stores. The only "data" is hardcoded Python dicts.

3. **No outbound access**: In Kubernetes, NetworkPolicies should block honeypot pods from making any outbound connections (except to the logging infrastructure). A compromised honeypot cannot be used as a pivot point.

4. **Non-root user**: The Dockerfile creates a non-root user. Even if code execution is achieved, the attacker has minimal privileges.

5. **Read-only filesystem**: In Kubernetes, set `readOnlyRootFilesystem: true` in the security context. The honeypot writes nothing to disk.

6. **Resource limits**: Strict CPU/memory limits prevent a compromised honeypot from affecting other workloads.

---

## Build and Run

### Local development:

```bash
cd honeypots/
pip install -r requirements.txt
HONEYPOT_TYPE=generic uvicorn app.main:app --reload --port 8000
```

### Docker build:

```bash
docker build -t honeypot:latest ./honeypots/
```

### Docker run (any type):

```bash
docker run -e HONEYPOT_TYPE=exploits -p 8000:8000 honeypot:latest
docker run -e HONEYPOT_TYPE=dos -p 8001:8000 honeypot:latest
docker run -e HONEYPOT_TYPE=reconnaissance -p 8002:8000 honeypot:latest
```

### Run tests:

```bash
cd honeypots/
HONEYPOT_TYPE=generic pytest tests/ -v
```

---

## Summary of Key Design Decisions

1. **Single image, multiple behaviors**: One Docker image, 9 behavior types driven by env var. This minimizes build complexity and ensures all honeypots share the same store-clone foundation.

2. **Exact API clone**: The honeypot's API routes, response schemas, and HTTP behavior are identical to the real store-backend. This is the core requirement — indistinguishability.

3. **In-memory everything**: No database, no persistence, no external dependencies. Honeypots are disposable, stateless (within a session), and fast to start.

4. **Forensic logging as the primary purpose**: Every request is logged in detail. The honeypot's value is not in serving fake products — it's in capturing attacker behavior.

5. **Behavioral hooks**: The BaseBehavior class provides clean extension points. Each attack type can modify responses, add routes, inject delays, or modify headers without changing the core store logic.

6. **Minimal resource footprint**: 50m CPU, 64Mi RAM per honeypot. Running all 9 costs less than a single real application pod.
