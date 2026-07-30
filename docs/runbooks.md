# WeMarket Operational Runbooks

## Table of Contents
1. [Deployment Runbooks](#deployment-runbooks)
2. [Database Runbooks](#database-runbooks)
3. [AI/ML Runbooks](#ai-ml-runbooks)
4. [Infrastructure Runbooks](#infrastructure-runbooks)
5. [Security Runbooks](#security-runbooks)
6. [Disaster Recovery Runbooks](#disaster-recovery-runbooks)

---

## Deployment Runbooks

### RB-DEPLOY-001: Standard Production Deploy

**Trigger**: New release tagged on main branch
**Frequency**: On-demand (typically daily)
**Duration**: ~10 minutes
**Rollback Time**: < 2 minutes

**Steps**:
1. **Pre-deploy Checks**
   ```bash
   # Verify CI passed
   gh run list --workflow=CI --branch=main --limit=1
   
   # Verify staging health
   curl -s https://staging.wemarket.com/api/health/deep | jq .checks
   ```

2. **Deploy**
   ```bash
   # Automatic via ArgoCD (preferred)
   # Just push to main - ArgoCD auto-syncs
   
   # Or manual Helm
   helm upgrade wemarket ./helm/wemarket \
     -n wemarket-prod \
     -f helm/wemarket/values-prod.yaml \
     --set image.tag=v2.1.0
   ```

3. **Post-deploy Verification**
   ```bash
   # Health checks
   for i in {1..10}; do
     curl -sf https://api.wemarket.com/api/health/deep && break
     sleep 10
   done
   
   # Smoke tests
   PLAYWRIGHT_BASE_URL=https://wemarket.com npx playwright test --project=chromium
   
   # Check error rate
   curl -s https://grafana.wemarket.com/api/dashboards/uid/wemarket-overview | jq
   ```

4. **Post-deploy Monitoring** (30 min)
   - Watch error rate < 0.1%
   - Watch P99 latency < 2s
   - Watch AI cost rate

**Rollback Criteria**:
- Error rate > 1%
- P99 latency > 5s
- Critical feature broken

**Rollback Command**:
```bash
# ArgoCD
argocd app rollback wemarket <previous-revision>

# Helm
helm rollback wemarket -n wemarket-prod

# Kubectl
kubectl rollout undo deployment/wemarket -n wemarket-prod
```

---

### RB-DEPLOY-002: Hotfix Deploy

**Trigger**: Critical production bug
**Frequency**: As needed
**Duration**: ~5 minutes
**Approval**: Tech lead + on-call

**Steps**:
1. **Create Hotfix Branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/fix-critical-bug
   # Make fix
   git commit -m "fix: critical bug description"
   git push origin hotfix/fix-critical-bug
   ```

2. **Fast-track CI**
   ```bash
   # Skip non-critical checks if needed
   # gh workflow run ci.yml --ref hotfix/fix-critical-bug
   ```

3. **Deploy**
   ```bash
   # Force sync in ArgoCD
   argocd app sync wemarket --prune --force
   
   # Or direct kubectl for speed
   kubectl set image deployment/wemarket \
     app=ghcr.io/kwpark0047-iceu/wemarket-api:hotfix \
     -n wemarket-prod
   ```

4. **Verify & Merge**
   ```bash
   # Quick health check
   curl -sf https://api.wemarket.com/api/health
   
   # Merge back to main
   git checkout main
   git merge hotfix/fix-critical-bug
   git push origin main
   git branch -d hotfix/fix-critical-bug
   ```

---

### RB-DEPLOY-003: Blue-Green Deploy (Major Version)

**Trigger**: Major version with breaking changes
**Frequency**: Monthly/Quarterly
**Duration**: ~30 minutes
**Approval**: Engineering lead + Product

**Steps**:
1. **Prepare Green Environment**
   ```bash
   # Deploy to green namespace
   kubectl create namespace wemarket-green
   helm install wemarket-green ./helm/wemarket \
     -n wemarket-green \
     -f helm/wemarket/values-prod.yaml \
     --set image.tag=v3.0.0
   ```

2. **Internal Testing**
   ```bash
   # Test via internal ingress
   curl -H "Host: green.api.wemarket.com" \
     https://api.wemarket.com/api/health
   
   # Run full test suite against green
   BASE_URL=https://green.api.wemarket.com npm run test:e2e
   ```

3. **Canary Traffic (10%)**
   ```bash
   # Update ingress to send 10% to green
   kubectl patch ingress wemarket -n wemarket-prod \
     -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary":"true","nginx.ingress.kubernetes.io/canary-weight":"10"}}}'
   ```

5. **Full Cutover**
   ```bash
   # Verify metrics for 15 min
   # Then switch 100%
   kubectl patch ingress wemarket -n wemarket-prod \
     -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary":"false"}}}'
   
   # Update main deployment
   kubectl set image deployment/wemarket \
     app=ghcr.io/kwpark0047-iceu/wemarket-api:v3.0.0 \
     -n wemarket-prod
   
   # Cleanup green
   kubectl delete namespace wemarket-green
   ```

---

## Database Runbooks

### RB-DB-001: Manual Migration Deploy

**Trigger**: New migration needs deployment
**Frequency**: With each deploy containing migrations
**Duration**: 2-5 minutes

**Steps**:
```bash
# 1. Backup first
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > pre-migration-$(date +%Y%m%d).sql.gz

# 2. Run migration
npx prisma migrate deploy

# 3. Verify
npx prisma migrate status

# 4. Verify app works
curl -sf https://api.wemarket.com/api/health/deep
```

**Rollback**:
```bash
# If migration breaks
npx prisma migrate resolve --rolled-back "migration_name"
# Then deploy previous version
```

---

### RB-DB-002: Connection Pool Exhaustion

**Alert**: `pg_stat_activity_numbackends / max_connections > 0.8`
**Duration**: 5-15 minutes

**Steps**:
```bash
# 1. Check current connections
kubectl exec -it postgres-0 -- psql -U wemarket -c "
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
"

# 2. Kill idle connections
kubectl exec -it postgres-0 -- psql -U wemarket -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'idle' 
  AND state_change < now() - interval '5 minutes';
"

# 3. Scale PgBouncer if available
kubectl scale deployment pgbouncer --replicas=5 -n wemarket-prod

# 4. Check for connection leaks in app
# Check: Are connections being returned to pool?
```

---

### RB-DB-003: Slow Query Investigation

**Alert**: `pg_stat_statements mean_time > 1s`
**Duration**: 15-30 minutes

**Steps**:
```bash
# 1. Find slow queries
kubectl exec -it postgres-0 -- psql -U wemarket -c "
  SELECT query, mean_time, calls, total_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 20;
"

# 2. Check for missing indexes
kubectl exec -it postgres-0 -- psql -U wemarket -c "
  SELECT schemaname, tablename, seq_scan, idx_scan
  FROM pg_stat_user_tables
  WHERE seq_scan > idx_scan
  ORDER BY seq_scan DESC;
"

# 3. Analyze specific query
kubectl exec -it postgres-0 -- psql -U wemarket -c "
  EXPLAIN ANALYZE <slow_query>;
"

# 4. Add index if needed
kubectl exec -it postgres-0 -- psql -U wemarket -c "
  CREATE INDEX CONCURRENTLY idx_orders_store_created 
  ON orders (store_id, created_at DESC);
"
```

---

### RB-DB-004: Point-in-Time Recovery (Supabase)

**Trigger**: Data corruption, accidental deletion
**RTO**: 1 hour, **RPO**: 1 minute

**Steps**:
1. **Stop Writes** (maintenance mode)
   ```bash
   kubectl patch configmap wemarket-config -n wemarket-prod \
     -p '{"data":{"MAINTENANCE_MODE":"true"}}'
   kubectl rollout restart deployment/wemarket -n wemarket-prod
   ```

2. **Initiate PITR** (Supabase Dashboard)
   - Go to Supabase Dashboard > Database > Backups
   - Click "Point-in-time Recovery"
   - Select timestamp before incident
   - Confirm restore

3. **Verify Data**
   ```bash
   # Check critical tables
   kubectl exec -it postgres-0 -- psql -U wemarket -c "
     SELECT count(*) FROM orders WHERE created_at > '2025-01-27';
   "
   ```

4. **Resume**
   ```bash
   kubectl patch configmap wemarket-config -n wemarket-prod \
     -p '{"data":{"MAINTENANCE_MODE":"false"}}'
   kubectl rollout restart deployment/wemarket -n wemarket-prod
   ```

---

## AI/ML Runbooks

### RB-AI-001: High Fallback Rate

**Alert**: `ai_fallback_rate > 20%`
**Duration**: 10-30 minutes

**Steps**:
```bash
# 1. Check OmniRoute health
curl -s http://omniroute:20128/v1/models \
  -H "Authorization: Bearer sk-omniroute" | jq

# 2. Check Gemini quota
# Google Cloud Console > Generative AI > Quotas

# 3. Check fallback logs
kubectl logs -n wemarket-prod -l app=wemarket \
  --tail=100 | grep -i fallback

# 4. Mitigation: Force primary
kubectl patch configmap wemarket-config -n wemarket-prod \
  -p '{"data":{"FEATURE_AI_FALLBACK":"false"}}'
kubectl rollout restart deployment/wemarket -n wemarket-prod
```

---

### RB-AI-002: AI Cost Spike

**Alert**: `ai_cost_usd_per_hour > $10`
**Duration**: 15-30 minutes

**Steps**:
```bash
# 1. Check usage dashboard
# Grafana > AI Metrics > Cost

# 2. Identify source
kubectl logs -n wemarket-prod -l app=wemarket \
  --tail=500 | grep -E "(recommend|generate|translate)" | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -20

# 3. Implement emergency rate limit
kubectl patch configmap wemarket-config -n wemarket-prod \
  -p '{"data":{"RATE_LIMIT_AI_MAX":"20"}}'
kubectl rollout restart deployment/wemarket -n wemarket-prod

# 4. Check for abuse
# Check: Are specific users/stores making excessive calls?
kubectl logs -n wemarket-prod -l app=wemarket \
  --tail=1000 | grep "ai_request" | \
  jq -r '.storeId' | sort | uniq -c | sort -rn | head -10
```

---

### RB-AI-003: OmniRoute Unavailable

**Alert**: `up{job="omniroute"} == 0`
**Duration**: 10-30 minutes

**Steps**:
```bash
# 1. Check OmniRoute container
docker ps | grep omniroute
docker logs omniroute --tail 100

# 2. Check port
curl -v http://localhost:20128/v1/models

# 3. Restart if needed
docker restart omniroute

# 4. Verify fallback working
curl -s https://api.wemarket.com/api/health/deep | jq .checks.omniroute
```

---

## Infrastructure Runbooks

### RB-INFRA-001: Pod CrashLoopBackOff

**Alert**: Pod in CrashLoopBackOff
**Duration**: 10-30 minutes

**Steps**:
```bash
# 1. Check events
kubectl describe pod -n wemarket-prod <pod-name>

# 2. Check logs
kubectl logs -n wemarket-prod <pod-name> --previous --tail=200

# 3. Common causes:
# - Config/Secret missing: Check ConfigMap/Secret exists
# - DB connection: Check postgres/redis reachable
# - OOM: Check memory limits
# - Port conflict: Check port already in use

# 4. Quick fix: Restart
kubectl delete pod -n wemarket-prod <pod-name>

# 5. If persistent, check image
kubectl describe pod -n wemarket-prod <pod-name> | grep Image
```

---

### RB-INFRA-002: High Memory Usage

**Alert**: `container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9`
**Duration**: 15-30 minutes

**Steps**:
```bash
# 1. Check which pods
kubectl top pods -n wemarket-prod --sort-by=memory

# 2. Check for leaks
kubectl logs -n wemarket-prod <high-mem-pod> --tail=500 | grep -i memory

# 3. Quick fix: Restart
kubectl delete pod -n wemarket-prod <high-mem-pod>

# 4. Long term: Increase limits
kubectl patch deployment wemarket -n wemarket-prod \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"wemarket","resources":{"limits":{"memory":"2Gi"}}]}}}}'
```

---

### RB-INFRA-003: Certificate Expiry

**Alert**: TLS cert expires in < 30 days
**Duration**: 30 minutes

**Steps**:
```bash
# 1. Check cert status
kubectl get certificates -n wemarket-prod
kubectl describe certificate wemarket-tls -n wemarket-prod

# 2. Force renewal
kubectl delete certificate wemarket-tls -n wemarket-prod
# cert-manager will re-create

# 3. If cert-manager stuck
kubectl delete secret wemarket-tls -n wemarket-prod
kubectl annotate certificate wemarket-tls -n wemarket-prod \
  cert-manager.io/force-renew=true
```

---

### RB-INFRA-004: Redis Failover

**Alert**: Redis master down
**Duration**: 5-15 minutes

**Steps**:
```bash
# 1. Check Redis status
kubectl exec -it redis-0 -- redis-cli INFO replication

# 2. If master down, promote replica
kubectl exec -it redis-1 -- redis-cli REPLICAOF NO ONE

# 3. Update config
kubectl patch configmap wemarket-config -n wemarket-prod \
  -p '{"data":{"REDIS_URL":"redis://redis-1:6379"}}'
kubectl rollout restart deployment/wemarket -n wemarket-prod

# 3. Verify
curl -s https://api.wemarket.com/api/health/deep | jq .checks.redis
```

---

## Security Runbooks

### RB-SEC-001: Suspicious Activity Detected

**Alert**: High auth failure rate, unusual API patterns
**Duration**: 15-60 minutes

**Steps**:
```bash
# 1. Check auth failures
kubectl logs -n wemarket-prod -l app=wemarket \
  --tail=1000 | grep -i "unauthorized\|invalid token" | \
  awk '{print $(NF-1)}' | sort | uniq -c | sort -rn | head -20

# 2. Block IPs (via Cloudflare)
# Cloudflare Dashboard > Security > WAF > Block IP

# 3. Rotate compromised secrets
kubectl create secret generic wemarket-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -base64 64) \
  --from-literal=JWT_REFRESH_SECRET=$(openssl rand -base64 64) \
  -n wemarket-prod --dry-run=client -o yaml | kubectl apply -f -

# 4. Force re-login
kubectl patch configmap wemarket-config -n wemarket-prod \
  -p '{"data":{"FORCE_RELOGIN":"true"}}'
kubectl rollout restart deployment/wemarket -n wemarket-prod
```

---

### RB-SEC-002: Vulnerability in Dependency

**Alert**: Trivy/Snyk scan finds Critical/High vulnerability
**Duration**: 1-4 hours

**Steps**:
```bash
# 1. Assess
# Check: Is it in production code? Dev only? Transitive?

# 2. If Critical in prod:
# Update dependency
npm update <vulnerable-package>

# 3. Rebuild & scan
docker build -t wemarket-api:patched .
trivy image wemarket-api:patched

# 4. Deploy hotfix
docker tag wemarket-api:patched ghcr.io/kwpark0047-iceu/wemarket-api:security-patch
docker push ghcr.io/kwpark0047-iceu/wemarket-api:security-patch
kubectl set image deployment/wemarket \
  app=ghcr.io/kwpark0047-iceu/wemarket-api:security-patch \
  -n wemarket-prod

# 5. If no fix available: Mitigate
# - Add WAF rule
# - Disable vulnerable feature
# - Add network policy
```

---

## Disaster Recovery Runbooks

### RB-DR-001: Complete Region Failover

**Trigger**: Entire region unavailable
**RTO**: 15 minutes, **RPO**: 1 minute

**Steps**:
```bash
# 1. Update DNS (Cloudflare)
# Dashboard > DNS > Edit A record > Point to backup region LB

# 2. Deploy to backup region
kubectl config use-context backup-cluster
helm install wemarket ./helm/wemarket -n wemarket-prod -f values-dr.yaml

# 3. Verify
for i in {1..20}; do
  curl -sf https://api-backup.wemarket.com/api/health && break
  sleep 15
done

# 4. Update monitoring
# Update Grafana datasources, alertmanager routes

# 5. Communicate
# Status page update, Slack notification
```

---

### RB-DR-002: Database Restore from Backup

**Trigger**: Data corruption, ransomware
**RTO**: 4 hours, **RPO**: 1 hour

**Steps**:
```bash
# 1. Stop application
kubectl scale deployment wemarket --replicas=0 -n wemarket-prod

# 2. Restore database (Supabase)
# Dashboard > Database > Backups > Restore
# Select: Latest clean backup

# 3. Verify restore
kubectl exec -it postgres-0 -- psql -U wemarket -c "
  SELECT count(*) FROM orders;
  SELECT max(created_at) FROM orders;
"

# 4. Run migrations (if schema changed)
npx prisma migrate deploy

# 4. Restart application
kubectl scale deployment wemarket --replicas=3 -n wemarket-prod

# 5. Verify
curl -sf https://api.wemarket.com/api/health/deep
```

---

### RB-DR-003: Complete Cluster Loss

**Trigger**: Kubernetes cluster destroyed
**RTO**: 4 hours, **RPO**: 1 hour

**Steps**:
```bash
# 1. Provision new cluster
# Terraform / Cloud provider console
# Ensure: CNI, CSI, Ingress, Cert-manager, Prometheus Operator

# 2. Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 3. Apply ArgoCD Applications
kubectl apply -f argocd/

# 4. Wait for sync
argocd app wait wemarket --timeout 300

# 5. Verify all services
argocd app get wemarket
argocd app get wemarket

# 6. Update DNS
# Point to new cluster LB

# 7. Verify end-to-end
curl -sf https://api.wemarket.com/api/health/deep
```

---

## Quick Reference Card

### Key Commands
```bash
# Health checks
curl https://api.wemarket.com/api/health
curl https://api.wemarket.com/api/health/deep

# Logs
kubectl logs -n wemarket-prod -l app=wemarket --tail=100 -f
kubectl logs -n wemarket-prod -l app=wemarket --previous --tail=200

# Metrics
curl https://prometheus.wemarket.com/api/v1/query?query=up
curl https://grafana.wemarket.com/api/dashboards/uid/wemarket-overview

# Deploy
argocd app sync wemarket
kubectl set image deployment/wemarket app=ghcr.io/...:tag -n wemarket-prod

# Rollback
argocd app rollback wemarket <rev>
helm rollback wemarket -n wemarket-prod
kubectl rollout undo deployment/wemarket -n wemarket-prod

# Scale
kubectl scale deployment wemarket --replicas=5 -n wemarket-prod

# Config
kubectl patch configmap wemarket-config -n wemarket-prod -p '{"data":{"KEY":"value"}}'
kubectl rollout restart deployment/wemarket -n wemarket-prod

# Secrets
kubectl create secret generic wemarket-secrets --from-literal=KEY=value -n wemarket-prod --dry-run=client -o yaml | kubectl apply -f -
```

### Key URLs
- Grafana: https://grafana.wemarket.com
- Prometheus: https://prometheus.wemarket.com
- Alertmanager: https://alertmanager.wemarket.com
- Loki: https://loki.wemarket.com
- ArgoCD: https://argocd.wemarket.com
- Supabase: https://supabase.com/dashboard
- Render: https://dashboard.render.com
- Cloudflare: https://dash.cloudflare.com

---

*Last Updated: 2025-01-27*  
*Version: 2.0.0*  
*Maintainer: WeMarket Platform Team*
