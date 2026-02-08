# Kubernetes Manifests

This directory contains the raw manifests required to deploy the Lugn & Trygg stack without Helm. The files are split by concern so they can be applied individually or as a bundle.

## Files

| File | Description |
| --- | --- |
| `deployment.yaml` | ConfigMap plus frontend and backend Deployments with probes and security context. |
| `service.yaml` | Services for frontend (LoadBalancer), backend (ClusterIP) and Redis. |
| `redis-statefulset.yaml` | Persistent Redis instance for rate limiting and caching. |
| `hpa.yaml` | Autoscaling policies for both frontend and backend. |
| `ingress.yaml` | NGINX ingress with TLS (Let’s Encrypt) for `app.lugntrygg.se` and `api.lugntrygg.se`. |
| `secrets.example.yaml` | Template for the required secret keys. **Never commit real credentials.** |

## Usage

```bash
# 1. Create namespace and secrets
kubectl create namespace lugn-trygg
kubectl apply -n lugn-trygg -f k8s/secrets.example.yaml  # replace placeholder values first

# 2. Apply core components
kubectl apply -n lugn-trygg -f k8s/deployment.yaml
kubectl apply -n lugn-trygg -f k8s/service.yaml
kubectl apply -n lugn-trygg -f k8s/redis-statefulset.yaml
kubectl apply -n lugn-trygg -f k8s/hpa.yaml
kubectl apply -n lugn-trygg -f k8s/ingress.yaml
```

For production clusters we recommend using the Helm chart under `helm/lugn-trygg/`, which templates the same resources with better overrides.
