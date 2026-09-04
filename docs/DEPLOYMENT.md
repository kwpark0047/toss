# WeMarket Deployment Guide

## Overview

This guide covers deploying WeMarket to various environments using different deployment strategies.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Staging Deployment](#staging-deployment)
4. [Production Deployment](#production-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Rollback Procedures](#rollback-procedures)
7. [Health Checks & Validation](#health-checks--validation)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- Docker & Docker Compose (v2.0+)
- Node.js 22.x LTS
- kubectl (v1.28+)
- Helm (v3.12+)
- ArgoCD CLI (for GitOps)

### Required Secrets
All secrets must be configured in the deployment platform:

| Secret | Description | Required |
|--------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Yes |
| `PHONE_ENC_KEY` | Phone number encryption key | Yes |
| `GEMINI_API_KEY` | Google Generative AI API key | Yes |
| `OMNIROUTE_API_KEY` | OmniRoute API key | Yes |
| `TOSS_SECRET_KEY` | Toss Payments secret key | Yes |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase admin SDK JSON | Yes |
| `CORS_ORIGIN` | Allowed CORS origins | Yes |

---

## Local Development

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/kwpark0047/250105.git
cd 250105

# 2. Start all services
docker-compose up -d

# 3. Install dependencies
npm ci

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npx prisma migrate dev

# 6. Start development servers
npm run dev
```

### Services Started
- **API**: http://localhost:3000
- **Frontend**: http://localhost:5173
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Adminer**: http://localhost:8080

### Environment File (.env.local)
```env
NODE_ENV=development
DATABASE_URL=postgresql://wemarket:wemarket123@localhost:5432/wemarket
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-dev-jwt-secret-32-chars-min
JWT_REFRESH_SECRET=your-dev-refresh-secret-32-chars-min
GEMINI_API_KEY=your-gemini-key
OMNIROUTE_API_KEY=sk-omniroute
LOG_LEVEL=debug
```

---

## Staging Deployment

### Automatic (GitHub Actions)
Push to `develop` branch triggers automatic staging deployment:

```bash
git push origin develop
```

### Manual Deployment
```bash
# Build and push image
docker build -t ghcr.io/kwpark0047/wemarket-api:staging .
docker push ghcr.io/kwpark0047/wemarket-api:staging

# Deploy via Render
curl -X POST "${RENDER_STAGING_DEPLOY_HOOK}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "do_not_clear"}'
```

### Staging URL
- API: https://staging-api.wemarket.com
- Frontend: https://staging.wemarket.com

---

## Production Deployment

### Automatic (GitHub Actions)
Push to `main` branch triggers production deployment after staging validation:

```bash
git push origin main
```

### Pipeline Stages
1. **CI**: Lint → Test → Security Scan
2. **Build**: Docker image → GHCR
3. **Staging Deploy** → Health checks → Smoke tests
4. **Migration Gate**: `prisma migrate deploy` using the direct production connection
5. **Production Deploy** → Health checks → Smoke tests
6. **Notification** → Slack

The production GitHub environment must define `PRODUCTION_DATABASE_URL` and
`PRODUCTION_DIRECT_URL`. The latter must be a direct PostgreSQL connection, not
a transaction-pooler URL.

### Manual Production Deploy
```bash
# Tag release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Deploy via Render
curl -X POST "${RENDER_PRODUCTION_DEPLOY_HOOK}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "do_not_clear"}'
```

### Production URLs
- API: https://api.wemarket.com
- Frontend: https://wemarket.com
- Monitoring: https://grafana.wemarket.com

---

## Kubernetes Deployment

### Prerequisites
- Kubernetes 1.28+
- Helm 3.12+
- cert-manager installed
- ingress-nginx installed
- Prometheus Operator installed

### Install via Helm

```bash
# Add repository
helm repo add wemarket https://kwpark0047.github.io/250105/helm
helm repo update

# Install
helm install wemarket wemarket/wemarket \
  --namespace wemarket-prod \
  --create-namespace \
  -f helm/wemarket/values-prod.yaml \
  --wait --timeout 10m
```

### Required Secrets (Create First)
```bash
kubectl create secret generic wemarket-secrets \
  --namespace wemarket-prod \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..." \
  --from-literal=JWT_SECRET="..." \
  --from-literal=JWT_REFRESH_SECRET="..." \
  --from-literal=PHONE_ENC_KEY="..." \
  --from-literal=GEMINI_API_KEY="..." \
  --from-literal=OMNIROUTE_API_KEY="..." \
  --from-literal=TOSS_SECRET_KEY="..." \
  --from-literal=FIREBASE_SERVICE_ACCOUNT="..."
```

### Verify Deployment
```bash
# Check pods
kubectl get pods -n wemarket-prod

# Check logs
kubectl logs -n wemarket-prod -l app=wemarket -f

# Check ingress
kubectl get ingress -n wemarket-prod

# Check HPA
kubectl get hpa -n wemarket-prod
```

### GitOps with ArgoCD
```bash
# Apply ArgoCD applications
kubectl apply -f argocd/wemarket-project.yaml
kubectl apply -f argocd/wemarket-application.yaml

# Sync manually
argocd app sync wemarket
```

---

## Rollback Procedures

### Docker Compose Rollback
```bash
# Stop current
docker-compose down

# Start previous version
docker-compose -f docker-compose.prod.yml up -d
# (previous image tag is cached)
```

### Kubernetes Rollback
```bash
# View revision history
kubectl rollout history deployment/wemarket -n wemarket-prod

# Rollback to previous revision
kubectl rollout undo deployment/wemarket -n wemarket-prod

# Rollback to specific revision
kubectl rollout undo deployment/wemarket -n wemarket-prod --to-revision=3
```

### ArgoCD Rollback
```bash
# Via CLI
argocd app rollback wemarket 3

# Via UI
# Applications → wemarket → History → Rollback to revision 3
```

### Database Rollback (Emergency)
```bash
# Restore from Supabase PITR
# Go to Supabase Dashboard → Database → Backups → Point-in-time Recovery
# Select timestamp before issue
```

---

## Health Checks & Validation

### API Health Endpoints
| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/health` | Liveness probe | 200 OK, `{status: "ok"}` |
| `/api/health/deep` | Readiness probe | 200 OK, detailed checks |
| `/api/health/circuits` | Circuit breaker status | 200 OK, circuit states |
| `/api/health/sla` | SLA metrics | 200 OK, SLA metrics |

### Post-Deploy Validation Checklist
- [ ] API health endpoint returns 200
- [ ] Deep health check shows all dependencies OK
- [ ] Frontend loads without console errors
- [ ] Authentication flow works (login/register)
- [ ] Order flow completes end-to-end
- [ ] AI recommendations work
- [ ] Payment integration responds
- [ ] Metrics appear in Grafana
- [ ] Logs appear in Loki/Grafana
- [ ] Alerts not firing unexpectedly

### Smoke Tests (Automated)
```bash
# Run smoke tests against deployed environment
npm run test:e2e -- --project=smoke
```

---

## Troubleshooting

### Common Issues

#### API Returns 503 (Service Unavailable)
```bash
# Check if app pods are running
kubectl get pods -n wemarket-prod

# Check logs
kubectl logs -n wemarket-prod -l app=wemarket --tail=100

# Check events
kubectl describe pod <pod-name> -n wemarket-prod
```

#### High Latency / Timeouts
```bash
# Check database connections
kubectl exec -it postgres-0 -n wemarket-prod -- pg_isready

# Check Redis
kubectl exec -it redis-0 -n wemarket-prod -- redis-cli ping

# Check HPA scaling
kubectl get hpa -n wemarket-prod
```

#### Database Migration Failures
```bash
# Check migration status
npx prisma migrate status

# Reset and re-apply (dev only!)
npx prisma migrate reset --force

# Production: restore from backup
# Supabase Dashboard → Database → Backups
```

#### Redis Connection Issues
```bash
# Check Redis memory
kubectl exec -it redis-0 -n wemarket-prod -- redis-cli INFO memory

# Check connections
kubectl exec -it redis-0 -n wemarket-prod -- redis-cli CLIENT LIST

# Flush cache if needed
kubectl exec -it redis-0 -n wemarket-prod -- redis-cli FLUSHALL
```

#### AI Service Failures
```bash
# Check OmniRoute connectivity
curl -v http://omniroute:20128/v1/models \
  -H "Authorization: Bearer sk-omniroute"

# Check Gemini quota
# Google Cloud Console → Generative AI → Quotas

# Fallback to cached responses
# Check cache hit rate in Grafana
```

### Log Locations
| Component | Location |
|-----------|----------|
| API Logs | `/app/logs/*.log` (container) / Loki |
| Nginx Access | `/var/log/nginx/access.log` |
| Nginx Error | `/var/log/nginx/error.log` |
| PostgreSQL | Supabase Dashboard / `pg_log` |
| Redis | `redis-cli INFO` / Redis logs |
| Kubernetes | `kubectl logs` / Loki |

### Useful Commands
```bash
# View real-time logs
kubectl logs -f deployment/wemarket -n wemarket-prod

# Exec into pod
kubectl exec -it <pod-name> -n wemarket-prod -- sh

# Port forward for debugging
kubectl port-forward svc/wemarket 3000:3000 -n wemarket-prod

# Check resource usage
kubectl top pods -n wemarket-prod
kubectl top nodes

# View events
kubectl get events -n wemarket-prod --sort-by='.lastTimestamp'
```

---

## Security Checklist (Pre-Production)

- [ ] All secrets stored in secret manager (not in code)
- [ ] TLS certificates valid and auto-renewing
- [ ] Rate limiting configured and tested
- [ ] CORS origins restricted to known domains
- [ ] CSP headers configured
- [ ] Security scanning passed (Trivy, Semgrep, Snyk)
- [ ] Dependency audit clean (no critical/high vulnerabilities)
- [ ] Secrets rotated in last 90 days
- [ ] Database encrypted at rest and in transit
- [ ] Redis AUTH enabled
- [ ] Network policies restricting inter-pod communication
- [ ] Pod security standards enforced (restricted)

---

## Support Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Platform Team | platform@wemarket.com | PagerDuty |
| AI/ML Team | ai@wemarket.com | Slack #ai-alerts |
| Database Admin | dba@wemarket.com | PagerDuty |
| Security Team | security@wemarket.com | Immediate |

---

*Last Updated: 2025-01-27*  
*Version: 1.0.0*
