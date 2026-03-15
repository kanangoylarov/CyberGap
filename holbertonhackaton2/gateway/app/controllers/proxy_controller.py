from fastapi import APIRouter, Request
from app.services.routing_service import RoutingService
from app.services.proxy_service import ProxyService

router = APIRouter()

routing_service: RoutingService | None = None
proxy_service: ProxyService | None = None


def init_services(routing_svc: RoutingService, proxy_svc: ProxyService) -> None:
    global routing_service, proxy_service
    routing_service = routing_svc
    proxy_service = proxy_svc


@router.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
)
async def proxy_all(request: Request, path: str):
    upstream_host, upstream_port, attack_type, confidence = (
        await routing_service.resolve_upstream(request)
    )
    response = await proxy_service.forward_request(
        request, upstream_host, upstream_port
    )
    response.headers["X-Gateway-Attack-Type"] = str(attack_type)
    response.headers["X-Gateway-Confidence"] = f"{confidence:.3f}"
    return response
