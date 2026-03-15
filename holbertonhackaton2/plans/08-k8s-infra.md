# Plan 08 — Kubernetes Infrastructure, Manifests, and Makefile

## Objective

Generate every Kubernetes manifest, the top-level Makefile, and all supporting
infrastructure configuration required to run the full honeypot system inside
Minikube. Every file listed in the directory tree below must be produced in its
entirety — no placeholders, no TODOs. Each manifest must include every field
specified in this document.

---

## 1. Directory Tree (exact paths to create)

```
k8s/
├── namespace.yaml
├── secrets.yaml                    # DB passwords (base64, gitignored)
├── redis/
│   ├── deployment.yaml
│   └── service.yaml
├── postgres-store/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── pvc.yaml
│   └── configmap.yaml             # POSTGRES_DB, POSTGRES_USER
├── postgres-gateway/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── pvc.yaml
│   └── configmap.yaml
├── gateway/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── store-frontend/
│   ├── deployment.yaml
│   └── service.yaml
├── store-backend/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── ai-classifier/
│   ├── deployment.yaml
│   └── service.yaml
├── honeypots/
│   ├── deployment-generic.yaml
│   ├── deployment-exploits.yaml
│   ├── deployment-fuzzers.yaml
│   ├── deployment-dos.yaml
│   ├── deployment-recon.yaml
│   ├── deployment-analysis.yaml
│   ├── deployment-backdoor.yaml
│   ├── deployment-shellcode.yaml
│   ├── deployment-worms.yaml
│   └── services.yaml              # All 9 ClusterIP services in one file
├── elk/
│   ├── elasticsearch-deployment.yaml
│   ├── elasticsearch-service.yaml
│   ├── elasticsearch-pvc.yaml
│   ├── logstash-deployment.yaml
│   ├── logstash-service.yaml
│   ├── logstash-configmap.yaml    # Pipeline configs
│   ├── kibana-deployment.yaml
│   ├── kibana-service.yaml
│   └── filebeat-daemonset.yaml
├── admin-panel/
│   ├── deployment.yaml
│   └── service.yaml
├── admin-api/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── ingress.yaml                   # Main ingress rules

Makefile                           # Top-level build/deploy orchestration (project root)
```

---

## 2. Global Conventions

- **Namespace:** every resource lives in `honeypot` (metadata.namespace: honeypot).
- **Labels:** every Deployment/Pod carries `app: <service-name>` for selector consistency.
- **Image pull policy:** all locally-built images use `imagePullPolicy: Never` (Minikube docker-env).
- **Restart policy:** Deployments default to `Always` (Kubernetes default); do not override.
- **API versions:** use `apps/v1` for Deployments/DaemonSets, `v1` for Services/ConfigMaps/Secrets/PVCs/Namespaces, `networking.k8s.io/v1` for Ingress.
- **Resource requests = limits** in dev (set both `requests` and `limits` to the same values listed in each section).

---

## 3. Manifest Specifications

### 3.1 namespace.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: honeypot
```

Produce this file verbatim at `k8s/namespace.yaml`.

---

### 3.2 secrets.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: honeypot
type: Opaque
data:
  STORE_POSTGRES_USER: c3RvcmU=                # store
  STORE_POSTGRES_PASSWORD: c3RvcmVwYXNz        # storepass
  STORE_POSTGRES_DB: c3RvcmVkYg==              # storedb
  GATEWAY_POSTGRES_USER: Z2F0ZXdheQ==          # gateway
  GATEWAY_POSTGRES_PASSWORD: Z2F0ZXdheXBhc3M=  # gatewaypass
  GATEWAY_POSTGRES_DB: Z2F0ZXdheWRi            # gatewaydb
  REDIS_PASSWORD: ""                            # no auth in dev
```

Produce this file verbatim at `k8s/secrets.yaml`.

**Important:** add `k8s/secrets.yaml` to `.gitignore` so credentials are never committed.

---

### 3.3 Redis

#### k8s/redis/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: honeypot
  labels:
    app: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          protocol: TCP
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "100m"
            memory: "128Mi"
        readinessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 15
          periodSeconds: 20
```

#### k8s/redis/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: honeypot
  labels:
    app: redis
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
    protocol: TCP
    name: redis
```

---

### 3.4 PostgreSQL Store

#### k8s/postgres-store/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-store-config
  namespace: honeypot
data:
  POSTGRES_DB: storedb
  POSTGRES_USER: store
```

#### k8s/postgres-store/pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-store-pvc
  namespace: honeypot
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

#### k8s/postgres-store/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-store
  namespace: honeypot
  labels:
    app: postgres-store
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-store
  strategy:
    type: Recreate          # required for RWO PVC
  template:
    metadata:
      labels:
        app: postgres-store
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
          protocol: TCP
        envFrom:
        - configMapRef:
            name: postgres-store-config
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: STORE_POSTGRES_PASSWORD
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
          subPath: pgdata           # avoids lost+found conflict
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - store
            - -d
            - storedb
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - store
            - -d
            - storedb
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
      volumes:
      - name: postgres-data
        persistentVolumeClaim:
          claimName: postgres-store-pvc
```

#### k8s/postgres-store/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-store
  namespace: honeypot
  labels:
    app: postgres-store
spec:
  type: ClusterIP
  selector:
    app: postgres-store
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
    name: postgres
```

---

### 3.5 PostgreSQL Gateway

Follows the exact same pattern as PostgreSQL Store with these substitutions:

| Field | Store Value | Gateway Value |
|---|---|---|
| ConfigMap name | postgres-store-config | postgres-gateway-config |
| POSTGRES_DB | storedb | gatewaydb |
| POSTGRES_USER | store | gateway |
| PVC name | postgres-store-pvc | postgres-gateway-pvc |
| Deployment name | postgres-store | postgres-gateway |
| Labels app | postgres-store | postgres-gateway |
| Secret key (password) | STORE_POSTGRES_PASSWORD | GATEWAY_POSTGRES_PASSWORD |
| Liveness -U | store | gateway |
| Liveness -d | storedb | gatewaydb |
| Service name | postgres-store | postgres-gateway |

#### k8s/postgres-gateway/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-gateway-config
  namespace: honeypot
data:
  POSTGRES_DB: gatewaydb
  POSTGRES_USER: gateway
```

#### k8s/postgres-gateway/pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-gateway-pvc
  namespace: honeypot
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

#### k8s/postgres-gateway/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-gateway
  namespace: honeypot
  labels:
    app: postgres-gateway
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-gateway
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app: postgres-gateway
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
          protocol: TCP
        envFrom:
        - configMapRef:
            name: postgres-gateway-config
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: GATEWAY_POSTGRES_PASSWORD
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
          subPath: pgdata
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - gateway
            - -d
            - gatewaydb
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - gateway
            - -d
            - gatewaydb
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
      volumes:
      - name: postgres-data
        persistentVolumeClaim:
          claimName: postgres-gateway-pvc
```

#### k8s/postgres-gateway/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-gateway
  namespace: honeypot
  labels:
    app: postgres-gateway
spec:
  type: ClusterIP
  selector:
    app: postgres-gateway
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
    name: postgres
```

---

### 3.6 Gateway

#### k8s/gateway/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-config
  namespace: honeypot
data:
  GATEWAY_REDIS_HOST: redis.honeypot.svc.cluster.local
  GATEWAY_REDIS_PORT: "6379"
  GATEWAY_AI_CLASSIFIER_URL: http://ai-classifier.honeypot.svc.cluster.local:8000
  GATEWAY_STORE_BACKEND_HOST: store-backend.honeypot.svc.cluster.local
  GATEWAY_STORE_BACKEND_PORT: "8000"
  GATEWAY_FINGERPRINT_TTL: "3600"
  GATEWAY_LOG_LEVEL: INFO
  # DB URL is constructed from secret + configmap values inside the app or
  # can be set explicitly:
  GATEWAY_DB_URL: postgresql+asyncpg://gateway:gatewaypass@postgres-gateway.honeypot.svc.cluster.local:5432/gatewaydb
```

#### k8s/gateway/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
  namespace: honeypot
  labels:
    app: gateway
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
    spec:
      containers:
      - name: gateway
        image: gateway:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8000
          protocol: TCP
        envFrom:
        - configMapRef:
            name: gateway-config
        env:
        - name: GATEWAY_POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: GATEWAY_POSTGRES_USER
        - name: GATEWAY_POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: GATEWAY_POSTGRES_PASSWORD
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
```

#### k8s/gateway/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway
  namespace: honeypot
  labels:
    app: gateway
spec:
  type: ClusterIP
  selector:
    app: gateway
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
```

---

### 3.7 Store Frontend

#### k8s/store-frontend/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: store-frontend
  namespace: honeypot
  labels:
    app: store-frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: store-frontend
  template:
    metadata:
      labels:
        app: store-frontend
    spec:
      containers:
      - name: store-frontend
        image: store-frontend:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 80
          protocol: TCP
        resources:
          requests:
            cpu: "50m"
            memory: "64Mi"
          limits:
            cpu: "50m"
            memory: "64Mi"
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 20
```

#### k8s/store-frontend/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: store-frontend
  namespace: honeypot
  labels:
    app: store-frontend
spec:
  type: ClusterIP
  selector:
    app: store-frontend
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
```

---

### 3.8 Store Backend

#### k8s/store-backend/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: store-backend-config
  namespace: honeypot
data:
  STORE_DATABASE_URL: postgresql+asyncpg://store:storepass@postgres-store.honeypot.svc.cluster.local:5432/storedb
```

#### k8s/store-backend/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: store-backend
  namespace: honeypot
  labels:
    app: store-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: store-backend
  template:
    metadata:
      labels:
        app: store-backend
    spec:
      containers:
      - name: store-backend
        image: store-backend:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8000
          protocol: TCP
        envFrom:
        - configMapRef:
            name: store-backend-config
        resources:
          requests:
            cpu: "150m"
            memory: "256Mi"
          limits:
            cpu: "150m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
```

#### k8s/store-backend/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: store-backend
  namespace: honeypot
  labels:
    app: store-backend
spec:
  type: ClusterIP
  selector:
    app: store-backend
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
```

---

### 3.9 AI Classifier

#### k8s/ai-classifier/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-classifier
  namespace: honeypot
  labels:
    app: ai-classifier
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ai-classifier
  template:
    metadata:
      labels:
        app: ai-classifier
    spec:
      containers:
      - name: ai-classifier
        image: ai-classifier:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8000
          protocol: TCP
        resources:
          requests:
            cpu: "300m"
            memory: "512Mi"
          limits:
            cpu: "300m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 20
          periodSeconds: 5
          timeoutSeconds: 5
```

#### k8s/ai-classifier/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ai-classifier
  namespace: honeypot
  labels:
    app: ai-classifier
spec:
  type: ClusterIP
  selector:
    app: ai-classifier
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
```

---

### 3.10 Honeypots (9 Deployments + 1 Services File)

All 9 honeypot deployments share the same structure. The only variables are:

| File | Deployment Name | HONEYPOT_TYPE value | Service Name | Label (app) |
|---|---|---|---|---|
| deployment-generic.yaml | honeypot-generic | generic | honeypot-generic | honeypot-generic |
| deployment-exploits.yaml | honeypot-exploits | exploits | honeypot-exploits | honeypot-exploits |
| deployment-fuzzers.yaml | honeypot-fuzzers | fuzzers | honeypot-fuzzers | honeypot-fuzzers |
| deployment-dos.yaml | honeypot-dos | dos | honeypot-dos | honeypot-dos |
| deployment-recon.yaml | honeypot-recon | reconnaissance | honeypot-recon | honeypot-recon |
| deployment-analysis.yaml | honeypot-analysis | analysis | honeypot-analysis | honeypot-analysis |
| deployment-backdoor.yaml | honeypot-backdoor | backdoor | honeypot-backdoor | honeypot-backdoor |
| deployment-shellcode.yaml | honeypot-shellcode | shellcode | honeypot-shellcode | honeypot-shellcode |
| deployment-worms.yaml | honeypot-worms | worms | honeypot-worms | honeypot-worms |

#### Template for each deployment file (substitute `{NAME}`, `{TYPE}`)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: honeypot-{NAME}
  namespace: honeypot
  labels:
    app: honeypot-{NAME}
    honeypot-type: "{TYPE}"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: honeypot-{NAME}
  template:
    metadata:
      labels:
        app: honeypot-{NAME}
        honeypot-type: "{TYPE}"
    spec:
      containers:
      - name: honeypot
        image: honeypot:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8000
          protocol: TCP
        env:
        - name: HONEYPOT_TYPE
          value: "{TYPE}"
        - name: HONEYPOT_LOG_LEVEL
          value: DEBUG
        resources:
          requests:
            cpu: "50m"
            memory: "64Mi"
          limits:
            cpu: "50m"
            memory: "64Mi"
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 20
```

Apply these substitutions to produce each of the 9 files:

1. `deployment-generic.yaml` — NAME=generic, TYPE=generic
2. `deployment-exploits.yaml` — NAME=exploits, TYPE=exploits
3. `deployment-fuzzers.yaml` — NAME=fuzzers, TYPE=fuzzers
4. `deployment-dos.yaml` — NAME=dos, TYPE=dos
5. `deployment-recon.yaml` — NAME=recon, TYPE=reconnaissance
6. `deployment-analysis.yaml` — NAME=analysis, TYPE=analysis
7. `deployment-backdoor.yaml` — NAME=backdoor, TYPE=backdoor
8. `deployment-shellcode.yaml` — NAME=shellcode, TYPE=shellcode
9. `deployment-worms.yaml` — NAME=worms, TYPE=worms

#### k8s/honeypots/services.yaml

All 9 ClusterIP services in a single file, separated by `---`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: honeypot-generic
  namespace: honeypot
  labels:
    app: honeypot-generic
spec:
  type: ClusterIP
  selector:
    app: honeypot-generic
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-exploits
  namespace: honeypot
  labels:
    app: honeypot-exploits
spec:
  type: ClusterIP
  selector:
    app: honeypot-exploits
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-fuzzers
  namespace: honeypot
  labels:
    app: honeypot-fuzzers
spec:
  type: ClusterIP
  selector:
    app: honeypot-fuzzers
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-dos
  namespace: honeypot
  labels:
    app: honeypot-dos
spec:
  type: ClusterIP
  selector:
    app: honeypot-dos
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-recon
  namespace: honeypot
  labels:
    app: honeypot-recon
spec:
  type: ClusterIP
  selector:
    app: honeypot-recon
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-analysis
  namespace: honeypot
  labels:
    app: honeypot-analysis
spec:
  type: ClusterIP
  selector:
    app: honeypot-analysis
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-backdoor
  namespace: honeypot
  labels:
    app: honeypot-backdoor
spec:
  type: ClusterIP
  selector:
    app: honeypot-backdoor
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-shellcode
  namespace: honeypot
  labels:
    app: honeypot-shellcode
spec:
  type: ClusterIP
  selector:
    app: honeypot-shellcode
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
---
apiVersion: v1
kind: Service
metadata:
  name: honeypot-worms
  namespace: honeypot
  labels:
    app: honeypot-worms
spec:
  type: ClusterIP
  selector:
    app: honeypot-worms
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
```

---

### 3.11 ELK Stack

#### k8s/elk/elasticsearch-pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: elasticsearch-pvc
  namespace: honeypot
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

#### k8s/elk/elasticsearch-deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elasticsearch
  namespace: honeypot
  labels:
    app: elasticsearch
spec:
  replicas: 1
  selector:
    matchLabels:
      app: elasticsearch
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      initContainers:
      - name: fix-permissions
        image: busybox:1.36
        command: ["sh", "-c", "chown -R 1000:1000 /usr/share/elasticsearch/data"]
        volumeMounts:
        - name: es-data
          mountPath: /usr/share/elasticsearch/data
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
        ports:
        - containerPort: 9200
          name: http
          protocol: TCP
        - containerPort: 9300
          name: transport
          protocol: TCP
        env:
        - name: discovery.type
          value: single-node
        - name: xpack.security.enabled
          value: "false"
        - name: ES_JAVA_OPTS
          value: "-Xms512m -Xmx512m"
        volumeMounts:
        - name: es-data
          mountPath: /usr/share/elasticsearch/data
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "500m"
            memory: "1Gi"
        readinessProbe:
          httpGet:
            path: /_cluster/health?local=true
            port: 9200
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
        livenessProbe:
          httpGet:
            path: /_cluster/health?local=true
            port: 9200
          initialDelaySeconds: 60
          periodSeconds: 20
          timeoutSeconds: 5
          failureThreshold: 5
      volumes:
      - name: es-data
        persistentVolumeClaim:
          claimName: elasticsearch-pvc
```

#### k8s/elk/elasticsearch-service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: elasticsearch
  namespace: honeypot
  labels:
    app: elasticsearch
spec:
  type: ClusterIP
  selector:
    app: elasticsearch
  ports:
  - port: 9200
    targetPort: 9200
    protocol: TCP
    name: http
  - port: 9300
    targetPort: 9300
    protocol: TCP
    name: transport
```

#### k8s/elk/logstash-configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: logstash-config
  namespace: honeypot
data:
  logstash.conf: |
    input {
      beats {
        port => 5044
      }
    }

    filter {
      if [kubernetes][labels][app] {
        mutate {
          add_field => { "service_name" => "%{[kubernetes][labels][app]}" }
        }
      }

      if [message] =~ /^\{/ {
        json {
          source => "message"
          target => "parsed"
          skip_on_invalid_json => true
        }
      }

      if [kubernetes][labels][honeypot-type] {
        mutate {
          add_field => { "honeypot_type" => "%{[kubernetes][labels][honeypot-type]}" }
        }
      }
    }

    output {
      elasticsearch {
        hosts => ["http://elasticsearch.honeypot.svc.cluster.local:9200"]
        index => "honeypot-logs-%{+YYYY.MM.dd}"
      }
    }

  logstash.yml: |
    http.host: "0.0.0.0"
    xpack.monitoring.enabled: false
    pipeline.workers: 2
    pipeline.batch.size: 125

  pipelines.yml: |
    - pipeline.id: main
      path.config: "/usr/share/logstash/pipeline/logstash.conf"
```

#### k8s/elk/logstash-deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: logstash
  namespace: honeypot
  labels:
    app: logstash
spec:
  replicas: 1
  selector:
    matchLabels:
      app: logstash
  template:
    metadata:
      labels:
        app: logstash
    spec:
      containers:
      - name: logstash
        image: docker.elastic.co/logstash/logstash:8.12.0
        ports:
        - containerPort: 5044
          name: beats
          protocol: TCP
        env:
        - name: LS_JAVA_OPTS
          value: "-Xms256m -Xmx256m"
        volumeMounts:
        - name: logstash-pipeline
          mountPath: /usr/share/logstash/pipeline/logstash.conf
          subPath: logstash.conf
        - name: logstash-config
          mountPath: /usr/share/logstash/config/logstash.yml
          subPath: logstash.yml
        - name: logstash-pipelines
          mountPath: /usr/share/logstash/config/pipelines.yml
          subPath: pipelines.yml
        resources:
          requests:
            cpu: "300m"
            memory: "512Mi"
          limits:
            cpu: "300m"
            memory: "512Mi"
        readinessProbe:
          httpGet:
            path: /
            port: 9600
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
        livenessProbe:
          httpGet:
            path: /
            port: 9600
          initialDelaySeconds: 120
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 5
      volumes:
      - name: logstash-pipeline
        configMap:
          name: logstash-config
          items:
          - key: logstash.conf
            path: logstash.conf
      - name: logstash-config
        configMap:
          name: logstash-config
          items:
          - key: logstash.yml
            path: logstash.yml
      - name: logstash-pipelines
        configMap:
          name: logstash-config
          items:
          - key: pipelines.yml
            path: pipelines.yml
```

#### k8s/elk/logstash-service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: logstash
  namespace: honeypot
  labels:
    app: logstash
spec:
  type: ClusterIP
  selector:
    app: logstash
  ports:
  - port: 5044
    targetPort: 5044
    protocol: TCP
    name: beats
```

#### k8s/elk/kibana-deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kibana
  namespace: honeypot
  labels:
    app: kibana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kibana
  template:
    metadata:
      labels:
        app: kibana
    spec:
      containers:
      - name: kibana
        image: docker.elastic.co/kibana/kibana:8.12.0
        ports:
        - containerPort: 5601
          name: http
          protocol: TCP
        env:
        - name: ELASTICSEARCH_HOSTS
          value: http://elasticsearch.honeypot.svc.cluster.local:9200
        - name: SERVER_BASEPATH
          value: ""
        - name: XPACK_SECURITY_ENABLED
          value: "false"
        resources:
          requests:
            cpu: "200m"
            memory: "512Mi"
          limits:
            cpu: "200m"
            memory: "512Mi"
        readinessProbe:
          httpGet:
            path: /api/status
            port: 5601
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
        livenessProbe:
          httpGet:
            path: /api/status
            port: 5601
          initialDelaySeconds: 120
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 5
```

#### k8s/elk/kibana-service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: kibana
  namespace: honeypot
  labels:
    app: kibana
spec:
  type: ClusterIP
  selector:
    app: kibana
  ports:
  - port: 5601
    targetPort: 5601
    protocol: TCP
    name: http
```

#### k8s/elk/filebeat-daemonset.yaml

This file is the most complex. It must include:

1. A `ServiceAccount` named `filebeat` in namespace `honeypot`.
2. A `ClusterRole` named `filebeat` with rules to list/watch pods, namespaces, nodes.
3. A `ClusterRoleBinding` named `filebeat` binding the ClusterRole to the ServiceAccount.
4. A `ConfigMap` named `filebeat-config` containing `filebeat.yml`.
5. A `DaemonSet` named `filebeat`.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: filebeat
  namespace: honeypot
  labels:
    app: filebeat
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: filebeat
  labels:
    app: filebeat
rules:
- apiGroups: [""]
  resources:
  - pods
  - namespaces
  - nodes
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: filebeat
  labels:
    app: filebeat
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: filebeat
subjects:
- kind: ServiceAccount
  name: filebeat
  namespace: honeypot
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: honeypot
  labels:
    app: filebeat
data:
  filebeat.yml: |
    filebeat.autodiscover:
      providers:
        - type: kubernetes
          node: ${NODE_NAME}
          hints.enabled: true
          hints.default_config:
            type: container
            paths:
              - /var/log/containers/*-${data.kubernetes.container.id}.log

    processors:
      - add_kubernetes_metadata:
          host: ${NODE_NAME}
          matchers:
            - logs_path:
                logs_path: "/var/log/containers/"
      - add_cloud_metadata: ~
      - add_host_metadata: ~

    output.logstash:
      hosts: ["logstash.honeypot.svc.cluster.local:5044"]

    logging.level: info
    logging.to_stderr: true
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: filebeat
  namespace: honeypot
  labels:
    app: filebeat
spec:
  selector:
    matchLabels:
      app: filebeat
  template:
    metadata:
      labels:
        app: filebeat
    spec:
      serviceAccountName: filebeat
      terminationGracePeriodSeconds: 30
      containers:
      - name: filebeat
        image: docker.elastic.co/beats/filebeat:8.12.0
        args:
        - "-c"
        - "/etc/filebeat/filebeat.yml"
        - "-e"
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        securityContext:
          runAsUser: 0
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "100m"
            memory: "128Mi"
        volumeMounts:
        - name: config
          mountPath: /etc/filebeat/filebeat.yml
          subPath: filebeat.yml
          readOnly: true
        - name: varlogcontainers
          mountPath: /var/log/containers
          readOnly: true
        - name: varlogpods
          mountPath: /var/log/pods
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: data
          mountPath: /usr/share/filebeat/data
      volumes:
      - name: config
        configMap:
          name: filebeat-config
          defaultMode: 0640
      - name: varlogcontainers
        hostPath:
          path: /var/log/containers
          type: Directory
      - name: varlogpods
        hostPath:
          path: /var/log/pods
          type: Directory
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
          type: Directory
      - name: data
        hostPath:
          path: /var/lib/filebeat-data
          type: DirectoryOrCreate
```

---

### 3.12 Admin API

#### k8s/admin-api/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: admin-api-config
  namespace: honeypot
data:
  ADMIN_GATEWAY_DB_URL: postgresql+asyncpg://gateway:gatewaypass@postgres-gateway.honeypot.svc.cluster.local:5432/gatewaydb
  ADMIN_STORE_DB_URL: postgresql+asyncpg://store:storepass@postgres-store.honeypot.svc.cluster.local:5432/storedb
  ADMIN_LOG_LEVEL: INFO
```

#### k8s/admin-api/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: admin-api
  namespace: honeypot
  labels:
    app: admin-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: admin-api
  template:
    metadata:
      labels:
        app: admin-api
    spec:
      containers:
      - name: admin-api
        image: admin-api:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8000
          protocol: TCP
        envFrom:
        - configMapRef:
            name: admin-api-config
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "100m"
            memory: "128Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
          timeoutSeconds: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
```

#### k8s/admin-api/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: admin-api
  namespace: honeypot
  labels:
    app: admin-api
spec:
  type: ClusterIP
  selector:
    app: admin-api
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
```

---

### 3.13 Admin Panel

#### k8s/admin-panel/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: admin-panel
  namespace: honeypot
  labels:
    app: admin-panel
spec:
  replicas: 1
  selector:
    matchLabels:
      app: admin-panel
  template:
    metadata:
      labels:
        app: admin-panel
    spec:
      containers:
      - name: admin-panel
        image: admin-panel:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 80
          protocol: TCP
        resources:
          requests:
            cpu: "50m"
            memory: "64Mi"
          limits:
            cpu: "50m"
            memory: "64Mi"
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 20
```

#### k8s/admin-panel/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: admin-panel
  namespace: honeypot
  labels:
    app: admin-panel
spec:
  type: ClusterIP
  selector:
    app: admin-panel
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
```

---

### 3.14 Ingress

#### k8s/ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-ingress
  namespace: honeypot
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
spec:
  ingressClassName: nginx
  rules:
  - host: shop.local
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: gateway
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: store-frontend
            port:
              number: 80
  - host: admin.local
    http:
      paths:
      - path: /api/admin
        pathType: Prefix
        backend:
          service:
            name: admin-api
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: admin-panel
            port:
              number: 80
  - host: kibana.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kibana
            port:
              number: 5601
```

---

## 4. Makefile (project root)

```makefile
.PHONY: setup build deploy-infra deploy-elk deploy-backend deploy-gateway deploy-frontend deploy-ingress deploy-all status logs destroy \
        build-gateway build-store-frontend build-store-backend build-honeypot build-ai-classifier build-admin-api build-admin-panel

SHELL := /bin/bash

# ─── Setup ──────────────────────────────────────────────────────────────────────
setup:
	minikube addons enable ingress
	kubectl apply -f k8s/namespace.yaml
	@echo ""
	@echo "=== SETUP COMPLETE ==="
	@echo "Add the following to /etc/hosts (use 'minikube ip' to get the IP):"
	@echo "$$(minikube ip) shop.local admin.local kibana.local"
	@echo ""
	@echo "IMPORTANT: Before building images, run:"
	@echo "  eval \$$(minikube docker-env)"

# ─── Build ──────────────────────────────────────────────────────────────────────
build: build-gateway build-store-frontend build-store-backend build-honeypot build-ai-classifier build-admin-api build-admin-panel
	@echo "All images built successfully."

build-gateway:
	docker build -t gateway:latest ./gateway

build-store-frontend:
	docker build -t store-frontend:latest ./store-frontend

build-store-backend:
	docker build -t store-backend:latest ./store-backend

build-honeypot:
	docker build -t honeypot:latest ./honeypots

build-ai-classifier:
	docker build -t ai-classifier:latest ./ai-classifier

build-admin-api:
	docker build -t admin-api:latest ./admin-api

build-admin-panel:
	docker build -t admin-panel:latest ./admin-panel

# ─── Deploy Phase 1: Infrastructure ────────────────────────────────────────────
deploy-infra:
	kubectl apply -f k8s/secrets.yaml
	kubectl apply -f k8s/redis/
	kubectl apply -f k8s/postgres-store/
	kubectl apply -f k8s/postgres-gateway/
	kubectl apply -f k8s/elk/elasticsearch-pvc.yaml
	kubectl apply -f k8s/elk/elasticsearch-deployment.yaml
	kubectl apply -f k8s/elk/elasticsearch-service.yaml
	@echo "Waiting for infrastructure pods to become ready..."
	kubectl -n honeypot wait --for=condition=ready pod -l app=redis --timeout=120s
	kubectl -n honeypot wait --for=condition=ready pod -l app=postgres-store --timeout=120s
	kubectl -n honeypot wait --for=condition=ready pod -l app=postgres-gateway --timeout=120s
	@echo "Infrastructure pods are ready."

# ─── Deploy Phase 2: ELK ───────────────────────────────────────────────────────
deploy-elk:
	kubectl apply -f k8s/elk/logstash-configmap.yaml
	kubectl apply -f k8s/elk/logstash-deployment.yaml
	kubectl apply -f k8s/elk/logstash-service.yaml
	kubectl apply -f k8s/elk/kibana-deployment.yaml
	kubectl apply -f k8s/elk/kibana-service.yaml
	kubectl apply -f k8s/elk/filebeat-daemonset.yaml
	@echo "ELK stack deployed."

# ─── Deploy Phase 3: Backend services ──────────────────────────────────────────
deploy-backend:
	kubectl apply -f k8s/store-backend/
	kubectl apply -f k8s/ai-classifier/
	kubectl apply -f k8s/honeypots/
	@echo "Backend services deployed."

# ─── Deploy Phase 4: Gateway ───────────────────────────────────────────────────
deploy-gateway:
	kubectl apply -f k8s/gateway/
	@echo "Gateway deployed."

# ─── Deploy Phase 5: Frontend + Admin ──────────────────────────────────────────
deploy-frontend:
	kubectl apply -f k8s/store-frontend/
	kubectl apply -f k8s/admin-api/
	kubectl apply -f k8s/admin-panel/
	@echo "Frontend and admin services deployed."

# ─── Deploy Phase 6: Ingress ───────────────────────────────────────────────────
deploy-ingress:
	kubectl apply -f k8s/ingress.yaml
	@echo "Ingress deployed."

# ─── Deploy All (phases 1-6 in order) ──────────────────────────────────────────
deploy-all: deploy-infra deploy-elk deploy-backend deploy-gateway deploy-frontend deploy-ingress
	@echo ""
	@echo "=== ALL SERVICES DEPLOYED ==="
	@echo "Run 'make status' to check pod status."

# ─── Status ────────────────────────────────────────────────────────────────────
status:
	@echo "=== PODS ==="
	kubectl -n honeypot get pods -o wide
	@echo ""
	@echo "=== SERVICES ==="
	kubectl -n honeypot get services
	@echo ""
	@echo "=== INGRESS ==="
	kubectl -n honeypot get ingress

# ─── Logs (interactive) ────────────────────────────────────────────────────────
logs:
	@read -p "Service name (app label): " svc; \
	kubectl -n honeypot logs -l app=$$svc --tail=50 -f

# ─── Destroy everything ────────────────────────────────────────────────────────
destroy:
	kubectl delete namespace honeypot --ignore-not-found
	@echo "Namespace 'honeypot' deleted."
```

---

## 5. Deployment Order (step-by-step)

The following is the exact order in which resources must be deployed. The
Makefile targets encode this order, but this section documents the rationale.

```
Phase 0 — Bootstrap
  1. minikube start (if not already running)
  2. eval $(minikube docker-env)          # point docker CLI at Minikube daemon
  3. make setup                           # enable ingress addon, create namespace
  4. make build                           # build all Docker images inside Minikube

Phase 1 — Infrastructure (make deploy-infra)
  1. k8s/secrets.yaml                     # DB credentials must exist before any PG pod
  2. k8s/redis/*                          # Redis: no dependencies
  3. k8s/postgres-store/*                 # PG Store: needs secret for POSTGRES_PASSWORD
  4. k8s/postgres-gateway/*              # PG Gateway: needs secret for POSTGRES_PASSWORD
  5. k8s/elk/elasticsearch-pvc.yaml      # ES PVC first
  6. k8s/elk/elasticsearch-deployment.yaml
  7. k8s/elk/elasticsearch-service.yaml
  8. Wait for redis, postgres-store, postgres-gateway pods to be Ready

Phase 2 — ELK (make deploy-elk)
  1. k8s/elk/logstash-configmap.yaml     # Pipeline config must exist before Logstash pod
  2. k8s/elk/logstash-deployment.yaml
  3. k8s/elk/logstash-service.yaml
  4. k8s/elk/kibana-deployment.yaml
  5. k8s/elk/kibana-service.yaml
  6. k8s/elk/filebeat-daemonset.yaml     # DaemonSet: needs Logstash service endpoint

Phase 3 — Backend (make deploy-backend)
  1. k8s/store-backend/*                 # Needs postgres-store to be ready
  2. k8s/ai-classifier/*                # Standalone, no DB dependency
  3. k8s/honeypots/*                     # All 9 deployments + services

Phase 4 — Gateway (make deploy-gateway)
  1. k8s/gateway/*                       # Needs redis, ai-classifier, store-backend, postgres-gateway

Phase 5 — Frontend + Admin (make deploy-frontend)
  1. k8s/store-frontend/*               # Static assets, no backend dependency at deploy time
  2. k8s/admin-api/*                    # Needs postgres-gateway (already up from Phase 1)
  3. k8s/admin-panel/*                  # Static assets

Phase 6 — Ingress (make deploy-ingress)
  1. k8s/ingress.yaml                   # Needs all backend services to exist
```

---

## 6. Hosts File Configuration

After deployment, add the following entry to `/etc/hosts` on the host machine.
Replace `192.168.49.2` with the actual output of `minikube ip`.

```
# Honeypot project — Minikube Ingress
192.168.49.2 shop.local admin.local kibana.local
```

To get the correct IP:
```bash
echo "$(minikube ip) shop.local admin.local kibana.local"
```

---

## 7. Resource Budget Summary

| Service | CPU (req=lim) | Memory (req=lim) | Replicas | Total CPU | Total Memory |
|---|---|---|---|---|---|
| Redis | 100m | 128Mi | 1 | 100m | 128Mi |
| PostgreSQL Store | 200m | 256Mi | 1 | 200m | 256Mi |
| PostgreSQL Gateway | 200m | 256Mi | 1 | 200m | 256Mi |
| Elasticsearch | 500m | 1Gi | 1 | 500m | 1Gi |
| Logstash | 300m | 512Mi | 1 | 300m | 512Mi |
| Kibana | 200m | 512Mi | 1 | 200m | 512Mi |
| Filebeat | 100m | 128Mi | 1* | 100m | 128Mi |
| Gateway | 200m | 256Mi | 1 | 200m | 256Mi |
| Store Frontend | 50m | 64Mi | 1 | 50m | 64Mi |
| Store Backend | 150m | 256Mi | 1 | 150m | 256Mi |
| AI Classifier | 300m | 512Mi | 1 | 300m | 512Mi |
| Honeypots (x9) | 50m | 64Mi | 9 | 450m | 576Mi |
| Admin API | 100m | 128Mi | 1 | 100m | 128Mi |
| Admin Panel | 50m | 64Mi | 1 | 50m | 64Mi |
| **TOTAL** | | | **22 pods** | **2900m** | **4.6Gi** |

*Filebeat is a DaemonSet — 1 pod per node. In single-node Minikube this is 1.

Recommended Minikube config: `minikube start --cpus=4 --memory=8192`

---

## 8. Verification Checklist

After `make deploy-all`, verify:

```bash
# All pods running
kubectl -n honeypot get pods
# Expected: 22 pods in Running state (may take 2-3 min for ELK)

# Services reachable
kubectl -n honeypot get svc

# Ingress has IP assigned
kubectl -n honeypot get ingress

# Test store frontend
curl -H "Host: shop.local" http://$(minikube ip)/

# Test gateway
curl -H "Host: shop.local" http://$(minikube ip)/api/health

# Test admin panel
curl -H "Host: admin.local" http://$(minikube ip)/

# Test Kibana
curl -H "Host: kibana.local" http://$(minikube ip)/api/status
```

---

## 9. Notes for Implementation

1. **imagePullPolicy: Never** — all locally-built images use this. You MUST run
   `eval $(minikube docker-env)` before `make build` so that images are built
   inside Minikube's Docker daemon.

2. **PVC strategy: Recreate** — both PostgreSQL deployments and Elasticsearch use
   `strategy.type: Recreate` because their PVCs are `ReadWriteOnce` and cannot be
   mounted by two pods simultaneously.

3. **subPath for pgdata** — PostgreSQL volume mounts use `subPath: pgdata` to
   avoid the `lost+found` directory conflict on ext4 filesystems.

4. **Elasticsearch init container** — the `fix-permissions` init container ensures
   the data directory is owned by UID 1000 (elasticsearch user).

5. **Filebeat RBAC** — the DaemonSet needs a ServiceAccount, ClusterRole, and
   ClusterRoleBinding to access the Kubernetes API for pod metadata enrichment.

6. **Secrets management** — `k8s/secrets.yaml` contains base64-encoded passwords.
   In production, use Sealed Secrets or an external secret manager. For dev/demo
   purposes, these plain base64 values are acceptable but the file should be
   gitignored.

7. **Service DNS** — all inter-service communication uses Kubernetes DNS:
   `<service>.<namespace>.svc.cluster.local`. The gateway configmap contains
   fully-qualified DNS names to avoid ambiguity.

8. **Ingress order** — path rules within a host are evaluated longest-match-first
   by the NGINX ingress controller, so `/api` will match before `/` even though
   `/` is listed second.
