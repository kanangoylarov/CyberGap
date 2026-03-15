import logging
import random
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.behavior.base import BaseBehavior

logger = logging.getLogger("honeypot.worms")

FAKE_NODE_NAMES = [
    "node-alpha-01", "node-beta-02", "node-gamma-03", "node-delta-04",
    "node-epsilon-05", "node-zeta-06", "node-eta-07", "node-theta-08",
    "node-iota-09", "node-kappa-10", "node-lambda-11", "node-mu-12",
]


class WormsBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "worms"

    def get_extra_router(self) -> APIRouter:
        router = APIRouter()

        @router.post("/api/propagate")
        async def propagate(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            try:
                body = await request.json()
                targets = body.get("targets", [])
            except Exception:
                targets = []
            logger.warning(
                "CRITICAL: Worm propagation request from %s — targets=%s",
                source_ip,
                targets,
            )
            reached = random.randint(1, min(5, max(1, len(targets)))) if targets else random.randint(1, 5)
            reached_targets = []
            for i in range(reached):
                if i < len(targets):
                    reached_targets.append(
                        {"target": targets[i], "status": "infected", "latency_ms": round(random.uniform(10, 500), 1)}
                    )
                else:
                    reached_targets.append(
                        {"target": f"10.0.{random.randint(1, 254)}.{random.randint(1, 254)}", "status": "infected", "latency_ms": round(random.uniform(10, 500), 1)}
                    )
            return JSONResponse(
                content={
                    "status": "propagating",
                    "targets_reached": reached,
                    "targets_total": len(targets) if targets else reached,
                    "details": reached_targets,
                    "propagation_id": f"prop-{random.randint(100000, 999999)}",
                },
                status_code=200,
            )

        @router.post("/api/infect")
        async def infect(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            try:
                body = await request.json()
                payload = body.get("payload", "")
            except Exception:
                payload = ""
            logger.warning(
                "CRITICAL: Worm infection request from %s — payload_size=%d",
                source_ip,
                len(str(payload)),
            )
            hosts_infected = random.randint(1, 3)
            infected_hosts = []
            for _ in range(hosts_infected):
                infected_hosts.append({
                    "host": f"10.0.{random.randint(1, 254)}.{random.randint(1, 254)}",
                    "hostname": random.choice(FAKE_NODE_NAMES),
                    "os": random.choice(["Ubuntu 20.04", "Debian 11", "CentOS 7", "Ubuntu 22.04"]),
                    "infection_time_ms": round(random.uniform(50, 2000), 1),
                    "persistence": random.choice(["crontab", "systemd", "rc.local", "init.d"]),
                })
            return JSONResponse(
                content={
                    "status": "success",
                    "hosts_infected": hosts_infected,
                    "details": infected_hosts,
                    "infection_id": f"inf-{random.randint(100000, 999999)}",
                },
                status_code=200,
            )

        @router.get("/api/botnet/status")
        async def botnet_status(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            logger.warning(
                "CRITICAL: Botnet status check from %s", source_ip
            )
            active_nodes = random.randint(50, 500)
            pending_commands = random.randint(0, 20)
            nodes = []
            for i in range(min(10, active_nodes)):
                nodes.append({
                    "node_id": f"bot-{random.randint(10000, 99999)}",
                    "hostname": random.choice(FAKE_NODE_NAMES),
                    "ip": f"10.{random.randint(0, 254)}.{random.randint(0, 254)}.{random.randint(1, 254)}",
                    "os": random.choice(["Linux", "Windows", "FreeBSD"]),
                    "status": random.choice(["active", "active", "active", "idle", "updating"]),
                    "last_seen": f"{random.randint(1, 300)}s ago",
                    "uptime_hours": random.randint(1, 720),
                })
            return JSONResponse(
                content={
                    "botnet_id": "darknet-alpha",
                    "status": "operational",
                    "active_nodes": active_nodes,
                    "total_nodes_ever": active_nodes + random.randint(100, 500),
                    "pending_commands": pending_commands,
                    "commands_executed_24h": random.randint(100, 5000),
                    "c2_server": "10.0.0.1:8443",
                    "encryption": "AES-256-CBC",
                    "protocol": "HTTPS",
                    "sample_nodes": nodes,
                },
                status_code=200,
            )

        return router

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        return headers
