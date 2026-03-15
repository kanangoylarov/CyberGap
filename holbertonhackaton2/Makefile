.PHONY: setup build deploy-infra deploy-elk deploy-backend deploy-gateway deploy-frontend deploy-ingress deploy-all status logs destroy

setup:
	minikube addons enable ingress
	kubectl apply -f k8s/namespace.yaml
	@echo "Add to /etc/hosts: $$(minikube ip) shop.local admin.local kibana.local"

build: build-gateway build-store-frontend build-store-backend build-honeypot build-ai-classifier build-admin-api build-admin-panel

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

deploy-infra:
	kubectl apply -f k8s/secrets.yaml
	kubectl apply -f k8s/redis/
	kubectl apply -f k8s/postgres-store/
	kubectl apply -f k8s/postgres-gateway/
	kubectl apply -f k8s/elk/elasticsearch-pvc.yaml
	kubectl apply -f k8s/elk/elasticsearch-deployment.yaml
	kubectl apply -f k8s/elk/elasticsearch-service.yaml
	@echo "Waiting for infra pods..."
	kubectl -n honeypot wait --for=condition=ready pod -l app=redis --timeout=120s || true
	kubectl -n honeypot wait --for=condition=ready pod -l app=postgres-store --timeout=120s || true
	kubectl -n honeypot wait --for=condition=ready pod -l app=postgres-gateway --timeout=120s || true

deploy-elk:
	kubectl apply -f k8s/elk/logstash-configmap.yaml
	kubectl apply -f k8s/elk/logstash-deployment.yaml
	kubectl apply -f k8s/elk/logstash-service.yaml
	kubectl apply -f k8s/elk/kibana-deployment.yaml
	kubectl apply -f k8s/elk/kibana-service.yaml
	kubectl apply -f k8s/elk/filebeat-daemonset.yaml

deploy-backend:
	kubectl apply -f k8s/store-backend/
	kubectl apply -f k8s/ai-classifier/
	kubectl apply -f k8s/honeypots/

deploy-gateway:
	kubectl apply -f k8s/gateway/

deploy-frontend:
	kubectl apply -f k8s/store-frontend/
	kubectl apply -f k8s/admin-api/
	kubectl apply -f k8s/admin-panel/

deploy-ingress:
	kubectl apply -f k8s/ingress.yaml

deploy-all: deploy-infra deploy-elk deploy-backend deploy-gateway deploy-frontend deploy-ingress
	@echo "All services deployed!"

status:
	kubectl -n honeypot get pods -o wide
	kubectl -n honeypot get services
	kubectl -n honeypot get ingress

logs:
	@read -p "Service name: " svc; kubectl -n honeypot logs -l app=$$svc --tail=50 -f

destroy:
	kubectl delete namespace honeypot
