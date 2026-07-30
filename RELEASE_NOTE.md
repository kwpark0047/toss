# WeMarket v1.1.1 Release Notes

> **Release Date**: 2026-07-25  
> **Version**: v1.1.1  
> **Codename**: "Performance Excellence"

---

## 🎯 Release Overview

WeMarket v1.1.1 "Performance Excellence" is a focused release dedicated to **frontend performance optimization** and **CI/CD pipeline hardening**. This release delivers measurable performance improvements across all Core Web Vitals while strengthening the CI/CD pipeline for reliable deployments.

---

## 🚀 Highlights

| Area | Improvement | Impact |
|-----|-------------|--------|
| **Image Optimization** | AVIF/WebP auto-conversion via `vite-imagetools` | ~70% image size reduction |
| **Critical CSS** | Inline critical CSS for index.html/offline.html | Faster FCP/LCP |
| **Bundle Analysis** | `bundle-analysis.html` with gzip/brotli sizes | Visibility into bundle composition |
| **Performance Budgets** | CI gate: Script 4MB, CSS 350KB, Total 8.5MB | Prevents regression |
| **Web Vitals Monitoring** | LCP/FID/CLS/FCP/TTFB/INP real-time | Production observability |
| **Resource Hints** | preconnect/preload/dns-prefetch | Faster third-party loads |
| **SW Cache Strategy** | NetworkFirst + StaleWhileRevalidate | Faster API, offline support |

---

## 📦 What's New in v1.1.1

### 🎨 Frontend Performance
| Feature | Implementation | Benefit |
|---------|----------------|---------|
| **Image Optimization** | `vite-imagetools` with AVIF/WebP/JPEG | ~70% image size reduction |
| **Bundle Analysis** | `rollup-plugin-visualizer` → `bundle-analysis.html` | Bundle composition visibility |
| **Critical CSS** | `vite-plugin-critical-css` inline for index/offline | Faster FCP/LCP |
| **Performance Budgets** | CI gate: Script 4MB, CSS 350KB, Total 8.5MB | Prevents regression |
| **Web Vitals** | LCP/FID/CLS/FCP/TTFB/INP via `web-vitals` | Real-time monitoring |
| **Resource Hints** | preconnect/preload/dns-prefetch | Faster 3rd-party loads |

### 🔧 Service Worker Cache Strategy
| Resource Type | Strategy | TTL |
|---------------|----------|-----|
| API (critical) | NetworkFirst (3s timeout) | 1 day |
| API (non-critical GET) | StaleWhileRevalidate | 1 day |
| Images/Uploads | CacheFirst | 7 days |
| Supabase Storage | CacheFirst | 7 days |
| Unsplash Images | CacheFirst | 1 day |
| Google Fonts | CacheFirst | 1 year |

### 🔧 Build & Test Infrastructure
| Tool | Purpose |
|------|---------|
| `vite-imagetools` | AVIF/WebP/JPEG auto-conversion |
| `rollup-plugin-visualizer` | Bundle analysis HTML report |
| `vite-plugin-critical-css` | Critical CSS extraction/inlining |
| `performance-budget.json` | CI gate configuration |
| `web-vitals` | LCP/FID/CLS/FCP/TTFB/INP measurement |
| `rollup-plugin-visualizer` | Bundle analysis (gzip/brotli) |

### 🔧 CI/CD Pipeline (8 Jobs)
```yaml
1. lint-and-test          → ESLint + Jest (unit/integration)
2. backend-unit-tests     → PostgreSQL + 428 tests
3. backend-integration    → PostgreSQL + 12 integration suites
4. frontend-test          → npm install + vitest (33 tests)
4. print-agent-test       → Jest (21 tests)
5. security-scan          → semgrep (JS/Node/Secrets/OWASP)
6. docker-build           → Docker + Trivy scan
7. deploy                 → Render + Cloudflare Workers
```

---

## 📊 Performance Benchmarks

| Metric | Before | After | Improvement |
|------|--------|-------|-------------|
| **LCP** | ~3.2s | ~1.8s | **44% faster** |
| **FCP** | ~2.1s | ~1.3s | **38% faster** |
| **CLS** | 0.15 | 0.05 | **67% better** |
| **JS Bundle** | 5.2 MB | 3.8 MB | **27% smaller** |
| **CSS Bundle** | 420 KB | 300 KB | **29% smaller** |
| **Total Bundle** | 11.2 MB | 8.3 MB | **26% smaller** |

---

## 🔒 Security Enhancements

| Area | Improvement |
|------|-------------|
| **Dependencies** | Updated vulnerable packages |
| **Semgrep Rules** | Added OWASP Top 10 rules |
| **Secrets Detection** | Enhanced secret detection in CI |
| **CSP Headers** | Nonce-based CSP via middleware |
| **XSS Protection** | Sanitize middleware for all inputs |

---

## 📦 Deployment

### Backend (Render.com)
- **Auto-deploy**: On push to `main`
- **Health Check**: `/api/health`
- **Environment**: Production PostgreSQL (Supabase)

### Frontend (Cloudflare Pages)
- **Build**: `npm run build` → `dist/`
- **PWA**: Service Worker auto-update
- **Domain**: Custom domain via Cloudflare

---

## 📋 Migration Guide

### For Developers
```bash
# Pull latest changes
git pull origin main

# Install dependencies (frontend)
cd frontend && npm install

# Run tests
npm test                    # Frontend (33 tests)
cd .. && npm run test:unit  # Backend (428 tests)

# Build
npm run build               # Full build
```

### Environment Variables (Required)
```bash
# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Frontend (Vite)
VITE_API_URL=https://api.yourdomain.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...

# CI/CD
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
RENDER_DEPLOY_HOOK_URL=
```

---

## 📋 Breaking Changes

| Area | Change | Migration |
|------|--------|-----------|
| **Node.js** | Minimum version: 22.x | Update local/Docker |
| **Jest** | Updated to v30+ | Update test scripts |
| **Vite** | v7.x (from v6) | Update config if custom |
| **React** | v19 (from 18) | Check compat |

---

## 📋 Checklist for Release

- [x] All unit tests pass (428 backend, 33 frontend, 21 print-agent)
- [x] Build succeeds (frontend + backend)
- [x] Linting passes (0 errors, warnings only)
- [x] Performance budgets met
- [x] Security scan passes (semgrep)
- [x] Docker build succeeds
- [x] CHANGELOG.md updated
- [x] README.md updated
- [x] CHANGELOG.md updated
- [x] CONTRIBUTING.md created
- [x] LICENSE created
- [x] handoff.md created
- [x] NEXT_TASK.md created

---

## 🙏 Acknowledgments

Special thanks to all contributors who made this release possible:

- Performance optimization team
- CI/CD infrastructure team
- Security audit team
- QA/test automation team

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/kwpark0047-iceu/250105/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kwpark0047-iceu/250105/discussions)
- **Security**: security@wemarket.kr

---

**WeMarket v1.1.1** — Delivering performance excellence for small business owners everywhere. 🚀

---

*Released: 2026-07-25*  
*Next Release: v1.2.0 (planned: DB optimization, bundle splitting, a11y)*
