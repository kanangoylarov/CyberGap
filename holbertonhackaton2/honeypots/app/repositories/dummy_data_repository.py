"""In-memory data store with hardcoded fake products for the honeypot."""

import threading
import uuid
from copy import deepcopy
from datetime import datetime, timedelta
from typing import Optional


_BASE_DATE = datetime(2026, 3, 15)


def _created_at(product_id: int) -> datetime:
    """Deterministic created_at based on product id."""
    return _BASE_DATE - timedelta(days=(product_id * 7) % 180)


def _image_url(product_id: int) -> str:
    return f"https://picsum.photos/seed/product{product_id}/400/400"


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

_PRODUCTS: list[dict] = [
    {
        "id": 1,
        "name": "Wireless Bluetooth Headphones Pro X3",
        "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life. Features high-resolution audio drivers for immersive sound quality.",
        "price": 89.99,
        "image_url": _image_url(1),
        "category": "Electronics",
        "stock": 145,
        "created_at": _created_at(1),
    },
    {
        "id": 2,
        "name": "USB-C Fast Charging Hub 7-in-1",
        "description": "Compact multiport adapter with 4K HDMI, USB 3.0, SD card reader, and 100W power delivery pass-through. Compatible with all USB-C laptops and tablets.",
        "price": 45.99,
        "image_url": _image_url(2),
        "category": "Electronics",
        "stock": 312,
        "created_at": _created_at(2),
    },
    {
        "id": 3,
        "name": "Smart LED Desk Lamp with Wireless Charger",
        "description": "Adjustable color temperature desk lamp with built-in Qi wireless charging pad. Touch-sensitive controls with five brightness levels and a memory function.",
        "price": 62.50,
        "image_url": _image_url(3),
        "category": "Electronics",
        "stock": 89,
        "created_at": _created_at(3),
    },
    {
        "id": 4,
        "name": "Portable SSD 1TB External Drive",
        "description": "Ultra-fast external solid state drive with read speeds up to 1050 MB/s. Shock-resistant aluminum casing with USB 3.2 Gen 2 connectivity.",
        "price": 109.99,
        "image_url": _image_url(4),
        "category": "Electronics",
        "stock": 203,
        "created_at": _created_at(4),
    },
    {
        "id": 5,
        "name": "Mechanical Gaming Keyboard RGB",
        "description": "Full-size mechanical keyboard with hot-swappable switches and per-key RGB lighting. Features N-key rollover, macro support, and a detachable wrist rest.",
        "price": 129.99,
        "image_url": _image_url(5),
        "category": "Electronics",
        "stock": 67,
        "created_at": _created_at(5),
    },
    {
        "id": 6,
        "name": "4K Webcam with Ring Light",
        "description": "Ultra HD webcam with built-in adjustable ring light and auto-focus. Dual stereo microphones with noise reduction for crystal-clear video calls.",
        "price": 79.99,
        "image_url": _image_url(6),
        "category": "Electronics",
        "stock": 178,
        "created_at": _created_at(6),
    },
    {
        "id": 7,
        "name": "Organic Cotton Classic T-Shirt",
        "description": "Soft ringspun organic cotton tee with a relaxed fit and reinforced collar. Pre-shrunk fabric that maintains shape wash after wash.",
        "price": 24.99,
        "image_url": _image_url(7),
        "category": "Clothing",
        "stock": 456,
        "created_at": _created_at(7),
    },
    {
        "id": 8,
        "name": "Slim Fit Stretch Chino Pants",
        "description": "Modern slim-fit chinos with two-percent spandex for comfortable all-day wear. Features a flat front and hidden flex waistband.",
        "price": 54.99,
        "image_url": _image_url(8),
        "category": "Clothing",
        "stock": 234,
        "created_at": _created_at(8),
    },
    {
        "id": 9,
        "name": "Waterproof Hiking Jacket",
        "description": "Three-layer waterproof breathable shell with sealed seams and adjustable hood. Lightweight and packable for backcountry adventures in any weather.",
        "price": 149.99,
        "image_url": _image_url(9),
        "category": "Clothing",
        "stock": 98,
        "created_at": _created_at(9),
    },
    {
        "id": 10,
        "name": "Merino Wool Quarter-Zip Pullover",
        "description": "Luxuriously soft merino wool pullover with moisture-wicking and temperature-regulating properties. Naturally odor-resistant for multi-day wear.",
        "price": 89.99,
        "image_url": _image_url(10),
        "category": "Clothing",
        "stock": 167,
        "created_at": _created_at(10),
    },
    {
        "id": 11,
        "name": "Classic Leather Belt",
        "description": "Full-grain leather belt with a brushed nickel buckle and hand-stitched edges. Develops a rich patina over time for a distinguished look.",
        "price": 34.99,
        "image_url": _image_url(11),
        "category": "Clothing",
        "stock": 389,
        "created_at": _created_at(11),
    },
    {
        "id": 12,
        "name": "Performance Running Shorts",
        "description": "Lightweight running shorts with built-in brief liner and moisture-wicking fabric. Features a zippered back pocket and reflective accents for low-light visibility.",
        "price": 38.99,
        "image_url": _image_url(12),
        "category": "Clothing",
        "stock": 278,
        "created_at": _created_at(12),
    },
    {
        "id": 13,
        "name": "Advanced Python Programming Guide",
        "description": "Comprehensive guide covering decorators, metaclasses, async patterns, and performance optimization. Includes real-world projects and best practices from industry experts.",
        "price": 49.99,
        "image_url": _image_url(13),
        "category": "Books",
        "stock": 134,
        "created_at": _created_at(13),
    },
    {
        "id": 14,
        "name": "The Art of Clean Architecture",
        "description": "A practical handbook on building maintainable software systems using SOLID principles and hexagonal architecture. Features case studies from large-scale production systems.",
        "price": 44.99,
        "image_url": _image_url(14),
        "category": "Books",
        "stock": 89,
        "created_at": _created_at(14),
    },
    {
        "id": 15,
        "name": "Data Structures and Algorithms Illustrated",
        "description": "Visual and intuitive introduction to fundamental data structures and algorithms with full-color diagrams. Covers complexity analysis, trees, graphs, and dynamic programming.",
        "price": 39.99,
        "image_url": _image_url(15),
        "category": "Books",
        "stock": 212,
        "created_at": _created_at(15),
    },
    {
        "id": 16,
        "name": "Machine Learning Engineering in Practice",
        "description": "End-to-end guide for deploying ML models to production, covering data pipelines, model serving, monitoring, and MLOps. Written by a seasoned ML infrastructure engineer.",
        "price": 54.99,
        "image_url": _image_url(16),
        "category": "Books",
        "stock": 156,
        "created_at": _created_at(16),
    },
    {
        "id": 17,
        "name": "Creative Writing: Finding Your Voice",
        "description": "An encouraging workshop-style book with exercises to develop your unique writing style. Covers fiction, memoir, and poetry across twenty structured chapters.",
        "price": 19.99,
        "image_url": _image_url(17),
        "category": "Books",
        "stock": 345,
        "created_at": _created_at(17),
    },
    {
        "id": 18,
        "name": "Stainless Steel French Press 34oz",
        "description": "Double-walled insulated French press that keeps coffee hot for over an hour. Features a four-level filtration system for sediment-free brews.",
        "price": 29.99,
        "image_url": _image_url(18),
        "category": "Home&Kitchen",
        "stock": 267,
        "created_at": _created_at(18),
    },
    {
        "id": 19,
        "name": "Non-Stick Ceramic Cookware Set 10-Piece",
        "description": "PFOA-free ceramic-coated cookware set with stainless steel handles and tempered glass lids. Oven-safe up to 450 degrees and compatible with all cooktops.",
        "price": 189.99,
        "image_url": _image_url(19),
        "category": "Home&Kitchen",
        "stock": 78,
        "created_at": _created_at(19),
    },
    {
        "id": 20,
        "name": "Bamboo Cutting Board Set (3-Pack)",
        "description": "Set of three premium bamboo cutting boards in graduated sizes with juice grooves. Naturally antimicrobial and gentler on knife edges than plastic.",
        "price": 32.99,
        "image_url": _image_url(20),
        "category": "Home&Kitchen",
        "stock": 423,
        "created_at": _created_at(20),
    },
    {
        "id": 21,
        "name": "Smart WiFi Instant Pot 6-Quart",
        "description": "App-controlled multi-cooker with pressure cook, slow cook, steam, and sous vide functions. Monitors cooking remotely and sends notifications when meals are ready.",
        "price": 119.99,
        "image_url": _image_url(21),
        "category": "Home&Kitchen",
        "stock": 145,
        "created_at": _created_at(21),
    },
    {
        "id": 22,
        "name": "Egyptian Cotton Bath Towel Set",
        "description": "Six-piece towel set made from long-staple Egyptian cotton with 700 GSM density. Exceptionally absorbent and plush with double-stitched hems for durability.",
        "price": 59.99,
        "image_url": _image_url(22),
        "category": "Home&Kitchen",
        "stock": 198,
        "created_at": _created_at(22),
    },
    {
        "id": 23,
        "name": "Vacuum Insulated Water Bottle 32oz",
        "description": "Triple-insulated stainless steel bottle that keeps drinks cold for 24 hours or hot for 12. Leak-proof lid with built-in carrying loop and wide mouth for ice.",
        "price": 27.99,
        "image_url": _image_url(23),
        "category": "Home&Kitchen",
        "stock": 367,
        "created_at": _created_at(23),
    },
    {
        "id": 24,
        "name": "Yoga Mat Premium 6mm Non-Slip",
        "description": "Extra-thick eco-friendly yoga mat with dual-layer non-slip texture on both sides. Includes alignment markings and a carrying strap for easy transport.",
        "price": 44.99,
        "image_url": _image_url(24),
        "category": "Sports",
        "stock": 289,
        "created_at": _created_at(24),
    },
    {
        "id": 25,
        "name": "Adjustable Dumbbell Set 5-52.5 lbs",
        "description": "Space-saving adjustable dumbbells that replace fifteen sets of weights with a quick-turn dial mechanism. Durable molded trays included for safe storage.",
        "price": 349.99,
        "image_url": _image_url(25),
        "category": "Sports",
        "stock": 34,
        "created_at": _created_at(25),
    },
    {
        "id": 26,
        "name": "Resistance Bands Set (5-Pack)",
        "description": "Five color-coded latex resistance bands ranging from extra-light to extra-heavy. Includes door anchor, ankle straps, and a portable carry bag.",
        "price": 22.99,
        "image_url": _image_url(26),
        "category": "Sports",
        "stock": 445,
        "created_at": _created_at(26),
    },
    {
        "id": 27,
        "name": "GPS Running Watch with Heart Rate",
        "description": "Multi-sport GPS watch with wrist-based heart rate monitoring and built-in route mapping. Tracks VO2 max, training load, and recovery time with week-long battery life.",
        "price": 199.99,
        "image_url": _image_url(27),
        "category": "Sports",
        "stock": 112,
        "created_at": _created_at(27),
    },
    {
        "id": 28,
        "name": "Foam Roller High-Density 18-Inch",
        "description": "Professional-grade high-density EVA foam roller for deep tissue massage and myofascial release. Textured surface targets trigger points for effective recovery.",
        "price": 19.99,
        "image_url": _image_url(28),
        "category": "Sports",
        "stock": 334,
        "created_at": _created_at(28),
    },
]


class DummyDataRepository:
    """Thread-safe in-memory data store for the honeypot."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._products: list[dict] = deepcopy(_PRODUCTS)
        # carts keyed by session_id -> list of cart-item dicts
        self._carts: dict[str, list[dict]] = {}
        # orders keyed by order_id (int) -> order dict
        self._orders: dict[int, dict] = {}
        self._next_cart_item_id: int = 1
        self._next_order_id: int = 1

    # ------------------------------------------------------------------
    # Products
    # ------------------------------------------------------------------

    def get_products(
        self,
        search: Optional[str] = None,
        category: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict], int]:
        """Return a paginated, optionally filtered list of products."""
        with self._lock:
            filtered = list(self._products)

            if category:
                filtered = [
                    p for p in filtered
                    if p["category"].lower() == category.lower()
                ]

            if search:
                term = search.lower()
                filtered = [
                    p for p in filtered
                    if term in p["name"].lower()
                    or term in p["description"].lower()
                ]

            total = len(filtered)
            page = filtered[offset: offset + limit]
            return deepcopy(page), total

    def get_product(self, product_id: int) -> Optional[dict]:
        """Return a single product by id, or None."""
        with self._lock:
            for p in self._products:
                if p["id"] == product_id:
                    return deepcopy(p)
            return None

    # ------------------------------------------------------------------
    # Cart
    # ------------------------------------------------------------------

    def get_cart(self, session_id: str) -> list[dict]:
        """Return all cart items for a session."""
        with self._lock:
            items = self._carts.get(session_id, [])
            return deepcopy(items)

    def add_to_cart(self, session_id: str, product_id: int, quantity: int) -> dict:
        """Add a product to the cart. Returns the new cart item dict."""
        with self._lock:
            product = None
            for p in self._products:
                if p["id"] == product_id:
                    product = deepcopy(p)
                    break

            if product is None:
                raise ValueError(f"Product {product_id} not found")

            if session_id not in self._carts:
                self._carts[session_id] = []

            # Check if product already in cart -- increment quantity
            for item in self._carts[session_id]:
                if item["product_id"] == product_id:
                    item["quantity"] += quantity
                    return deepcopy(item)

            cart_item = {
                "id": self._next_cart_item_id,
                "product_id": product_id,
                "quantity": quantity,
                "product": product,
                "created_at": datetime.utcnow(),
            }
            self._next_cart_item_id += 1
            self._carts[session_id].append(cart_item)
            return deepcopy(cart_item)

    def update_cart_item(
        self, session_id: str, item_id: int, quantity: int
    ) -> Optional[dict]:
        """Update quantity of a cart item. Returns updated item or None."""
        with self._lock:
            items = self._carts.get(session_id, [])
            for item in items:
                if item["id"] == item_id:
                    item["quantity"] = quantity
                    return deepcopy(item)
            return None

    def remove_cart_item(self, session_id: str, item_id: int) -> bool:
        """Remove a cart item. Returns True if found and removed."""
        with self._lock:
            items = self._carts.get(session_id, [])
            for i, item in enumerate(items):
                if item["id"] == item_id:
                    items.pop(i)
                    return True
            return False

    # ------------------------------------------------------------------
    # Orders
    # ------------------------------------------------------------------

    def create_order(
        self,
        session_id: str,
        customer_name: str,
        email: str,
        address: str,
    ) -> dict:
        """Create an order from the current cart contents."""
        with self._lock:
            cart_items = self._carts.get(session_id, [])
            if not cart_items:
                raise ValueError("Cart is empty")

            order_items = []
            total = 0.0
            for ci in cart_items:
                item_price = ci["product"]["price"] * ci["quantity"]
                total += item_price
                order_items.append({
                    "product_id": ci["product_id"],
                    "product_name": ci["product"]["name"],
                    "quantity": ci["quantity"],
                    "price": ci["product"]["price"],
                })

            total = round(total, 2)

            order = {
                "id": self._next_order_id,
                "customer_name": customer_name,
                "customer_email": email,
                "shipping_address": address,
                "total": total,
                "status": "pending",
                "items": order_items,
                "created_at": datetime.utcnow(),
            }
            self._next_order_id += 1
            self._orders[order["id"]] = order

            # Clear the cart after order creation
            self._carts[session_id] = []

            return deepcopy(order)

    def get_order(self, order_id: int) -> Optional[dict]:
        """Return an order by id, or None."""
        with self._lock:
            order = self._orders.get(order_id)
            if order is not None:
                return deepcopy(order)
            return None
