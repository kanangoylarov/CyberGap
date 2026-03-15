# Plan 01 — Gateway (Smart Reverse Proxy)

> **Purpose**: This document is a self-contained implementation specification for the Gateway module of an AI-powered network security system. Feed this entire file to Claude and ask it to generate every file listed below. Every file, class, method signature, import, constant, and behaviour is specified here so that the output is deterministic and complete.

---

## 1. System Context

The Gateway is the **single entry point** for ALL API traffic destined for the store backend. It sits in front of the real application and:

1. Captures every incoming HTTP request.
2. Computes a deterministic **fingerprint** (SHA-256) from request attributes.
3. Checks **Redis** for a cached classification of that fingerprint.
4. On cache miss, extracts a 49-feature vector compatible with the UNSW-NB15 dataset and sends it to the **AI Classifier** service via HTTP POST.
5. Based on the classification result (attack type 0-9), routes the request to either the **real store backend** (type 0 = Normal) or one of **9 specialized honeypots** (types 1-9).
6. Proxies the request **transparently** — the client never sees a redirect, never knows it has been rerouted.
7. Logs every decision to **PostgreSQL** (`gatewaydb.gateway_logs`) and emits **structured JSON** to stdout for ELK ingestion.

### Architecture Pattern

```
Model --> Repository --> Service --> Controller (Router)
```

All async. FastAPI + uvicorn. Python 3.11.

---

## 2. Directory Tree

Generate every file listed below. Every `__init__.py` must exist (can be empty unless stated otherwise).

```
gateway/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py
│   │   └── database.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── redis_repository.py
│   │   └── log_repository.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── fingerprint_service.py
│   │   ├── feature_extractor_service.py
│   │   ├── classifier_client_service.py
│   │   ├── routing_service.py
│   │   └── proxy_service.py
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── proxy_controller.py
│   │   └── health_controller.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── request_interceptor.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── constants.py
│   │   ├── database.py
│   │   └── redis.py
│   └── utils/
│       ├── __init__.py
│       └── logging.py
└── tests/
    ├── __init__.py
    ├── test_fingerprint_service.py
    ├── test_routing_service.py
    └── test_feature_extractor.py
```

---

## 3. requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
redis[hiredis]==5.0.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
pydantic-settings==2.3.0
python-json-logger==2.0.7
```

Generate this file verbatim.

---

## 4. Dockerfile

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
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Generate this file verbatim.

---

## 5. File-by-File Implementation Specification

### 5.1 `app/__init__.py`

Empty file. Just makes `app` a Python package.

---

### 5.2 `app/config.py`

**Imports:**
```python
from pydantic_settings import BaseSettings
```

**Class: `Settings`** (extends `BaseSettings`)

| Field | Type | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | `str` | `"redis.honeypot.svc.cluster.local"` | Redis hostname |
| `REDIS_PORT` | `int` | `6379` | Redis port |
| `REDIS_DB` | `int` | `0` | Redis database number |
| `GATEWAY_DB_URL` | `str` | `"postgresql+asyncpg://gateway:gateway@postgres-gateway.honeypot.svc.cluster.local:5432/gatewaydb"` | Async PostgreSQL connection string for gateway's own database |
| `AI_CLASSIFIER_URL` | `str` | `"http://ai-classifier.honeypot.svc.cluster.local:8000"` | Base URL of the AI classifier service (no trailing slash) |
| `STORE_BACKEND_HOST` | `str` | `"store-backend.honeypot.svc.cluster.local"` | Real store backend hostname |
| `STORE_BACKEND_PORT` | `int` | `8000` | Real store backend port |
| `FINGERPRINT_TTL` | `int` | `3600` | Fingerprint cache TTL in seconds (1 hour) |
| `LOG_LEVEL` | `str` | `"INFO"` | Python log level string |

**Nested `Config` class:**
```python
class Config:
    env_prefix = "GATEWAY_"
```

This means environment variables are prefixed: `GATEWAY_REDIS_HOST`, `GATEWAY_AI_CLASSIFIER_URL`, etc.

**Module-level singleton:**
```python
settings = Settings()
```

---

### 5.3 `app/core/constants.py`

**Imports:** None required.

**Constants:**

```python
ATTACK_MAPPING: dict[str, int] = {
    'Normal': 0,
    'Generic': 1,
    'Exploits': 2,
    'Fuzzers': 3,
    'DoS': 4,
    'Reconnaissance': 5,
    'Analysis': 6,
    'Backdoor': 7,
    'Shellcode': 8,
    'Worms': 9,
}
```

```python
ATTACK_LABELS: dict[int, str] = {v: k for k, v in ATTACK_MAPPING.items()}
```

```python
ATTACK_ROUTES: dict[int, tuple[str, int]] = {
    0: ("store-backend.honeypot.svc.cluster.local", 8000),
    1: ("honeypot-generic.honeypot.svc.cluster.local", 8000),
    2: ("honeypot-exploits.honeypot.svc.cluster.local", 8000),
    3: ("honeypot-fuzzers.honeypot.svc.cluster.local", 8000),
    4: ("honeypot-dos.honeypot.svc.cluster.local", 8000),
    5: ("honeypot-recon.honeypot.svc.cluster.local", 8000),
    6: ("honeypot-analysis.honeypot.svc.cluster.local", 8000),
    7: ("honeypot-backdoor.honeypot.svc.cluster.local", 8000),
    8: ("honeypot-shellcode.honeypot.svc.cluster.local", 8000),
    9: ("honeypot-worms.honeypot.svc.cluster.local", 8000),
}
```

**`HOP_BY_HOP_HEADERS`** — a `frozenset` of lowercase header names that must NOT be forwarded:
```python
HOP_BY_HOP_HEADERS: frozenset[str] = frozenset({
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
})
```

---

### 5.4 `app/core/database.py`

**Imports:**
```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
```

**`Base`** class:
```python
class Base(DeclarativeBase):
    pass
```

**`engine`** — module-level `AsyncEngine`:
```python
engine = create_async_engine(
    settings.GATEWAY_DB_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)
```

**`async_session_factory`** — module-level `async_sessionmaker`:
```python
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

**`async def init_db() -> None`:**
- Creates all tables using `Base.metadata.create_all` within `async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)`.

**`async def close_db() -> None`:**
- Calls `await engine.dispose()`.

---

### 5.5 `app/core/redis.py`

**Imports:**
```python
import redis.asyncio as aioredis
from app.config import settings
```

**Module-level variable:**
```python
redis_pool: aioredis.Redis | None = None
```

**`async def init_redis() -> aioredis.Redis`:**
- Creates a `Redis` connection using `aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=settings.REDIS_DB, decode_responses=True)`.
- Assigns to the module-level `redis_pool`.
- Returns the connection.

**`async def close_redis() -> None`:**
- If `redis_pool` is not None, calls `await redis_pool.close()`.

**`def get_redis() -> aioredis.Redis`:**
- Returns the module-level `redis_pool`. Raises `RuntimeError` if it is None (not initialized).

---

### 5.6 `app/models/__init__.py`

Empty file.

---

### 5.7 `app/models/schemas.py`

**Imports:**
```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
```

#### Class: `RequestSignature(BaseModel)`

Represents the raw attributes extracted from an HTTP request, used as input to the fingerprinting algorithm.

| Field | Type | Default | Description |
|---|---|---|---|
| `source_ip` | `str` | *required* | Client IP from X-Forwarded-For, X-Real-IP, or request.client.host |
| `user_agent` | `str` | `""` | User-Agent header value, lowercased |
| `accept_language` | `str` | `""` | Accept-Language header value |
| `accept_encoding` | `str` | `""` | Accept-Encoding header value |
| `header_order` | `list[str]` | `[]` | Ordered list of all request header names (lowercased) |
| `request_method` | `str` | *required* | HTTP method (GET, POST, etc.) uppercased |
| `path_pattern` | `str` | *required* | URL path with numeric/UUID segments replaced by `*` |
| `query_param_keys` | `list[str]` | `[]` | Sorted list of query parameter names |
| `content_type` | `Optional[str]` | `None` | Content-Type header value |
| `body_entropy` | `float` | `0.0` | Shannon entropy of the request body bytes |
| `content_length` | `int` | `0` | Content-Length in bytes |

#### Class: `ClassifyRequest(BaseModel)`

All 49 UNSW-NB15 features. Every field has a sensible default so the object can be partially constructed.

| Field | Type | Default | Description |
|---|---|---|---|
| `srcip` | `str` | `"0.0.0.0"` | Source IP address |
| `sport` | `int` | `0` | Source port |
| `dstip` | `str` | `"0.0.0.0"` | Destination IP address |
| `dsport` | `int` | `80` | Destination port |
| `proto` | `str` | `"tcp"` | Protocol (always "tcp" for HTTP) |
| `state` | `str` | `"FIN"` | Connection state |
| `dur` | `float` | `0.0` | Duration of connection |
| `sbytes` | `int` | `0` | Source to destination bytes |
| `dbytes` | `int` | `0` | Destination to source bytes |
| `sttl` | `int` | `64` | Source TTL |
| `dttl` | `int` | `128` | Destination TTL |
| `sloss` | `int` | `0` | Source packet loss |
| `dloss` | `int` | `0` | Destination packet loss |
| `service` | `str` | `"http"` | Network service (always "http") |
| `Sload` | `float` | `0.0` | Source load (bits/sec) |
| `Dload` | `float` | `0.0` | Destination load (bits/sec) |
| `Spkts` | `int` | `1` | Source packets |
| `Dpkts` | `int` | `1` | Destination packets |
| `swin` | `int` | `255` | Source TCP window size |
| `dwin` | `int` | `255` | Destination TCP window size |
| `stcpb` | `int` | `0` | Source TCP base seq number |
| `dtcpb` | `int` | `0` | Destination TCP base seq number |
| `smeansz` | `int` | `0` | Source mean packet size |
| `dmeansz` | `int` | `0` | Destination mean packet size |
| `trans_depth` | `int` | `1` | HTTP transaction depth |
| `res_bdy_len` | `int` | `0` | Response body length (0 at classification time) |
| `Sjit` | `float` | `0.0` | Source jitter |
| `Djit` | `float` | `0.0` | Destination jitter |
| `Sintpkt` | `float` | `0.0` | Source inter-packet time |
| `Dintpkt` | `float` | `0.0` | Destination inter-packet time |
| `tcprtt` | `float` | `0.02` | TCP round-trip time |
| `synack` | `float` | `0.01` | SYN-ACK time |
| `ackdat` | `float` | `0.01` | ACK data time |
| `is_sm_ips_ports` | `int` | `0` | 1 if src IP==dst IP and src port==dst port |
| `ct_state_ttl` | `int` | `0` | Count of connections per state+TTL |
| `ct_flw_http_mthd` | `int` | `0` | Count of flows with same HTTP method |
| `is_ftp_login` | `int` | `0` | 1 if FTP login (always 0 for HTTP) |
| `ct_ftp_cmd` | `int` | `0` | Count of FTP commands (always 0 for HTTP) |
| `ct_srv_src` | `int` | `0` | Count of connections from same src to same service |
| `ct_srv_dst` | `int` | `0` | Count of connections to same dst from same service |
| `ct_dst_ltm` | `int` | `0` | Count of connections to same dst in last time window |
| `ct_src_ltm` | `int` | `0` | Count of connections from same src in last time window |
| `ct_src_dport_ltm` | `int` | `0` | Count of connections from same src to same dst port in LTM |
| `ct_dst_sport_ltm` | `int` | `0` | Count of connections to same dst from same src port in LTM |
| `ct_dst_src_ltm` | `int` | `0` | Count of connections between same src-dst pair in LTM |

**Note:** Use `Field(alias=...)` if needed for serialization, but the field names above should match the UNSW-NB15 column names exactly (including mixed case for `Sload`, `Dload`, `Spkts`, `Dpkts`, `Sjit`, `Djit`, `Sintpkt`, `Dintpkt`).

#### Class: `ClassifyResponse(BaseModel)`

| Field | Type | Default | Description |
|---|---|---|---|
| `attack_type` | `int` | *required* | Integer 0-9 from ATTACK_MAPPING |
| `attack_label` | `str` | *required* | Human-readable label (e.g., "Normal", "DoS") |
| `confidence` | `float` | *required* | Model confidence 0.0 - 1.0 |
| `inference_time_ms` | `float` | *required* | Time the AI model took for inference |

#### Class: `GatewayLogCreate(BaseModel)`

| Field | Type | Default | Description |
|---|---|---|---|
| `timestamp` | `datetime` | *required* | When the request was received |
| `fingerprint` | `str` | *required* | SHA-256 fingerprint (64 hex chars) |
| `source_ip` | `str` | *required* | Client IP |
| `attack_type` | `int` | *required* | Classification result 0-9 |
| `attack_label` | `str` | *required* | Human-readable attack label |
| `confidence` | `float` | *required* | AI model confidence |
| `upstream` | `str` | *required* | Upstream host:port the request was routed to |
| `latency_ms` | `float` | *required* | Total gateway processing latency |
| `method` | `str` | *required* | HTTP method |
| `path` | `str` | *required* | Request path |
| `user_agent` | `str` | `""` | User-Agent header |

---

### 5.8 `app/models/database.py`

**Imports:**
```python
from sqlalchemy import Column, Integer, SmallInteger, String, Float, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base
```

#### Class: `GatewayLog(Base)`

```python
__tablename__ = "gateway_logs"
```

| Column | SQLAlchemy Type | Constraints | Description |
|---|---|---|---|
| `id` | `Integer` | `primary_key=True, autoincrement=True` | Auto-incrementing PK |
| `timestamp` | `DateTime` | `nullable=False` | When the request was received |
| `fingerprint` | `String(64)` | `nullable=False, index=True` | SHA-256 hex fingerprint |
| `source_ip` | `String(45)` | `nullable=False, index=True` | Client IP (v4 or v6) |
| `attack_type` | `SmallInteger` | `nullable=False, index=True` | 0-9 attack classification |
| `attack_label` | `String(50)` | | Human-readable label |
| `confidence` | `Float` | | AI model confidence |
| `upstream` | `String(255)` | | Target upstream host:port |
| `latency_ms` | `Float` | | Gateway processing time |
| `method` | `String(10)` | | HTTP method |
| `path` | `String(2048)` | | Request path |
| `user_agent` | `Text` | | User-Agent header |
| `created_at` | `DateTime` | `server_default=func.now()` | DB insert timestamp |

---

### 5.9 `app/utils/__init__.py`

Empty file.

---

### 5.10 `app/utils/logging.py`

**Imports:**
```python
import logging
import sys
from pythonjsonlogger import jsonlogger
from app.config import settings
```

**Function: `setup_logger(name: str = "gateway") -> logging.Logger`**

1. Create a logger with `logging.getLogger(name)`.
2. Set the log level from `settings.LOG_LEVEL`.
3. Create a `StreamHandler` writing to `sys.stdout`.
4. Create a `jsonlogger.JsonFormatter` with format string `"%(asctime)s %(name)s %(levelname)s %(message)s"`.
5. Set the formatter on the handler.
6. Add the handler to the logger.
7. Return the logger.

**Module-level:**
```python
logger = setup_logger()
```

This `logger` is imported by other modules: `from app.utils.logging import logger`.

---

### 5.11 `app/repositories/__init__.py`

Empty file.

---

### 5.12 `app/repositories/redis_repository.py`

**Imports:**
```python
from typing import Optional
import redis.asyncio as aioredis
from app.utils.logging import logger
```

#### Class: `RedisRepository`

**`__init__(self, redis: aioredis.Redis)`**
- Stores `self._redis = redis`.

**`async def get_fingerprint_classification(self, fingerprint: str) -> Optional[int]`**
- Key pattern: `fp:{fingerprint}`
- Calls `self._redis.get(key)`.
- If result is not None, return `int(result)`.
- On miss, return `None`.
- Log cache hits/misses at DEBUG level.

**`async def set_fingerprint_classification(self, fingerprint: str, attack_type: int, ttl: int = 3600) -> None`**
- Key pattern: `fp:{fingerprint}`
- Calls `self._redis.setex(key, ttl, attack_type)`.
- Log at DEBUG level.

**`async def increment_connection_counter(self, key_type: str, *parts: str, ttl: int = 300) -> int`**
- Key pattern: `ct:{key_type}:{part1}:{part2}:...`
- Join parts with `:`.
- Use a Redis pipeline:
  1. `INCR key`
  2. `EXPIRE key ttl` (only set if key is new, use `self._redis.expire` with `nx=True` if available, otherwise always set)
- Return the incremented value as `int`.
- This is used for all the `ct_*` UNSW-NB15 features: `ct_srv_src`, `ct_srv_dst`, `ct_dst_ltm`, `ct_src_ltm`, `ct_src_dport_ltm`, `ct_dst_sport_ltm`, `ct_dst_src_ltm`, `ct_flw_http_mthd`, `ct_state_ttl`.

**`async def get_connection_counter(self, key_type: str, *parts: str) -> int`**
- Key pattern: same as above.
- Calls `self._redis.get(key)`.
- Returns `int(result)` if exists, else `0`.

**`async def increment_rate(self, source_ip: str, ttl: int = 60) -> int`**
- Key pattern: `rate:{source_ip}`
- Use pipeline: `INCR` then `EXPIRE` with ttl.
- Returns the incremented count.

---

### 5.13 `app/repositories/log_repository.py`

**Imports:**
```python
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from app.models.database import GatewayLog
from app.models.schemas import GatewayLogCreate
from app.utils.logging import logger
```

#### Class: `LogRepository`

**`__init__(self, session_factory: async_sessionmaker)`**
- Stores `self._session_factory = session_factory`.

**`async def create_log(self, log_entry: GatewayLogCreate) -> None`**
- Open an async session: `async with self._session_factory() as session:`.
- Create a `GatewayLog` instance from `log_entry.model_dump()`.
- `session.add(log)`.
- `await session.commit()`.
- Wrap everything in try/except. On error, log the exception at WARNING level but do **not** raise — this is fire-and-forget. The request pipeline must not fail due to a logging error.

---

### 5.14 `app/services/__init__.py`

Empty file.

---

### 5.15 `app/services/fingerprint_service.py`

**Imports:**
```python
import hashlib
import math
import re
from collections import Counter
from fastapi import Request
from app.models.schemas import RequestSignature
```

#### Class: `FingerprintService`

**`def compute_fingerprint(self, signature: RequestSignature) -> str`**

Algorithm:
1. Build a list of normalized values:
   - `signature.source_ip`
   - `signature.user_agent` (already lowercased)
   - `signature.accept_language`
   - `signature.accept_encoding`
   - `"|".join(sorted(signature.header_order))`
   - `signature.request_method`
   - `signature.path_pattern`
   - `"|".join(sorted(signature.query_param_keys))`
   - `signature.content_type or ""`
   - `f"{signature.body_entropy:.4f}"`
   - `str(signature.content_length)`
2. Join all values with `"|"` separator.
3. Return `hashlib.sha256(joined_string.encode("utf-8")).hexdigest()`.

**`async def extract_signature(self, request: Request) -> RequestSignature`**

Must be `async` because it reads the request body.

Steps:
1. **source_ip**: Check `X-Forwarded-For` header (take the first IP if comma-separated), then `X-Real-IP` header, then `request.client.host`, then fallback `"0.0.0.0"`.
2. **user_agent**: `request.headers.get("user-agent", "")` lowercased.
3. **accept_language**: `request.headers.get("accept-language", "")`.
4. **accept_encoding**: `request.headers.get("accept-encoding", "")`.
5. **header_order**: `[k.lower() for k in request.headers.keys()]` — preserve original order.
6. **request_method**: `request.method.upper()`.
7. **path_pattern**: `self._normalize_path(request.url.path)`.
8. **query_param_keys**: `sorted(request.query_params.keys())`.
9. **content_type**: `request.headers.get("content-type")` or `None`.
10. **body**: `await request.body()` — read the full body bytes.
11. **body_entropy**: `self._compute_entropy(body)`.
12. **content_length**: `len(body)`.
13. Return a `RequestSignature` with all the above.

**Important:** After reading `request.body()`, the body is consumed. To allow the body to be read again downstream (for proxying), the body bytes must be cached. In FastAPI, `request.body()` can be called multiple times because Starlette caches it internally. Verify this behavior — if needed, store `request.state._body = body` and read it back later.

**`@staticmethod def _compute_entropy(data: bytes) -> float`**

1. If `len(data) == 0`, return `0.0`.
2. Count byte frequencies using `Counter(data)`.
3. Compute Shannon entropy: `H = -sum(p * log2(p) for p in probabilities)` where `p = count / total`.
4. Return `H` rounded to 4 decimal places.

**`@staticmethod def _normalize_path(path: str) -> str`**

1. Split path by `/`.
2. For each segment:
   - If the segment matches `^\d+$` (purely numeric), replace with `*`.
   - If the segment matches a UUID pattern (`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`), replace with `*`.
3. Rejoin with `/`.
4. Return the normalized path.

---

### 5.16 `app/services/feature_extractor_service.py`

**Imports:**
```python
import socket
from fastapi import Request
from app.models.schemas import RequestSignature, ClassifyRequest
from app.repositories.redis_repository import RedisRepository
from app.utils.logging import logger
```

#### Class: `FeatureExtractorService`

**`__init__(self, redis_repo: RedisRepository)`**
- Stores `self._redis_repo = redis_repo`.

**`async def extract_features(self, request: Request, signature: RequestSignature) -> ClassifyRequest`**

This is the core mapping function. It takes an HTTP request and produces a 49-feature vector for the AI model.

**Direct mappings:**

| Feature | Source | Logic |
|---|---|---|
| `srcip` | `signature.source_ip` | Direct |
| `sport` | Request source port | `request.client.port` if available, else `0` |
| `dstip` | Gateway IP | Use `socket.gethostname()` or `request.url.hostname` or `"0.0.0.0"` |
| `dsport` | Destination port | `request.url.port` or (`443` if scheme is `https`, else `80`) |
| `proto` | Always | `"tcp"` |
| `service` | Always | `"http"` |
| `state` | Always | `"FIN"` (assume completed HTTP transaction) |
| `sbytes` | Body size | `signature.content_length` (request body size) |
| `dbytes` | Response size | `0` (not known at classification time) |
| `trans_depth` | Always | `1` |
| `res_bdy_len` | Always | `0` (not known at classification time) |

**Approximated features:**

| Feature | Logic |
|---|---|
| `dur` | `max(signature.content_length / 1_000_000, 0.001)` — rough estimate: bytes / ~1MB/s |
| `sttl` | `64` (common Linux default) |
| `dttl` | `128` (common Windows default, used as approximation) |
| `sloss` | `0` (assume no packet loss) |
| `dloss` | `0` |
| `Sload` | `(sbytes * 8) / dur` if `dur > 0` else `0.0` |
| `Dload` | `0.0` (no response data at classification time) |
| `Spkts` | `max(sbytes // 1460, 1)` — bytes / TCP MSS, at least 1 |
| `Dpkts` | `1` (at least ACK) |
| `swin` | `255` |
| `dwin` | `255` |
| `stcpb` | `0` (not available at L7) |
| `dtcpb` | `0` |
| `smeansz` | `sbytes // Spkts` if `Spkts > 0` else `0` |
| `dmeansz` | `0` |
| `Sjit` | `0.0` |
| `Djit` | `0.0` |
| `Sintpkt` | `0.0` |
| `Dintpkt` | `0.0` |
| `tcprtt` | `0.02` |
| `synack` | `0.01` |
| `ackdat` | `0.01` |
| `is_sm_ips_ports` | `1` if `srcip == dstip and sport == dsport` else `0` |

**Redis counter features (all use `self._redis_repo.increment_connection_counter`):**

| Feature | key_type | parts | TTL |
|---|---|---|---|
| `ct_srv_src` | `"srv_src"` | `(signature.source_ip, "http")` | `300` |
| `ct_srv_dst` | `"srv_dst"` | `(dstip, "http")` | `300` |
| `ct_dst_ltm` | `"dst_ltm"` | `(dstip,)` | `300` |
| `ct_src_ltm` | `"src_ltm"` | `(signature.source_ip,)` | `300` |
| `ct_src_dport_ltm` | `"src_dport_ltm"` | `(signature.source_ip, str(dsport))` | `300` |
| `ct_dst_sport_ltm` | `"dst_sport_ltm"` | `(dstip, str(sport))` | `300` |
| `ct_dst_src_ltm` | `"dst_src_ltm"` | `(dstip, signature.source_ip)` | `300` |
| `ct_flw_http_mthd` | `"flw_http_mthd"` | `(signature.request_method,)` | `300` |
| `ct_state_ttl` | `"state_ttl"` | `("FIN", str(sttl))` | `300` |

**FTP features (always 0):**
- `is_ftp_login = 0`
- `ct_ftp_cmd = 0`

Return a `ClassifyRequest` with all 49 fields populated.

---

### 5.17 `app/services/classifier_client_service.py`

**Imports:**
```python
import time
import httpx
from app.models.schemas import ClassifyRequest, ClassifyResponse
from app.core.constants import ATTACK_LABELS
from app.utils.logging import logger
```

#### Class: `ClassifierClientService`

**`__init__(self, base_url: str)`**
- Stores `self._base_url = base_url.rstrip("/")`.

**`async def classify(self, features: ClassifyRequest) -> ClassifyResponse`**

1. Build the URL: `f"{self._base_url}/classify"`.
2. Serialize features: `features.model_dump()`.
3. Record `start = time.perf_counter()`.
4. Use `httpx.AsyncClient` with a timeout of `5.0` seconds:
   ```python
   async with httpx.AsyncClient(timeout=5.0) as client:
       response = await client.post(url, json=payload)
       response.raise_for_status()
   ```
5. Calculate `inference_time_ms = (time.perf_counter() - start) * 1000`.
6. Parse the response JSON. The AI classifier returns `{"attack_type": int, "confidence": float}` at minimum.
7. Build and return `ClassifyResponse`:
   - `attack_type`: from response JSON
   - `attack_label`: look up from `ATTACK_LABELS[attack_type]`
   - `confidence`: from response JSON
   - `inference_time_ms`: calculated above

**Error handling (fail-open):**
- On `httpx.TimeoutException`: log WARNING, return `ClassifyResponse(attack_type=0, attack_label="Normal", confidence=0.0, inference_time_ms=...)`.
- On `httpx.HTTPStatusError`: log WARNING, return same default.
- On any other `Exception`: log ERROR, return same default.

The system **fails open** — if the AI classifier is down, all traffic is treated as Normal and sent to the real backend. Availability takes priority over security in this failure mode.

---

### 5.18 `app/services/routing_service.py`

**Imports:**
```python
import asyncio
import time
from datetime import datetime, timezone
from fastapi import Request
from app.services.fingerprint_service import FingerprintService
from app.services.feature_extractor_service import FeatureExtractorService
from app.services.classifier_client_service import ClassifierClientService
from app.repositories.redis_repository import RedisRepository
from app.repositories.log_repository import LogRepository
from app.models.schemas import GatewayLogCreate
from app.core.constants import ATTACK_ROUTES, ATTACK_LABELS
from app.config import Settings
from app.utils.logging import logger
```

#### Class: `RoutingService`

**`__init__(self, fingerprint_svc: FingerprintService, feature_extractor_svc: FeatureExtractorService, classifier_client_svc: ClassifierClientService, redis_repo: RedisRepository, log_repo: LogRepository, settings: Settings)`**

Stores all dependencies as instance attributes.

**`async def resolve_upstream(self, request: Request) -> tuple[str, int, int, float]`**

Returns `(upstream_host, upstream_port, attack_type, confidence)`.

Full pipeline:

1. `start = time.perf_counter()`
2. **Extract signature:** `signature = await self._fingerprint_svc.extract_signature(request)`
3. **Compute fingerprint:** `fingerprint = self._fingerprint_svc.compute_fingerprint(signature)`
4. **Check Redis cache:** `cached_type = await self._redis_repo.get_fingerprint_classification(fingerprint)`
5. **If cache hit:**
   - `attack_type = cached_type`
   - `confidence = 1.0` (cached results have implicit full confidence)
   - `attack_label = ATTACK_LABELS.get(attack_type, "Unknown")`
   - Log at DEBUG: `f"Cache HIT for fingerprint {fingerprint[:16]}... -> {attack_label}"`
6. **If cache miss:**
   - Extract features: `features = await self._feature_extractor_svc.extract_features(request, signature)`
   - Classify: `result = await self._classifier_client_svc.classify(features)`
   - `attack_type = result.attack_type`
   - `confidence = result.confidence`
   - `attack_label = result.attack_label`
   - Cache the result: `await self._redis_repo.set_fingerprint_classification(fingerprint, attack_type, self._settings.FINGERPRINT_TTL)`
   - Log at INFO: `f"Cache MISS for fingerprint {fingerprint[:16]}... -> {attack_label} (confidence={confidence:.3f})"`
7. **Look up upstream:** `upstream_host, upstream_port = ATTACK_ROUTES.get(attack_type, ATTACK_ROUTES[0])`
8. **Compute latency:** `latency_ms = (time.perf_counter() - start) * 1000`
9. **Log to database (fire-and-forget):**
   ```python
   log_entry = GatewayLogCreate(
       timestamp=datetime.now(timezone.utc),
       fingerprint=fingerprint,
       source_ip=signature.source_ip,
       attack_type=attack_type,
       attack_label=attack_label,
       confidence=confidence,
       upstream=f"{upstream_host}:{upstream_port}",
       latency_ms=latency_ms,
       method=signature.request_method,
       path=request.url.path,
       user_agent=signature.user_agent,
   )
   asyncio.create_task(self._log_repo.create_log(log_entry))
   ```
   Use `asyncio.create_task` so the log write does not block the request pipeline.
10. **Return:** `(upstream_host, upstream_port, attack_type, confidence)`

---

### 5.19 `app/services/proxy_service.py`

**Imports:**
```python
import httpx
from fastapi import Request
from fastapi.responses import Response
from app.core.constants import HOP_BY_HOP_HEADERS
from app.utils.logging import logger
```

#### Class: `ProxyService`

**`async def forward_request(self, request: Request, upstream_host: str, upstream_port: int) -> Response`**

Transparently forward the request to the upstream service.

Steps:

1. **Build upstream URL:**
   ```python
   upstream_url = f"http://{upstream_host}:{upstream_port}{request.url.path}"
   if request.url.query:
       upstream_url += f"?{request.url.query}"
   ```

2. **Read request body:** `body = await request.body()`

3. **Filter headers:** `headers = self._filter_hop_by_hop(dict(request.headers))`

4. **Add forwarding headers:**
   ```python
   client_ip = request.client.host if request.client else "0.0.0.0"
   existing_xff = request.headers.get("x-forwarded-for", "")
   headers["x-forwarded-for"] = f"{existing_xff}, {client_ip}".strip(", ")
   headers["x-real-ip"] = client_ip
   ```

5. **Set Host header** to upstream: `headers["host"] = f"{upstream_host}:{upstream_port}"`

6. **Forward the request:**
   ```python
   async with httpx.AsyncClient(timeout=30.0) as client:
       upstream_response = await client.request(
           method=request.method,
           url=upstream_url,
           headers=headers,
           content=body,
           follow_redirects=False,
       )
   ```

7. **Filter response headers:** Remove hop-by-hop headers from upstream response headers too.

8. **Build and return FastAPI Response:**
   ```python
   return Response(
       content=upstream_response.content,
       status_code=upstream_response.status_code,
       headers=dict(upstream_response.headers),
   )
   ```

9. **Error handling:**
   - On `httpx.TimeoutException`: return `Response(content=b"Gateway Timeout", status_code=504)`
   - On `httpx.ConnectError`: return `Response(content=b"Bad Gateway", status_code=502)`
   - On any other exception: log ERROR, return `Response(content=b"Internal Server Error", status_code=500)`

**`@staticmethod def _filter_hop_by_hop(headers: dict) -> dict`**

```python
return {k: v for k, v in headers.items() if k.lower() not in HOP_BY_HOP_HEADERS}
```

---

### 5.20 `app/controllers/__init__.py`

Empty file.

---

### 5.21 `app/controllers/health_controller.py`

**Imports:**
```python
from fastapi import APIRouter
from app.core.redis import get_redis
from app.utils.logging import logger
```

**Router:** `router = APIRouter(tags=["health"])`

**Endpoint: `GET /health`**

```python
@router.get("/health")
async def health_check():
```

1. Check Redis connectivity: try `await get_redis().ping()`.
2. Return JSON:
   - On success: `{"status": "healthy", "redis": "connected"}`
   - On Redis failure: `{"status": "degraded", "redis": "disconnected"}` with HTTP 200 still (the gateway can still function without Redis, just slower).

---

### 5.22 `app/controllers/proxy_controller.py`

**Imports:**
```python
from fastapi import APIRouter, Request
from app.services.routing_service import RoutingService
from app.services.proxy_service import ProxyService
```

**Router:** `router = APIRouter()`

**Module-level variables (set during app startup):**
```python
routing_service: RoutingService | None = None
proxy_service: ProxyService | None = None
```

**Function: `def init_services(routing_svc: RoutingService, proxy_svc: ProxyService) -> None`**
- Sets the module-level `routing_service` and `proxy_service` variables.
- This is called from `main.py` during the lifespan startup.

**Endpoint: catch-all**

```python
@router.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
)
async def proxy_all(request: Request, path: str):
```

1. `upstream_host, upstream_port, attack_type, confidence = await routing_service.resolve_upstream(request)`
2. `response = await proxy_service.forward_request(request, upstream_host, upstream_port)`
3. Add custom response headers (for observability, can be stripped by a front-end proxy):
   - `X-Gateway-Attack-Type`: str(attack_type)
   - `X-Gateway-Confidence`: f"{confidence:.3f}"
4. Return `response`.

**Important:** The catch-all route must be registered LAST on the app, after `/health`, so it does not shadow the health endpoint.

---

### 5.23 `app/middleware/__init__.py`

Empty file.

---

### 5.24 `app/middleware/request_interceptor.py`

**Imports:**
```python
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.utils.logging import logger
```

#### Class: `RequestInterceptorMiddleware(BaseHTTPMiddleware)`

**`async def dispatch(self, request: Request, call_next)`**

1. `start = time.perf_counter()`
2. `response = await call_next(request)`
3. `latency_ms = (time.perf_counter() - start) * 1000`
4. Log structured JSON at INFO level:
   ```python
   logger.info(
       "request_processed",
       extra={
           "method": request.method,
           "path": request.url.path,
           "status_code": response.status_code,
           "latency_ms": round(latency_ms, 2),
           "client_ip": request.client.host if request.client else "unknown",
       },
   )
   ```
5. Add `X-Process-Time` header to response: `response.headers["X-Process-Time"] = f"{latency_ms:.2f}ms"`
6. Return `response`.

---

### 5.25 `app/main.py`

**Imports:**
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.database import init_db, close_db
from app.core.redis import init_redis, close_redis, get_redis
from app.repositories.redis_repository import RedisRepository
from app.repositories.log_repository import LogRepository
from app.core.database import async_session_factory
from app.services.fingerprint_service import FingerprintService
from app.services.feature_extractor_service import FeatureExtractorService
from app.services.classifier_client_service import ClassifierClientService
from app.services.routing_service import RoutingService
from app.services.proxy_service import ProxyService
from app.controllers import health_controller, proxy_controller
from app.middleware.request_interceptor import RequestInterceptorMiddleware
from app.utils.logging import logger
```

**Lifespan:**

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    logger.info("Gateway starting up...")

    # 1. Initialize Redis
    redis = await init_redis()
    logger.info("Redis connected")

    # 2. Initialize Database (create tables)
    await init_db()
    logger.info("Database initialized")

    # 3. Build repositories
    redis_repo = RedisRepository(redis)
    log_repo = LogRepository(async_session_factory)

    # 4. Build services
    fingerprint_svc = FingerprintService()
    feature_extractor_svc = FeatureExtractorService(redis_repo)
    classifier_client_svc = ClassifierClientService(settings.AI_CLASSIFIER_URL)
    routing_svc = RoutingService(
        fingerprint_svc=fingerprint_svc,
        feature_extractor_svc=feature_extractor_svc,
        classifier_client_svc=classifier_client_svc,
        redis_repo=redis_repo,
        log_repo=log_repo,
        settings=settings,
    )
    proxy_svc = ProxyService()

    # 5. Inject services into controller
    proxy_controller.init_services(routing_svc, proxy_svc)

    logger.info("Gateway ready to accept connections")

    yield  # --- APP RUNS ---

    # --- SHUTDOWN ---
    logger.info("Gateway shutting down...")
    await close_redis()
    await close_db()
    logger.info("Gateway shutdown complete")
```

**App creation:**

```python
app = FastAPI(
    title="AI Security Gateway",
    description="Smart reverse proxy with AI-powered traffic classification",
    version="1.0.0",
    lifespan=lifespan,
)
```

**Middleware registration (order matters — first added = outermost):**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestInterceptorMiddleware)
```

**Router registration (order matters — health BEFORE catch-all):**

```python
app.include_router(health_controller.router)
app.include_router(proxy_controller.router)
```

---

## 6. Tests

### 6.1 `tests/__init__.py`

Empty file.

### 6.2 `tests/test_fingerprint_service.py`

**Imports:**
```python
import pytest
from app.services.fingerprint_service import FingerprintService
from app.models.schemas import RequestSignature
```

**Tests:**

1. **`test_compute_fingerprint_deterministic`**
   - Create a `RequestSignature` with fixed values.
   - Call `compute_fingerprint` twice.
   - Assert both results are identical.
   - Assert the result is a 64-character hex string.

2. **`test_compute_fingerprint_different_inputs`**
   - Create two `RequestSignature` objects with different `source_ip` values.
   - Assert the fingerprints are different.

3. **`test_normalize_path_replaces_numeric`**
   - `_normalize_path("/api/products/42")` should return `"/api/products/*"`.
   - `_normalize_path("/api/users/123/orders/456")` should return `"/api/users/*/orders/*"`.

4. **`test_normalize_path_replaces_uuid`**
   - `_normalize_path("/api/items/550e8400-e29b-41d4-a716-446655440000")` should return `"/api/items/*"`.

5. **`test_normalize_path_preserves_non_numeric`**
   - `_normalize_path("/api/products/search")` should return `"/api/products/search"` unchanged.

6. **`test_compute_entropy_empty`**
   - `_compute_entropy(b"")` should return `0.0`.

7. **`test_compute_entropy_uniform`**
   - `_compute_entropy(b"\x00" * 100)` should return `0.0` (all same byte = 0 entropy).

8. **`test_compute_entropy_high`**
   - `_compute_entropy(bytes(range(256)))` should return close to `8.0` (max entropy for byte data).

### 6.3 `tests/test_routing_service.py`

**Imports:**
```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.routing_service import RoutingService
from app.models.schemas import ClassifyResponse
```

**Tests:**

1. **`test_resolve_upstream_cache_hit`**
   - Mock `redis_repo.get_fingerprint_classification` to return `0` (Normal).
   - Mock `fingerprint_svc.extract_signature` and `compute_fingerprint`.
   - Call `resolve_upstream`.
   - Assert the classifier was NOT called.
   - Assert returned upstream matches `ATTACK_ROUTES[0]`.

2. **`test_resolve_upstream_cache_miss_normal`**
   - Mock Redis to return `None` (cache miss).
   - Mock classifier to return `ClassifyResponse(attack_type=0, attack_label="Normal", confidence=0.95, inference_time_ms=12.5)`.
   - Call `resolve_upstream`.
   - Assert the classifier WAS called.
   - Assert `redis_repo.set_fingerprint_classification` was called.
   - Assert returned upstream matches `ATTACK_ROUTES[0]`.

3. **`test_resolve_upstream_cache_miss_attack`**
   - Mock Redis to return `None`.
   - Mock classifier to return `attack_type=4` (DoS).
   - Assert returned upstream matches `ATTACK_ROUTES[4]` (honeypot-dos).

4. **`test_resolve_upstream_classifier_failure`**
   - Mock Redis to return `None`.
   - Mock classifier to raise an exception.
   - Assert returned upstream defaults to `ATTACK_ROUTES[0]` (fail-open).

### 6.4 `tests/test_feature_extractor.py`

**Imports:**
```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.feature_extractor_service import FeatureExtractorService
from app.models.schemas import RequestSignature
```

**Tests:**

1. **`test_extract_features_basic`**
   - Create a mock `Request` and `RequestSignature`.
   - Mock the `RedisRepository` so `increment_connection_counter` returns `1` for all counter calls.
   - Call `extract_features`.
   - Assert the returned `ClassifyRequest` has:
     - `proto == "tcp"`
     - `service == "http"`
     - `is_ftp_login == 0`
     - `ct_ftp_cmd == 0`
     - `srcip` matches the signature's source_ip.

2. **`test_extract_features_counter_increments`**
   - Same setup but verify that `increment_connection_counter` was called exactly 9 times (one for each ct_* counter).

3. **`test_extract_features_packet_calculation`**
   - Set `content_length = 14600` (10 packets worth).
   - Assert `Spkts == 10` (14600 // 1460).
   - Assert `smeansz == 1460` (14600 // 10).

---

## 7. Inter-Service Communication Summary

| From | To | Protocol | Endpoint | Purpose |
|---|---|---|---|---|
| Gateway | Redis | TCP/6379 | N/A (Redis protocol) | Fingerprint cache, ct_* counters, rate limits |
| Gateway | AI Classifier | HTTP POST | `POST /classify` | Send 49-feature vector, get attack classification |
| Gateway | Store Backend | HTTP (any method) | `*` (transparent proxy) | Forward normal traffic |
| Gateway | Honeypot-Generic | HTTP (any method) | `*` (transparent proxy) | Forward Generic attacks |
| Gateway | Honeypot-Exploits | HTTP (any method) | `*` (transparent proxy) | Forward Exploits attacks |
| Gateway | Honeypot-Fuzzers | HTTP (any method) | `*` (transparent proxy) | Forward Fuzzers attacks |
| Gateway | Honeypot-DoS | HTTP (any method) | `*` (transparent proxy) | Forward DoS attacks |
| Gateway | Honeypot-Recon | HTTP (any method) | `*` (transparent proxy) | Forward Reconnaissance attacks |
| Gateway | Honeypot-Analysis | HTTP (any method) | `*` (transparent proxy) | Forward Analysis attacks |
| Gateway | Honeypot-Backdoor | HTTP (any method) | `*` (transparent proxy) | Forward Backdoor attacks |
| Gateway | Honeypot-Shellcode | HTTP (any method) | `*` (transparent proxy) | Forward Shellcode attacks |
| Gateway | Honeypot-Worms | HTTP (any method) | `*` (transparent proxy) | Forward Worms attacks |
| Gateway | PostgreSQL (gatewaydb) | TCP/5432 | N/A (asyncpg) | Log every routing decision |

---

## 8. Key Behavioral Rules

1. **Transparency**: The gateway is completely invisible to the client. No redirects, no modified URLs. The client thinks it is talking to the real backend regardless of whether it has been rerouted to a honeypot.

2. **Fingerprint TTL**: Cached classifications expire after 1 hour (`FINGERPRINT_TTL = 3600`). After expiry, the next request with the same fingerprint triggers a fresh classification.

3. **Fail-Open**: If the AI classifier is unreachable, times out, or returns an error, the gateway defaults to `attack_type=0` (Normal) and routes to the real backend. Availability takes priority over security in failure modes.

4. **Structured Logging**: All log output is structured JSON to stdout, suitable for collection by Filebeat or similar log shippers into an ELK stack.

5. **Database Logging**: Every routing decision is also written to `gatewaydb.gateway_logs` via async fire-and-forget (`asyncio.create_task`). A database write failure must NEVER block or fail the request pipeline.

6. **Body Preservation**: The request body must be readable both for fingerprinting/feature extraction AND for proxying to the upstream. Starlette caches `request.body()` internally, so multiple calls return the same bytes.

7. **Header Forwarding**: Hop-by-hop headers (Connection, Keep-Alive, Transfer-Encoding, etc.) are stripped. All other headers are forwarded. `X-Forwarded-For` and `X-Real-IP` are added/appended.

8. **No Response Modification**: The upstream response is returned to the client as-is (status code, headers, body), except for the addition of observability headers (`X-Gateway-Attack-Type`, `X-Gateway-Confidence`, `X-Process-Time`). These can be stripped by a front-end load balancer if needed.

---

## 9. Environment Variables

All prefixed with `GATEWAY_`:

| Variable | Default | Description |
|---|---|---|
| `GATEWAY_REDIS_HOST` | `redis.honeypot.svc.cluster.local` | Redis host |
| `GATEWAY_REDIS_PORT` | `6379` | Redis port |
| `GATEWAY_REDIS_DB` | `0` | Redis DB number |
| `GATEWAY_GATEWAY_DB_URL` | `postgresql+asyncpg://gateway:gateway@postgres-gateway.honeypot.svc.cluster.local:5432/gatewaydb` | PostgreSQL connection string |
| `GATEWAY_AI_CLASSIFIER_URL` | `http://ai-classifier.honeypot.svc.cluster.local:8000` | AI classifier base URL |
| `GATEWAY_STORE_BACKEND_HOST` | `store-backend.honeypot.svc.cluster.local` | Real store backend host |
| `GATEWAY_STORE_BACKEND_PORT` | `8000` | Real store backend port |
| `GATEWAY_FINGERPRINT_TTL` | `3600` | Cache TTL in seconds |
| `GATEWAY_LOG_LEVEL` | `INFO` | Log level |

---

## 10. Request Flow (End-to-End)

```
Client Request
    │
    ▼
┌───────────────────────────────────┐
│  RequestInterceptorMiddleware     │
│  (start timer)                    │
│    │                              │
│    ▼                              │
│  proxy_controller.proxy_all()    │
│    │                              │
│    ▼                              │
│  routing_service.resolve_upstream()│
│    │                              │
│    ├─► fingerprint_svc.extract_signature(request)
│    │     └─► Read headers, body, compute entropy
│    │                              │
│    ├─► fingerprint_svc.compute_fingerprint(signature)
│    │     └─► SHA-256 hash         │
│    │                              │
│    ├─► redis_repo.get_fingerprint_classification(fp)
│    │     └─► Redis GET fp:{hash}  │
│    │                              │
│    │   [CACHE MISS]               │
│    ├─► feature_extractor_svc.extract_features(request, sig)
│    │     ├─► Compute 49 UNSW-NB15 features
│    │     └─► Redis INCR ct_* counters (9 calls)
│    │                              │
│    ├─► classifier_client_svc.classify(features)
│    │     └─► POST http://ai-classifier:8000/classify
│    │                              │
│    ├─► redis_repo.set_fingerprint_classification(fp, type)
│    │     └─► Redis SETEX fp:{hash} 3600 type
│    │                              │
│    ├─► ATTACK_ROUTES[attack_type] → (host, port)
│    │                              │
│    └─► asyncio.create_task(log_repo.create_log(...))
│         └─► INSERT INTO gateway_logs (fire-and-forget)
│                                   │
│    ▼                              │
│  proxy_service.forward_request()  │
│    ├─► Build upstream URL         │
│    ├─► Filter hop-by-hop headers  │
│    ├─► Add X-Forwarded-For        │
│    └─► httpx.request() → upstream │
│                                   │
│  (stop timer, log, add headers)   │
└───────────────────────────────────┘
    │
    ▼
Client Response (transparent)
```

---

## 11. Implementation Notes

1. **All `__init__.py` files**: Generate them. They can be empty unless the spec says otherwise.

2. **Type hints**: Use type hints on all function signatures. Use `from __future__ import annotations` at the top of every file.

3. **Async everywhere**: Every I/O operation (Redis, HTTP, database) must be async. Use `await` consistently.

4. **No global mutable state except where noted**: The Redis pool and DB engine are module-level singletons initialized during lifespan. Service instances are created during lifespan and injected into controllers.

5. **Error handling**: Every external call (Redis, HTTP, DB) must be wrapped in try/except. Failures are logged but never crash the gateway. The gateway must stay up.

6. **No hardcoded secrets**: All configuration comes from environment variables via `Settings`.

7. **Docker**: The Dockerfile uses a multi-stage build for smaller images. The app runs as a non-root `appuser`.

8. **Tests**: Use `pytest` with `pytest-asyncio` for async tests. Mock all external dependencies.
