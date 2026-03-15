import logging
import random
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.behavior.base import BaseBehavior

logger = logging.getLogger("honeypot.analysis")

FAKE_USERS = [
    {"id": 1, "username": "admin", "email": "admin@myshopapp.com", "role": "superadmin", "last_login": "2024-03-14T22:10:03Z", "status": "active"},
    {"id": 2, "username": "jdoe", "email": "john.doe@myshopapp.com", "role": "admin", "last_login": "2024-03-14T18:45:12Z", "status": "active"},
    {"id": 3, "username": "smanager", "email": "sarah.m@myshopapp.com", "role": "store_manager", "last_login": "2024-03-14T20:30:00Z", "status": "active"},
    {"id": 4, "username": "warehouse1", "email": "wh-ops@myshopapp.com", "role": "warehouse", "last_login": "2024-03-13T08:00:00Z", "status": "active"},
    {"id": 5, "username": "cs_agent", "email": "support@myshopapp.com", "role": "customer_support", "last_login": "2024-03-14T16:20:33Z", "status": "active"},
    {"id": 6, "username": "dev_tom", "email": "tom.dev@myshopapp.com", "role": "developer", "last_login": "2024-03-14T23:55:10Z", "status": "active"},
    {"id": 7, "username": "marketing", "email": "marketing@myshopapp.com", "role": "marketing", "last_login": "2024-03-12T14:00:00Z", "status": "inactive"},
    {"id": 8, "username": "old_admin", "email": "legacy-admin@myshopapp.com", "role": "admin", "last_login": "2023-11-20T10:00:00Z", "status": "disabled"},
]

FAKE_CONFIG = {
    "database": {
        "driver": "mysql",
        "host": "10.0.3.42",
        "port": 3306,
        "name": "myshop_production",
        "username": "shop_admin",
        "password": "Pr0d_$h0p_DB!2024#Secure",
        "pool_size": 20,
        "max_overflow": 10,
    },
    "redis": {
        "host": "10.0.3.45",
        "port": 6379,
        "password": "R3d!s_Pr0d_P@ss_2024",
        "db": 0,
        "max_connections": 50,
    },
    "s3": {
        "bucket": "myshop-assets-prod",
        "region": "us-east-1",
        "access_key": "AKIAIOSFODNN7EXAMPLE",
        "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "cdn_url": "https://cdn.myshopapp.com",
    },
    "cache": {
        "driver": "redis",
        "ttl": 3600,
        "prefix": "myshop_",
    },
    "session": {
        "driver": "redis",
        "lifetime": 120,
        "encrypt": False,
    },
    "features": {
        "enable_2fa": True,
        "maintenance_mode": False,
        "debug_mode": True,
        "rate_limiting": True,
        "max_requests_per_minute": 60,
    },
}

SUPPLIERS = [
    "TechCorp International",
    "GlobalParts Ltd.",
    "DirectSource Manufacturing",
    "PremiumGoods Co.",
    "ValueChain Supply",
    "QuickShip Distributors",
    "MegaWholesale Inc.",
]


class AnalysisBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "analysis"

    def modify_product_response(self, products: list[dict]) -> list[dict]:
        for product in products:
            base_price = product.get("price", 10.0)
            cost = round(base_price * random.uniform(0.20, 0.50), 2)
            margin = round(((base_price - cost) / base_price) * 100, 1) if base_price > 0 else 0.0
            product["cost_price"] = cost
            product["supplier"] = random.choice(SUPPLIERS)
            product["profit_margin"] = margin
            product["total_sold"] = random.randint(50, 15000)
            product["return_rate"] = round(random.uniform(0.5, 12.0), 1)
        return products

    def get_extra_router(self) -> APIRouter:
        router = APIRouter()

        @router.get("/api/internal/users")
        async def internal_users(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            logger.warning("Internal users endpoint accessed from %s", source_ip)
            return JSONResponse(
                content={
                    "users": FAKE_USERS,
                    "total": len(FAKE_USERS),
                    "page": 1,
                    "per_page": 50,
                },
                status_code=200,
            )

        @router.get("/api/internal/config")
        async def internal_config(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            logger.warning(
                "CRITICAL: Internal config endpoint accessed from %s", source_ip
            )
            return JSONResponse(content=FAKE_CONFIG, status_code=200)

        @router.get("/api/internal/stats")
        async def internal_stats(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            logger.warning("Internal stats endpoint accessed from %s", source_ip)
            stats = {
                "revenue": {
                    "today": round(random.uniform(5000, 25000), 2),
                    "this_week": round(random.uniform(30000, 150000), 2),
                    "this_month": round(random.uniform(100000, 500000), 2),
                    "this_year": round(random.uniform(1000000, 5000000), 2),
                },
                "orders": {
                    "today": random.randint(50, 500),
                    "pending": random.randint(10, 100),
                    "shipped": random.randint(20, 200),
                    "returned": random.randint(1, 30),
                    "cancelled": random.randint(2, 20),
                },
                "customers": {
                    "total_registered": random.randint(50000, 200000),
                    "active_last_30d": random.randint(10000, 50000),
                    "new_today": random.randint(20, 200),
                    "avg_order_value": round(random.uniform(35, 120), 2),
                },
                "inventory": {
                    "total_products": random.randint(500, 5000),
                    "low_stock_alerts": random.randint(5, 50),
                    "out_of_stock": random.randint(2, 25),
                    "warehouse_utilization": f"{random.randint(60, 95)}%",
                },
                "system": {
                    "cpu_usage": f"{random.randint(15, 75)}%",
                    "memory_usage": f"{random.randint(40, 85)}%",
                    "disk_usage": f"{random.randint(30, 70)}%",
                    "active_connections": random.randint(50, 500),
                    "avg_response_time_ms": round(random.uniform(20, 150), 1),
                },
            }
            return JSONResponse(content=stats, status_code=200)

        return router

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        return headers
