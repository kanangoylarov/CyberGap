"""Seed the database with initial product data.

Run with: python -m app.seed.seed_data
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.database import async_session, engine
from app.models.orm import Product
from app.utils.logging import setup_logging

logger = logging.getLogger(__name__)

PRODUCTS = [
    # ── Electronics ──────────────────────────────────────────────────────────
    {
        "name": "Wireless Bluetooth Headphones",
        "description": "Premium over-ear headphones with active noise cancellation and 30-hour battery life.",
        "price": 79.99,
        "image_url": "https://picsum.photos/seed/headphones/400/400",
        "category": "Electronics",
        "stock": 50,
    },
    {
        "name": "USB-C Fast Charger",
        "description": "65W GaN charger with dual USB-C ports for laptops and phones.",
        "price": 34.99,
        "image_url": "https://picsum.photos/seed/charger/400/400",
        "category": "Electronics",
        "stock": 120,
    },
    {
        "name": "Mechanical Keyboard",
        "description": "Compact 75% layout keyboard with hot-swappable switches and RGB backlighting.",
        "price": 109.99,
        "image_url": "https://picsum.photos/seed/keyboard/400/400",
        "category": "Electronics",
        "stock": 35,
    },
    {
        "name": "Portable Bluetooth Speaker",
        "description": "Waterproof speaker with 360-degree sound and 12-hour playtime.",
        "price": 49.99,
        "image_url": "https://picsum.photos/seed/speaker/400/400",
        "category": "Electronics",
        "stock": 75,
    },
    {
        "name": "Wireless Mouse",
        "description": "Ergonomic wireless mouse with adjustable DPI and silent clicks.",
        "price": 29.99,
        "image_url": "https://picsum.photos/seed/mouse/400/400",
        "category": "Electronics",
        "stock": 200,
    },
    # ── Clothing ─────────────────────────────────────────────────────────────
    {
        "name": "Classic Cotton T-Shirt",
        "description": "Soft 100% organic cotton t-shirt available in multiple colors.",
        "price": 24.99,
        "image_url": "https://picsum.photos/seed/tshirt/400/400",
        "category": "Clothing",
        "stock": 300,
    },
    {
        "name": "Slim Fit Jeans",
        "description": "Stretch denim jeans with a modern slim fit and comfortable waistband.",
        "price": 59.99,
        "image_url": "https://picsum.photos/seed/jeans/400/400",
        "category": "Clothing",
        "stock": 150,
    },
    {
        "name": "Lightweight Hoodie",
        "description": "French terry hoodie perfect for layering in cool weather.",
        "price": 44.99,
        "image_url": "https://picsum.photos/seed/hoodie/400/400",
        "category": "Clothing",
        "stock": 80,
    },
    {
        "name": "Running Sneakers",
        "description": "Breathable mesh sneakers with cushioned sole for everyday comfort.",
        "price": 89.99,
        "image_url": "https://picsum.photos/seed/sneakers/400/400",
        "category": "Clothing",
        "stock": 60,
    },
    {
        "name": "Wool Beanie",
        "description": "Warm merino wool beanie with a classic ribbed knit design.",
        "price": 19.99,
        "image_url": "https://picsum.photos/seed/beanie/400/400",
        "category": "Clothing",
        "stock": 200,
    },
    # ── Books ────────────────────────────────────────────────────────────────
    {
        "name": "Python Programming Mastery",
        "description": "Comprehensive guide to advanced Python programming patterns and best practices.",
        "price": 39.99,
        "image_url": "https://picsum.photos/seed/pythonbook/400/400",
        "category": "Books",
        "stock": 100,
    },
    {
        "name": "The Art of Clean Code",
        "description": "Learn how to write maintainable, readable, and efficient code.",
        "price": 34.99,
        "image_url": "https://picsum.photos/seed/cleancode/400/400",
        "category": "Books",
        "stock": 85,
    },
    {
        "name": "Data Structures Handbook",
        "description": "Essential reference for algorithms and data structures with real-world examples.",
        "price": 44.99,
        "image_url": "https://picsum.photos/seed/dsbook/400/400",
        "category": "Books",
        "stock": 65,
    },
    {
        "name": "Web Development Fundamentals",
        "description": "From HTML to full-stack: a beginner-friendly guide to building web applications.",
        "price": 29.99,
        "image_url": "https://picsum.photos/seed/webdev/400/400",
        "category": "Books",
        "stock": 110,
    },
    {
        "name": "Machine Learning in Practice",
        "description": "Hands-on projects and techniques for applying ML to real business problems.",
        "price": 49.99,
        "image_url": "https://picsum.photos/seed/mlbook/400/400",
        "category": "Books",
        "stock": 45,
    },
    # ── Home & Kitchen ───────────────────────────────────────────────────────
    {
        "name": "Stainless Steel Water Bottle",
        "description": "Double-walled insulated bottle that keeps drinks cold for 24 hours.",
        "price": 27.99,
        "image_url": "https://picsum.photos/seed/bottle/400/400",
        "category": "Home & Kitchen",
        "stock": 180,
    },
    {
        "name": "Non-Stick Frying Pan",
        "description": "12-inch ceramic-coated pan with a cool-touch handle. Oven safe to 450F.",
        "price": 39.99,
        "image_url": "https://picsum.photos/seed/pan/400/400",
        "category": "Home & Kitchen",
        "stock": 90,
    },
    {
        "name": "Bamboo Cutting Board Set",
        "description": "Set of 3 eco-friendly bamboo cutting boards in different sizes.",
        "price": 32.99,
        "image_url": "https://picsum.photos/seed/cuttingboard/400/400",
        "category": "Home & Kitchen",
        "stock": 70,
    },
    {
        "name": "LED Desk Lamp",
        "description": "Adjustable LED lamp with 5 brightness levels and USB charging port.",
        "price": 36.99,
        "image_url": "https://picsum.photos/seed/desklamp/400/400",
        "category": "Home & Kitchen",
        "stock": 55,
    },
    {
        "name": "French Press Coffee Maker",
        "description": "34oz borosilicate glass French press with stainless steel filter.",
        "price": 24.99,
        "image_url": "https://picsum.photos/seed/frenchpress/400/400",
        "category": "Home & Kitchen",
        "stock": 95,
    },
    # ── Sports ───────────────────────────────────────────────────────────────
    {
        "name": "Yoga Mat",
        "description": "Extra-thick 6mm non-slip yoga mat with carrying strap.",
        "price": 29.99,
        "image_url": "https://picsum.photos/seed/yogamat/400/400",
        "category": "Sports",
        "stock": 140,
    },
    {
        "name": "Resistance Bands Set",
        "description": "Set of 5 resistance bands with varying tensions for home workouts.",
        "price": 19.99,
        "image_url": "https://picsum.photos/seed/bands/400/400",
        "category": "Sports",
        "stock": 200,
    },
    {
        "name": "Adjustable Dumbbells",
        "description": "Quick-change dumbbell set adjustable from 5 to 52.5 lbs per hand.",
        "price": 249.99,
        "image_url": "https://picsum.photos/seed/dumbbells/400/400",
        "category": "Sports",
        "stock": 25,
    },
    {
        "name": "Jump Rope",
        "description": "Speed jump rope with ball bearings and adjustable cable length.",
        "price": 14.99,
        "image_url": "https://picsum.photos/seed/jumprope/400/400",
        "category": "Sports",
        "stock": 160,
    },
    {
        "name": "Foam Roller",
        "description": "High-density foam roller for muscle recovery and deep tissue massage.",
        "price": 22.99,
        "image_url": "https://picsum.photos/seed/foamroller/400/400",
        "category": "Sports",
        "stock": 110,
    },
]


async def seed() -> None:
    """Insert seed products if the products table is empty."""
    async with async_session() as session:
        result = await session.execute(select(Product).limit(1))
        if result.scalars().first() is not None:
            logger.info("Products already exist, skipping seed")
            return

        for product_data in PRODUCTS:
            product = Product(**product_data)
            session.add(product)

        await session.commit()
        logger.info("Seeded %d products", len(PRODUCTS))


async def main() -> None:
    setup_logging()
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
