# WeMarket Deployment Guide

## Overview

This guide covers deploying WeMarket to production using multiple deployment strategies:
- **Render.com** (current production)
- **Docker Compose** (self-hosted)
- **Kubernetes** (Helm/ArgoCD - recommended for scale)

---

## Prerequisites

### Required Accounts & Secrets
| Service | Purpose | Required Secrets |
|---------|---------|------------------|
| GitHub | Source control & CI/CD | GITHUB_TOKEN |
| GHCR | Container registry | GITHUB_TOKEN |
| Supabase | PostgreSQL database | DATABASE_URL, DIRECT_URL |
| Render.com | Hosting (current) | RENDER_DEPLOY_HOOK_URL |
| Cloudflare | DNS, CDN, WAF | CLOUDFLARE_API_TOKEN |
| Slack | Notifications | SLACK_WEBHOOK_URL |
| PagerDuty | On-call alerting | PAGERDUTY_KEY |
| Google Cloud | Gemini AI | GEMINI_API_KEY |
| Toss Payments | Payment processing | TOSS_SECRET_KEY |

### Infrastructure Requirements

#### Minimum (Development)
- 2 vCPU, 4GB RAM
- PostgreSQL 16+
- Redis 7+
- 20GB storage

#### Production (Recommended)
- 3+ nodes, 4 vCPU, 8GB RAM each
- Managed PostgreSQL (Supabase/RDS)
- Managed Redis (ElastiCache/Redis Cloud)
- Load balancer (Cloudflare/NGINX)
- Object storage (S3/GCS) for backups

---

## Deployment Methods

### Method 1: Render.com (Current)

#### Initial Setup
```bash
# 1. Connect GitHub repo to Render
# 2. Create new Web Service
# 3. Configure:
#    - Build Command: npm install && npx prisma generate
#    - Start Command: node index.js
#    - Health Check Path: /api/health
#    - Auto-Deploy: Yes

# 4. Add Environment Variables (see .env.example)
# 5. Add PostgreSQL database (Supabase external)
# 6. Add Redis (external or Render Redis)
```

#### Deploy
```bash
# Automatic on push to main
git push origin main

# Manual deploy via Render dashboard
# Or via webhook:
curl -X POST "$RENDER_DEPLOY_HOOK"
```

#### Rollback
```bash
# Render Dashboard > Deploys > Rollback to previous
# Or via API:
curl -X POST "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -d '{"clearCache": "do_not_clear"}'
```

---

### Method 2: Docker Compose (Self-Hosted)

#### Quick Start
```bash
# 1. Clone and configure
git clone https://github.com/kwpark0047-iceu/250105.git
cd 250105
cp .env.example .env.prod
# Edit .env.prod with production values

# 2. Create data directories
sudo mkdir -p /data/postgres /data/redis /data/logs /data/prometheus /data/grafana /data/loki

# 3. Deploy
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify
docker-compose -f docker-compose.prod.yml ps
curl http://localhost/api/health
```

#### Production Checklist
- [ ] TLS termination configured in an external reverse proxy/load balancer
- [ ] Strong passwords in `.env.prod`
- [ ] Backup cron job configured
- [ ] Log rotation configured
- [ ] Monitoring alerts configured
- [ ] Firewall rules applied (only 80/443 external)

#### Scaling
```bash
# Scale API
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Update
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --no-deps app
```

---

### Method 3: Kubernetes (Helm + ArgoCD) - Recommended

#### Prerequisites
- Kubernetes 1.28+ cluster
- Helm 3.12+
- ArgoCD installed
- cert-manager installed
- nginx-ingress controller
- Prometheus Operator (for ServiceMonitor)

#### Quick Install
```bash
# 1. Add repo (if published)
helm repo add wemarket https://charts.wemarket.com
helm repo update

# 2. Install with custom values
helm install wemarket ./helm/wemarket \
  -n wemarket-prod \
  --create-namespace \
  -f helm/wemarket/values-prod.yaml \
  --set image.tag=1.0.0

# 3. Or with ArgoCD (GitOps)
kubectl apply -f argocd/wemarket-application.yaml
```

#### Configuration

**values-prod.yaml**
```yaml
global:
  domain: wemarket.com
  environment: production

image:
  repository: ghcr.io/kwpark0047-iceu/wemarket-api
  tag: "1.0.0"

app:
  replicas: 5
  resources:
    limits:
      cpu: 2000m
      memory: 2Gi
    requests:
      cpu: 500m
      memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 5
  maxReplicas: 30

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  tls:
    - secretName: wemarket-tls
      hosts:
        - api.wemarket.com

secrets:
  existingSecret: wemarket-secrets

postgresql:
  enabled: false  # Use external Supabase

redis:
  enabled: false  # Use external Redis
```

#### Secrets Management
```bash
# Create secret (one-time)
kubectl create secret generic wemarket-secrets \
  -n wemarket-prod \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..." \
  --from-literal=JWT_SECRET="..." \
  --from-literal=GEMINI_API_KEY="..." \
  --dry-run=client -o yaml | kubectl apply -f -

# Or use External Secrets Operator
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: wemarket-secrets
  namespace: wemarket-prod
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: wemarket-secrets
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: prod/wemarket/database-url
    - secretKey: REDIS_URL
      remoteRef:
        key: prod/wemarket/redis-url
    # ...
EOF
```

#### GitOps with ArgoCD
```bash
# 1. Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. Apply project and application
kubectl apply -f argocd/wemarket-project.yaml
kubectl apply -f argocd/wemarket-application.yaml

# 3. Access ArgoCD
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Login: admin / (get password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
```

#### Upgrading
```bash
# Via Helm
helm upgrade wemarket ./helm/wemarket -n wemarket-prod -f helm/wemarket/values-prod.yaml --set image.tag=1.0.0

# Via ArgoCD (auto-sync)
# Just update image tag in values-prod.yaml and commit
git add helm/wemarket/values-prod.yaml
git commit -m "chore: update image to v2.1.0"
git push origin main
# ArgoCD will auto-sync
```

#### Rollback
```bash
# Via Helm
helm rollback wemarket -n wemarket-prod

# Via ArgoCD
# ArCD UI > Application > History > Rollback
# Or CLI:
argocd app rollback wemarket <revision>

# Via kubectl (deployment only)
kubectl rollout undo deployment/wemarket -n wemarket-prod
```

---

## Database Migrations

### Prisma Migrations
```bash
# Development
npx prisma migrate dev --name migration_name

# Production (CI/CD)
npx prisma migrate deploy

# Rollback (manual)
# 1. Revert migration file
# 2. npx prisma migrate resolve --rolled-back "migration_name"
# 3. Deploy remaining
```

### Backup & Restore
```bash
# Backup (run as cron)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore
gunzip -c backup_20250127_020000.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Point-in-time recovery (Supabase)
# Dashboard > Database > Backups > Point-in-time Recovery
```

---

## SSL/TLS Configuration

### Let's Encrypt (cert-manager)
```yaml
# ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: security@wemarket.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

### Cloudflare Origin Certificate
```bash
# 1. Cloudflare Dashboard > SSL/TLS > Origin Server
# 2. Create Certificate
# 3. Save as k8s secret:
kubectl create secret tls wemarket-tls \
  --cert=origin.pem \
  --key=origin.key \
  -n wemarket-prod
```

---

## Monitoring & Alerting

### Access
- Grafana: https://grafana.wemarket.com (admin / $GRAFANA_PASSWORD)
- Prometheus: https://prometheus.wemarket.com
- Alertmanager: https://alertmanager.wemarket.com
- Loki: https://loki.wemarket.com

### Key Dashboards
1. **WeMarket Overview** - System health, API metrics
2. **AI Metrics** - AI usage, cost, latency
3. **Business Metrics** - Orders, revenue, users
4. **Infrastructure** - Kubernetes, nodes, databases

### Critical Alerts
| Alert | Threshold | Action |
|-------|-----------|--------|
| API Down | `up == 0` | Page on-call |
| High Error Rate | `> 5%` | Investigate |
| High Latency P99 | `> 3s` | Scale/optimize |
| AI Cost Spike | `> $10/hr` | Check usage |
| DB Connections | `> 80%` | Scale DB |
| Redis Memory | `> 85%` | Scale Redis |

---

## Security Hardening

### Network Policies
```bash
# Apply network policies
kubectl apply -f helm/wemarket/templates/networkpolicy.yaml
```

### Pod Security Standards
```yaml
# Enforced via PodSecurity admission controller
apiVersion: v1
kind: Namespace
metadata:
  name: wemarket-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Image Security
```bash
# Scan images in CI
trivy image ghcr.io/kwpark0047-iceu/wemarket-api:latest

# Sign images
cosign sign ghcr.io/kwpark0047-iceu/wemarket-api:1.0.0

# Verify at deploy
cosign verify ghcr.io/kwpark0047-iceu/wemarket-api:1.0.0
```

---

## Disaster Recovery

### RTO/RPO Targets
| Tier | Service | RTO | RPO |
|------|---------|-----|-----|
| Critical | API, Database | 15 min | 1 min |
| Important | Redis, AI | 1 hour | 5 min |
| Standard | Frontend, Logs | 4 hours | 1 hour |

### Recovery Procedures

#### Complete Region Failure
1. Update DNS to backup region (Cloudflare)
2. Deploy to backup region via ArgoCD
2. Verify health checks
3. Update monitoring
4. Communicate status

#### Database Corruption
1. Stop writes (maintenance mode)
2. Restore from latest clean backup
3. Replay WAL if available
4. Verify data integrity
5. Resume traffic

### Backup Verification
```bash
# Monthly restore test
# 1. Create test namespace
# 2. Restore latest backup
# 2. Run data integrity checks
# 3. Document results
# 4. Clean up
```

---

## Maintenance Windows

### Scheduled Maintenance
- **Weekly**: Sunday 02:00-04:00 KST (DB vacuum, log rotation)
- **Monthly**: First Sunday 01:00-05:00 KST (OS patches, dependency updates)
- **Quarterly**: Major version upgrades

### Zero-Downtime Deployments
```bash
# Rolling update (default)
kubectl set image deployment/wemarket app=ghcr.io/...:v2.1.0 -n wemarket-prod

# Blue-Green (for major changes)
# 1. Deploy to green namespace
# 2. Test with internal traffic
# 3. Switch ingress
# 4. Monitor 15 min
# 5. Decommission blue
```

---

## Troubleshooting Quick Reference

| Issue | Command | Expected |
|-------|---------|----------|
| Pod not starting | `kubectl describe pod -n wemarket-prod <pod>` | Events show reason |
| Service not accessible | `kubectl get ep -n wemarket-prod` | Endpoints match pods |
| Config not updating | `kubectl rollout restart deploy/wemarket` | New pods with new config |
| Secret not updating | `kubectl get secret wemarket-secrets -o yaml` | Data matches |
| Ingress not working | `kubectl describe ingress -n wemarket-prod` | Address assigned |
| Cert not issuing | `kubectl describe certificate -n wemarket-prod` | Ready=True |

---

## Support Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Platform Team | #wemarket-platform | PagerDuty |
| Backend Team | #wemarket-backend | Slack |
| Frontend Team | #wemarket-frontend | Slack |
| AI/ML Team | #wemarket-ai | Slack |
| Security | security@wemarket.com | Email |
| On-Call | PagerDuty schedule | PagerDuty |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-01-27 | Kubernetes, ArgoCD, monitoring stack |
| 1.1.0 | 2025-01-15 | Render.com, Docker Compose |
| 1.0.0 | 2025-01-01 | Initial release |

---

*Last Updated: 2025-01-27*  
*Maintainer: WeMarket Platform Team*
