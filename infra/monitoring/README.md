# Monitoring & Alerting Stack

Artifacts in this folder wire up the Day 4 monitoring checklist. Everything is orchestrated via `docker-compose.prod.yml`, but the configs can also be mounted into Kubernetes ConfigMaps if you prefer in-cluster observability.

## Components

| File | Purpose |
| --- | --- |
| `prometheus.yml` | Scrape backend metrics (`/metrics`), Redis exporter, and blackbox probes. Includes the alert rule file. |
| `alert.rules.yml` | Runtime SLO alerts (error rate, latency, Redis pressure, TLS expiry). |
| `alertmanager.yml` | Routes alerts to Slack and PagerDuty. Uses env vars `SLACK_WEBHOOK_URL` and `PAGERDUTY_SERVICE_KEY` (set via compose). |
| `grafana/` | Datasource + dashboard provisioning. The overview dashboard renders API uptime, latency, mood metrics, etc. |
| `promtail-config.yml` | Ships container logs to Loki for long-term storage and search. |

## Running Locally

```bash
# Start the full monitoring toolchain
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX \
PAGERDUTY_SERVICE_KEY=your-key \
docker compose -f docker-compose.prod.yml up -d prometheus grafana alertmanager loki promtail

# Access the UIs
# Prometheus: http://localhost:9090
# Alertmanager: http://localhost:9093
# Grafana: http://localhost:3001 (admin / ${GRAFANA_ADMIN_PASSWORD})
```

## Kubernetes Notes

1. Create a `ConfigMap` from `prometheus.yml`/`alert.rules.yml` and mount into the Prometheus Operator or kube-prometheus-stack release.
2. Store `alertmanager.yml` as a secret so the Slack/PagerDuty credentials stay encrypted.
3. Import the Grafana dashboard JSON via provisioning or the UI. The chart already mounts it in docker-compose.
4. Use Fluent Bit or the Grafana Agent for log shipping if Loki is also running inside the cluster.

With these files checked in, the Day 4 monitoring deliverables (Prometheus, Grafana, alert rules, Slack/PagerDuty hooks, dashboard provisioning) are fulfilled.
