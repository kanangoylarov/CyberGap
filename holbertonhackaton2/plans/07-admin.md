# 07 - Admin Panel + Admin API: Security System Monitoring Dashboard

## Overview

The Admin system consists of two services:

1. **Admin API** (FastAPI backend) — Reads from the gateway database (read-only) and exposes REST + WebSocket endpoints for statistics, fingerprint analysis, and real-time log streaming.
2. **Admin Panel** (React frontend) — A single-page application providing dashboards, tables, and real-time views for monitoring the security system.

The Admin API follows a strict **Model -> Repository -> Service -> Controller** architecture pattern.

---

## Admin API

### Directory Tree

```
admin-api/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py                  # GATEWAY_DB_URL (reads from gatewaydb)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── orm.py                 # GatewayLog SQLAlchemy model (read-only mirror)
│   │   └── schemas.py            # Response DTOs
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── log_repository.py     # Query gateway_logs table
│   │   └── stats_repository.py   # Aggregation queries
│   ├── services/
│   │   ├── __init__.py
│   │   ├── stats_service.py       # Overview stats, time series data
│   │   ├── fingerprint_service.py # Fingerprint listing and detail
│   │   └── live_stream_service.py # WebSocket broadcast of new logs
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── stats_controller.py    # GET /api/admin/stats/*
│   │   ├── fingerprint_controller.py  # GET /api/admin/fingerprints
│   │   ├── log_controller.py      # GET /api/admin/logs
│   │   └── ws_controller.py       # WS /api/admin/ws/live
│   ├── core/
│   │   ├── __init__.py
│   │   ├── database.py
│   │   └── dependencies.py
│   └── utils/
│       └── logging.py
└── tests/
    └── test_stats_service.py
```

---

### config.py

Application configuration loaded from environment variables with sensible defaults.

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GATEWAY_DB_URL: str = "postgresql+asyncpg://gateway:gateway@postgres-gateway.honeypot.svc.cluster.local:5432/gatewaydb"
    LOG_LEVEL: str = "INFO"
    WS_POLL_INTERVAL: float = 2.0  # seconds between WebSocket polls

    class Config:
        env_prefix = "ADMIN_"
```

**Key decisions:**
- `env_prefix = "ADMIN_"` means environment variables are prefixed with `ADMIN_` (e.g., `ADMIN_GATEWAY_DB_URL`). This avoids collisions with other services in the same namespace.
- The database URL points to the **same** PostgreSQL instance used by the gateway service. The admin API only performs SELECT queries (read-only access).
- `WS_POLL_INTERVAL` controls how frequently the WebSocket endpoint polls for new log entries. 2 seconds provides near-real-time updates without excessive database load.
- Uses `asyncpg` driver for async PostgreSQL access, matching the gateway's database driver.

---

### models/orm.py

SQLAlchemy ORM model that mirrors the gateway_logs table. This is a read-only mirror — the admin API never writes to this table.

```python
from sqlalchemy import Column, Integer, String, Float, DateTime, func
from app.core.database import Base


class GatewayLog(Base):
    __tablename__ = "gateway_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    fingerprint = Column(String(64), nullable=False, index=True)
    source_ip = Column(String(45), nullable=False, index=True)
    attack_type = Column(Integer, nullable=False, default=0, index=True)
    attack_label = Column(String(50), nullable=False, default="normal")
    confidence = Column(Float, nullable=False, default=0.0)
    upstream = Column(String(255), nullable=True)
    latency_ms = Column(Float, nullable=True)
    method = Column(String(10), nullable=False)
    path = Column(String(2048), nullable=False)
    user_agent = Column(String(1024), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Column notes:**
- `id` — Auto-incrementing primary key. Used by WebSocket polling to detect new entries (`WHERE id > last_seen_id`).
- `timestamp` — When the request arrived at the gateway. Indexed for time-range queries.
- `fingerprint` — SHA-256 hash of browser fingerprint data. Indexed for fingerprint lookups.
- `source_ip` — Client IP address (IPv4 or IPv6, max 45 chars). Indexed for IP-based filtering.
- `attack_type` — Integer classification: 0=normal, 1=SQLi, 2=XSS, 3=CMDi, 4=path traversal, etc. Indexed for attack type filtering.
- `attack_label` — Human-readable label for the attack type (e.g., "SQL Injection", "Cross-Site Scripting").
- `confidence` — AI model confidence score (0.0 to 1.0).
- `upstream` — Which backend service handled the request (e.g., "store-backend", "honeypot-ssh").
- `latency_ms` — Total request processing time in milliseconds.
- `method` — HTTP method (GET, POST, PUT, DELETE, etc.).
- `path` — Request URL path.
- `user_agent` — Client User-Agent header.
- `created_at` — Database row insertion time (auto-set by PostgreSQL).

---

### models/schemas.py

Pydantic response DTOs (Data Transfer Objects) for all API endpoints.

```python
from datetime import datetime
from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_requests: int
    total_attacks: int
    attack_rate: float  # percentage (0.0 - 100.0)
    unique_ips: int
    unique_fingerprints: int
    top_attack_type: str
    top_attack_count: int
    avg_confidence: float


class AttackBreakdown(BaseModel):
    attack_type: int
    attack_label: str
    count: int
    percentage: float


class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    total: int
    attacks: int
    normal: int


class TimeSeriesResponse(BaseModel):
    points: list[TimeSeriesPoint]
    bucket_size: str  # "1m", "5m", "1h"


class FingerprintSummary(BaseModel):
    fingerprint: str
    source_ip: str
    attack_type: int
    attack_label: str
    confidence: float
    hit_count: int
    first_seen: datetime
    last_seen: datetime


class FingerprintDetail(BaseModel):
    fingerprint: str
    source_ips: list[str]
    attack_type: int
    attack_label: str
    avg_confidence: float
    total_requests: int
    first_seen: datetime
    last_seen: datetime
    recent_paths: list[str]
    methods_used: list[str]


class LogEntry(BaseModel):
    id: int
    timestamp: datetime
    fingerprint: str
    source_ip: str
    attack_type: int
    attack_label: str
    confidence: float
    method: str
    path: str
    user_agent: str


class PaginatedLogs(BaseModel):
    items: list[LogEntry]
    total: int
    page: int
    per_page: int
```

**Schema notes:**
- `OverviewStats` — Aggregate statistics for the dashboard header cards. `attack_rate` is a percentage (e.g., 15.3 means 15.3% of requests are attacks).
- `AttackBreakdown` — One row per attack type with count and percentage. Used for pie charts and breakdown tables.
- `TimeSeriesPoint` — One data point per time bucket. Includes total, attack, and normal counts for overlaid line charts.
- `TimeSeriesResponse` — Wraps the time series data with the bucket size label for frontend display.
- `FingerprintSummary` — Compact view for the fingerprint table. Shows the most recent source_ip and attack_type.
- `FingerprintDetail` — Expanded view for a single fingerprint. Shows all source IPs used, all methods, recent paths, and aggregated stats.
- `LogEntry` — Single log row for the log table.
- `PaginatedLogs` — Standard pagination wrapper with total count for frontend pagination controls.

---

### repositories/stats_repository.py

Raw database queries for aggregate statistics. All methods are async and accept an optional `since` parameter for time-range filtering.

```python
from datetime import datetime
from typing import Optional
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.orm import GatewayLog


class StatsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_overview(self, since: Optional[datetime] = None) -> dict:
        """
        Single query returning all overview statistics.

        SQL equivalent:
            SELECT
                count(*) AS total_requests,
                count(CASE WHEN attack_type > 0 THEN 1 END) AS total_attacks,
                count(DISTINCT source_ip) AS unique_ips,
                count(DISTINCT fingerprint) AS unique_fingerprints,
                avg(CASE WHEN attack_type > 0 THEN confidence END) AS avg_confidence
            FROM gateway_logs
            WHERE timestamp >= :since
        """
        pass

    async def get_attack_breakdown(self, since: Optional[datetime] = None) -> list[dict]:
        """
        Attack type distribution.

        SQL equivalent:
            SELECT attack_type, attack_label, count(*) AS count
            FROM gateway_logs
            WHERE attack_type > 0 AND timestamp >= :since
            GROUP BY attack_type, attack_label
            ORDER BY count DESC

        Post-processing: calculate percentage = count / sum(all counts) * 100
        """
        pass

    async def get_timeseries(self, since: datetime, bucket: str = "5m") -> list[dict]:
        """
        Time-bucketed counts for line charts.

        SQL equivalent:
            SELECT
                date_trunc(:bucket, timestamp) AS bucket_time,
                count(*) AS total,
                count(CASE WHEN attack_type > 0 THEN 1 END) AS attacks,
                count(CASE WHEN attack_type = 0 THEN 1 END) AS normal
            FROM gateway_logs
            WHERE timestamp >= :since
            GROUP BY bucket_time
            ORDER BY bucket_time ASC

        Bucket mapping:
            "1m"  -> date_trunc('minute', timestamp)
            "5m"  -> 5-minute intervals via floor(extract(epoch from timestamp) / 300) * 300
            "1h"  -> date_trunc('hour', timestamp)
            "1d"  -> date_trunc('day', timestamp)
        """
        pass
```

**Implementation notes:**
- All queries use SQLAlchemy's async session for non-blocking database access.
- The `since` parameter defaults to None, meaning "all time". The service layer sets a reasonable default (e.g., last 24 hours).
- The 5-minute bucket requires a manual epoch-based calculation since PostgreSQL's `date_trunc` only supports standard intervals (minute, hour, day, etc.).
- Top attack type is determined by a subquery or by sorting the breakdown results in the service layer.

---

### repositories/log_repository.py

Queries for individual log entries, pagination, and fingerprint aggregation.

```python
from typing import Optional
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.orm import GatewayLog


class LogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_logs(
        self,
        page: int,
        per_page: int,
        attack_type: Optional[int] = None,
        source_ip: Optional[str] = None,
        fingerprint: Optional[str] = None,
    ) -> tuple[list, int]:
        """
        Paginated, filterable query on gateway_logs.

        Filters are applied via WHERE clauses:
            - attack_type: exact match (WHERE attack_type = :attack_type)
            - source_ip: exact match (WHERE source_ip = :source_ip)
            - fingerprint: exact match (WHERE fingerprint = :fingerprint)

        Returns (rows, total_count) for pagination.
        ORDER BY timestamp DESC (newest first).
        OFFSET = (page - 1) * per_page, LIMIT = per_page.
        """
        pass

    async def get_latest_id(self) -> int:
        """
        For WebSocket polling — get the maximum ID in the table.

        SQL: SELECT COALESCE(max(id), 0) FROM gateway_logs
        """
        pass

    async def get_logs_after_id(self, last_id: int, limit: int = 50) -> list:
        """
        For WebSocket — get new logs since last_id.

        SQL: SELECT * FROM gateway_logs WHERE id > :last_id ORDER BY id ASC LIMIT :limit

        Returns up to `limit` new entries. The WebSocket handler tracks
        the last_id and calls this method on each poll interval.
        """
        pass

    async def get_fingerprint_summary(
        self, page: int, per_page: int
    ) -> tuple[list, int]:
        """
        Aggregated fingerprint table.

        SQL:
            SELECT
                fingerprint,
                (array_agg(source_ip ORDER BY timestamp DESC))[1] AS source_ip,
                mode() WITHIN GROUP (ORDER BY attack_type) AS attack_type,
                mode() WITHIN GROUP (ORDER BY attack_label) AS attack_label,
                avg(confidence) AS confidence,
                count(*) AS hit_count,
                min(timestamp) AS first_seen,
                max(timestamp) AS last_seen
            FROM gateway_logs
            GROUP BY fingerprint
            ORDER BY hit_count DESC
            OFFSET :offset LIMIT :limit

        Note: mode() gives the most common attack_type for each fingerprint.
        The source_ip is the most recent one used with that fingerprint.
        """
        pass

    async def get_fingerprint_detail(self, fingerprint_hash: str) -> Optional[dict]:
        """
        Full detail for a single fingerprint.

        Queries:
        1. Aggregate query for stats (same as summary but for one fingerprint)
        2. SELECT DISTINCT source_ip for all IPs used
        3. SELECT DISTINCT method for all methods used
        4. SELECT path FROM gateway_logs WHERE fingerprint = :hash
           ORDER BY timestamp DESC LIMIT 20 (recent paths)
        """
        pass
```

**Implementation notes:**
- `get_logs` returns a tuple of `(list_of_rows, total_count)`. The total_count requires a separate COUNT query (or a window function) for proper pagination.
- `get_logs_after_id` is optimized for the WebSocket use case: it queries by primary key (indexed) and returns in ascending order so the frontend can append them.
- `get_fingerprint_summary` uses PostgreSQL's `mode()` aggregate function to find the most common attack type per fingerprint. If the database does not support `mode()`, a subquery approach is used instead.
- `get_fingerprint_detail` executes multiple queries to build the full detail view. These could be combined into a single query with subqueries, but separate queries are clearer and easier to maintain.

---

### services/stats_service.py

Business logic layer for statistics. Wraps the stats repository with defaults, formatting, and validation.

```python
from datetime import datetime, timedelta
from typing import Optional
from app.repositories.stats_repository import StatsRepository
from app.models.schemas import OverviewStats, AttackBreakdown, TimeSeriesResponse


class StatsService:
    def __init__(self, repo: StatsRepository):
        self.repo = repo

    async def get_overview(self, since: Optional[datetime] = None) -> OverviewStats:
        """
        1. Default `since` to 24 hours ago if not provided.
        2. Call repo.get_overview(since).
        3. Calculate attack_rate = (total_attacks / total_requests) * 100.
        4. Get top attack type from repo.get_attack_breakdown(since)[0].
        5. Return OverviewStats.
        """
        pass

    async def get_breakdown(self, since: Optional[datetime] = None) -> list[AttackBreakdown]:
        """
        1. Default `since` to 24 hours ago.
        2. Call repo.get_attack_breakdown(since).
        3. Calculate percentages.
        4. Return list[AttackBreakdown].
        """
        pass

    async def get_timeseries(
        self, since: Optional[datetime] = None, bucket: str = "5m"
    ) -> TimeSeriesResponse:
        """
        1. Default `since` to 6 hours ago for minute buckets, 24 hours for 5m, 7 days for 1h.
        2. Validate bucket is one of: "1m", "5m", "1h", "1d".
        3. Call repo.get_timeseries(since, bucket).
        4. Return TimeSeriesResponse with points and bucket_size.
        """
        pass
```

---

### services/fingerprint_service.py

Business logic for fingerprint listing and detail views.

```python
from typing import Optional
from app.repositories.log_repository import LogRepository
from app.models.schemas import FingerprintSummary, FingerprintDetail


class FingerprintService:
    def __init__(self, repo: LogRepository):
        self.repo = repo

    async def list_fingerprints(
        self, page: int = 1, per_page: int = 20
    ) -> tuple[list[FingerprintSummary], int]:
        """
        1. Validate page >= 1 and per_page between 1 and 100.
        2. Call repo.get_fingerprint_summary(page, per_page).
        3. Map raw rows to FingerprintSummary objects.
        4. Return (list, total_count).
        """
        pass

    async def get_detail(self, fingerprint_hash: str) -> Optional[FingerprintDetail]:
        """
        1. Validate fingerprint_hash is a valid hex string of expected length.
        2. Call repo.get_fingerprint_detail(fingerprint_hash).
        3. Return None if not found, FingerprintDetail otherwise.
        """
        pass
```

---

### services/live_stream_service.py

Manages WebSocket connections and polls the database for new log entries.

```python
import asyncio
from app.repositories.log_repository import LogRepository
from app.config import Settings


class LiveStreamService:
    def __init__(self, repo: LogRepository, settings: Settings):
        self.repo = repo
        self.settings = settings

    async def stream_logs(self, websocket, last_id: int = 0):
        """
        Main loop for a single WebSocket connection.

        1. If last_id == 0, get the current latest ID from the database.
        2. Loop forever:
            a. Query repo.get_logs_after_id(last_id, limit=50).
            b. If new logs exist:
                - Serialize each log to JSON.
                - Send as a JSON array via websocket.send_json().
                - Update last_id to the max ID in the batch.
            c. Sleep for WS_POLL_INTERVAL seconds.
        3. On WebSocketDisconnect, exit gracefully.
        4. On database error, send error message and continue polling.
        """
        pass
```

**Design decisions:**
- Polling-based rather than database LISTEN/NOTIFY to keep the implementation simple and portable.
- Each WebSocket connection has its own polling loop. This is acceptable for a small number of admin users (< 10 concurrent connections).
- The `last_id` parameter allows clients to resume from where they left off after a reconnect.
- Limit of 50 logs per poll prevents large JSON payloads when many events arrive simultaneously.

---

### controllers/stats_controller.py

```python
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.services.stats_service import StatsService
from app.core.dependencies import get_stats_service

router = APIRouter(prefix="/api/admin/stats", tags=["stats"])


@router.get("/overview")
async def get_overview(
    since: Optional[datetime] = Query(None, description="Start of time range (ISO 8601)"),
    service: StatsService = Depends(get_stats_service),
):
    """
    Returns aggregate overview statistics.
    Response: OverviewStats
    """
    return await service.get_overview(since)


@router.get("/breakdown")
async def get_breakdown(
    since: Optional[datetime] = Query(None),
    service: StatsService = Depends(get_stats_service),
):
    """
    Returns attack type breakdown.
    Response: list[AttackBreakdown]
    """
    return await service.get_breakdown(since)


@router.get("/timeseries")
async def get_timeseries(
    since: Optional[datetime] = Query(None),
    bucket: str = Query("5m", regex="^(1m|5m|1h|1d)$"),
    service: StatsService = Depends(get_stats_service),
):
    """
    Returns time-bucketed counts for charts.
    Response: TimeSeriesResponse
    """
    return await service.get_timeseries(since, bucket)
```

---

### controllers/fingerprint_controller.py

```python
from fastapi import APIRouter, Depends, Query, HTTPException
from app.services.fingerprint_service import FingerprintService
from app.core.dependencies import get_fingerprint_service

router = APIRouter(prefix="/api/admin/fingerprints", tags=["fingerprints"])


@router.get("/")
async def list_fingerprints(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service: FingerprintService = Depends(get_fingerprint_service),
):
    """
    Paginated list of fingerprints with aggregated stats.
    Response: { items: list[FingerprintSummary], total: int, page: int, per_page: int }
    """
    items, total = await service.list_fingerprints(page, per_page)
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/{fingerprint_hash}")
async def get_fingerprint_detail(
    fingerprint_hash: str,
    service: FingerprintService = Depends(get_fingerprint_service),
):
    """
    Detailed view of a single fingerprint.
    Response: FingerprintDetail
    404 if fingerprint not found.
    """
    detail = await service.get_detail(fingerprint_hash)
    if not detail:
        raise HTTPException(status_code=404, detail="Fingerprint not found")
    return detail
```

---

### controllers/log_controller.py

```python
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.repositories.log_repository import LogRepository
from app.models.schemas import PaginatedLogs, LogEntry
from app.core.dependencies import get_log_repository

router = APIRouter(prefix="/api/admin/logs", tags=["logs"])


@router.get("/")
async def get_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    attack_type: Optional[int] = Query(None, ge=0),
    source_ip: Optional[str] = Query(None),
    fingerprint: Optional[str] = Query(None),
    repo: LogRepository = Depends(get_log_repository),
):
    """
    Paginated, filterable log listing.
    Response: PaginatedLogs
    """
    items, total = await repo.get_logs(page, per_page, attack_type, source_ip, fingerprint)
    return PaginatedLogs(
        items=[LogEntry.model_validate(row) for row in items],
        total=total,
        page=page,
        per_page=per_page,
    )
```

---

### controllers/ws_controller.py

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.services.live_stream_service import LiveStreamService
from app.core.dependencies import get_live_stream_service

router = APIRouter(tags=["websocket"])


@router.websocket("/api/admin/ws/live")
async def live_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time log streaming.

    Protocol:
    1. Client connects to ws://host/api/admin/ws/live
    2. Server accepts the connection.
    3. Client can optionally send { "last_id": 12345 } to resume from a specific point.
    4. Server begins polling the database every 2 seconds.
    5. When new logs are found, server sends:
       {
         "type": "logs",
         "data": [
           { "id": 12346, "timestamp": "...", "source_ip": "...", ... },
           { "id": 12347, ... }
         ]
       }
    6. Server sends periodic heartbeats: { "type": "heartbeat", "timestamp": "..." }
    7. On disconnect, server cleans up resources.

    Error handling:
    - If database is unavailable, send { "type": "error", "message": "..." }
    - If client sends invalid JSON, ignore and continue.
    - Auto-close connection after 1 hour of inactivity.
    """
    await websocket.accept()
    service = get_live_stream_service()
    try:
        await service.stream_logs(websocket)
    except WebSocketDisconnect:
        pass
```

---

### core/database.py

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import Settings


class Base(DeclarativeBase):
    pass


settings = Settings()
engine = create_async_engine(settings.GATEWAY_DB_URL, echo=False, pool_size=5, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
```

**Key decisions:**
- `pool_size=5` with `max_overflow=10` allows up to 15 concurrent database connections. Sufficient for an admin API with few concurrent users.
- `expire_on_commit=False` prevents lazy loading issues in async context.
- The session is yielded (generator-based dependency injection) so FastAPI handles cleanup.

---

### core/dependencies.py

FastAPI dependency injection wiring. Connects controllers -> services -> repositories -> database sessions.

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.repositories.stats_repository import StatsRepository
from app.repositories.log_repository import LogRepository
from app.services.stats_service import StatsService
from app.services.fingerprint_service import FingerprintService
from app.services.live_stream_service import LiveStreamService
from app.config import Settings


def get_stats_repository(session: AsyncSession = Depends(get_session)) -> StatsRepository:
    return StatsRepository(session)


def get_log_repository(session: AsyncSession = Depends(get_session)) -> LogRepository:
    return LogRepository(session)


def get_stats_service(repo: StatsRepository = Depends(get_stats_repository)) -> StatsService:
    return StatsService(repo)


def get_fingerprint_service(repo: LogRepository = Depends(get_log_repository)) -> FingerprintService:
    return FingerprintService(repo)


def get_live_stream_service() -> LiveStreamService:
    settings = Settings()
    # LiveStreamService creates its own session for long-lived WebSocket connections
    return LiveStreamService(settings=settings)
```

---

### main.py

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.controllers import stats_controller, fingerprint_controller, log_controller, ws_controller
from app.config import Settings
import structlog


@asynccontextmanager
async def lifespan(app: FastAPI):
    structlog.configure(
        processors=[structlog.processors.JSONRenderer()],
    )
    yield


app = FastAPI(title="Admin API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats_controller.router)
app.include_router(fingerprint_controller.router)
app.include_router(log_controller.router)
app.include_router(ws_controller.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

### API Endpoints Summary

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/admin/stats/overview?since=` | Aggregate statistics | `OverviewStats` |
| GET | `/api/admin/stats/breakdown?since=` | Attack type distribution | `list[AttackBreakdown]` |
| GET | `/api/admin/stats/timeseries?since=&bucket=5m` | Time-bucketed counts | `TimeSeriesResponse` |
| GET | `/api/admin/fingerprints?page=1&per_page=20` | Paginated fingerprint list | `{ items, total, page, per_page }` |
| GET | `/api/admin/fingerprints/{hash}` | Fingerprint detail | `FingerprintDetail` |
| GET | `/api/admin/logs?page=1&per_page=50&attack_type=&source_ip=&fingerprint=` | Paginated logs | `PaginatedLogs` |
| WS | `/api/admin/ws/live` | Real-time log stream | JSON messages |
| GET | `/health` | Health check | `{ status: "ok" }` |

---

### requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
pydantic==2.7.0
pydantic-settings==2.3.0
python-json-logger==2.0.7
websockets==12.0
structlog==24.1.0
```

---

### Dockerfile (admin-api)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Admin Panel (React Frontend)

### Directory Tree

```
admin-panel/
├── Dockerfile
├── nginx.conf
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   └── client.ts              # Axios instance for /api/admin/*
    ├── types/
    │   └── index.ts               # TypeScript interfaces matching admin API schemas
    ├── components/
    │   ├── Layout.tsx             # Sidebar + main content
    │   ├── Sidebar.tsx            # Navigation sidebar
    │   ├── StatsCards.tsx         # 4 stat cards: total, attacks, unique IPs, confidence
    │   ├── AttackBreakdown.tsx    # Pie/donut chart of attack types
    │   ├── TimeSeriesChart.tsx    # Line chart of attacks over time
    │   ├── FingerprintTable.tsx   # Sortable, filterable data table
    │   ├── LogTable.tsx           # Real-time log table with auto-scroll
    │   ├── AttackBadge.tsx        # Colored badge for attack type
    │   └── LiveIndicator.tsx      # Green dot + "Live" when WebSocket connected
    ├── pages/
    │   ├── OverviewPage.tsx       # StatsCards + TimeSeriesChart + AttackBreakdown
    │   ├── AttacksPage.tsx        # Detailed attack breakdown + filters
    │   ├── FingerprintsPage.tsx   # FingerprintTable with search
    │   └── LogsPage.tsx          # Real-time log viewer with filters
    ├── hooks/
    │   ├── useWebSocket.ts        # WebSocket connection + auto-reconnect
    │   ├── useStats.ts            # Fetch overview stats
    │   └── useFingerprints.ts     # Fetch fingerprint data
    └── styles/
        └── index.css              # Tailwind directives
```

---

### Technology Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router v6** for client-side routing
- **Recharts** for charts (LineChart, PieChart, BarChart)
- **Axios** for HTTP requests
- **React Query (TanStack Query)** for data fetching and caching

---

### api/client.ts

```typescript
import axios from "axios";

const client = axios.create({
  baseURL: "/api/admin",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
```

**Key decisions:**
- `baseURL: "/api/admin"` uses a relative path. In production, nginx proxies `/api/admin/*` to the admin-api service. In development, Vite's proxy config handles this.
- No authentication is configured (admin panel is only accessible within the cluster network or via VPN in production).

---

### types/index.ts

TypeScript interfaces matching the admin API Pydantic schemas exactly.

```typescript
export interface OverviewStats {
  total_requests: number;
  total_attacks: number;
  attack_rate: number;
  unique_ips: number;
  unique_fingerprints: number;
  top_attack_type: string;
  top_attack_count: number;
  avg_confidence: number;
}

export interface AttackBreakdown {
  attack_type: number;
  attack_label: string;
  count: number;
  percentage: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  total: number;
  attacks: number;
  normal: number;
}

export interface TimeSeriesResponse {
  points: TimeSeriesPoint[];
  bucket_size: string;
}

export interface FingerprintSummary {
  fingerprint: string;
  source_ip: string;
  attack_type: number;
  attack_label: string;
  confidence: number;
  hit_count: number;
  first_seen: string;
  last_seen: string;
}

export interface FingerprintDetail {
  fingerprint: string;
  source_ips: string[];
  attack_type: number;
  attack_label: string;
  avg_confidence: number;
  total_requests: number;
  first_seen: string;
  last_seen: string;
  recent_paths: string[];
  methods_used: string[];
}

export interface LogEntry {
  id: number;
  timestamp: string;
  fingerprint: string;
  source_ip: string;
  attack_type: number;
  attack_label: string;
  confidence: number;
  method: string;
  path: string;
  user_agent: string;
}

export interface PaginatedLogs {
  items: LogEntry[];
  total: number;
  page: number;
  per_page: number;
}

export interface WebSocketMessage {
  type: "logs" | "heartbeat" | "error";
  data?: LogEntry[];
  timestamp?: string;
  message?: string;
}
```

---

### Component Specs

#### Layout.tsx

Top-level layout component with a fixed sidebar and scrollable main content area.

```
+------------------+----------------------------------------+
|                  |                                        |
|    Sidebar       |          Main Content Area             |
|                  |          (React Router Outlet)         |
|    - Overview    |                                        |
|    - Attacks     |                                        |
|    - Fingerprints|                                        |
|    - Logs        |                                        |
|                  |                                        |
|    LiveIndicator |                                        |
+------------------+----------------------------------------+
```

- Sidebar width: 240px (fixed).
- Main content: flex-1 with padding.
- Dark theme: `bg-gray-900 text-white` base.
- Responsive: sidebar collapses to hamburger menu on mobile.

#### Sidebar.tsx

- Navigation links with icons for each page.
- Active link highlighted with `bg-blue-600` background.
- LiveIndicator component at the bottom showing WebSocket connection status.
- System title at top: "Honeypot Heimdall".

#### StatsCards.tsx

Four cards in a responsive grid (2x2 on medium screens, 4x1 on large).

| Card | Value | Color | Icon |
|------|-------|-------|------|
| Total Requests | `total_requests` formatted with commas | Blue | Globe |
| Attacks Detected | `total_attacks` with attack_rate % | Red | Shield |
| Unique IPs | `unique_ips` | Yellow | Network |
| Avg Confidence | `avg_confidence` formatted as percentage | Green | Target |

Each card: `bg-gray-800 rounded-lg p-6 shadow-lg`. Value in large text (`text-3xl font-bold`), label in small muted text (`text-gray-400 text-sm`).

#### AttackBreakdown.tsx

- **Chart:** Recharts PieChart (donut variant with `innerRadius={60}`).
- **Data:** `list[AttackBreakdown]` from `/api/admin/stats/breakdown`.
- **Colors:** Predefined color map: `{ 0: "#10B981", 1: "#EF4444", 2: "#F59E0B", 3: "#8B5CF6", 4: "#EC4899" }`.
- **Legend:** Below the chart, showing attack_label, count, and percentage.
- **Interactive:** Hover shows tooltip with exact count and percentage.

#### TimeSeriesChart.tsx

- **Chart:** Recharts LineChart with Area fills.
- **X-axis:** Formatted timestamps (e.g., "14:30", "15:00").
- **Y-axis:** Request count.
- **Lines:** Two series: "Total" (blue, `stroke="#3B82F6"`) and "Attacks" (red, `stroke="#EF4444"`).
- **Area fills:** Semi-transparent (`fillOpacity={0.1}`).
- **Bucket selector:** Dropdown to switch between 1m, 5m, 1h, 1d buckets.
- **Time range selector:** Buttons for "Last 1h", "Last 6h", "Last 24h", "Last 7d".
- **Responsive:** Full width of container, 300px height.

#### FingerprintTable.tsx

- **Table:** Full-width with alternating row colors (`odd:bg-gray-800 even:bg-gray-750`).
- **Columns:**
  - Fingerprint: First 12 characters of hash, monospace font, clickable (links to detail page).
  - IP: `source_ip`, monospace.
  - Attack Type: `AttackBadge` component with colored label.
  - Confidence: Percentage with color gradient (green < 0.5 < yellow < 0.8 < red).
  - Hit Count: Integer with bar indicator.
  - First Seen: Relative time (e.g., "2h ago").
  - Last Seen: Relative time.
- **Search bar:** Filter by IP or fingerprint hash (client-side filter on current page, server-side search via query params).
- **Sorting:** Click column headers to sort. Default: hit_count DESC.
- **Pagination:** Page controls at bottom with "Showing X-Y of Z" text.

#### LogTable.tsx

- **Table:** Compact rows for high density. Fixed height container with virtual scrolling for performance.
- **Columns:**
  - Time: `HH:mm:ss.SSS` format.
  - IP: Monospace, clickable (filters by IP).
  - Method: Colored badge (GET=green, POST=blue, PUT=yellow, DELETE=red).
  - Path: Truncated to 60 chars with tooltip for full path.
  - Attack Type: `AttackBadge` component.
  - Confidence: Percentage.
- **Auto-scroll:** New entries appear at the top. Auto-scroll is on by default.
- **Pause button:** Toggles auto-scroll. Shows count of new entries while paused.
- **Filters:** Dropdowns for attack type, method. Text input for IP filter.
- **Data source:** WebSocket via `useWebSocket` hook. Falls back to polling `/api/admin/logs` if WebSocket disconnects.

#### AttackBadge.tsx

Colored badge component for displaying attack types.

```typescript
const ATTACK_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: "bg-green-900", text: "text-green-300", label: "Normal" },
  1: { bg: "bg-red-900", text: "text-red-300", label: "SQLi" },
  2: { bg: "bg-orange-900", text: "text-orange-300", label: "XSS" },
  3: { bg: "bg-purple-900", text: "text-purple-300", label: "CMDi" },
  4: { bg: "bg-pink-900", text: "text-pink-300", label: "Traversal" },
};
```

Renders as: `<span className="px-2 py-1 rounded text-xs font-medium {bg} {text}">{label}</span>`

#### LiveIndicator.tsx

- Shows a pulsing green dot when WebSocket is connected.
- Shows a red dot when disconnected.
- Text: "Live" or "Disconnected".
- Pulse animation: Tailwind `animate-pulse` on the green dot.

---

### Page Specs

#### OverviewPage.tsx

The main dashboard page. Layout:

```
+---StatsCards (4 cards in a row)---------------------------+
|  [Total Requests] [Attacks] [Unique IPs] [Avg Confidence] |
+-----------------------------------------------------------+
+---TimeSeriesChart (70% width)---+---AttackBreakdown (30%)-+
|                                 |                         |
|   Line chart with area fills    |   Donut chart           |
|                                 |   + Legend              |
|                                 |                         |
+---------------------------------+-------------------------+
```

- Auto-refreshes every 30 seconds via React Query's `refetchInterval`.
- Time range selector affects all components on the page.

#### AttacksPage.tsx

Detailed attack analysis page.

- Full-width `AttackBreakdown` chart at top (larger than overview version).
- Below: table with columns: Attack Type, Label, Count, Percentage, Avg Confidence.
- Each row is a bar chart showing relative count.
- Time range filter at top right.
- Click on an attack type to filter the logs page to that type.

#### FingerprintsPage.tsx

- Search bar at top: "Search by IP or fingerprint..."
- `FingerprintTable` component below.
- Click a fingerprint row to expand/navigate to detail view showing:
  - All source IPs used.
  - All HTTP methods used.
  - Recent 20 paths accessed.
  - Timeline of activity.

#### LogsPage.tsx

- Filter bar at top: attack type dropdown, method dropdown, IP text input.
- `LiveIndicator` in the filter bar.
- `LogTable` component below, powered by WebSocket.
- "Pause" / "Resume" toggle button.
- "Clear" button to reset the displayed log buffer.
- Status line: "Showing X logs | Y new" (when paused).

---

### Hooks

#### useWebSocket.ts

```typescript
export function useWebSocket(url: string) {
  // State: messages (LogEntry[]), isConnected (boolean), error (string | null)
  // On mount: connect to WebSocket URL
  // On message: parse JSON, append to messages array (max 1000 entries, FIFO)
  // On close: set isConnected = false, attempt reconnect after 3 seconds
  // On error: set error message, attempt reconnect
  // Reconnect logic: exponential backoff (3s, 6s, 12s, max 30s)
  // Cleanup: close WebSocket on unmount
  // Returns: { messages, isConnected, error, clearMessages }
}
```

#### useStats.ts

```typescript
export function useStats(since?: string) {
  // Uses React Query (useQuery) to fetch /api/admin/stats/overview
  // Refetch interval: 30 seconds
  // Returns: { data: OverviewStats, isLoading, error }
}
```

#### useFingerprints.ts

```typescript
export function useFingerprints(page: number, perPage: number) {
  // Uses React Query to fetch /api/admin/fingerprints?page=X&per_page=Y
  // Refetch interval: 60 seconds
  // Returns: { data: { items, total }, isLoading, error }
}
```

---

### Dockerfile (admin-panel)

Multi-stage build: Node for building, nginx for serving.

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### nginx.conf

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to admin-api service
    location /api/admin/ {
        proxy_pass http://admin-api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /api/admin/ws/ {
        proxy_pass http://admin-api:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }
}
```

**Key decisions:**
- SPA fallback ensures React Router works with browser history API.
- API proxy eliminates CORS issues by serving frontend and API from the same origin.
- WebSocket proxy requires `proxy_http_version 1.1` and `Upgrade/Connection` headers.
- `proxy_read_timeout 3600s` keeps WebSocket connections alive for up to 1 hour.

---

### package.json (key dependencies)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@tanstack/react-query": "^5.40.0",
    "axios": "^1.7.0",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

---

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/admin": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
```

---

## Kubernetes Deployment Notes

### admin-api
- **Deployment:** 1 replica (stateless).
- **Service:** ClusterIP on port 8000.
- **Environment variables:** `ADMIN_GATEWAY_DB_URL` from a Secret.
- **Health check:** HTTP GET `/health` on port 8000.
- **Resources:** 128Mi-256Mi memory, 100m-250m CPU.

### admin-panel
- **Deployment:** 1 replica (stateless).
- **Service:** ClusterIP on port 80.
- **Ingress/NodePort:** Exposed for user access.
- **Resources:** 64Mi-128Mi memory, 50m-100m CPU (nginx is lightweight).
- **ConfigMap:** nginx.conf mounted as `/etc/nginx/conf.d/default.conf`.
