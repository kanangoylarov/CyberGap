# 06 - ELK Stack: Centralized Logging with Elasticsearch, Logstash, Kibana + Filebeat

## Overview

ELK Stack provides centralized, structured logging for the entire honeypot security system. All services emit structured JSON to stdout. Filebeat runs as a DaemonSet, scraping container logs from each Kubernetes node. Logs are shipped to Logstash, which parses and routes them by service into dedicated Elasticsearch indices. Kibana provides dashboards for visualization and investigation.

**Log flow:** Service stdout -> Container log files -> Filebeat -> Logstash (parse/enrich) -> Elasticsearch (store/index) -> Kibana (visualize)

---

## Directory Tree

```
elk/
├── elasticsearch/
│   └── elasticsearch.yml          # Single-node config
├── logstash/
│   ├── logstash.yml              # Logstash settings
│   ├── pipelines.yml             # Pipeline definitions
│   └── pipeline/
│       ├── gateway.conf          # Parse gateway logs, add GeoIP
│       ├── honeypot.conf         # Parse honeypot forensic logs
│       └── store.conf            # Parse store-backend logs
├── kibana/
│   └── kibana.yml                # Kibana settings
└── filebeat/
    └── filebeat.yml              # DaemonSet config, autodiscover
```

---

## Detailed Specs

### elasticsearch.yml

Single-node Elasticsearch instance. Security is disabled for Minikube development; must be enabled for production.

```yaml
cluster.name: honeypot-cluster
node.name: es-node-1
discovery.type: single-node
network.host: 0.0.0.0
xpack.security.enabled: false  # Minikube only
```

**Key decisions:**
- `discovery.type: single-node` eliminates the need for a multi-node discovery process. Suitable for dev/staging. Production should use a 3-node minimum cluster.
- `xpack.security.enabled: false` removes authentication overhead in development. In production, enable X-Pack security with TLS and role-based access control.
- Default JVM heap is 1GB. For Minikube, this is acceptable. Production should set `ES_JAVA_OPTS=-Xms2g -Xmx2g` (never exceed 50% of available RAM).
- Data is stored at the default path `/usr/share/elasticsearch/data`. A PersistentVolumeClaim should be mounted here for data persistence across pod restarts.

**Index lifecycle:**
- Gateway logs: `gateway-logs-YYYY.MM.dd` (daily rotation)
- Honeypot logs: `honeypot-logs-YYYY.MM.dd` (daily rotation)
- Store logs: `store-logs-YYYY.MM.dd` (daily rotation)
- Consider ILM (Index Lifecycle Management) policies for production to auto-delete indices older than 30 days.

---

### logstash.yml

```yaml
http.host: "0.0.0.0"
pipeline.workers: 2
pipeline.batch.size: 125
```

**Key decisions:**
- `pipeline.workers: 2` matches a modest CPU allocation in Minikube. Each worker is a thread that processes a batch of events through the filter and output stages. Production should set this to the number of available CPU cores.
- `pipeline.batch.size: 125` is the default. Events are accumulated into batches before being processed. Larger batches improve throughput but increase latency.
- `http.host: "0.0.0.0"` exposes the Logstash monitoring API on all interfaces for health checks.
- Logstash listens on port 9600 for its monitoring API (used by Kubernetes liveness/readiness probes).

---

### pipelines.yml

Defines three separate pipelines, one per service category. Each pipeline has its own config file, allowing independent filter logic and output routing.

```yaml
- pipeline.id: gateway
  path.config: "/usr/share/logstash/pipeline/gateway.conf"
- pipeline.id: honeypot
  path.config: "/usr/share/logstash/pipeline/honeypot.conf"
- pipeline.id: store
  path.config: "/usr/share/logstash/pipeline/store.conf"
```

**Why separate pipelines:**
- Each service emits different log structures requiring different parsing logic.
- Failures in one pipeline do not affect others.
- Each pipeline can be scaled independently if needed.
- Cleaner configuration and easier debugging.

---

### pipeline/gateway.conf

Parses logs from the gateway service, enriches with GeoIP data, and routes to a dedicated Elasticsearch index.

```
input {
  beats {
    port => 5044
  }
}
filter {
  if [kubernetes][container][name] =~ "gateway" {
    json { source => "message" }
    if [source_ip] {
      geoip { source => "source_ip" target => "geoip" }
    }
    mutate {
      add_field => { "[@metadata][index_prefix]" => "gateway-logs" }
    }
  }
}
output {
  if [@metadata][index_prefix] == "gateway-logs" {
    elasticsearch {
      hosts => ["http://elasticsearch:9200"]
      index => "gateway-logs-%{+YYYY.MM.dd}"
    }
  }
}
```

**Filter logic:**
1. Match events where `kubernetes.container.name` contains "gateway".
2. Parse the `message` field as JSON, extracting all structured fields (timestamp, fingerprint, source_ip, attack_type, attack_label, confidence, method, path, user_agent, upstream, latency_ms).
3. If `source_ip` is present, run GeoIP enrichment to add geographic coordinates, country, city, and ASN information. This powers the geographic attack map in Kibana.
4. Tag the event with a metadata field for output routing.

**Expected fields after parsing:**
- `timestamp` (ISO 8601)
- `fingerprint` (browser fingerprint hash)
- `source_ip` (client IP)
- `attack_type` (integer: 0=normal, 1=SQLi, 2=XSS, 3=CMDi, 4=path traversal, etc.)
- `attack_label` (human-readable attack name)
- `confidence` (float 0.0-1.0, AI model confidence)
- `method` (HTTP method)
- `path` (request path)
- `user_agent` (client user agent string)
- `upstream` (which backend handled the request)
- `latency_ms` (request processing time)
- `geoip.location` (geo_point for map visualization)
- `geoip.country_name`, `geoip.city_name`, `geoip.asn`

---

### pipeline/honeypot.conf

Parses logs from honeypot containers. Similar structure to gateway.conf with honeypot-specific enrichment.

```
input {
  beats {
    port => 5044
  }
}
filter {
  if [kubernetes][container][name] =~ "honeypot-" {
    json { source => "message" }
    # Extract honeypot type from container name (e.g., "honeypot-ssh" -> "ssh")
    if [kubernetes][container][name] {
      grok {
        match => { "[kubernetes][container][name]" => "honeypot-%{WORD:honeypot_type}" }
      }
    }
    mutate {
      add_field => { "[@metadata][index_prefix]" => "honeypot-logs" }
    }
  }
}
output {
  if [@metadata][index_prefix] == "honeypot-logs" {
    elasticsearch {
      hosts => ["http://elasticsearch:9200"]
      index => "honeypot-logs-%{+YYYY.MM.dd}"
    }
  }
}
```

**Honeypot-specific fields:**
- `honeypot_type` — extracted from the container name (e.g., "ssh", "http", "ftp"). Allows filtering and grouping by honeypot service type.
- `interaction_type` — the type of attacker interaction (login attempt, command execution, file upload, etc.).
- `payload` — the raw attacker payload or command.
- `session_id` — tracks a single attacker session across multiple log entries.
- `duration_ms` — how long the attacker interacted with the honeypot.

**Use cases:**
- Track attacker behavior patterns across different honeypot types.
- Correlate honeypot interactions with gateway attack detections (via source_ip or fingerprint).
- Identify sophisticated attackers who probe multiple honeypot services.

---

### pipeline/store.conf

Parses logs from the store-backend service.

```
input {
  beats {
    port => 5044
  }
}
filter {
  if [kubernetes][container][name] =~ "store-backend" {
    json { source => "message" }
    mutate {
      add_field => { "[@metadata][index_prefix]" => "store-logs" }
    }
  }
}
output {
  if [@metadata][index_prefix] == "store-logs" {
    elasticsearch {
      hosts => ["http://elasticsearch:9200"]
      index => "store-logs-%{+YYYY.MM.dd}"
    }
  }
}
```

**Store-specific fields:**
- `endpoint` — the API endpoint hit (e.g., /api/products, /api/cart).
- `status_code` — HTTP response status code.
- `response_time_ms` — backend processing time.
- `user_id` — if authenticated, the user identifier.
- `error` — error message if the request failed.

**Purpose:** Monitor store-backend health, identify slow endpoints, and detect anomalous access patterns that might indicate an attacker who bypassed the gateway's detection.

---

### filebeat.yml

Filebeat runs as a Kubernetes DaemonSet, meaning one instance runs on every node. It uses autodiscovery to automatically find and tail container log files.

```yaml
filebeat.autodiscover:
  providers:
    - type: kubernetes
      node: ${NODE_NAME}
      hints.enabled: true
      templates:
        - condition:
            kubernetes.namespace: honeypot
          config:
            - type: container
              paths:
                - /var/log/containers/*-${data.kubernetes.container.id}.log
              processors:
                - add_kubernetes_metadata:
                    host: ${NODE_NAME}
output.logstash:
  hosts: ["logstash:5044"]
```

**Key decisions:**
- `type: kubernetes` autodiscovery provider watches the Kubernetes API for pod start/stop events and automatically begins tailing new containers.
- `node: ${NODE_NAME}` ensures each Filebeat instance only processes containers on its own node (set via the Kubernetes downward API in the DaemonSet spec).
- `hints.enabled: true` allows per-pod log configuration via annotations (e.g., `co.elastic.logs/enabled: "true"`).
- The `condition` block restricts log collection to the `honeypot` namespace only, preventing collection of system pod logs.
- `add_kubernetes_metadata` processor enriches each log event with pod name, namespace, container name, labels, and annotations. This metadata is critical for Logstash routing.
- Output is directed to Logstash (not directly to Elasticsearch) so that parsing and enrichment can be applied.

**DaemonSet considerations:**
- Mount `/var/log/containers` as a read-only hostPath volume.
- Mount `/var/lib/docker/containers` for full log access.
- Use a `hostNetwork: false` and configure RBAC for Kubernetes API access.
- Resource limits: 100m CPU, 200Mi memory (Filebeat is lightweight).
- The `NODE_NAME` environment variable is set via `fieldRef: spec.nodeName` in the DaemonSet pod spec.

---

### kibana.yml

```yaml
server.name: kibana
server.host: "0.0.0.0"
elasticsearch.hosts: ["http://elasticsearch:9200"]
```

**Key decisions:**
- `server.host: "0.0.0.0"` allows access from outside the container (via Kubernetes Service/Ingress).
- Kibana connects directly to Elasticsearch on the internal cluster network.
- Default port is 5601.
- In production, enable `xpack.security.enabled` and configure Kibana to authenticate with Elasticsearch.
- Kibana is exposed via a ClusterIP Service and optionally an Ingress or NodePort for external access.

---

## Kibana Dashboards

Seven dashboards are defined for monitoring the security system. These are created either manually through the Kibana UI or via the Saved Objects API.

### 1. Attack Distribution Pie Chart

- **Data source:** `gateway-logs-*`
- **Visualization type:** Pie chart (donut variant)
- **Metric:** Count of documents
- **Split slices by:** `attack_label.keyword` (terms aggregation, top 10)
- **Colors:** Normal traffic = green, SQLi = red, XSS = orange, CMDi = purple, Path Traversal = yellow
- **Purpose:** At-a-glance view of what percentage of traffic is malicious and which attack types dominate.

### 2. Attacks Over Time

- **Data source:** `gateway-logs-*`
- **Visualization type:** Line chart (time series)
- **X-axis:** `timestamp`, 5-minute interval buckets
- **Y-axis:** Count of documents
- **Series:** Two lines — total requests and attack requests (filtered by `attack_type > 0`)
- **Purpose:** Identify attack spikes, correlate with incidents, and observe traffic patterns over time. Useful for spotting coordinated attack campaigns.

### 3. Top 10 Source IPs

- **Data source:** `gateway-logs-*`
- **Visualization type:** Horizontal bar chart
- **Metric:** Count of documents
- **Bucket:** `source_ip.keyword` (terms aggregation, top 10, ordered by count descending)
- **Color coding:** Bars colored by average `attack_type` (green for mostly normal, red for mostly attacks)
- **Purpose:** Quickly identify the most active source IPs. High-volume IPs with high attack rates are likely automated scanners or botnets.

### 4. Honeypot Interaction Timeline

- **Data source:** `honeypot-logs-*`
- **Visualization type:** Event timeline (annotations)
- **X-axis:** `timestamp`
- **Event details:** `honeypot_type`, `interaction_type`, `source_ip`
- **Color coding by:** `honeypot_type`
- **Purpose:** Visualize attacker interactions with honeypots over time. Helps identify attackers who move laterally between honeypot services.

### 5. Attack Confidence Histogram

- **Data source:** `gateway-logs-*` (filtered: `attack_type > 0`)
- **Visualization type:** Histogram
- **X-axis:** `confidence` field, 0.05 interval buckets (0.0 to 1.0)
- **Y-axis:** Count of documents
- **Purpose:** Understand the AI model's confidence distribution. A bimodal distribution (peaks near 0.0 and 1.0) indicates good model performance. A uniform distribution suggests the model is uncertain and may need retraining.

### 6. Geographic Attack Map

- **Data source:** `gateway-logs-*` (filtered: `attack_type > 0`)
- **Visualization type:** Coordinate map (or region map)
- **Geo field:** `geoip.location` (geo_point)
- **Metric:** Count of attacks
- **Purpose:** Visualize geographic distribution of attack sources. Helps identify whether attacks originate from specific regions or are globally distributed.
- **Note:** Requires the GeoIP database to be available in Logstash. The free MaxMind GeoLite2 database is bundled with Logstash by default.

### 7. HTTP Method Distribution

- **Data source:** `gateway-logs-*`
- **Visualization type:** Pie chart
- **Metric:** Count of documents
- **Split slices by:** `method.keyword` (terms aggregation)
- **Purpose:** Normal web traffic is predominantly GET. An unusually high percentage of POST, PUT, DELETE, or PATCH requests may indicate automated attack tools or API abuse.

---

## Kubernetes Deployment Notes

### Elasticsearch
- **Deployment:** StatefulSet with 1 replica (single-node).
- **Service:** ClusterIP on port 9200 (HTTP) and 9300 (transport).
- **Storage:** PVC of 10Gi minimum for Minikube, 50Gi+ for production.
- **Resources:** 512Mi-1Gi memory request, 1Gi-2Gi limit. CPU: 500m request, 1000m limit.
- **Init container:** Set `vm.max_map_count=262144` via sysctl (required by Elasticsearch).

### Logstash
- **Deployment:** Deployment with 1 replica.
- **Service:** ClusterIP on port 5044 (Beats input) and 9600 (monitoring API).
- **ConfigMaps:** `logstash.yml`, `pipelines.yml`, and pipeline config files mounted from ConfigMaps.
- **Resources:** 256Mi-512Mi memory, 500m CPU.
- **Health check:** HTTP GET on port 9600 (`/_node/stats`).

### Kibana
- **Deployment:** Deployment with 1 replica.
- **Service:** ClusterIP on port 5601, optionally exposed via NodePort or Ingress.
- **Resources:** 256Mi-512Mi memory, 250m CPU.
- **Health check:** HTTP GET on port 5601 (`/api/status`).
- **Readiness probe:** Wait for Kibana to connect to Elasticsearch.

### Filebeat
- **Deployment:** DaemonSet (one per node).
- **Volumes:** hostPath mounts for `/var/log/containers` and `/var/lib/docker/containers`.
- **ServiceAccount:** Requires RBAC permissions to read pod metadata from the Kubernetes API.
- **Resources:** 100m CPU, 200Mi memory (lightweight).
- **Tolerations:** Should tolerate all taints to run on every node.

---

## Networking

All ELK components communicate within the `honeypot` namespace:

```
Filebeat (DaemonSet, every node)
    -> logstash.honeypot.svc.cluster.local:5044 (Beats protocol)
        -> elasticsearch.honeypot.svc.cluster.local:9200 (HTTP)

Kibana
    -> elasticsearch.honeypot.svc.cluster.local:9200 (HTTP)
```

No components need external network access except Kibana (for user access) and optionally Elasticsearch (if external tools query it directly).

---

## Data Retention

- **Development (Minikube):** Keep all indices, no automatic deletion.
- **Production:** Use Index Lifecycle Management (ILM):
  - Hot phase: 0-7 days (full indexing, all replicas)
  - Warm phase: 7-30 days (read-only, reduced replicas)
  - Delete phase: 30+ days (auto-delete)
- ILM policies are applied per index pattern (`gateway-logs-*`, `honeypot-logs-*`, `store-logs-*`).
