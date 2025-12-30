# Day 4 Cloud Infrastructure Plan

This document translates the Day 4 checklist into deployable cloud primitives. The recommendations are cloud-agnostic where possible and note concrete service equivalents for Azure, AWS and GCP.

## 1. Managed Kubernetes Cluster

| Concern | Recommendation |
| --- | --- |
| Control Plane | Use the managed option (AKS, EKS with Fargate control plane, or GKE Autopilot) to offload upgrades and security patches. |
| Node Pools | Two pools: `web` (3× Standard_D4s_v5 / m5.xlarge / e2-standard-4) for frontend + backend, and `jobs` (2× Standard_D2s_v5 / m5.large / e2-standard-2) for background workers/cronjobs. Enable autoscaling with min=2, max=10 per pool. |
| Networking | Private cluster endpoints plus Azure CNI / AWS VPC CNI / GCP VPC-native to get pod-level IPs. Require NetworkPolicies that only allow ingress traffic via the ingress controller namespace. |
| Storage | Use managed SSD (Azure Premium SSD, gp3, Balanced PD) for Redis PVC and any uploads. Set default storage class with encryption-at-rest enabled. |
| Access | Enable workload identity/OIDC so pods can access Firebase/Google APIs without static keys once available. |

## 2. Redis Cluster for Rate Limiting

| Concern | Recommendation |
| --- | --- |
| Service | Azure Cache for Redis (P1 or higher), Amazon ElastiCache (Redis 7 multi-AZ), or Google Memorystore (M2 tier). |
| Topology | Primary + replica with automatic failover; enable TLS and AUTH tokens. |
| Networking | Private endpoint inside same VNET/VPC and restrict inbound traffic to cluster subnets + bastion CIDR. |
| Observability | Export Redis metrics to Prometheus via `redis_exporter` (already in docker-compose) or native cloud metrics for alerting. |
| Client Config | Update `REDIS_URL` to `rediss://username:password@host:6380/0` for TLS endpoints. Keep max 50 connections per pod to avoid hitting plan limits. |

## 3. Load Balancer + Edge Security

| Layer | Recommendation |
| --- | --- |
| L7 Routing | Use managed ingress: Azure Application Gateway Ingress Controller, AWS Load Balancer Controller (ALB), or GKE Ingress for Anthos. Map `app.lugntrygg.se` → frontend service, `api.lugntrygg.se` → backend service. |
| TLS | Terminate at the load balancer using managed certificates (Azure Key Vault cert binding, AWS ACM, Google Managed Certs). Auto renew via cert-manager for in-cluster secrets. |
| WAF | Enable Azure WAF_v2 / AWS WAF / Google Cloud Armor with OWASP CRS, custom rules blocking Swedish IP blocklists if required. |
| Network ACL | Lock down Kubernetes NodePorts; only the ingress controller service should be public. |

## 4. Autoscaling Policies

| Scope | Settings |
| --- | --- |
| Horizontal Pod Autoscaler | Already defined in `k8s/hpa.yaml` (frontend 3-10 replicas @60% CPU/70% memory, backend 3-15 replicas @65% CPU). Apply the same values in Helm via `values.yaml`. |
| Cluster Autoscaler | Enable on the managed cluster so the node pool scales between 2 and 10 nodes per pool in response to pending pods. |
| Redis | Use managed service autoscale (Azure `scale-out policy`, AWS `Global Datastore`). Monitor eviction metrics to trigger manual scale. |
| CDN Edge | Configure request-based autoscaling (CloudFront automatically). |

## 5. CDN for Static Assets

| Concern | Recommendation |
| --- | --- |
| Service | Azure Front Door Standard/Premium, AWS CloudFront, or Google Cloud CDN. |
| Origin | Point CDN to the frontend Load Balancer (or to a versioned storage bucket containing the `dist/` artifacts if you prefer static hosting). |
| Cache Policy | `max-age=31536000` for hashed assets, `no-cache` for `index.html`/`sw.js`. Mirror the rules found in `nginx.conf`. |
| Security | Enforce HTTPS, enable geo restrictions (Nordics first), and attach WAF policies for volumetric DDoS. |
| Invalidation | Trigger automatic cache invalidation from CI/CD after each `npm run build` using the provider SDK. |

## 6. Deployment Flow

1. Build + push images to a private registry (GHCR, ACR, ECR, or GCR) using `docker-compose.prod.yml` as canonical reference for environment variables.
2. Deploy via Helm: `helm upgrade --install lugn-trygg ./helm/lugn-trygg -n lugn-trygg`
3. Apply ingress + cert-manager issuers.
4. Update DNS (Route53/Azure DNS/Cloud DNS) so `app.` and `api.` point to the ingress load balancer.
5. Provision CDN and set `app.lugntrygg.se` CNAME to the CDN endpoint; origin shield to the ingress public address.

## 7. Environment Matrix

| Environment | Cluster | Redis | CDN | Notes |
| --- | --- | --- | --- | --- |
| Development | Kind/minikube + `docker-compose.yml` | Local Redis container | Vite dev server | No TLS, focus on fast feedback. |
| Staging | Managed cluster in separate subscription/project | Managed Redis Basic tier | CDN staging profile | Mirror production scale but with relaxed autoscaling limits. |
| Production | Managed cluster w. autoscaler | Redis Premium multi-AZ | CDN global distribution | Full WAF + alerting + backup policies active. |

With this plan each Day 4 requirement (managed cluster, Redis, load balancer, autoscaling, CDN) is mapped to a concrete, reproducible setup aligned with the manifests that now live in `k8s/` and the Helm chart.
