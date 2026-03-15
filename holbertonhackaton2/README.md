# AI-Powered Network Request Classification & Dynamic Honeypot System

An intelligent network security system that classifies incoming HTTP requests using machine learning, fingerprints visitors, and dynamically routes detected attacks to specialized honeypot services — all running in Minikube.

## Architecture

```
                        INTERNET
                            |
                  ┌─────────▼──────────┐
                  │   NGINX Ingress    │
                  │  (minikube addon)  │
                  └─────────┬──────────┘
                            │
          ┌─────────────────▼──────────────────┐
          │         GATEWAY (FastAPI)          │
          │                                    │
          │  1. Fingerprint request (SHA-256)   │
          │  2. Check Redis cache (1hr TTL)     │
          │  3. On miss → call AI Classifier    │
          │  4. Route to upstream transparently  │
          └──┬────────┬────────┬───────────────┘
             │        │        │
    ┌────────▼──┐  ┌──▼──┐  ┌─▼──────────────────────┐
    │  Redis    │  │ AI  │  │  Normal (type=0)        │
    │  Cache    │  │ Svc │  │  → Real Store Backend   │
    └───────────┘  └─────┘  │                         │
                            │  Attack (type=1..9)     │
                            │  → Honeypot (fake store │
                            │    + forensic logging)  │
                            └─────────────────────────┘

  ┌──────────────┐   ┌───────────────────┐
  │ PostgreSQL   │   │ PostgreSQL        │
  │ (storedb)    │   │ (gatewaydb)       │
  └──────────────┘   └───────┬───────────┘
                              │
              ┌───────────────▼───────────────┐
              │  Admin API → Admin Panel      │
              │  (real-time attack dashboard)  │
              └───────────────────────────────┘

  ┌──────────────────────────────────────────┐
  │  ELK Stack                               │
  │  Filebeat → Logstash → Elasticsearch     │
  │  Kibana dashboards                        │
  └──────────────────────────────────────────┘
```

### How It Works

1. **Every request** hits the Gateway, which computes a SHA-256 fingerprint from IP, User-Agent, headers, body entropy, and more.
2. **Cache check**: Redis stores fingerprint → attack_type mappings with a 1-hour TTL. Repeat visitors are classified instantly (~0.5ms).
3. **On cache miss**: The Gateway extracts 49 UNSW-NB15 compatible features and sends them to the AI Classifier for prediction.
4. **Routing**: Normal traffic (type 0) goes to the real store. Attack traffic (types 1-9) is transparently proxied to a honeypot that **looks identical** to the real store but serves dummy data and logs everything forensically.
5. **The attacker never knows** they've been redirected — no HTTP redirects, no URL changes, no visible difference.

### Attack Classification

| Type | Label | Honeypot Behavior |
|------|-------|-------------------|
| 0 | Normal | → Real store backend |
| 1 | Generic | Fake store, standard logging |
| 2 | Exploits | Fake wp-admin, phpmyadmin login pages |
| 3 | Fuzzers | Random error responses to keep fuzzer engaged |
| 4 | DoS | Tarpitting (1-5s delays per request) |
| 5 | Reconnaissance | Fake .env, robots.txt, /backup, /admin |
| 6 | Analysis | Leaked "internal" APIs with fake data |
| 7 | Backdoor | Fake web shell (/api/exec, /api/shell) |
| 8 | Shellcode | Accepts binary uploads, logs hex dumps |
| 9 | Worms | Fake propagation/infection endpoints |

---

## Project Structure

```
holbertonhackaton2/
├── Makefile                    # Build & deploy orchestration
├── README.md
│
├── gateway/                    # Smart Reverse Proxy (FastAPI)
│   ├── app/
│   │   ├── services/          # Fingerprinting, feature extraction, routing, proxy
│   │   ├── repositories/      # Redis cache, PostgreSQL logging
│   │   ├── controllers/       # Catch-all proxy route + health
│   │   └── middleware/        # Request timing & structured logging
│   ├── tests/                 # 25 unit tests
│   └── Dockerfile
│
├── ai-classifier/             # ML Classification Service (FastAPI)
│   ├── app/
│   │   ├── services/          # Classifier (dummy/real model swap)
│   │   └── controllers/       # POST /classify, GET /health
│   └── Dockerfile
│
├── store-backend/             # Legitimate Store API (FastAPI)
│   ├── app/
│   │   ├── models/            # Product, CartItem, Order, OrderItem (SQLAlchemy)
│   │   ├── repositories/      # Product, Cart, Order CRUD
│   │   ├── services/          # Business logic with stock validation
│   │   └── controllers/       # /api/products, /api/cart, /api/orders
│   ├── alembic/               # Database migrations
│   ├── seed/                  # 25 sample products
│   └── Dockerfile
│
├── store-frontend/            # Customer-Facing Store (React + TypeScript)
│   ├── src/
│   │   ├── pages/             # Home, ProductDetail, Cart, Checkout
│   │   ├── components/        # ProductCard, CartItem, SearchBar, etc.
│   │   ├── hooks/             # useProducts, useCart, useOrders
│   │   └── api/               # Axios client
│   ├── nginx.conf
│   └── Dockerfile
│
├── honeypots/                 # Fake Store Clones (FastAPI, single image)
│   ├── app/
│   │   ├── services/behavior/ # 9 attack-type-specific behaviors
│   │   ├── repositories/      # In-memory dummy data (28 products)
│   │   ├── controllers/       # Same API as real store
│   │   └── middleware/        # Forensic request/response logging
│   └── Dockerfile
│
├── admin-api/                 # Admin Dashboard API (FastAPI)
│   ├── app/
│   │   ├── repositories/      # Stats aggregation, log queries
│   │   ├── services/          # Overview, fingerprints, WebSocket streaming
│   │   └── controllers/       # /api/admin/stats, /fingerprints, /logs, WS /ws/live
│   └── Dockerfile
│
├── admin-panel/               # Admin Dashboard (React + Recharts)
│   ├── src/
│   │   ├── pages/             # Overview, Attacks, Fingerprints, Logs
│   │   ├── components/        # StatsCards, Charts, Tables, LiveIndicator
│   │   └── hooks/             # useWebSocket, useStats, useFingerprints
│   ├── nginx.conf
│   └── Dockerfile
│
├── elk/                       # ELK Stack Configuration
│   ├── elasticsearch/         # Single-node config
│   ├── logstash/              # Pipeline: gateway + honeypot + store logs
│   ├── kibana/                # Dashboard config
│   └── filebeat/              # K8s autodiscover DaemonSet config
│
├── k8s/                       # Kubernetes Manifests (47 files)
│   ├── namespace.yaml
│   ├── secrets.yaml
│   ├── redis/                 # Redis deployment + service
│   ├── postgres-store/        # PostgreSQL for store data
│   ├── postgres-gateway/      # PostgreSQL for gateway logs
│   ├── gateway/               # Gateway deployment + configmap
│   ├── store-frontend/
│   ├── store-backend/
│   ├── ai-classifier/
│   ├── honeypots/             # 9 deployments + 9 services
│   ├── elk/                   # ES, Logstash, Kibana, Filebeat
│   ├── admin-panel/
│   ├── admin-api/
│   └── ingress.yaml           # shop.local, admin.local, kibana.local
│
└── plans/                     # Detailed implementation specs (8 files)
```

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Gateway | FastAPI, httpx, redis.asyncio |
| Store API | FastAPI, SQLAlchemy 2.0 (async), asyncpg, Alembic |
| AI Classifier | FastAPI, XGBoost (UNSW-NB15 dataset) |
| Honeypots | FastAPI (single image, env-driven behavior) |
| Admin API | FastAPI, WebSocket, SQLAlchemy |

### Frontend
| Component | Technology |
|-----------|-----------|
| Store | React 18, TypeScript, Vite, Tailwind CSS |
| Admin Panel | React 18, TypeScript, Recharts, Tailwind CSS |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Orchestration | Minikube (Kubernetes) |
| Databases | PostgreSQL 16 (x2: storedb, gatewaydb) |
| Cache | Redis 7 |
| Logging | Elasticsearch, Logstash, Kibana, Filebeat |
| Ingress | NGINX Ingress Controller |

### Architecture Pattern (All FastAPI Services)
```
Model (Pydantic + SQLAlchemy) → Repository (data access) → Service (business logic) → Controller (HTTP routes)
```

---

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) (v1.30+)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Docker](https://docs.docker.com/get-docker/)
- 8GB RAM and 4 CPUs allocated to Minikube

---

## Quick Start

### 1. Start Minikube

```bash
minikube start --memory=8192 --cpus=4
```

### 2. Use Minikube's Docker Daemon

```bash
eval $(minikube docker-env)
```

This builds images directly into Minikube's Docker daemon, so no container registry is needed.

### 3. Setup & Build

```bash
make setup    # Enable ingress addon, create namespace
make build    # Build all 7 Docker images
```

### 4. Deploy

```bash
make deploy-all
```

This deploys in the correct order:
1. Infrastructure (Redis, PostgreSQL x2, Elasticsearch)
2. ELK stack (Logstash, Kibana, Filebeat)
3. Backend services (store-backend, ai-classifier, 9 honeypots)
4. Gateway
5. Frontends (store-frontend, admin-panel, admin-api)
6. Ingress rules

### 5. Configure DNS

Add the Minikube IP to your hosts file:

```bash
echo "$(minikube ip) shop.local admin.local kibana.local" | sudo tee -a /etc/hosts
```

### 6. Access the Services

| Service | URL |
|---------|-----|
| Store | http://shop.local |
| Store API | http://shop.local/api/products |
| Admin Panel | http://admin.local |
| Kibana | http://kibana.local |

---

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make setup` | Enable minikube ingress addon, create namespace |
| `make build` | Build all 7 Docker images |
| `make deploy-infra` | Deploy Redis, PostgreSQL x2, Elasticsearch |
| `make deploy-elk` | Deploy Logstash, Kibana, Filebeat |
| `make deploy-backend` | Deploy store-backend, ai-classifier, 9 honeypots |
| `make deploy-gateway` | Deploy gateway |
| `make deploy-frontend` | Deploy store-frontend, admin-panel, admin-api |
| `make deploy-ingress` | Deploy ingress rules |
| `make deploy-all` | Deploy everything in correct order |
| `make status` | Show all pods, services, ingress |
| `make logs` | Tail logs for a specific service |
| `make destroy` | Delete the entire namespace |

---

## API Reference

### Store API (via Gateway at shop.local/api)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (search, category, pagination) |
| GET | `/api/products/categories` | List product categories |
| GET | `/api/products/{id}` | Get product by ID |
| GET | `/api/cart` | Get current cart |
| POST | `/api/cart` | Add item to cart |
| PUT | `/api/cart/{item_id}` | Update cart item quantity |
| DELETE | `/api/cart/{item_id}` | Remove cart item |
| POST | `/api/orders` | Place order (checkout) |
| GET | `/api/orders/{id}` | Get order by ID |

### AI Classifier API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/classify` | Classify request (49 UNSW-NB15 features) |
| GET | `/health` | Health check |

### Admin API (admin.local/api/admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats/overview` | Aggregate statistics |
| GET | `/api/admin/stats/breakdown` | Attack type distribution |
| GET | `/api/admin/stats/timeseries` | Time-bucketed attack counts |
| GET | `/api/admin/fingerprints` | Paginated fingerprint list |
| GET | `/api/admin/fingerprints/{hash}` | Fingerprint detail |
| GET | `/api/admin/logs` | Paginated, filterable logs |
| WS | `/api/admin/ws/live` | Real-time log stream |

---

## Database Architecture

Two separate PostgreSQL instances ensure complete isolation:

### storedb (postgres-store)
Real store data. Only the store-backend reads/writes.

```sql
products        -- 25 seeded products across 5 categories
cart_items      -- Session-based cart (cookie-identified)
orders          -- Customer orders
order_items     -- Order line items
```

### gatewaydb (postgres-gateway)
Security logs. Gateway writes, admin-api reads.

```sql
gateway_logs    -- Every routing decision
  ├── fingerprint   (indexed) -- SHA-256 request fingerprint
  ├── source_ip     (indexed) -- Client IP
  ├── attack_type   (indexed) -- 0-9 classification
  ├── attack_label            -- Human-readable label
  ├── confidence              -- AI model confidence
  ├── upstream                -- Where request was routed
  ├── latency_ms              -- Gateway processing time
  ├── method, path, user_agent
  └── timestamp     (indexed)
```

### Redis
Ephemeral cache. No persistence needed.

```
fp:{sha256}              → attack_type (int)     TTL: 3600s
ct:srv_src:{ip}:http     → connection count      TTL: 300s
ct:dst_ltm:{ip}          → connection count      TTL: 300s
rate:{ip}                → request count         TTL: 60s
... (9 counter types for UNSW-NB15 features)
```

---

## Fingerprinting

The gateway computes a deterministic SHA-256 fingerprint from:

| Signal | Source | Purpose |
|--------|--------|---------|
| Source IP | X-Forwarded-For / X-Real-IP / client.host | Identity |
| User-Agent | Request header (lowercased) | Client identification |
| Accept-Language | Request header | Browser locale |
| Accept-Encoding | Request header | Client capabilities |
| Header order | Ordered list of header names | Client stack fingerprint |
| HTTP method | GET, POST, etc. | Request intent |
| Path pattern | Normalized (numerics → `*`) | Access pattern |
| Query param keys | Sorted parameter names | Request structure |
| Content-Type | Request header | Payload type |
| Body entropy | Shannon entropy of body bytes | Payload analysis |
| Content-Length | Body size in bytes | Payload size |

**Lifecycle**: First request → full AI classification (~10ms). Subsequent requests within 1 hour → instant Redis cache hit (~0.5ms).

---

## AI Classification

### Model
- **Algorithm**: XGBoost multi-class classifier
- **Dataset**: UNSW-NB15 (2.5M network records, 49 features, 10 categories)
- **Classes**: Normal + 9 attack types matching our `attack_mapping`
- **Expected accuracy**: 93-96%

### Feature Extraction
The gateway maps HTTP-level request attributes to the 49 UNSW-NB15 network flow features:

- **Direct**: source IP, ports, protocol, service, body bytes
- **Approximated**: duration, TTL, packet counts, load, jitter
- **Redis-tracked**: Connection counters (ct_srv_src, ct_dst_ltm, etc.) maintained as sliding window counters

### Plugging In Your Trained Model
The current AI classifier returns random results (dummy mode). To use your trained model:

1. Place model artifacts in `ai-classifier/models/`:
   - `classifier.joblib` — trained XGBoost model
   - `scaler.joblib` — fitted StandardScaler
   - `encoder.joblib` — fitted OneHotEncoder
   - `feature_columns.json` — ordered feature names

2. Update `ai-classifier/app/services/classifier_service.py` to load and run the model instead of returning random predictions.

---

## Honeypot Design

Each honeypot is a **clone of the real store**:
- Same API endpoints (`/api/products`, `/api/cart`, `/api/orders`)
- Same response format (Pydantic schemas match)
- Realistic dummy data (28 products, 5 categories)
- **Single Docker image** — behavior driven by `HONEYPOT_TYPE` env var

### Per-Type Behavioral Tweaks

| Type | Extra Bait Endpoints | Special Behavior |
|------|---------------------|------------------|
| Generic | None | Baseline: logs everything |
| Exploits | `/wp-admin/`, `/phpmyadmin/` | Fake login pages, SQL injection bait in products |
| Fuzzers | None | 10% random error responses (400/403/500) |
| DoS | None | Tarpitting: 1-5s artificial delay per request |
| Recon | `/robots.txt`, `/.env`, `/admin/`, `/backup/` | Fake credentials, backup file listings |
| Analysis | `/api/internal/users`, `/config`, `/stats` | Leaked internal APIs with fake data |
| Backdoor | `/api/exec`, `/api/shell` | Fake web shell with plausible output |
| Shellcode | `/api/upload`, `/api/execute` | Accepts binary, logs hex dumps |
| Worms | `/api/propagate`, `/api/infect`, `/api/botnet/status` | Fake propagation responses |

### Forensic Logging
Every honeypot request/response is logged as structured JSON:
```json
{
  "event": "honeypot_interaction",
  "honeypot_type": "exploits",
  "timestamp": "2026-03-15T12:00:00Z",
  "source_ip": "192.168.1.100",
  "method": "POST",
  "path": "/wp-admin/",
  "headers": { "..." },
  "body": "log=admin&pwd=password123",
  "response_status": 200,
  "latency_ms": 45.2
}
```

---

## Admin Dashboard

The admin panel provides real-time visibility into the security system:

### Overview Page
- **Stats cards**: Total requests, attacks detected, unique IPs, avg confidence
- **Time series chart**: Attacks over time (Recharts LineChart)
- **Attack breakdown**: Donut chart by attack type

### Fingerprints Page
- Searchable/sortable table of all fingerprints
- Columns: hash, IP, attack type, confidence, hit count, first/last seen
- Click to expand: all IPs used, methods, recent paths

### Logs Page
- **Real-time** via WebSocket (2s polling)
- Live indicator (green pulse when connected)
- Filters: attack type, HTTP method, IP
- Pause/resume auto-scroll

---

## ELK Stack

All services emit structured JSON to stdout. The logging pipeline:

```
Pods (stdout) → Filebeat (DaemonSet) → Logstash → Elasticsearch
                                                        ↓
                                                     Kibana
```

### Log Indices
| Index Pattern | Source |
|---------------|--------|
| `gateway-logs-*` | Gateway routing decisions (with GeoIP) |
| `honeypot-logs-*` | Honeypot forensic interactions |
| `store-logs-*` | Store backend application logs |

---

## Kubernetes Resources

### Pod Count: 22 total

| Service | Pods | CPU | Memory |
|---------|------|-----|--------|
| Gateway | 1 | 200m | 256Mi |
| Store Backend | 1 | 150m | 256Mi |
| Store Frontend | 1 | 50m | 64Mi |
| AI Classifier | 1 | 300m | 512Mi |
| Honeypots (x9) | 9 | 450m | 576Mi |
| Redis | 1 | 100m | 128Mi |
| PostgreSQL (x2) | 2 | 400m | 512Mi |
| Elasticsearch | 1 | 500m | 1Gi |
| Logstash | 1 | 300m | 512Mi |
| Kibana | 1 | 200m | 512Mi |
| Filebeat | 1 | — | — |
| Admin API | 1 | 100m | 128Mi |
| Admin Panel | 1 | 50m | 64Mi |
| **Total** | **22** | **~2.8 cores** | **~4.5Gi** |

### Deployment Order
```
Phase 0: minikube start, enable ingress
Phase 1: namespace, Redis, PostgreSQL x2, Elasticsearch
Phase 2: Logstash, Kibana, Filebeat, DB migrations
Phase 3: store-backend, ai-classifier, honeypots (x9)
Phase 4: gateway
Phase 5: store-frontend, admin-api, admin-panel
Phase 6: ingress
```

---

## Development

### Local Development (without Minikube)

Each service can be run independently for development:

**Store Backend:**
```bash
cd store-backend
pip install -r requirements.txt
# Set STORE_DATABASE_URL to a local PostgreSQL
uvicorn app.main:app --reload --port 8001
```

**Store Frontend:**
```bash
cd store-frontend
npm install
npm run dev    # Vite dev server on port 3000, proxies /api to localhost:8000
```

**Gateway:**
```bash
cd gateway
pip install -r requirements.txt
# Requires Redis and AI classifier running
uvicorn app.main:app --reload --port 8000
```

### Testing

```bash
# Store backend tests
cd store-backend && pip install pytest pytest-asyncio httpx aiosqlite && pytest

# Gateway tests
cd gateway && pip install pytest pytest-asyncio && pytest
```

---

## Security Considerations

- **No real credentials** in honeypots — all fake data designed to waste attacker time
- **Non-root containers** — all Dockerfiles use `useradd -r appuser`
- **Fail-open gateway** — if AI classifier is down, traffic defaults to Normal (availability over security)
- **Separate databases** — store data and security logs are completely isolated
- **No authentication on admin panel** — designed for internal/VPN access only; add auth for production
- **Secrets in k8s/secrets.yaml** — base64 encoded defaults; replace for production deployment

---

## License

This project was built as part of a Holberton School hackathon.
