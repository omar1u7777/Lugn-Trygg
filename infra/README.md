# Infrastructure Stack (Day 4)

This folder gathers the shared infrastructure assets required to deploy Lugn & Trygg across Docker Compose, Kubernetes and Helm. Everything is wired to the same service topology: React frontend, Flask backend, Redis cache, Prometheus/Grafana monitoring and Alertmanager.

## Layout

| Path | Description |
| --- | --- |
| `nginx/` | Hardened reverse-proxy config for edge load balancers (optional). |
| `monitoring/prometheus.yml` | Prometheus scrape targets plus alert rules and blackbox probes. |
| `monitoring/alertmanager.yml` | Slack + PagerDuty routing rules. |
| `monitoring/alert.rules.yml` | Runtime alert definitions imported by Prometheus. |
| `monitoring/grafana/` | Provisioned datasources and dashboards. |
| `monitoring/promtail-config.yml` | Ships container logs to Loki. |

## Usage

```bash
# Launch full production-like stack (includes monitoring + alerting)
docker compose -f docker-compose.prod.yml up -d

# Apply standalone manifests to a cluster
kubectl apply -f k8s/ -n lugn-trygg

# Install via Helm (preferred)
helm upgrade --install lugn-trygg ./helm/lugn-trygg -n lugn-trygg --create-namespace \
  --set secrets.firebaseApiKey=$FIREBASE_API_KEY \
  --set secrets.jwtSecret=$JWT_SECRET
```

Monitoring endpoints are exposed through Prometheus (`:9090`), Alertmanager (`:9093`) and Grafana (`:3001`). Remember to update `infra/monitoring/alertmanager.yml` with real Slack and PagerDuty credentials before deploying.
