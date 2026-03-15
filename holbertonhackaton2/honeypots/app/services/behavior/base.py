from abc import ABC, abstractmethod
from typing import Optional
from fastapi import APIRouter, Request


class BaseBehavior(ABC):
    @abstractmethod
    def get_type_name(self) -> str:
        ...

    def modify_product_response(self, products: list[dict]) -> list[dict]:
        return products

    def get_extra_router(self) -> Optional[APIRouter]:
        return None

    async def pre_response_hook(self, request: Request) -> Optional[dict]:
        return None

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        return headers
